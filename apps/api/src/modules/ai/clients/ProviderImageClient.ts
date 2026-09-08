import { Inject, Injectable } from '@nestjs/common';
import { generateImage } from 'ai';

import { AI_IMAGE_MODEL } from '../ai.config.js';
import { ImageClient } from './ImageClient.js';
import { redactSecrets } from './redact.js';

import type { ImageModel } from 'ai';
import type { ImageRequest, ImageResponse } from './ImageClient.js';

/** The real client: `generateImage` against whichever image model the environment chose. */
@Injectable()
export class ProviderImageClient extends ImageClient {
  constructor(@Inject(AI_IMAGE_MODEL) private readonly model: ImageModel | null) {
    super();
  }

  get isAvailable(): boolean {
    return this.model !== null;
  }

  async generate({ aspectRatio, prompt }: ImageRequest): Promise<ImageResponse> {
    if (!this.model) {throw new Error('No image model configured');}

    try {
      const result = await generateImage({ aspectRatio, model: this.model, prompt });

      // `ImageModel` admits a bare id string as well as a model object.
      return { bytes: result.image.uint8Array, mediaType: result.image.mediaType, model: typeof this.model === 'string' ? this.model : this.model.modelId };
    } catch (error: unknown) {
      // The provider's message names the key, the quota or the model — the one thing
      // an operator needs — and is redacted before it can reach a log.
      throw new Error(redactSecrets(error instanceof Error ? error.message : 'Unknown image failure'), { cause: error });
    }
  }
}
