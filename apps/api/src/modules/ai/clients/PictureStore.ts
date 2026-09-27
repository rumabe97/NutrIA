/** Where a stored picture can be read from, publicly, by anyone who has the address. */
export type StoredPicture = { readonly url: string };

/**
 * Where accepted dish pictures are kept (`0066`): Vercel Blob in production, a
 * stub in every test and local run. The file goes in as the model returned it —
 * nothing here may resize, re-encode or strip it, or Google's C2PA manifest
 * stops matching its bytes.
 */
export abstract class PictureStore {
  /** False without `BLOB_READ_WRITE_TOKEN`: no picture is drawn, since none could be kept. */
  abstract get isAvailable(): boolean;

  /** Stores `bytes` at `path`, public, never overwriting. */
  abstract put(path: string, bytes: Uint8Array, contentType: 'image/jpeg'): Promise<StoredPicture>;
}
