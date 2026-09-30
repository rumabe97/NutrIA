import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const put = jest.fn<(path: string, body: Buffer, options: Record<string, unknown>) => Promise<{ url: string }>>();
const del = jest.fn<(address: string, options: Record<string, unknown>) => Promise<void>>();

jest.unstable_mockModule('@vercel/blob', () => ({ del, put }));

const { VercelBlobPictureStore } = await import('./VercelBlobPictureStore.js');

const TOKEN = ['vercel_blob_rw_', 'store', 'spec', 'token0123456789'].join('');
const FILE = new Uint8Array([0xff, 0xd8, 0xff, 0xeb, 0x00, 0x04, 0x4a, 0x50]);

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
const PATH = `dish-pictures/${RECIPE}/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg`;
const URL = `https://store.public.blob.vercel-storage.com/${PATH}`;

beforeEach(() => {
  put.mockReset();
  del.mockReset();
});

/* 0066: the file goes to Blob as it came, public, at the path it was given, never over another. */
describe('VercelBlobPictureStore', () => {
  it('puts the bytes untouched, public, as a JPEG, at exactly the path given and never over another file', async () => {
    put.mockResolvedValue({ url: 'https://store.public.blob.vercel-storage.com/dish-pictures/r/2.0.0-x.jpg' });

    const stored = await new VercelBlobPictureStore(TOKEN, []).put('dish-pictures/r/2.0.0-x.jpg', FILE, 'image/jpeg');

    expect(stored).toEqual({ url: 'https://store.public.blob.vercel-storage.com/dish-pictures/r/2.0.0-x.jpg' });

    const [path, body, options] = put.mock.calls[0] ?? [];

    expect(path).toBe('dish-pictures/r/2.0.0-x.jpg');
    expect(new Uint8Array(body as Buffer)).toEqual(FILE);
    expect(options).toMatchObject({ access: 'public', addRandomSuffix: false, allowOverwrite: false, contentType: 'image/jpeg', token: TOKEN });
  });

  it('keeps its token out of a failure', async () => {
    put.mockRejectedValue(new Error(`Forbidden for token ${TOKEN}`));

    const failure = (await new VercelBlobPictureStore(TOKEN, []).put('p.jpg', FILE, 'image/jpeg').catch((error: unknown) => error)) as Error;

    expect(failure.message).toContain('Blob put failed');
    expect(failure.message).not.toContain(TOKEN);
  });

  it('is unavailable, and stores nothing, without a token', async () => {
    const store = new VercelBlobPictureStore(null, []);

    expect(store.isAvailable).toBe(false);
    await expect(store.put('p.jpg', FILE, 'image/jpeg')).rejects.toThrow('No picture store configured');
    expect(put).not.toHaveBeenCalled();
  });

  /* 0072: a picture the owner removed, or one an acceptance published that no row came to point to. */
  it('deletes a dish’s picture by the address it was given for it, or by its path, with its own token', async () => {
    del.mockResolvedValue(undefined);

    const store = new VercelBlobPictureStore(TOKEN, []);
    const signal = AbortSignal.timeout(1_000);

    await store.del(URL, signal);
    await store.del(PATH);

    expect(del.mock.calls).toEqual([
      [URL, { abortSignal: signal, token: TOKEN }],
      [PATH, { abortSignal: undefined, token: TOKEN }]
    ]);
  });

  it.each([
    `dish-picture-candidates/${RECIPE}/2.0.0-x.jpg`,
    `https://store.public.blob.vercel-storage.com/dish-picture-candidates/${RECIPE}/2.0.0-x.jpg`,
    `https://store.public.blob.vercel-storage.com/other/${RECIPE}/2.0.0-x.jpg`,
    `https://store.public.blob.vercel-storage.com/dish-pictures/${RECIPE}/..%2F..%2Fother.jpg`,
    'https://store.public.blob.vercel-storage.com/',
    'data:image/jpeg;base64,AAAA',
    'http://[not a url',
    ''
  ])('deletes nothing that is not a dish’s picture: %s', async address => {
    await expect(new VercelBlobPictureStore(TOKEN, []).del(address)).rejects.toThrow('Blob del refused: not a dish picture');
    expect(del).not.toHaveBeenCalled();
  });

  it('keeps its token out of a failed deletion, and deletes nothing without a token', async () => {
    del.mockRejectedValue(new Error(`Forbidden for token ${TOKEN}`));

    const failure = (await new VercelBlobPictureStore(TOKEN, []).del(URL).catch((error: unknown) => error)) as Error;

    expect(failure.message).toContain('Blob del failed');
    expect(failure.message).not.toContain(TOKEN);

    del.mockClear();
    await expect(new VercelBlobPictureStore(null, []).del(URL)).rejects.toThrow('No picture store configured');
    expect(del).not.toHaveBeenCalled();
  });

  /* 0072: the address of a judge-rejected file left in the public store is never returned, stored or logged. */
  it('keeps the file’s address and path out of a failed deletion, whichever it was given, and carries no cause', async () => {
    for (const address of [URL, PATH]) {
      del.mockRejectedValue(new Error(`Vercel Blob: could not delete ${URL} (pathname ${PATH}) with ${TOKEN}`));

      const failure = (await new VercelBlobPictureStore(TOKEN, []).del(address).catch((error: unknown) => error)) as Error;

      expect(failure.message).toContain('Blob del failed');
      expect(failure.message).not.toContain(URL);
      expect(failure.message).not.toContain(PATH);
      expect(failure.message).not.toContain('0b7e3f2a');
      expect(failure.message).not.toContain(RECIPE);
      expect(failure.message).not.toContain(TOKEN);
      // An error report carries an error's causes: the SDK's own error, which names the file, is not one of them.
      expect(failure.cause).toBeUndefined();
    }
  });

  it('keeps the path out of a failed put, and carries no cause', async () => {
    put.mockRejectedValue(new Error(`Vercel Blob: could not write ${PATH} at https://store.public.blob.vercel-storage.com/${PATH}`));

    const failure = (await new VercelBlobPictureStore(TOKEN, []).put(PATH, FILE, 'image/jpeg').catch((error: unknown) => error)) as Error;

    expect(failure.message).toContain('Blob put failed');
    expect(failure.message).not.toContain(PATH);
    expect(failure.message).not.toContain('0b7e3f2a');
    expect(failure.message).not.toContain(RECIPE);
    expect(failure.cause).toBeUndefined();
  });
});
