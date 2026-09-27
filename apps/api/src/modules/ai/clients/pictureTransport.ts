import { redactSecrets } from './redact.js';
import { withoutEcho } from './gateway.js';

/**
 * The one way a dish-picture request leaves this process (`0066`): to
 * OpenRouter's API, with a provider block that keeps nothing written over
 * whatever the body says.
 *
 * Both picture clients — the image model and the vision judge — post through
 * `OpenRouterPictures.post`, and it takes a `PinnedProvider`, which only
 * `pinnedProvider` can make. So a request with no provider block, or with one
 * that allows a fallback or an endpoint that trains on what it is sent, cannot
 * be written: the type will not take it, and the block goes on last. The
 * endpoint is fixed here, never read from the environment.
 */
export const OPENROUTER_API = 'https://openrouter.ai/api/v1';

/**
 * What every picture request asks of the endpoint that serves it: no other
 * provider if this one fails (`allow_fallbacks`), nothing kept (`zdr`), nothing
 * collected (`data_collection`) — the owner's no-training rule (`0064` § 3),
 * the same fields the text requests carry.
 */
export const NO_RETENTION = Object.freeze({ allow_fallbacks: false, data_collection: 'deny', zdr: true } as const);

declare const pinned: unique symbol;

/** A provider block made by `pinnedProvider` and nothing else. */
export type PinnedProvider = Readonly<typeof NO_RETENTION & { readonly only: readonly string[] }> & { readonly [pinned]: true };

/** The block for the companies named — `AI_IMAGE_PROVIDER_ONLY` or `AI_JUDGE_PROVIDER_ONLY` — frozen. */
export function pinnedProvider(only: readonly string[]): PinnedProvider {
  if (only.length === 0) {
    throw new Error('A picture request must name the providers that may serve it');
  }

  return Object.freeze({ only: Object.freeze([...only]), ...NO_RETENTION }) as PinnedProvider;
}

/** A picture call that failed: the status OpenRouter answered, or null when none came back. */
export class PictureCallError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    options?: { readonly cause?: unknown }
  ) {
    super(message, options);
    this.name = 'PictureCallError';
  }
}

export type OpenRouterAnswer = { readonly body: unknown; readonly headers: Headers };

export class OpenRouterPictures {
  private readonly fetch: typeof fetch;

  constructor(
    private readonly apiKey: string,
    private readonly secrets: readonly string[],
    fetchImpl: typeof fetch = globalThis.fetch
  ) {
    this.fetch = fetchImpl;
  }

  /** A model call. The provider block is written over the body, last. */
  post(
    path: '/chat/completions' | '/images',
    body: Readonly<Record<string, unknown>>,
    provider: PinnedProvider,
    signal?: AbortSignal
  ): Promise<OpenRouterAnswer> {
    return this.send(path, { body: JSON.stringify({ ...body, provider }), method: 'POST', signal });
  }

  /** A read of what a call cost — `/generation` — which reaches no model. */
  get(path: `/generation?id=${string}`, signal?: AbortSignal): Promise<OpenRouterAnswer> {
    return this.send(path, { method: 'GET', signal });
  }

  private async send(
    path: string,
    init: { readonly body?: string; readonly method: 'GET' | 'POST'; readonly signal?: AbortSignal }
  ): Promise<OpenRouterAnswer> {
    let response: Response;

    try {
      response = await this.fetch(`${OPENROUTER_API}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
    } catch (error: unknown) {
      throw new PictureCallError(
        this.redact(`OpenRouter ${path.split('?')[0]} failed: ${error instanceof Error ? error.message : 'unknown error'}`),
        null,
        { cause: error }
      );
    }

    const text = await response.text();

    if (!response.ok) {
      // `withoutEcho` drops what a provider's refusal quotes back — the prompt, or the picture.
      throw new PictureCallError(this.redact(`OpenRouter ${path.split('?')[0]} answered ${response.status}: ${withoutEcho(text)}`), response.status);
    }

    try {
      return { body: JSON.parse(text) as unknown, headers: response.headers };
    } catch (error: unknown) {
      throw new PictureCallError(`OpenRouter ${path.split('?')[0]} answered ${response.status} with no JSON`, response.status, { cause: error });
    }
  }

  private redact(message: string): string {
    return redactSecrets(message, [this.apiKey, ...this.secrets]);
  }
}

/** The dollars a call cost, when its answer says (`usage.cost`), or null. */
export function reportedCost(body: unknown): number | null {
  const usage = isRecord(body) && isRecord(body['usage']) ? body['usage'] : {};
  const cost = usage['cost'];

  return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null;
}

/** Whose endpoint served a call, from the answer or OpenRouter's header, or null. */
export function servedBy(answer: OpenRouterAnswer): string | null {
  const provider = isRecord(answer.body) ? answer.body['provider'] : undefined;

  return (typeof provider === 'string' && provider.trim() !== '' ? provider.trim() : null) ?? (answer.headers.get('x-provider-name')?.trim() || null);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
