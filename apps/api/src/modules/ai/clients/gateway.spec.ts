import { describe, expect, it } from '@jest/globals';

import { readGateway, readOpenRouter, readQuota, withoutEcho } from './gateway.js';

/** Captured from a real call to OmniRoute 3.8 through the `NutrIA-Fallback` combo. */
const OMNIROUTE_HEADERS = {
  'content-type': 'application/json',
  'x-conversationid': 'conv_95acd2cf',
  'x-correlation-id': 'b81f0485-dab0-40ad-b20c-7739d18e216e',
  'x-omniroute-cache': 'MISS',
  'x-omniroute-cache-hit': 'false',
  'x-omniroute-combo-trace': 'combo-74b8eac9',
  'x-omniroute-compression': 'off; source=off',
  'x-omniroute-decision': 'strategy=priority; provider=opencode-zen; latency_ms=1336',
  'x-omniroute-latency-ms': '1336',
  'x-omniroute-model': 'muse-spark-1.2-contributor-free',
  'x-omniroute-provider': 'opencode-zen',
  'x-omniroute-request-id': '9234a272-a142-4a7d-9d47-f200b9ed4285',
  'x-omniroute-response-cost': '0.0000000000',
  'x-omniroute-session-id': 'ext:job-1',
  'x-omniroute-version': '3.8.50',
  'x-request-id': 'b21daee5'
};

/** Captured from a real 429 from the Gemini API, as the gateway logged it. */
const GEMINI_QUOTA =
  '[429]: You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.\n' +
  '* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash\n' +
  'Please retry in 25.222948128s.';

describe('readGateway', () => {
  it('reads who answered a combo, how long, what it cost and where its dashboard files it', () => {
    expect(readGateway(OMNIROUTE_HEADERS)).toEqual({
      cache: 'MISS',
      comboTrace: 'combo-74b8eac9',
      correlationId: 'b81f0485-dab0-40ad-b20c-7739d18e216e',
      costUsd: 0,
      latencyMs: 1336,
      model: 'muse-spark-1.2-contributor-free',
      provider: 'opencode-zen',
      requestId: '9234a272-a142-4a7d-9d47-f200b9ed4285',
      session: 'ext:job-1',
      strategy: 'priority',
      version: '3.8.50'
    });
  });

  it('is null for a call that did not go through a gateway', () => {
    expect(readGateway({ 'content-type': 'application/json', 'x-request-id': 'abc' })).toBeNull();
    expect(readGateway(undefined)).toBeNull();
  });

  it('matches header names whatever their case', () => {
    expect(readGateway({ 'X-OmniRoute-Model': 'gemini-3.6-flash' })?.model).toBe('gemini-3.6-flash');
  });
});

/** OpenRouter's answer, in the shape `bench-models.mjs` recorded on 2026-09-26 (`0064`). */
const OPENROUTER_ANSWER = {
  id: 'gen-1790000000-abc',
  choices: [{ finish_reason: 'stop', index: 0, message: { content: '{"dishes":[]}', role: 'assistant' } }],
  created: 1_790_000_000,
  model: 'deepseek/deepseek-v4.1-flash',
  object: 'chat.completion',
  provider: 'DeepInfra',
  usage: { completion_tokens: 2200, cost: 0.0118, prompt_tokens: 4100, total_tokens: 6300 }
};

describe('readOpenRouter', () => {
  it('reads who answered, whose endpoint served it, what it cost and its id, from the body', () => {
    expect(readOpenRouter(OPENROUTER_ANSWER)).toEqual({
      cache: null,
      comboTrace: null,
      correlationId: null,
      costUsd: 0.0118,
      latencyMs: null,
      model: 'deepseek/deepseek-v4.1-flash',
      provider: 'DeepInfra',
      requestId: 'gen-1790000000-abc',
      session: null,
      strategy: null,
      version: null
    });
  });

  it('reads the provider that refused a call, and only that, from the refusal body as the SDK keeps it — a string', () => {
    const refusal = JSON.stringify({
      error: { code: 429, message: 'Provider returned error', metadata: { provider_name: 'DeepInfra', raw: 'the request, echoed' } }
    });

    expect(readOpenRouter(refusal)).toMatchObject({ costUsd: null, model: null, provider: 'DeepInfra' });
    expect(JSON.stringify(readOpenRouter(refusal))).not.toContain('echoed');
  });

  it('is null for every other provider’s body, a refusal with no provider named, and anything that is not JSON', () => {
    expect(readOpenRouter({ id: 'chatcmpl-1', choices: [], model: 'gpt', usage: { prompt_tokens: 1 } })).toBeNull();
    expect(readOpenRouter({ candidates: [], usageMetadata: { promptTokenCount: 1 } })).toBeNull();
    expect(readOpenRouter('{"error":{"code":401,"message":"No auth credentials found"}}')).toBeNull();
    expect(readOpenRouter('Bad gateway')).toBeNull();
    expect(readOpenRouter(undefined)).toBeNull();
  });
});

describe('readQuota', () => {
  it('reads the allowance Google writes into a refusal, and how long to wait', () => {
    expect(readQuota(GEMINI_QUOTA)).toEqual({
      limit: 20,
      metric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
      model: 'gemini-3.6-flash',
      retryAfterSeconds: 26
    });
  });

  it('is null for a failure that is not about quota', () => {
    expect(readQuota('API key not valid. Please pass a valid API key.')).toBeNull();
    expect(readQuota('[504]: Request exceeded the local rate-limit execution expiration')).toBeNull();
  });
});

/** What a refusal leaves in the log and on the job row: never the request a provider echoed (`0064`). */
describe('withoutEcho', () => {
  it('keeps OpenRouter’s message and the provider’s name, and drops everything else under metadata', () => {
    const refusal = JSON.stringify({
      error: {
        code: 429,
        message: 'Provider returned error',
        metadata: { headers: { 'x-echo': 'the prompt' }, provider_name: 'DeepInfra', raw: 'the request, echoed' }
      }
    });

    expect(withoutEcho(refusal)).toBe('Provider returned error — provider: DeepInfra');
  });

  it('says OpenRouter refused when the refusal carries no message, and leaves out a provider it does not name', () => {
    expect(withoutEcho(JSON.stringify({ error: { code: 502, metadata: { raw: 'the request, echoed' } } }))).toBe('OpenRouter refused the request');
  });

  it('leaves every other body as it came — a refusal with no metadata, another provider’s, and anything that is not JSON', () => {
    const quota = JSON.stringify({
      error: { code: 429, message: 'Quota exceeded for metric: free_tier_requests, limit: 20', status: 'RESOURCE_EXHAUSTED' }
    });

    expect(withoutEcho(quota)).toBe(quota);
    expect(withoutEcho('Bad gateway')).toBe('Bad gateway');
    expect(withoutEcho('')).toBe('');
  });
});
