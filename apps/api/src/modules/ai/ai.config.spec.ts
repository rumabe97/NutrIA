import { describe, expect, it } from '@jest/globals';

import { nonStrictSchema, resolveMaxRetries } from './ai.config.js';

import type { Env } from '../../config/index.js';

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
describe('resolveMaxRetries', () => {
  it('leaves retrying to the gateway', () => {
    expect(resolveMaxRetries({ AI_PROVIDER: 'omniroute' } as Env)).toBe(0);
  });

  it('keeps the SDK’s default for a provider nothing else retries for', () => {
    expect(resolveMaxRetries({ AI_PROVIDER: 'google' } as Env)).toBe(2);
    expect(resolveMaxRetries({ AI_PROVIDER: 'anthropic' } as Env)).toBe(2);
  });
});
