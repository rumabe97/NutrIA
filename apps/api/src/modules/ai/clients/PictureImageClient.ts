/** One picture as the model returned it: the file's bytes exactly as they came, never re-encoded. */
export type DrawnPicture = {
  readonly bytes: Uint8Array;
  readonly contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** What the call cost, in dollars, or null when OpenRouter never said. */
  readonly costUsd: number | null;
  /** OpenRouter's id for the call (`gen-…`), which its activity page lists it under. */
  readonly generationId: string | null;
  readonly model: string;
  /** Whose endpoint drew it, as OpenRouter names it. */
  readonly provider: string | null;
};

/**
 * The boundary for drawing a dish's picture (`0066`), as `AiClient` is for
 * dishes: what asks for a picture depends on this, never on a provider, so it
 * is tested with a stub and the model is an environment variable.
 */
export abstract class PictureImageClient {
  /** False with `AI_PROVIDER=stub` or no `OPENROUTER_IMAGE_API_KEY`: nothing is drawn, and nothing is spent. */
  abstract get isAvailable(): boolean;

  abstract draw(prompt: string, signal?: AbortSignal): Promise<DrawnPicture>;
}
