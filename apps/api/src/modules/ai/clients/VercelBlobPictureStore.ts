import { put } from '@vercel/blob';

import { PictureStore } from './PictureStore.js';
import { redactSecrets } from './redact.js';

import type { StoredPicture } from './PictureStore.js';

/** A year: a path is never reused (`dish-pictures/<recipe>/<version>-<random>.jpg`), so a stored file never changes. */
const CACHE_SECONDS = 31_536_000;

/**
 * Vercel Blob (`0066`), the store in fra1 the API project is connected to.
 * Public, because a picture of a dish is nobody's data and the phone and the
 * edge may cache it; the path carries a recipe id and never a person's.
 */
export class VercelBlobPictureStore extends PictureStore {
  constructor(
    private readonly token: string | null,
    private readonly secrets: readonly string[]
  ) {
    super();
  }

  get isAvailable(): boolean {
    return this.token !== null;
  }

  async put(path: string, bytes: Uint8Array, contentType: 'image/jpeg'): Promise<StoredPicture> {
    if (!this.token) {
      throw new Error('No picture store configured');
    }

    try {
      const stored = await put(path, Buffer.from(bytes), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: CACHE_SECONDS,
        contentType,
        token: this.token
      });

      return { url: stored.url };
    } catch (error: unknown) {
      throw new Error(redactSecrets(`Blob put failed: ${error instanceof Error ? error.message : 'unknown'}`, [this.token, ...this.secrets]), {
        cause: error
      });
    }
  }
}
