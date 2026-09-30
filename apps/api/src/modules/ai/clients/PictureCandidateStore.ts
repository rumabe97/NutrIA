/**
 * Where a picture the judge rejected waits for the owner (`0072`): a second
 * Vercel Blob store, **private**, in fra1, with its own token — a stub in
 * every test and local run. Nothing here hands out an address: a file is
 * written, read back as bytes and deleted by its path, and only the API does
 * any of the three. The path is kept in the dish's row and never leaves the API.
 *
 * The file goes in as the model returned it, like an accepted one
 * (`PictureStore`): its C2PA manifest must still match its bytes the day the
 * owner publishes it.
 */
export abstract class PictureCandidateStore {
  /** False without `BLOB_CANDIDATES_READ_WRITE_TOKEN`: no rejected picture is kept, and drawing goes on as if there were no such store. */
  abstract get isAvailable(): boolean;

  /** Deletes the file at `path`. A file that is not there is not an error. */
  abstract del(path: string, signal?: AbortSignal): Promise<void>;

  /** The file at `path`, byte for byte, or null when there is none. */
  abstract get(path: string, signal?: AbortSignal): Promise<Uint8Array | null>;

  /** Stores `bytes` at `path`, private, never overwriting. */
  abstract put(path: string, bytes: Uint8Array, contentType: 'image/jpeg', signal?: AbortSignal): Promise<void>;
}
