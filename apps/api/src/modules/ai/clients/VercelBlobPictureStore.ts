import { del, put } from '@vercel/blob';

import { isPublishedPicturePath } from 'core/entities/DishPicture';

import { PictureStore } from './PictureStore.js';
import { redactSecrets } from './redact.js';

import type { StoredPicture } from './PictureStore.js';

/** A year: a path is never reused (`dish-pictures/<recipe>/<version>-<random>.jpg`), so a stored file never changes. */
const CACHE_SECONDS = 31_536_000;

/**
 * Vercel Blob (`0066`), the store in fra1 the API project is connected to.
 * Public, because a picture of a dish is nobody's data and the phone and the
 * edge may cache it; the path carries a recipe id and never a person's.
 * A failure names neither the token nor the file's address or path.
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

  async del(address: string, signal?: AbortSignal): Promise<void> {
    if (!this.token) {
      throw new Error('No picture store configured');
    }

    // Only a dish's picture is ever deleted: whatever a row held, nothing else is asked of the store.
    const path = publishedPath(address);

    if (path === null) {
      throw new Error('Blob del refused: not a dish picture');
    }

    let failure: string;

    try {
      await del(address, { abortSignal: signal, token: this.token });

      return;
    } catch (error: unknown) {
      failure = this.scrubbed('del', error, [address, path]);
    }

    // Thrown out here, with no `cause`: the SDK's own error may name the file, and an error report carries its causes.
    throw new Error(failure);
  }

  async put(path: string, bytes: Uint8Array, contentType: 'image/jpeg', signal?: AbortSignal): Promise<StoredPicture> {
    if (!this.token) {
      throw new Error('No picture store configured');
    }

    let failure: string;

    try {
      const stored = await put(path, Buffer.from(bytes), {
        abortSignal: signal,
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: CACHE_SECONDS,
        contentType,
        token: this.token
      });

      return { url: stored.url };
    } catch (error: unknown) {
      failure = this.scrubbed('put', error, [path]);
    }

    throw new Error(failure);
  }

  /**
   * What a failed call says, without the token and without where the file is:
   * its address and its path are taken out of the store's own words. A file an
   * acceptance published and could not take back is a picture the judge
   * rejected, and its address is never returned, stored or logged (`0072`).
   */
  private scrubbed(what: string, error: unknown, places: readonly string[]): string {
    const message = redactSecrets(`Blob ${what} failed: ${error instanceof Error ? error.message : 'unknown'}`, [
      ...(this.token ? [this.token] : []),
      ...this.secrets
    ]);

    // The longest first, so an address goes whole before the path inside it does.
    return [...places].sort((a, b) => b.length - a.length).reduce((text, place) => text.replaceAll(place, '[picture]'), message);
  }
}

/** The path a published picture's address names — the address being that path or the file's URL — or null when it is not a dish's picture. */
function publishedPath(address: string): string | null {
  let path = address;

  if (/^https?:\/\//i.test(address)) {
    try {
      path = decodeURIComponent(new URL(address).pathname.slice(1));
    } catch {
      return null;
    }
  }

  return isPublishedPicturePath(path) ? path : null;
}
