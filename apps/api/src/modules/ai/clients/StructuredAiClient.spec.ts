import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { jsonSchema } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

import { AiCallError } from './AiClient.js';
import { resolveModel } from '../ai.config.js';
import { StructuredAiClient } from './StructuredAiClient.js';
import { validateEnv } from '../../../config/Env.validation.js';

/**
 * A call the generation's time budget ended is not a provider failing: the
 * log says `timeout`, so an operator reads "the model was slow", not "the key
 * or the quota" (`0050`).
 */
describe('StructuredAiClient', () => {
  it('reports a call cut by its time budget as a timeout', async () => {
    // A model that never answers; only the signal ends the call.
    const model = new MockLanguageModelV4({
      doGenerate: async ({ abortSignal }) =>
        new Promise<never>((_resolve, reject) => {
          abortSignal?.addEventListener('abort', () => reject(abortSignal.reason));
        })
    });
    const client = new StructuredAiClient(model, { maxRetries: 0, sessionHeader: null }, []);
    const failure = await client
      .generate({ prompt: 'Diseña platos', schema: jsonSchema({ type: 'object' }), signal: AbortSignal.timeout(20), system: 'Chef' })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AiCallError);
    expect((failure as AiCallError).failure).toMatchObject({ kind: 'timeout', status: null });
  });

  /**
   * What happened on the platform: the signal fired and the request ran on
   * until the function was killed. Here the model never answers and never
   * listens to the signal — the budget still ends the call.
   */
  it('ends a call whose transport ignores the abort, instead of waiting on it', async () => {
    const model = new MockLanguageModelV4({ doGenerate: async () => new Promise<never>(() => undefined) });
    const client = new StructuredAiClient(model, { maxRetries: 0, sessionHeader: null }, []);
    const started = Date.now();
    const failure = await client
      .generate({ prompt: 'Diseña platos', schema: jsonSchema({ type: 'object' }), signal: AbortSignal.timeout(20), system: 'Chef' })
      .catch((error: unknown) => error);

    expect(Date.now() - started).toBeLessThan(2000);
    expect(failure).toBeInstanceOf(AiCallError);
    expect((failure as AiCallError).failure).toMatchObject({ kind: 'timeout' });
  });

  /**
   * The thrown message is logged and stored on the job row, where an admin
   * reads it back. A gateway key has no shape the redaction patterns know, so
   * the configured credential is what has to be matched.
   */
  it('keeps the configured credential out of the failure it logs and stores', async () => {
    const key = ['4d1f8b', '2e07ac', '93b5d6', 'f0a284'].join('');
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error(`401 Unauthorized: key ${key} is not allowed on this model`);
      }
    });
    const client = new StructuredAiClient(model, { maxRetries: 0, sessionHeader: null }, [key]);
    const failure = await client
      .generate({ prompt: 'Diseña platos', schema: jsonSchema({ type: 'object' }), system: 'Chef' })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AiCallError);
    expect((failure as AiCallError).message).not.toContain(key);
    expect((failure as AiCallError).message).toContain('[redacted]');
  });
});

/**
 * OpenRouter says who answered and what it cost in the answer's body, not in
 * headers (`0064`): the call log and `/admin` read it from there — through
 * the real provider, so what is tested is what the SDK hands back.
 */
describe('StructuredAiClient on OpenRouter', () => {
  const env = validateEnv({
    AI_FALLBACK_MODELS: 'minimax/minimax-m3',
    AI_PROVIDER: 'openrouter',
    APP_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://user:pass@host/db',
    OPENROUTER_API_KEY: 'test-openrouter-key'
  });
  const client = () => new StructuredAiClient(resolveModel(env), { maxRetries: 0, sessionHeader: null }, []);
  const request = { prompt: 'Diseña platos', schema: jsonSchema<{ dishes: unknown[] }>({ type: 'object' }), session: 'job-1', system: 'Chef' };
  const answer = (status: number, body: unknown) =>
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status }));

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records the model that answered — the fallback, here — its provider and its cost', async () => {
    const fetch = answer(200, {
      id: 'gen-1790000000-abc',
      choices: [{ finish_reason: 'stop', index: 0, message: { content: '{"dishes":[]}', role: 'assistant' } }],
      created: 1_790_000_000,
      model: 'minimax/minimax-m3',
      provider: 'Novita',
      usage: { completion_tokens: 900, completion_tokens_details: { reasoning_tokens: 300 }, cost: 0.0021, prompt_tokens: 4100, total_tokens: 5000 }
    });
    const response = await client().generate(request);

    expect(response.call).toMatchObject({
      answeredModel: 'minimax/minimax-m3',
      gateway: { costUsd: 0.0021, model: 'minimax/minimax-m3', provider: 'Novita', requestId: 'gen-1790000000-abc' },
      reasoningTokens: 300
    });
    // No session header: OpenRouter is not sent our job id.
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).has('x-omniroute-session')).toBe(false);
  });

  it('records a refusal with its status and the provider that refused it', async () => {
    answer(429, {
      error: { code: 429, message: 'Provider returned error', metadata: { provider_name: 'DeepInfra', raw: 'rate limited: Diseña platos' } }
    });
    const failure = await client()
      .generate(request)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AiCallError);
    expect((failure as AiCallError).failure).toMatchObject({ gateway: { costUsd: null, provider: 'DeepInfra' }, kind: 'provider', status: 429 });
    // The message is logged and stored on the job row: OpenRouter's words and the provider's name, never `raw`.
    expect((failure as AiCallError).message).toContain('Provider returned error');
    expect((failure as AiCallError).message).toContain('DeepInfra');
    expect((failure as AiCallError).message).not.toContain('Diseña platos');
  });
});
