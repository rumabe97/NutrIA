import type { FlexibleSchema } from 'ai';

export type AiUsage = {
  readonly calls: number;
  readonly inputTokens: number;
  readonly model: string;
  readonly outputTokens: number;
};

export type AiRequest<T> = {
  readonly prompt: string;
  /** A hand-written JSON Schema or a Zod one; see `wirePoolSchema` for why it matters. */
  readonly schema: FlexibleSchema<T>;
  readonly system: string;
};

export type AiResponse<T> = { readonly object: T; readonly usage: AiUsage };

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
