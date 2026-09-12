import type { FlexibleSchema } from 'ai';
import type { GatewayCall, QuotaRefusal } from './gateway.js';

export type AiUsage = { readonly calls: number; readonly inputTokens: number; readonly model: string; readonly outputTokens: number };

/** How one call went, as far as the provider — or the gateway in front of it — said. */
export type AiCall = {
  /** The model that answered, by the provider's own name. Through a combo, not necessarily the one asked for. */
  readonly answeredModel: string | null;
  readonly cachedInputTokens: number | null;
  /** Null when the call did not go through a gateway. */
  readonly gateway: GatewayCall | null;
  /** Our clock, from request to answer — the SDK's retries included, where there are any. */
  readonly ms: number;
  readonly reasoningTokens: number | null;
};

export type AiRequest<T> = {
  readonly prompt: string;
  /** A hand-written JSON Schema or a Zod one; see `wirePoolSchema` for why it matters. */
  readonly schema: FlexibleSchema<T>;
  /** Files the call under a session in a gateway's own log — a generation's job id. Direct providers are not sent it. */
  readonly session?: string;
  readonly system: string;
};

/** `call` is absent only from clients that cannot say, such as a test's stub. */
export type AiResponse<T> = { readonly call?: AiCall; readonly object: T; readonly usage: AiUsage };

/** A call that failed, with what the provider said about it. */
export type AiFailure = {
  readonly gateway: GatewayCall | null;
  /** `invalid_output`: the model answered, but not to the schema. `provider`: the provider or the gateway refused or failed. */
  readonly kind: 'invalid_output' | 'provider';
  /** The model that was asked for. */
  readonly model: string;
  readonly ms: number;
  readonly quota: QuotaRefusal | null;
  readonly status: number | null;
};

/** What a failed call throws: the redacted message, and the failure as data for the generation's log. */
export class AiCallError extends Error {
  constructor(
    message: string,
    readonly failure: AiFailure,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'AiCallError';
  }
}

/**
 * The boundary. Everything downstream depends on this interface and never on a
 * provider SDK, so the pool builder is testable with a stub and the provider is an
 * environment variable.
 */
export abstract class AiClient {
  abstract generate<T>(request: AiRequest<T>): Promise<AiResponse<T>>;

  /** False when no model is configured — the caller must then rely entirely on reuse. */
  abstract get isAvailable(): boolean;
}
