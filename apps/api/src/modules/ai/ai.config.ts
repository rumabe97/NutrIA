import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOllama } from 'ollama-ai-provider-v2';

import { isOpenRouterUrl } from '../../config/Env.validation.js';

import type { Env } from '../../config/index.js';
import type { ImageModel, LanguageModel } from 'ai';

export const AI_MODEL = Symbol('AI_MODEL');
export const AI_IMAGE_MODEL = Symbol('AI_IMAGE_MODEL');
export const AI_CALL_SETTINGS = Symbol('AI_CALL_SETTINGS');

/** The configured provider credentials, scrubbed from anything an upstream echoes back — `providerCredentials`. */
export const AI_SECRETS = Symbol('AI_SECRETS');

/** How long the model half of a pool build may take in all, in milliseconds — `AI_BUDGET_SECONDS`. */
export const AI_MODEL_BUDGET = Symbol('AI_MODEL_BUDGET');

/** How many tokens a pool request may write, or null for no cap — `resolveOutputCap`. */
export const AI_OUTPUT_CAP = Symbol('AI_OUTPUT_CAP');

/** A pool request's output cap: `perDish` times the dishes it asks for, plus `margin`. */
export type AiOutputCap = { readonly margin: number; readonly perDish: number };

/** `AI_MAX_OUTPUT_TOKENS_PER_DISH` when it is empty. */
const DEFAULT_OUTPUT_TOKENS_PER_DISH = 1200;

/** The `{ "dishes": [ … ] }` around the dishes, and room for a long one. */
const OUTPUT_TOKEN_MARGIN = 800;

/**
 * The cap on what one pool request may write, for OpenRouter alone.
 *
 * A model asked for three dishes once sent back fifteen — 45 for ~24 asked
 * over a fortnight — and a request writes at a fixed rate, so it ran into the
 * 170-second budget and took its slot's dishes with it. Capped, such an answer
 * is cut off, fails the schema and is recorded as `invalid_output`, which
 * costs only that request's dishes (`PoolBuilder`).
 *
 * Null for every other provider: a gateway's combo and Gemini's free tier
 * route to models this was never measured on, some of which think inside the
 * same allowance. Null too when OpenRouter's model may think with no cap on
 * the thinking (`AI_REASONING_EFFORT` other than `none`, and no
 * `AI_REASONING_MAX_TOKENS`): the thinking counts against the same tokens, and
 * an unknown amount of it would cut valid answers short. With a thinking cap,
 * the cap is added to the margin.
 */
export function resolveOutputCap(env: Env): AiOutputCap | null {
  if (env.AI_PROVIDER !== 'openrouter') {
    return null;
  }

  const thinking = env.AI_REASONING_EFFORT === 'none' ? 0 : env.AI_REASONING_MAX_TOKENS;

  if (thinking === undefined) {
    return null;
  }

  return { margin: OUTPUT_TOKEN_MARGIN + thinking, perDish: env.AI_MAX_OUTPUT_TOKENS_PER_DISH ?? DEFAULT_OUTPUT_TOKENS_PER_DISH };
}

/** The client the rewrite sweep asks — see `resolveRewriteModel`. */
export const AI_REWRITE_CLIENT = Symbol('AI_REWRITE_CLIENT');

/**
 * The model the rewrite sweep asks: `AI_REWRITE_MODEL` where it is set, and
 * the generation's model otherwise.
 *
 * Its own because the sweep is background work with no one waiting on it, and
 * the generation combo ends in the one step whose quota is precious — Gemini,
 * twenty requests a day. Pointed at a combo without that step, a sweep can
 * never be what spends a plan's calls.
 */
export function resolveRewriteModel(env: Env): LanguageModel | null {
  return resolveModel(env.AI_REWRITE_MODEL ? { ...env, AI_MODEL: env.AI_REWRITE_MODEL } : env);
}

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

    case 'openrouter':
      // OpenRouter, called directly (`0064`): paid models that never train on
      // what is sent, with OpenRouter's own model fallback in place of a
      // gateway's combo. The same OpenAI-compatible wire as the gateway — the
      // non-strict `json_schema` included — and every request carries the
      // no-training `provider` block, which `openRouterRequest` writes over the
      // finished body so nothing a caller sets can take it off.
      return createOpenAICompatible({
        apiKey: required(env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY'),
        baseURL: openRouterBaseUrl(env.AI_BASE_URL),
        name: 'openrouter',
        supportsStructuredOutputs: true,
        transformRequestBody: openRouterRequest({
          fallbackModels: env.AI_FALLBACK_MODELS ?? [],
          providerIgnore: env.AI_PROVIDER_IGNORE ?? [],
          providerSort: env.AI_PROVIDER_SORT,
          reasoningEffort: env.AI_REASONING_EFFORT,
          reasoningMaxTokens: env.AI_REASONING_MAX_TOKENS
        })
      })(env.AI_MODEL);

    case 'stub':
      return null;
  }
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Where the OpenRouter key and every request go: OpenRouter's API, or another
 * path on its origin when `AI_BASE_URL` names one. Boot already refuses any
 * other host (`Env.validation.ts`); this refuses it again where the key is
 * handed over, so an `Env` that did not come through `validateEnv` cannot
 * send it to a leftover gateway either.
 */
function openRouterBaseUrl(configured: string | undefined): string {
  if (!configured) {
    return OPENROUTER_BASE_URL;
  }

  if (!isOpenRouterUrl(configured)) {
    throw new Error('AI_BASE_URL must be empty or on https://openrouter.ai when AI_PROVIDER is "openrouter"');
  }

  return configured;
}

/**
 * Where OpenRouter may send a request: only to an endpoint that retains
 * nothing (`zdr`) and does not collect what it is sent (`data_collection:
 * 'deny'`) — the owner's rule that no provider trains on or reuses NutrIA's
 * data (`0064` § 3, the third of its three layers). `require_parameters`
 * keeps a request off an endpoint that would silently drop its
 * `response_format` or its `reasoning`; it is how every model in `0064`'s
 * table was measured (`scripts/bench-models.mjs`).
 *
 * Frozen and written over whatever a body carries, never merged with it.
 *
 * @knipignore Exported for its spec, which checks every request carries it.
 */
export const NO_TRAINING_PROVIDER = Object.freeze({ data_collection: 'deny', require_parameters: true, zdr: true } as const);

/**
 * The body OpenRouter is sent, from the body the SDK built: the schema
 * non-strict, then OpenRouter's own fields.
 *
 * - `models`: the asked model, then `AI_FALLBACK_MODELS` — OpenRouter tries
 *   the next when one is down, rate-limited or refuses, inside the same
 *   request. It is what the gateway's combo did, and why the SDK retries
 *   nothing here (`resolveCallSettings`).
 * - `reasoning`: `AI_REASONING_EFFORT` as OpenRouter spells it — `none`
 *   switches thinking off, which measured seven seconds a request and nine
 *   points of split error against 1.5 at `low` (`0064`); unset leaves the
 *   model's default. `AI_REASONING_MAX_TOKENS` caps the thinking in tokens
 *   instead (`{ max_tokens }`): when both are set the cap wins and the effort
 *   is ignored, since OpenRouter takes one or the other. `none` still wins
 *   over both — off is off.
 * - `usage.include`: the answer carries its cost, which the call log keeps
 *   (`readOpenRouter`).
 * - `provider`: `NO_TRAINING_PROVIDER`, plus `sort` when `AI_PROVIDER_SORT`
 *   is set — OpenRouter's load-balancing otherwise spread parallel requests
 *   onto slow ZDR endpoints (~120 s against ~37 s on the fastest) — and
 *   `ignore` when `AI_PROVIDER_IGNORE` names any, for one ZDR provider
 *   (Sail Research) that kept running into the time budget. The
 *   no-training fields are spread last, so neither can ever loosen them.
 *   The block is written over the body. This transform
 *   is the last thing the SDK runs before it posts: it has already merged a
 *   call's `providerOptions` into the body, so a caller's `provider` — or a
 *   later change that adds one — is replaced here, not kept. `models`,
 *   `reasoning` and `usage` are written over it the same way.
 *
 * @knipignore Exported for its spec; the provider above is its only caller.
 */
export function openRouterRequest(options: {
  readonly fallbackModels: readonly string[];
  readonly providerIgnore?: readonly string[];
  readonly providerSort?: Env['AI_PROVIDER_SORT'];
  readonly reasoningEffort?: Env['AI_REASONING_EFFORT'];
  readonly reasoningMaxTokens?: Env['AI_REASONING_MAX_TOKENS'];
}): (body: Record<string, unknown>) => Record<string, unknown> {
  const reasoning =
    options.reasoningEffort === 'none'
      ? { enabled: false }
      : options.reasoningMaxTokens !== undefined
        ? { max_tokens: options.reasoningMaxTokens }
        : options.reasoningEffort === undefined
          ? undefined
          : { effort: options.reasoningEffort };
  const ignore = options.providerIgnore ?? [];
  const provider =
    ignore.length === 0 && options.providerSort === undefined
      ? NO_TRAINING_PROVIDER
      : Object.freeze({
          ...(ignore.length > 0 ? { ignore: Object.freeze([...ignore]) } : {}),
          ...(options.providerSort === undefined ? {} : { sort: options.providerSort }),
          ...NO_TRAINING_PROVIDER
        });

  return body => {
    const asked = typeof body['model'] === 'string' ? body['model'] : null;
    const models = asked === null ? [...options.fallbackModels] : [asked, ...options.fallbackModels.filter(model => model !== asked)];

    return { ...nonStrictSchema(body), models, ...(reasoning ? { reasoning } : {}), provider, usage: { include: true } };
  };
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
 * @knipignore Exported for its spec; the providers above are its only callers.
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
 * **None on OpenRouter either** (`0064`), for the same reason: its `models`
 * list moves a refused or failed request to the fallback model itself, and a
 * failed request's slot is asked again by the pool builder's next round, or
 * covered from the library. A retry here would pay twice for the same wait.
 *
 * **A session header behind a gateway**, so its own log files a generation's
 * calls together under the job id; OmniRoute answers with the session it used,
 * "ext:<job>". A direct provider is not sent our ids — OpenRouter included:
 * its own id for each call (`gen-…`) comes back in the answer and is what the
 * call log keeps.
 */
export function resolveCallSettings(env: Env): AiCallSettings {
  switch (env.AI_PROVIDER) {
    case 'omniroute':
      return { maxRetries: 0, sessionHeader: 'x-omniroute-session' };

    case 'openrouter':
      return { maxRetries: 0, sessionHeader: null };

    default:
      return { maxRetries: 2, sessionHeader: null };
  }
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
