import { PictureCandidateStore } from './PictureCandidateStore.js';
import { PictureImageClient } from './PictureImageClient.js';
import { PictureJudgeClient } from './PictureJudgeClient.js';
import { PictureStore } from './PictureStore.js';

import type { DrawnPicture } from './PictureImageClient.js';
import type { JudgeCall, JudgedIngredient } from './PictureJudgeClient.js';
import type { PictureMatch, SeenFood, SeenPicture } from 'core/domain/DishPicture';
import type { StoredPicture } from './PictureStore.js';

/**
 * An 8×8 JPEG carrying what Google's files carry — an APP1 XMP packet naming
 * `trainedAlgorithmicMedia` and an APP11 JUMBF box labelled `c2pa` — built
 * for the tests, not drawn by any model. What the stub "draws", so the
 * provenance check passes as it does on a real picture.
 */
export const STUB_PICTURE = new Uint8Array(
  Buffer.from(
    '/9j/4QFTaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIj48cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPjxyZGY6RGVzY3JpcHRpb24geG1sbnM6SXB0YzR4bXBFeHQ9Imh0dHA6Ly9pcHRjLm9yZy9zdGQvSXB0YzR4bXBFeHQvMjAwOC0wMi0yOS8iIElwdGM0eG1wRXh0OkRpZ2l0YWxTb3VyY2VUeXBlPSJodHRwOi8vY3YuaXB0Yy5vcmcvbmV3c2NvZGVzL2RpZ2l0YWxzb3VyY2V0eXBlL3RyYWluZWRBbGdvcml0aG1pY01lZGlhIi8+PC9yZGY6UkRGPjwveDp4bXBtZXRhPv/rAExKUAABAAAAAQAAAEJqdW1iAAAAHmp1bWRjMnBhABEAEIAAAKoAOJtxA2MycGEAAAAAHGpzb257ImZpeHR1cmUiOiJudXRyaWEiff/bAEMABgQFBgUEBgYFBgcHBggKEAoKCQkKFA4PDBAXFBgYFxQWFhodJR8aGyMcFhYgLCAjJicpKikZHy0wLSgwJSgpKP/bAEMBBwcHCggKEwoKEygaFhooKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKP/AABEIAAgACAMBIgACEQEDEQH/xAAVAAEBAAAAAAAAAAAAAAAAAAAABv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAVAQEBAAAAAAAAAAAAAAAAAAAFBv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALABHnn/2Q==',
    'base64'
  )
);

/**
 * The pictures with `AI_PROVIDER=stub` (`0066`): every test and every local run.
 * Nothing leaves the machine and nothing is spent. Each is a Nest provider an
 * end-to-end test replaces to draw, judge or store otherwise.
 */
export class StubPictureImageClient extends PictureImageClient {
  get isAvailable(): boolean {
    return true;
  }

  async draw(): Promise<DrawnPicture> {
    return { bytes: STUB_PICTURE, contentType: 'image/jpeg', costUsd: 0, generationId: null, model: 'stub/picture', provider: 'stub' };
  }
}

/** Sees no food and matches every ingredient: every picture is accepted, unless a test says otherwise. */
export class StubPictureJudgeClient extends PictureJudgeClient {
  get isAvailable(): boolean {
    return true;
  }

  async see(): Promise<JudgeCall<SeenPicture>> {
    return { costUsd: 0, model: 'stub/judge', provider: 'stub', result: { foods: [] } };
  }

  async match(_seen: readonly SeenFood[], ingredients: readonly JudgedIngredient[]): Promise<JudgeCall<PictureMatch>> {
    return {
      costUsd: 0,
      model: 'stub/judge',
      provider: 'stub',
      result: { extras: [], ingredients: ingredients.map(({ slug }) => ({ matched: [], slug, status: 'seen' })) }
    };
  }
}

/**
 * Keeps nothing anywhere: the address is the file itself, as a data URL, so a
 * local screen shows the stub picture with no store. `stored` lists every put
 * and `deleted` the address of every deletion, for a test to read.
 */
export class StubPictureStore extends PictureStore {
  readonly deleted: string[] = [];

  readonly stored: { readonly bytes: Uint8Array; readonly path: string }[] = [];

  get isAvailable(): boolean {
    return true;
  }

  async del(address: string): Promise<void> {
    this.deleted.push(address);
  }

  async put(path: string, bytes: Uint8Array, contentType: 'image/jpeg'): Promise<StoredPicture> {
    this.stored.push({ bytes, path });

    return { url: `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}` };
  }
}

/**
 * The private store, in memory (`0072`): a rejected picture is kept in this
 * process and nowhere else. `files` is every file it holds, by path, for a
 * test to read — or to fill, to set a candidate up without a drawing.
 */
export class StubPictureCandidateStore extends PictureCandidateStore {
  readonly files = new Map<string, Uint8Array>();

  get isAvailable(): boolean {
    return true;
  }

  async del(path: string): Promise<void> {
    this.files.delete(path);
  }

  async get(path: string): Promise<Uint8Array | null> {
    return this.files.get(path) ?? null;
  }

  async put(path: string, bytes: Uint8Array): Promise<void> {
    if (this.files.has(path)) {
      throw new Error('Candidate put failed: a file is already there');
    }

    this.files.set(path, bytes);
  }
}
