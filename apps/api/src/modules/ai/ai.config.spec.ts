import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { generateObject, jsonSchema } from 'ai';

import { NO_TRAINING_PROVIDER, nonStrictSchema, openRouterRequest, resolveCallSettings, resolveModel } from './ai.config.js';
import { validateEnv } from '../../config/Env.validation.js';

import type { Env } from '../../config/index.js';
import type { LanguageModel } from 'ai';

/**
 * The OmniRoute provider sends `wirePoolSchema` as a `json_schema` response
 * format with `strict: false`. Strict mode made a model behind the gateway
 * reject every generation request with a 400, because the wire schema cannot
 * carry `additionalProperties: false` (Gemini rejects that keyword).
 */
describe('nonStrictSchema', () => {
  it('turns a strict json_schema response format non-strict, and keeps the schema itself', () => {
    const schema = { properties: { dishes: { type: 'array' } }, required: ['dishes'], type: 'object' };
    const body = { model: 'NutrIA-Fallback', response_format: { json_schema: { name: 'response', schema, strict: true }, type: 'json_schema' } };

    expect(nonStrictSchema(body)).toEqual({
      model: 'NutrIA-Fallback',
      response_format: { json_schema: { name: 'response', schema, strict: false }, type: 'json_schema' }
    });
  });

  it('leaves every other body exactly as it came', () => {
    const jsonObject = { model: 'm', response_format: { type: 'json_object' } };
    const plain = { model: 'm' };

    expect(nonStrictSchema(jsonObject)).toBe(jsonObject);
    expect(nonStrictSchema(plain)).toBe(plain);
  });
});

/**
 * A gateway moves a failed call to its next model itself. The SDK repeating the
 * call on top of that repeated the gateway's whole wait: one slot held for nine
 * minutes over three tries before the pool builder heard of the failure.
 */
describe('resolveCallSettings', () => {
  it('leaves retrying to the gateway, and files each call under a session there', () => {
    expect(resolveCallSettings({ AI_PROVIDER: 'omniroute' } as Env)).toEqual({ maxRetries: 0, sessionHeader: 'x-omniroute-session' });
  });

  it('leaves retrying to OpenRouter’s own fallback list, and sends it none of our ids (0064)', () => {
    expect(resolveCallSettings({ AI_PROVIDER: 'openrouter' } as Env)).toEqual({ maxRetries: 0, sessionHeader: null });
  });

  it('keeps the SDK’s default for a provider nothing else retries for, and sends it none of our ids', () => {
    for (const provider of ['google', 'anthropic', 'ollama'] as const) {
      expect(resolveCallSettings({ AI_PROVIDER: provider } as Env)).toEqual({ maxRetries: 2, sessionHeader: null });
    }
  });
});

/**
 * The no-training rule's third layer (`0064` § 3): every request to OpenRouter
 * goes only to endpoints that retain nothing and collect nothing, whatever a
 * caller asked for, and says which models may answer and how hard they think.
 */
describe('openRouterRequest', () => {
  const body = {
    messages: [{ content: 'Diseña platos', role: 'user' }],
    model: 'deepseek/deepseek-v4.1-flash',
    response_format: { json_schema: { name: 'response', schema: { type: 'object' }, strict: true }, type: 'json_schema' }
  };

  it('sends a request only to endpoints that neither retain nor collect it, asks for its cost, and keeps the schema non-strict', () => {
    const sent = openRouterRequest({ fallbackModels: [] })(body);

    expect(sent['provider']).toEqual({ data_collection: 'deny', require_parameters: true, zdr: true });
    expect(sent['usage']).toEqual({ include: true });
    expect(sent['response_format']).toEqual({ json_schema: { name: 'response', schema: { type: 'object' }, strict: false }, type: 'json_schema' });
    expect(sent['messages']).toBe(body.messages);
  });

  it('writes the provider block over any a caller set, never merging with it', () => {
    const asked = { ...body, provider: { data_collection: 'allow', only: ['somewhere'], zdr: false } };

    expect(openRouterRequest({ fallbackModels: [] })(asked)['provider']).toBe(NO_TRAINING_PROVIDER);
  });

  it('lists the asked model first and the fallbacks after it, each once', () => {
    const send = openRouterRequest({ fallbackModels: ['minimax/minimax-m3', 'deepseek/deepseek-v4.1-flash'] });

    expect(send(body)['models']).toEqual(['deepseek/deepseek-v4.1-flash', 'minimax/minimax-m3']);
    expect(openRouterRequest({ fallbackModels: [] })(body)['models']).toEqual(['deepseek/deepseek-v4.1-flash']);
  });

  it('spells the reasoning effort as OpenRouter does, switches it off for none, and leaves the model’s default when unset', () => {
    expect(openRouterRequest({ fallbackModels: [], reasoningEffort: 'low' })(body)['reasoning']).toEqual({ effort: 'low' });
    expect(openRouterRequest({ fallbackModels: [], reasoningEffort: 'none' })(body)['reasoning']).toEqual({ enabled: false });
    expect(openRouterRequest({ fallbackModels: [] })(body)).not.toHaveProperty('reasoning');
  });

  it('caps the thinking in tokens when asked, over any effort, but none still switches it off', () => {
    expect(openRouterRequest({ fallbackModels: [], reasoningMaxTokens: 2048 })(body)['reasoning']).toEqual({ max_tokens: 2048 });
    expect(openRouterRequest({ fallbackModels: [], reasoningEffort: 'high', reasoningMaxTokens: 2048 })(body)['reasoning']).toEqual({
      max_tokens: 2048
    });
    expect(openRouterRequest({ fallbackModels: [], reasoningEffort: 'none', reasoningMaxTokens: 2048 })(body)['reasoning']).toEqual({
      enabled: false
    });
  });

  it('adds the endpoint order when set, and keeps every no-training field beside it', () => {
    const asked = { ...body, provider: { data_collection: 'allow', require_parameters: false, zdr: false } };

    expect(openRouterRequest({ fallbackModels: [], providerSort: 'throughput' })(asked)['provider']).toEqual({
      data_collection: 'deny',
      require_parameters: true,
      sort: 'throughput',
      zdr: true
    });
    expect(openRouterRequest({ fallbackModels: [] })(body)['provider']).not.toHaveProperty('sort');
  });
});

/** The same, on the wire: what the SDK actually posts, with a call that tries to loosen it. */
describe('the openrouter provider', () => {
  const base = {
    AI_PROVIDER: 'openrouter',
    APP_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://user:pass@host/db',
    OPENROUTER_API_KEY: 'test-openrouter-key'
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the provider block, the fallback list and the reasoning to OpenRouter, whatever the call’s own options say', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'gen-1',
            choices: [{ finish_reason: 'stop', index: 0, message: { content: '{"dishes":[]}', role: 'assistant' } }],
            created: 1_790_000_000,
            model: 'deepseek/deepseek-v4.1-flash',
            provider: 'DeepInfra',
            usage: { completion_tokens: 10, cost: 0.0123, prompt_tokens: 20, total_tokens: 30 }
          }),
          { headers: { 'content-type': 'application/json' }, status: 200 }
        )
      );
    const env = validateEnv({ ...base, AI_FALLBACK_MODELS: 'minimax/minimax-m3', AI_REASONING_EFFORT: 'low' });

    await generateObject({
      model: resolveModel(env) as LanguageModel,
      prompt: 'Diseña platos',
      // What a caller — or a later change — might try: an endpoint that keeps data, and models of its own.
      providerOptions: { openrouter: { models: ['somebody/free-model:free'], provider: { data_collection: 'allow', zdr: false } } },
      schema: jsonSchema<{ dishes: unknown[] }>({ properties: { dishes: { type: 'array' } }, type: 'object' })
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;

    expect(String(url)).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(sent).toMatchObject({
      model: 'deepseek/deepseek-v4.1-flash',
      models: ['deepseek/deepseek-v4.1-flash', 'minimax/minimax-m3'],
      provider: { data_collection: 'deny', require_parameters: true, zdr: true },
      reasoning: { effort: 'low' },
      response_format: { json_schema: { strict: false }, type: 'json_schema' },
      usage: { include: true }
    });
  });

  /*
   * Boot refuses a leftover gateway URL; an `Env` that skipped boot — built by
   * hand, as a spec or a script would — is refused where the key is handed over.
   */
  it('never hands the key to a host that is not OpenRouter, even with an Env that skipped validation', () => {
    const env = validateEnv(base);

    expect(() => resolveModel({ ...env, AI_BASE_URL: 'http://localhost:20128/v1' })).toThrow(/AI_BASE_URL/);
    expect(() => resolveModel({ ...env, AI_BASE_URL: 'https://openrouter.ai/api/v1' })).not.toThrow();
  });
});
