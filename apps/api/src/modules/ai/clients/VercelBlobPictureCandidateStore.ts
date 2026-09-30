import { del, get, put } from '@vercel/blob';

import { PictureCandidateStore } from './PictureCandidateStore.js';
import { redactSecrets } from './redact.js';
import { untilAborted } from './untilAborted.js';

/**
 * The private Vercel Blob store (`0072`), in fra1, the API project is
 * connected to under its own token. Private is a property of the store: a
 * file in it has no public address, and is read only with the token — which
 * only the API holds. A failure names neither the token nor the file's path.
 */
export class VercelBlobPictureCandidateStore extends PictureCandidateStore {
  constructor(
    private readonly token: string | null,
    private readonly secrets: readonly string[]
  ) {
    super();
  }

  get isAvailable(): boolean {
    return this.token !== null;
  }

  async del(path: string, signal?: AbortSignal): Promise<void> {
    await this.run('del', path, signal, async token => del(path, { abortSignal: signal, token }));
  }

  async get(path: string, signal?: AbortSignal): Promise<Uint8Array | null> {
    return this.run('get', path, signal, async token => {
      // Straight from the store, never a cached copy: a file deleted a moment ago must not be read again.
      const found = await get(path, { abortSignal: signal, access: 'private', token, useCache: false });

      return found?.statusCode === 200 ? new Uint8Array(await new Response(found.stream).arrayBuffer()) : null;
    });
  }

  async put(path: string, bytes: Uint8Array, contentType: 'image/jpeg', signal?: AbortSignal): Promise<void> {
    await this.run('put', path, signal, async token =>
      put(path, Buffer.from(bytes), { abortSignal: signal, access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType, token })
    );
  }

  /** One call to the store, abandoned when its signal aborts, its failure scrubbed of the token and of the path. */
  private async run<T>(what: string, path: string, signal: AbortSignal | undefined, call: (token: string) => Promise<T>): Promise<T> {
    if (!this.token) {
      throw new Error('No picture candidate store configured');
    }

    let failure: string;

    try {
      return await untilAborted(call(this.token), signal);
    } catch (error: unknown) {
      failure = redactSecrets(`Candidate ${what} failed: ${error instanceof Error ? error.message : 'unknown'}`, [this.token, ...this.secrets]);
    }

    // Thrown out here, with no `cause`: the SDK's own error may name the path, and an error report carries its causes.
    throw new Error(failure.replaceAll(path, '[candidate]'));
  }
}
