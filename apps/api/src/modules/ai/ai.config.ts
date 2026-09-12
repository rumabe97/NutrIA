import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOllama } from 'ollama-ai-provider-v2';

import type { Env } from '../../config/index.js';
import type { ImageModel, LanguageModel } from 'ai';

export const AI_MODEL = Symbol('AI_MODEL');
export const AI_IMAGE_MODEL = Symbol('AI_IMAGE_MODEL');
export const AI_CALL_SETTINGS = Symbol('AI_CALL_SETTINGS');

/** How each call is made, which depends on who is on the other end. */
export type AiCallSettings = {
  /** How many times the SDK repeats a failed call before the caller hears of it. */
  readonly maxRetries: number;
  /** The header a gateway files a call's session under. Null for a direct provider, which is sent none. */
  readonly sessionHeader: string | null;
};

/**
 * Resolves the configured provider to a model.
 *
 * The only place a vendor SDK is named. Feature code depends on `AiClient`, so
 * switching provider is an environment change rather than a code change — which is
 * what makes running on a free tier, a local model, or a paid account the same
 * decision made three different ways.
 * See [`0006`](../../../../docs/decisions/0006-reuse-before-generating.md).
 *
 * `stub` returns null: the pool builder then makes no call at all. That is not a
 * test affordance, it is how the product runs with no account and no spend while
 * reuse covers demand.
 */
export function resolveModel(env: Env): LanguageModel | null {
  switch (env.AI_PROVIDER) {
    case 'anthropic':
      return createAnthropic({ apiKey: required(env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY') })(env.AI_MODEL);

    case 'google':
      return createGoogleGenerativeAI({ apiKey: required(env.GOOGLE_API_KEY, 'GOOGLE_API_KEY') })(env.AI_MODEL);

    case 'ollama':
      // Local, so no key. `AI_BASE_URL` points at the daemon.
      return createOllama({ baseURL: env.AI_BASE_URL ?? 'http://localhost:11434/api' })(env.AI_MODEL);

    case 'omniroute':
      // An OpenAI-compatible gateway (e.g. OmniRoute) that holds the vendor keys
      // and routes by model name — `OMNIROUTE_MODEL`, resolved into `AI_MODEL`.
      // Which account a call spends against is the gateway's routing, not this
      // code's. `name` only labels the provider in telemetry the SDK emits; it
      // never reaches the gateway or changes the request.
      //
      // `supportsStructuredOutputs: true` is load-bearing, not cosmetic. Without
      // it the SDK asks for the loose `{ type: 'json_object' }` mode — "return
      // JSON", no shape — and a real model answered in prose, then another in
      // JSON of another shape (which `PoolBuilder` now reports instead of
      // crashing on). With it, the exact `wirePoolSchema` travels as a
      // `json_schema` response format — sent non-strict: see `nonStrictSchema`.
      return createOpenAICompatible({
        apiKey: required(env.OMNIROUTE_API_KEY, 'OMNIROUTE_API_KEY'),
        baseURL: env.AI_BASE_URL ?? 'http://localhost:20128/v1',
        name: 'omniroute',
        supportsStructuredOutputs: true,
        transformRequestBody: nonStrictSchema
      })(env.AI_MODEL);

    case 'stub':
      return null;
  }
}

/**
 * The body a gateway is sent, with a `json_schema` response format's `strict`
 * flag off; every other body is returned as it came.
 *
 * Strict mode is OpenAI's contract, and some models behind a gateway enforce
 * it to the letter: every object must carry `additionalProperties: false` and
 * list every property as required. `wirePoolSchema` cannot carry the first —
 * Gemini rejects the keyword outright, which is why the wire schema is
 * hand-written — so a strict request fails at the door on those models
 * (`muse-spark` answered 400 in under a second). Non-strict still sends the
 * whole shape as guidance; the guarantee was never the wire schema but
 * `generatedDishSchema` and `PoolBuilder`'s gates downstream. Measured on the
 * same prompt: strict, 400; non-strict, two valid dishes.
 *
 * @knipignore Exported for its spec; the provider below is its only caller.
 */
export function nonStrictSchema(body: Record<string, unknown>): Record<string, unknown> {
  const format = body['response_format'] as { json_schema?: Record<string, unknown>; type?: string } | undefined;

  if (format?.type !== 'json_schema' || !format.json_schema) {
    return body;
  }

  return { ...body, response_format: { ...format, json_schema: { ...format.json_schema, strict: false } } };
}

/**
 * How calls are made, per provider.
 *
 * **No SDK retries behind a gateway**, because the gateway already retries,
 * and better: it moves a failed call to the next model of its combo instead of
 * asking the one that just failed again. Repeating the request after the
 * gateway gave up repeats its whole wait — a model that hung to OmniRoute's
 * 180 s limit held one slot for nine minutes over three tries, before
 * `PoolBuilder` could reach for the library. Every other provider keeps the
 * SDK's own default of two: nothing else retries for them.
 *
 * **A session header behind a gateway**, so its own log files a generation's
 * calls together under the job id; OmniRoute answers with the session it used,
 * "ext:<job>". A direct provider is not sent our ids.
 */
export function resolveCallSettings(env: Env): AiCallSettings {
  return env.AI_PROVIDER === 'omniroute' ? { maxRetries: 0, sessionHeader: 'x-omniroute-session' } : { maxRetries: 2, sessionHeader: null };
}

function required(value: string | undefined, name: string): string {
  // Env validation enforces this at boot; this guards the case where a provider is
  // switched at runtime in a test.
  if (!value) {
    throw new Error(`${name} is required when AI_PROVIDER selects it`);
  }

  return value;
}

/**
 * Which model draws illustrations, given who is generating dishes.
 *
 * Null unless `AI_ILLUSTRATIONS=true` *and* the provider has an image model:
 * only Google does here, and only with billing — its free tier allows zero image
 * calls, which is why this is a switch the owner throws rather than a default.
 * Anthropic and Ollama generate no images; Google's `AI_MODEL` names its text
 * model, so the image model is fixed rather than read from it (0010).
 */
export function resolveImageModel(env: Env): ImageModel | null {
  if (!env.AI_ILLUSTRATIONS || env.AI_PROVIDER !== 'google') {
    return null;
  }

  return createGoogleGenerativeAI({ apiKey: required(env.GOOGLE_API_KEY, 'GOOGLE_API_KEY') }).image('gemini-2.5-flash-image');
}
