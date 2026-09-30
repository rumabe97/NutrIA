import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const put = jest.fn<(path: string, body: Buffer, options: Record<string, unknown>) => Promise<{ url: string }>>();
const get = jest.fn<(path: string, options: Record<string, unknown>) => Promise<unknown>>();
const del = jest.fn<(path: string, options: Record<string, unknown>) => Promise<void>>();

jest.unstable_mockModule('@vercel/blob', () => ({ del, get, put }));

const { VercelBlobPictureCandidateStore } = await import('./VercelBlobPictureCandidateStore.js');

const TOKEN = ['vercel_blob_rw_', 'private', 'spec', 'token0123456789'].join('');
const FILE = new Uint8Array([0xff, 0xd8, 0xff, 0xeb, 0x00, 0x04, 0x4a, 0x50]);
const PATH = 'dish-picture-candidates/6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg';

/** What the SDK's `get` answers for a file that is there. */
function found(bytes: Uint8Array) {
  return { blob: { contentType: 'image/jpeg', size: bytes.length }, statusCode: 200, stream: new Response(Buffer.from(bytes)).body };
}

beforeEach(() => {
  put.mockReset();
  get.mockReset();
  del.mockReset();
});

/* 0072: a rejected picture waits in a private store, under its own token. No address of it is ever handed out. */
describe('VercelBlobPictureCandidateStore', () => {
  it('puts the bytes untouched, private, as a JPEG, at exactly the path given and never over another file — and hands back no address', async () => {
    put.mockResolvedValue({ url: 'https://store.private.blob.vercel-storage.com/x.jpg' });

    await expect(new VercelBlobPictureCandidateStore(TOKEN, []).put(PATH, FILE, 'image/jpeg')).resolves.toBeUndefined();

    const [path, body, options] = put.mock.calls[0] ?? [];

    expect(path).toBe(PATH);
    expect(new Uint8Array(body as Buffer)).toEqual(FILE);
    expect(options).toMatchObject({ access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'image/jpeg', token: TOKEN });
  });

  it('reads a file back byte for byte, as private, straight from the store', async () => {
    get.mockResolvedValue(found(FILE));

    await expect(new VercelBlobPictureCandidateStore(TOKEN, []).get(PATH)).resolves.toEqual(FILE);
    expect(get).toHaveBeenCalledWith(PATH, expect.objectContaining({ access: 'private', token: TOKEN, useCache: false }));
  });

  it('answers null for a file that is not there', async () => {
    get.mockResolvedValue(null);

    await expect(new VercelBlobPictureCandidateStore(TOKEN, []).get(PATH)).resolves.toBeNull();
  });

  it('deletes by path, with its own token', async () => {
    del.mockResolvedValue(undefined);

    await new VercelBlobPictureCandidateStore(TOKEN, []).del(PATH);

    expect(del).toHaveBeenCalledWith(PATH, expect.objectContaining({ token: TOKEN }));
  });

  it('keeps its token and the file’s path out of a failure, and carries no cause that could name them', async () => {
    const store = new VercelBlobPictureCandidateStore(TOKEN, []);

    put.mockRejectedValue(new Error(`Forbidden for token ${TOKEN} at ${PATH}`));
    get.mockRejectedValue(new Error(`Not reachable: ${PATH}`));
    del.mockRejectedValue(new Error(`Forbidden for token ${TOKEN}`));

    for (const [what, call] of [
      ['put', async () => store.put(PATH, FILE, 'image/jpeg')],
      ['get', async () => store.get(PATH)],
      ['del', async () => store.del(PATH)]
    ] as const) {
      const failure = (await call().catch((error: unknown) => error)) as Error;

      expect(failure.message).toContain(`Candidate ${what} failed`);
      expect(failure.message).not.toContain(TOKEN);
      expect(failure.message).not.toContain('dish-picture-candidates');
      expect(failure.cause).toBeUndefined();
    }
  });

  it('abandons a call that outlasts its signal, whatever the transport does with it', async () => {
    put.mockImplementation(async () => new Promise(() => undefined));

    await expect(new VercelBlobPictureCandidateStore(TOKEN, []).put(PATH, FILE, 'image/jpeg', AbortSignal.timeout(10))).rejects.toThrow(
      'Candidate put failed'
    );
  });

  it('is unavailable, and touches no store, without a token', async () => {
    const store = new VercelBlobPictureCandidateStore(null, []);

    expect(store.isAvailable).toBe(false);
    await expect(store.put(PATH, FILE, 'image/jpeg')).rejects.toThrow('No picture candidate store configured');
    await expect(store.get(PATH)).rejects.toThrow('No picture candidate store configured');
    await expect(store.del(PATH)).rejects.toThrow('No picture candidate store configured');
    expect(put).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
});
