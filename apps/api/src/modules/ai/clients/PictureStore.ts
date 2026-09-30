/** Where a stored picture can be read from, publicly, by anyone who has the address. */
export type StoredPicture = { readonly url: string };

/**
 * Where published dish pictures are kept (`0066`): Vercel Blob in production, a
 * stub in every test and local run. **Public**: whatever is put here can be
 * read by anyone who has its address, so only a picture that may reach a
 * person goes in, and there are two ways one may (`0072`): `judgePicture`
 * accepted it, or the owner accepted it by hand after seeing the allergens the
 * judge flagged — in both, the very bytes put here carry their C2PA manifest
 * (that it is there is what is looked at; its signature is not verified). A rejected picture waits in the private store (`PictureCandidateStore`)
 * and comes here only through the owner's acceptance: no retry, cron or
 * automatic code publishes one.
 * The file goes in as the model returned it — nothing here may resize,
 * re-encode or strip it, or Google's C2PA manifest stops matching its bytes.
 */
export abstract class PictureStore {
  /** False without `BLOB_READ_WRITE_TOKEN`: no picture is drawn, since none could be kept. */
  abstract get isAvailable(): boolean;

  /**
   * Deletes a published picture, by the address `put` answered for it or the
   * path it was put at: one the owner removed, or one an acceptance put here
   * that no row came to point to. A file that is not there is not an error.
   */
  abstract del(address: string, signal?: AbortSignal): Promise<void>;

  /** Stores `bytes` at `path`, public, never overwriting. */
  abstract put(path: string, bytes: Uint8Array, contentType: 'image/jpeg', signal?: AbortSignal): Promise<StoredPicture>;
}
