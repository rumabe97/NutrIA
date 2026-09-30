/** Where a stored picture can be read from, publicly, by anyone who has the address. */
export type StoredPicture = { readonly url: string };

/**
 * Where published dish pictures are kept (`0066`): Vercel Blob in production, a
 * stub in every test and local run. **Public**: whatever is put here can be
 * read by anyone who has its address, so only a picture that may reach a
 * person goes in — today, one `judgePicture` accepted. A picture the judge
 * rejected never comes here: it waits in the private store
 * (`PictureCandidateStore`, `0072`), and nothing publishes one from there.
 * The file goes in as the model returned it — nothing here may resize,
 * re-encode or strip it, or Google's C2PA manifest stops matching its bytes.
 */
export abstract class PictureStore {
  /** False without `BLOB_READ_WRITE_TOKEN`: no picture is drawn, since none could be kept. */
  abstract get isAvailable(): boolean;

  /** Stores `bytes` at `path`, public, never overwriting. */
  abstract put(path: string, bytes: Uint8Array, contentType: 'image/jpeg'): Promise<StoredPicture>;
}
