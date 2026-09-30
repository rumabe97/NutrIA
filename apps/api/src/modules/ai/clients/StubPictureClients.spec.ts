import { describe, expect, it } from '@jest/globals';

import { pictureMarks } from 'core/domain/DishPicture';

import { STUB_PICTURE, StubPictureCandidateStore, StubPictureStore } from './StubPictureClients.js';

const PATH = 'dish-picture-candidates/6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg';

/* 0072: the private store of every test and local run — in memory, and nowhere else. */
describe('StubPictureCandidateStore', () => {
  it('is available, and keeps a file to read back byte for byte', async () => {
    const store = new StubPictureCandidateStore();

    expect(store.isAvailable).toBe(true);
    await store.put(PATH, STUB_PICTURE);

    await expect(store.get(PATH)).resolves.toBe(STUB_PICTURE);
    expect([...store.files.keys()]).toEqual([PATH]);
  });

  it('answers null for a file it does not hold', async () => {
    await expect(new StubPictureCandidateStore().get(PATH)).resolves.toBeNull();
  });

  it('never writes over a file, as the real store does not', async () => {
    const store = new StubPictureCandidateStore();

    await store.put(PATH, STUB_PICTURE);

    await expect(store.put(PATH, new Uint8Array([1]))).rejects.toThrow('Candidate put failed');
    await expect(store.get(PATH)).resolves.toBe(STUB_PICTURE);
  });

  it('deletes a file, and deleting one that is not there is not an error', async () => {
    const store = new StubPictureCandidateStore();

    await store.put(PATH, STUB_PICTURE);
    await store.del(PATH);
    await store.del(PATH);

    await expect(store.get(PATH)).resolves.toBeNull();
    expect(store.files.size).toBe(0);
  });

  it('holds what the stub draws: a JPEG with its C2PA manifest', () => {
    expect(pictureMarks(STUB_PICTURE)).toEqual({ c2pa: true, jpeg: true, trainedAlgorithmicMedia: true });
  });
});

/* The public store of every test and local run: it keeps nothing, and lists what it was asked. */
describe('StubPictureStore', () => {
  it('answers the file itself as its address, and lists every put and every deletion', async () => {
    const store = new StubPictureStore();
    const { url } = await store.put('dish-pictures/r/2.0.0-x.jpg', STUB_PICTURE, 'image/jpeg');

    expect(url).toBe(`data:image/jpeg;base64,${Buffer.from(STUB_PICTURE).toString('base64')}`);
    expect(store.stored).toEqual([{ bytes: STUB_PICTURE, path: 'dish-pictures/r/2.0.0-x.jpg' }]);

    await store.del(url);
    expect(store.deleted).toEqual([url]);
  });
});
