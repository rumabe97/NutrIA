import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const put = jest.fn<(path: string, body: Buffer, options: Record<string, unknown>) => Promise<{ url: string }>>();

jest.unstable_mockModule('@vercel/blob', () => ({ put }));

const { VercelBlobPictureStore } = await import('./VercelBlobPictureStore.js');

const TOKEN = ['vercel_blob_rw_', 'store', 'spec', 'token0123456789'].join('');
const FILE = new Uint8Array([0xff, 0xd8, 0xff, 0xeb, 0x00, 0x04, 0x4a, 0x50]);

beforeEach(() => {
  put.mockReset();
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
});
