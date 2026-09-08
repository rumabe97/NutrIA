export type ImageRequest = { readonly aspectRatio: '1:1' | '4:3'; readonly prompt: string };

export type ImageResponse = { readonly bytes: Uint8Array; readonly mediaType: string; readonly model: string };

/**
 * The boundary for pictures, as `AiClient` is for dishes: the illustrator
 * depends on this and never on a provider SDK, so it is testable with a stub and
 * the model is an environment variable.
 */
export abstract class ImageClient {
  abstract generate(request: ImageRequest): Promise<ImageResponse>;

  /** False when illustrations are off or no image model is configured; the sweep then does nothing. */
  abstract get isAvailable(): boolean;
}
