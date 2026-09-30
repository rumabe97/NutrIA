import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pictureJudgedDrawing, pictureJudgement } from 'core/entities/DishPicture';
import { DatabaseOperationError, NotFoundError, PictureRetryRefusedError } from 'core/entities/Error';

import { PICTURE_COOL_OFF_DAYS, RecipeController, reviewableCandidate, toPictureStatus } from './RecipeController';

import type { AcceptanceFiles } from './RecipeController';

type Row = { lastAttemptAt: Date | null; provenance: Record<string, unknown> | null; status: string };
type Audit = (tx: unknown) => Promise<void>;
type Seen = { lastAttemptAt: Date; path: string };
type Picture = { model: string; promptVersion: string; provenance: Record<string, unknown>; url: string };

const dishPictures = vi.fn<() => Promise<boolean>>();
const recipeExists = vi.fn<(recipeId: string) => Promise<boolean>>();
const candidateRow = vi.fn<(recipeId: string) => Promise<Row | null>>();
const acceptCandidate = vi.fn<(recipeId: string, seen: Seen, picture: Picture, now: Date, audit: Audit) => Promise<boolean>>();
const dropCandidate = vi.fn<(recipeId: string, path: string, audit?: Audit) => Promise<boolean>>();
const removeAcceptedPicture =
  vi.fn<(recipeId: string, now: Date, audit: Audit) => Promise<{ candidatePath: string | null; url: string | null } | null>>();
const monthSpendUsd = vi.fn<() => Promise<number>>();
type Settled = { status: string; url: string | null } | null;

const pictureState = vi.fn<(recipeId: string) => Promise<unknown>>();
const settledPicture = vi.fn<(recipeId: string, lockTimeoutMs: number) => Promise<Settled>>();
const record = vi.fn<(entry: unknown, tx: unknown) => Promise<void>>();

vi.mock('core/controllers/Settings', () => ({ SettingsController: { dishPictures: () => dishPictures() } }));
vi.mock('#repositories/Audit', () => ({ AuditRepository: { record: (entry: unknown, tx: unknown) => record(entry, tx) } }));
vi.mock('#repositories/Recipe', () => ({
  FALLBACK_LOCALE: 'es-ES',
  RecipeRepository: {
    acceptCandidate: (recipeId: string, seen: Seen, picture: Picture, now: Date, audit: Audit) =>
      acceptCandidate(recipeId, seen, picture, now, audit),
    candidateRow: (recipeId: string) => candidateRow(recipeId),
    dropCandidate: (recipeId: string, path: string, audit?: Audit) => dropCandidate(recipeId, path, audit),
    monthSpendUsd: () => monthSpendUsd(),
    pictureState: (recipeId: string) => pictureState(recipeId),
    recipeExists: (recipeId: string) => recipeExists(recipeId),
    removeAcceptedPicture: (recipeId: string, now: Date, audit: Audit) => removeAcceptedPicture(recipeId, now, audit),
    settledPicture: (recipeId: string, lockTimeoutMs: number) => settledPicture(recipeId, lockTimeoutMs)
  }
}));

/** `marked.jpg` carries a C2PA manifest as Gemini's files do; `reencoded.jpg` is the same picture with it stripped (`provenance.test.ts`). */
function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(__dirname, '../../test/dish-picture', name)));
}

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
const OWNER = 'owner-1';
const NOW = new Date('2026-09-30T12:00:00Z');
const DAY = 86_400_000;
const ENDED = new Date(NOW.getTime() - DAY);
const PATH = `dish-picture-candidates/${RECIPE}/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg`;
const URL = `https://store.example/dish-pictures/${RECIPE}/2.0.0-published.jpg`;
const SIGNED = fixture('marked.jpg');
const STRIPPED = fixture('reencoded.jpg');
const CANDIDATE = {
  extras: [
    { foreignAllergens: ['milk', 'crustaceans'], mappedTo: ['queso', 'gambas'] },
    { foreignAllergens: ['milk'], mappedTo: [] }
  ],
  model: 'google/gemini-image',
  path: PATH,
  promptVersion: '2.0.0'
};
/** What the console showed, and what the request repeats. */
const SHOWN = ['crustaceans', 'milk'];

/** A food name only the judge ever wrote: anything that carries it out of the row carries a model's words. */
const SENTINEL = 'zzjudge-sentinel-food';

/** What the judge answered on the drawing that left the candidate, as the row stores it (project 010). */
const JUDGEMENT = pictureJudgement({
  at: ENDED,
  match: { extras: [SENTINEL], ingredients: [{ matched: [], slug: 'arroz-blanco-cocido', status: 'seen' }] },
  number: 3,
  seen: { foods: [{ amount: 'main', name: SENTINEL, specific: true }] },
  verdict: { accepted: false, notes: [`extra_allergen:${SENTINEL}=crustaceans`] }
});
const JUDGED =
  JUDGEMENT === null
    ? null
    : pictureJudgedDrawing({ ingredients: [{ grams: 200, name: 'Cooked white rice', slug: 'arroz-blanco-cocido' }], name: 'Arroz' }, [JUDGEMENT]);

function failed(overrides: Partial<Row> = {}): Row {
  return {
    lastAttemptAt: ENDED,
    provenance: { candidate: CANDIDATE, notes: ['3:rejected:extra_allergen:prawns=crustaceans'], reason: 'judge_allergen' },
    status: 'failed',
    ...overrides
  };
}

/** The two stores as the API hands them over, each call noted in the order it happened. */
function stores(overrides: Partial<Omit<AcceptanceFiles, 'available'>> & { readonly available?: boolean } = {}) {
  const order: string[] = [];

  const noted =
    <A extends unknown[], R>(step: string, work: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      order.push(step);

      return work(...args);
    };

  const files = {
    available: overrides.available ?? true,
    forget: vi.fn(noted('forget', overrides.forget ?? (async () => undefined))),
    publish: vi.fn(noted('publish', overrides.publish ?? (async () => ({ url: URL })))),
    read: vi.fn(noted('read', overrides.read ?? (async (): Promise<Uint8Array | null> => SIGNED))),
    unpublish: vi.fn(noted('unpublish', overrides.unpublish ?? (async () => undefined)))
  };

  return { files, order };
}

function refusal(error: unknown): string | undefined {
  return error instanceof PictureRetryRefusedError ? error.reason : undefined;
}

/** Accepts as the console would: the allergens shown, and the expiry the candidate was shown with — by default that of the row the test holds. */
async function accept(files: AcceptanceFiles, shown: readonly string[] = SHOWN, recipeId = RECIPE, expiresAt?: string): Promise<unknown> {
  const held = (await candidateRow(recipeId))?.lastAttemptAt ?? ENDED;
  const body = { allergens: [...shown], expiresAt: expiresAt ?? new Date(held.getTime() + PICTURE_COOL_OFF_DAYS * DAY).toISOString() };

  candidateRow.mockClear();

  return RecipeController.acceptCandidate(recipeId, OWNER, body, files, NOW).then(
    () => 'accepted',
    (error: unknown) => error
  );
}

/** Nothing reached a store or the database's writes. */
function expectNothingWritten(files: ReturnType<typeof stores>['files']): void {
  expect(files.publish).not.toHaveBeenCalled();
  expect(files.unpublish).not.toHaveBeenCalled();
  expect(files.forget).not.toHaveBeenCalled();
  expect(acceptCandidate).not.toHaveBeenCalled();
  expect(dropCandidate).not.toHaveBeenCalled();
  expect(record).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  dishPictures.mockResolvedValue(true);
  recipeExists.mockResolvedValue(true);
  candidateRow.mockResolvedValue(failed());
  acceptCandidate.mockImplementation(async (_id, _seen, _picture, _now, audit) => {
    await audit('tx');

    return true;
  });
  dropCandidate.mockResolvedValue(true);
  record.mockResolvedValue(undefined);
  monthSpendUsd.mockResolvedValue(0);
  // As a row whose acceptance did not happen reads, once settled: still failed.
  settledPicture.mockResolvedValue({ status: 'failed', url: null });
  removeAcceptedPicture.mockImplementation(async (_id, _now, audit) => {
    await audit('tx');

    return { candidatePath: null, url: URL };
  });
});

/*
 * 0072, PRD 009 criteria 5 and 8: the owner's acceptance is the second of the two doors a picture reaches a person
 * through. Six steps, in order; every refusal and every failure between them leaves a state the design names.
 */
describe('RecipeController.acceptCandidate', () => {
  it('runs the six steps in order: the row, the allergens, the bytes read and checked, published, ready with its audit row, the private file and its pointer', async () => {
    const { files, order } = stores();

    acceptCandidate.mockImplementation(async (_id, _seen, _picture, _now, audit) => {
      order.push('ready');
      await audit('tx');
      order.push('audit');

      return true;
    });
    dropCandidate.mockImplementation(async () => {
      order.push('pointer');

      return true;
    });

    await expect(accept(files)).resolves.toBe('accepted');

    expect(order).toEqual(['read', 'publish', 'ready', 'audit', 'forget', 'pointer']);
    expect(files.read).toHaveBeenCalledWith(PATH);
    expect(files.forget).toHaveBeenCalledWith(PATH);
    // The end of an acceptance is no admin action of its own: the pointer goes without a second audit row.
    expect(dropCandidate).toHaveBeenCalledWith(RECIPE, PATH, undefined);
    expect(files.unpublish).not.toHaveBeenCalled();
  });

  it('publishes the very bytes it read and checked, under the prompt version the candidate was drawn from', async () => {
    const { files } = stores();

    await accept(files);

    expect(files.publish).toHaveBeenCalledTimes(1);

    const [published, version] = files.publish.mock.calls[0] ?? [];

    // The same array, not a copy that went through anything: its C2PA manifest still matches its bytes.
    expect(published).toBe(SIGNED);
    expect(Buffer.from(published ?? []).equals(Buffer.from(fixture('marked.jpg')))).toBe(true);
    expect(version).toBe('2.0.0');
  });

  it('makes the row ready only if it is still the row that was read, with what drew the candidate — and the audit row in that transaction', async () => {
    const { files } = stores();

    await accept(files);

    expect(acceptCandidate).toHaveBeenCalledTimes(1);

    const [recipeId, seen, picture, now] = acceptCandidate.mock.calls[0] ?? [];

    expect(recipeId).toBe(RECIPE);
    expect(seen).toEqual({ lastAttemptAt: ENDED, path: PATH });
    expect(now).toBe(NOW);
    expect(picture).toEqual({
      model: 'google/gemini-image',
      promptVersion: '2.0.0',
      provenance: {
        acceptedBy: 'owner',
        c2pa: true,
        notes: ['3:rejected:extra_allergen:prawns=crustaceans'],
        overriddenAllergens: ['crustaceans', 'milk'],
        trainedAlgorithmicMedia: true
      },
      url: URL
    });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      { action: 'picture.accepted', actorId: OWNER, entity: 'recipe', entityId: RECIPE, metadata: { allergens: ['crustaceans', 'milk'] } },
      'tx'
    );
  });

  /*
   * Project 010, phase 3, on purpose: the acceptance used to store the owner's marks alone, which erased what the judge
   * said about the dish. It now keeps the rejections' notes and the judged drawings beside them — in the row, which no
   * view reads — while the audit row still carries catalogue keys only, and neither holds a path.
   */
  it('audits catalogue keys only, and stores no path or address of the private file', async () => {
    const { files } = stores();

    candidateRow.mockResolvedValue(failed({ provenance: { ...failed().provenance, drawings: [JUDGED] } }));
    await accept(files);

    const audited = JSON.stringify(record.mock.calls[0]?.[0]);

    expect(audited).not.toMatch(/dish-picture-candidates|0b7e3f2a|extra_allergen|prawns|gambas|queso|notes/);
    expect(audited).not.toContain(SENTINEL);
    expect(JSON.stringify(acceptCandidate.mock.calls[0]?.[2].provenance)).not.toMatch(/dish-picture-candidates|0b7e3f2a|candidate/);
  });

  it('keeps what the judge said on the rejected drawing beside the owner’s marks: its notes and its answers', async () => {
    const { files } = stores();

    expect(JUDGED).not.toBeNull();

    candidateRow.mockResolvedValue(failed({ provenance: { ...failed().provenance, drawings: [JUDGED] } }));
    await accept(files);

    expect(acceptCandidate.mock.calls[0]?.[2].provenance).toEqual({
      acceptedBy: 'owner',
      c2pa: true,
      drawings: [JUDGED],
      notes: ['3:rejected:extra_allergen:prawns=crustaceans'],
      overriddenAllergens: ['crustaceans', 'milk'],
      trainedAlgorithmicMedia: true
    });
  });

  it('leaves no path in what the row stores once it is complete: the pointer step 5 carried over is dropped in step 6, after its file', async () => {
    const { files, order } = stores();

    dropCandidate.mockImplementation(async () => {
      order.push('pointer');

      return true;
    });

    await accept(files);

    // What the acceptance itself writes names no file: the owner's four marks, and the rejections' notes (project 010)…
    expect(Object.keys(acceptCandidate.mock.calls[0]?.[2].provenance ?? {}).sort()).toEqual([
      'acceptedBy',
      'c2pa',
      'notes',
      'overriddenAllergens',
      'trainedAlgorithmicMedia'
    ]);
    // …and the pointer the row still held is taken off it, by its very path, only after the private file is gone.
    expect(order.slice(-2)).toEqual(['forget', 'pointer']);
    expect(dropCandidate).toHaveBeenCalledTimes(1);
    expect(dropCandidate).toHaveBeenCalledWith(RECIPE, PATH, undefined);
  });

  it('leaves a person’s app reading what it reads of any picture: ready and an address, nothing about who accepted it', async () => {
    const { files } = stores();

    await accept(files);

    const picture = acceptCandidate.mock.calls[0]?.[2];

    expect(toPictureStatus({ status: 'ready', url: picture?.url ?? null })).toEqual({ status: 'ready', url: URL });
  });

  it('is not held by the month’s cap: it calls no model and reads no spend', async () => {
    const { files } = stores();

    monthSpendUsd.mockResolvedValue(1_000_000);

    await expect(accept(files)).resolves.toBe('accepted');
    expect(monthSpendUsd).not.toHaveBeenCalled();
  });

  it('accepts a candidate nothing was flagged on only with the empty list, said explicitly', async () => {
    candidateRow.mockResolvedValue(failed({ provenance: { candidate: { ...CANDIDATE, extras: [] }, reason: 'judge_rejected' } }));

    await expect(accept(stores().files, ['milk'])).resolves.toSatisfy(error => refusal(error) === 'allergens_mismatch');
    await expect(accept(stores().files, [])).resolves.toBe('accepted');
    expect(record).toHaveBeenLastCalledWith(expect.objectContaining({ metadata: { allergens: [] } }), 'tx');
  });

  describe('before the first step', () => {
    it.each<[string, () => void, string]>([
      ['a recipe that does not exist', () => recipeExists.mockResolvedValue(false), RECIPE],
      ['an id that is not one', () => undefined, 'not-a-uuid-zzq']
    ])('is not found for %s, never echoing it, and reads nothing', async (_case, arrange, id) => {
      const { files } = stores();

      arrange();

      const error = await accept(files, SHOWN, id);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as Error).message).toBe('Recipe not found');
      expect(candidateRow).not.toHaveBeenCalled();
      expect(files.read).not.toHaveBeenCalled();
      expectNothingWritten(files);
    });

    it('refuses with the `dishPictures` switch off, as the retry does', async () => {
      const { files } = stores();

      dishPictures.mockResolvedValue(false);

      expect(refusal(await accept(files))).toBe('flag_off');
      expect(candidateRow).not.toHaveBeenCalled();
      expect(files.read).not.toHaveBeenCalled();
      expectNothingWritten(files);
    });

    it('refuses when a store is not configured', async () => {
      const { files } = stores({ available: false });

      expect(refusal(await accept(files))).toBe('unavailable');
      expect(files.read).not.toHaveBeenCalled();
      expectNothingWritten(files);
    });
  });

  describe('step 1 — a failed row holding a candidate that has not expired', () => {
    it.each<[string, Row | null]>([
      ['a dish with no candidate', null],
      ['a candidate expired to the millisecond, though the cleanup has not deleted it', failed({ lastAttemptAt: new Date(NOW.getTime() - 7 * DAY) })],
      ['a row that is ready', failed({ status: 'ready' })],
      ['a row being drawn', failed({ status: 'drawing' })],
      ['a row with no date', failed({ lastAttemptAt: null })],
      [
        'a pointer outside the candidates’ folder',
        failed({ provenance: { candidate: { ...CANDIDATE, path: `dish-pictures/${RECIPE}/2.0.0-x.jpg` } } })
      ]
    ])('refuses %s, and touches no store', async (_case, row) => {
      const { files } = stores();

      candidateRow.mockResolvedValue(row);

      expect(refusal(await accept(files))).toBe('no_candidate');
      expect(files.read).not.toHaveBeenCalled();
      expectNothingWritten(files);
    });

    it('accepts up to the last millisecond of the cool-off', async () => {
      candidateRow.mockResolvedValue(failed({ lastAttemptAt: new Date(NOW.getTime() - PICTURE_COOL_OFF_DAYS * DAY + 1) }));

      await expect(accept(stores().files)).resolves.toBe('accepted');
    });
  });

  /*
   * The allergens alone do not say which candidate was seen: a retry from another tab can leave another candidate on the
   * same dish, flagged for the same allergens — a picture the owner never looked at.
   */
  describe('step 2 — the body names the very candidate the console showed', () => {
    const SEEN = new Date(ENDED.getTime() + PICTURE_COOL_OFF_DAYS * DAY).toISOString();

    it('refuses another candidate of the same dish with the same allergens — one a later drawing left — and writes nothing', async () => {
      const { files } = stores();
      const later = new Date(ENDED.getTime() + 3_600_000);

      // Same dish, same flags, another file: the drawing a retry started ended an hour after the one that was seen.
      candidateRow.mockResolvedValue(
        failed({
          lastAttemptAt: later,
          provenance: { candidate: { ...CANDIDATE, path: PATH.replace('0b7e3f2a', '1c8f4a3b') }, reason: 'judge_allergen' }
        })
      );

      const error = await accept(files, SHOWN, RECIPE, SEEN);

      expect(refusal(error)).toBe('no_candidate');
      expect(files.read).not.toHaveBeenCalled();
      expectNothingWritten(files);
    });

    it('refuses a candidate a millisecond apart from the one that was seen', async () => {
      const { files } = stores();

      candidateRow.mockResolvedValue(failed({ lastAttemptAt: new Date(ENDED.getTime() + 1) }));

      expect(refusal(await accept(files, SHOWN, RECIPE, SEEN))).toBe('no_candidate');
      expectNothingWritten(files);
    });

    it('compares instants, however the same moment is written', async () => {
      // 2026-10-06T12:00:00.000Z, with an offset and without its milliseconds.
      expect(SEEN).toBe('2026-10-06T12:00:00.000Z');
      await expect(accept(stores().files, SHOWN, RECIPE, '2026-10-06T14:00:00+02:00')).resolves.toBe('accepted');
      await expect(accept(stores().files, SHOWN, RECIPE, '2026-10-06T12:00:00Z')).resolves.toBe('accepted');
    });

    it('never says when the stored candidate expires', async () => {
      const error = await accept(stores().files, SHOWN, RECIPE, '2026-10-05T12:00:00.000Z');

      expect(refusal(error)).toBe('no_candidate');
      expect((error as Error).message).not.toMatch(/2026/);
    });
  });

  describe('step 2 — the body repeats the allergens the console showed', () => {
    it.each<[string, readonly string[]]>([
      ['none', []],
      ['one missing', ['milk']],
      ['one extra', ['crustaceans', 'milk', 'egg']],
      ['different ones', ['egg', 'gluten']],
      ['the catalogue ingredients in the place of the keys', ['gambas', 'queso']]
    ])('refuses %s before the file is read, and never says which ones are stored', async (_case, shown) => {
      const { files } = stores();
      const error = await accept(files, shown);

      expect(refusal(error)).toBe('allergens_mismatch');
      expect((error as Error).message).not.toMatch(/crustaceans|milk/);
      expect(files.read).not.toHaveBeenCalled();
      expectNothingWritten(files);
    });

    it('takes them in any order', async () => {
      await expect(accept(stores().files, ['milk', 'crustaceans'])).resolves.toBe('accepted');
    });
  });

  describe('step 3 — the bytes about to be published carry their C2PA manifest', () => {
    it.each<[string, Uint8Array]>([
      ['a file whose manifest was stripped — the store holds a tampered file', STRIPPED],
      ['a file that is not a JPEG', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      ['an empty file', new Uint8Array()]
    ])('refuses %s, whatever the row says it was, and publishes nothing', async (_case, bytes) => {
      const { files } = stores({ read: async () => bytes });

      // The row's own words are no evidence: only the bytes read now are.
      candidateRow.mockResolvedValue(failed({ provenance: { c2pa: true, candidate: CANDIDATE, reason: 'judge_allergen' } }));

      expect(refusal(await accept(files))).toBe('not_acceptable');
      expectNothingWritten(files);
    });

    it('refuses when the private store no longer has the file', async () => {
      const { files } = stores({ read: async () => null });

      expect(refusal(await accept(files))).toBe('no_candidate');
      expectNothingWritten(files);
    });

    it('fails, publishing nothing, when the private store cannot be read', async () => {
      const { files } = stores({ read: async () => Promise.reject(new Error('Candidate get failed: 503')) });

      await expect(accept(files)).resolves.toMatchObject({ message: 'Candidate get failed: 503' });
      expectNothingWritten(files);
    });

    it('refuses a prompt version that is not one plain token, so the public path can name no other folder', async () => {
      const { files } = stores();

      candidateRow.mockResolvedValue(failed({ provenance: { candidate: { ...CANDIDATE, promptVersion: '../2.0.0' } } }));

      expect(refusal(await accept(files))).toBe('not_acceptable');
      expectNothingWritten(files);
    });
  });

  describe('step 4 — the public store', () => {
    it('fails with the row untouched and no audit row when the file cannot be published', async () => {
      const { files } = stores({ publish: async () => Promise.reject(new Error('Blob put failed: 503')) });

      await expect(accept(files)).resolves.toMatchObject({ message: 'Blob put failed: 503' });
      expect(acceptCandidate).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
      // The candidate is still there to be accepted again.
      expect(files.forget).not.toHaveBeenCalled();
      expect(dropCandidate).not.toHaveBeenCalled();
    });
  });

  describe('step 5 — ready and its audit row, together or not at all', () => {
    it('refuses and deletes the public file it just wrote when the row moved: another tab, a retry, a discard, the cleanup', async () => {
      const { files, order } = stores();

      acceptCandidate.mockResolvedValue(false);

      expect(refusal(await accept(files))).toBe('no_candidate');
      expect(order).toEqual(['read', 'publish', 'unpublish']);
      expect(files.unpublish).toHaveBeenCalledWith(URL);
      expect(record).not.toHaveBeenCalled();
      // The private file is whoever moved the row's to delete: this acceptance did not happen.
      expect(files.forget).not.toHaveBeenCalled();
      expect(dropCandidate).not.toHaveBeenCalled();
    });

    it('publishes nothing when the audit row cannot be written: the transaction fails, and the public file is deleted', async () => {
      const { files, order } = stores();

      record.mockRejectedValue(new DatabaseOperationError());
      // As the repository does: what the audit write throws leaves the transaction, which rolls the update back.
      acceptCandidate.mockImplementation(async (_id, _seen, _picture, _now, audit) => {
        await audit('tx');

        return true;
      });

      await expect(accept(files)).resolves.toBeInstanceOf(DatabaseOperationError);
      expect(order).toEqual(['read', 'publish', 'unpublish']);
      expect(files.unpublish).toHaveBeenCalledWith(URL);
      expect(files.forget).not.toHaveBeenCalled();
      expect(dropCandidate).not.toHaveBeenCalled();
    });

    it('does not read the row back when nothing was updated: that transaction answered, and no row points to the file', async () => {
      const { files } = stores();

      acceptCandidate.mockResolvedValue(false);
      await accept(files);

      expect(settledPicture).not.toHaveBeenCalled();
      expect(files.unpublish).toHaveBeenCalledTimes(1);
    });

    /*
     * The answer to a COMMIT can be lost on its way back: the transaction throws and the row is `ready` all the same.
     * A picture on somebody's screen whose file was deleted is the one outcome an acceptance may never produce.
     */
    it('reads the row back under its lock, never with a plain read: a commit still in flight is waited for, not guessed', async () => {
      acceptCandidate.mockRejectedValue(new DatabaseOperationError());

      await accept(stores().files);

      expect(settledPicture).toHaveBeenCalledTimes(1);
      expect(settledPicture).toHaveBeenCalledWith(RECIPE, 3_000);
      expect(pictureState).not.toHaveBeenCalled();
    });

    it('keeps the public file and goes on to step 6 when the transaction threw but the row settled ready at that very address', async () => {
      const { files, order } = stores();

      acceptCandidate.mockRejectedValue(new DatabaseOperationError());
      settledPicture.mockResolvedValue({ status: 'ready', url: URL });

      await expect(accept(files)).resolves.toBe('accepted');

      expect(files.unpublish).not.toHaveBeenCalled();
      expect(order).toEqual(['read', 'publish', 'forget']);
      expect(dropCandidate).toHaveBeenCalledWith(RECIPE, PATH, undefined);
    });

    it.each<[string, Settled]>([
      ['still failed', { status: 'failed', url: null }],
      ['being drawn again', { status: 'drawing', url: null }],
      [
        'ready at another address — somebody else’s acceptance, or the judge’s picture',
        { status: 'ready', url: 'https://store.example/dish-pictures/other.jpg' }
      ],
      ['ready with no address', { status: 'ready', url: null }],
      ['gone', null]
    ])('deletes the public file and fails when the transaction threw and the row settled %s', async (_case, row) => {
      const { files, order } = stores();

      acceptCandidate.mockRejectedValue(new DatabaseOperationError());
      settledPicture.mockResolvedValue(row);

      await expect(accept(files)).resolves.toBeInstanceOf(DatabaseOperationError);

      expect(order).toEqual(['read', 'publish', 'unpublish']);
      expect(files.unpublish).toHaveBeenCalledWith(URL);
      expect(files.forget).not.toHaveBeenCalled();
      expect(dropCandidate).not.toHaveBeenCalled();
    });

    it('leaves the public file where it is when the row cannot be had in time, or read at all: the outcome is unknown', async () => {
      const { files, order } = stores();
      const thrown = new DatabaseOperationError();

      acceptCandidate.mockRejectedValue(thrown);
      // The lock timeout, or a database that is down: the repository throws either way.
      settledPicture.mockRejectedValue(new DatabaseOperationError());

      await expect(accept(files)).resolves.toBe(thrown);

      expect(order).toEqual(['read', 'publish']);
      expect(files.unpublish).not.toHaveBeenCalled();
      // The candidate is untouched too: the private file and its pointer stay for the next try, or the cleanup.
      expect(files.forget).not.toHaveBeenCalled();
      expect(dropCandidate).not.toHaveBeenCalled();
    });

    it('still refuses, with the same code, when the public file it wrote cannot be deleted either', async () => {
      const { files } = stores({ unpublish: async () => Promise.reject(new Error('Blob del failed: 503')) });

      acceptCandidate.mockResolvedValue(false);

      expect(refusal(await accept(files))).toBe('no_candidate');
    });
  });

  describe('step 6 — the private file, then its pointer', () => {
    it('still succeeds when the private file cannot be deleted, and leaves the pointer for the cleanup to find', async () => {
      const { files } = stores({ forget: async () => Promise.reject(new Error('Candidate del failed: 503')) });

      await expect(accept(files)).resolves.toBe('accepted');
      expect(dropCandidate).not.toHaveBeenCalled();
      expect(files.unpublish).not.toHaveBeenCalled();
      expect(record).toHaveBeenCalledTimes(1);
    });

    it('still succeeds when the pointer cannot be removed after the file is gone', async () => {
      const { files } = stores();

      dropCandidate.mockRejectedValue(new DatabaseOperationError());

      await expect(accept(files)).resolves.toBe('accepted');
      expect(files.unpublish).not.toHaveBeenCalled();
    });
  });
});

/* PRD 009, criterion 6: only a picture accepted by hand can be taken back. */
describe('RecipeController.removePicture', () => {
  function stores(overrides: Partial<{ forget: (path: string) => Promise<void>; unpublish: (url: string) => Promise<void> }> = {}) {
    const order: string[] = [];
    const files = {
      forget: vi.fn(async (_path: string) => {
        order.push('forget');
      }),
      unpublish: vi.fn(async (_url: string) => {
        order.push('unpublish');
      }),
      ...overrides
    };

    return { files, order };
  }

  it('writes the row and its audit row first, and only then deletes the public file', async () => {
    const { files, order } = stores();

    removeAcceptedPicture.mockImplementation(async (_id, _now, audit) => {
      order.push('row');
      await audit('tx');
      order.push('audit');

      return { candidatePath: null, url: URL };
    });

    await expect(RecipeController.removePicture(RECIPE, OWNER, files, NOW)).resolves.toEqual({ fileDeleted: true });

    expect(order).toEqual(['row', 'audit', 'unpublish']);
    // The cool-off counts from the removal, so the dish is not drawn again at once.
    expect(removeAcceptedPicture).toHaveBeenCalledWith(RECIPE, NOW, expect.any(Function));
    expect(files.unpublish).toHaveBeenCalledWith(URL);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({ action: 'picture.removed', actorId: OWNER, entity: 'recipe', entityId: RECIPE, metadata: {} }, 'tx');
    expect(files.forget).not.toHaveBeenCalled();
  });

  it('refuses a picture the judge accepted — and a dish with none — writing nothing and deleting nothing', async () => {
    const { files } = stores();

    removeAcceptedPicture.mockResolvedValue(null);

    const error = await RecipeController.removePicture(RECIPE, OWNER, files, NOW).catch((thrown: unknown) => thrown);

    expect(refusal(error)).toBe('not_removable');
    expect(record).not.toHaveBeenCalled();
    expect(files.unpublish).not.toHaveBeenCalled();
    expect(files.forget).not.toHaveBeenCalled();
  });

  it('stands, and says the file is still there, when the public file cannot be deleted', async () => {
    const { files } = stores({ unpublish: async () => Promise.reject(new Error('Blob del failed: 503')) });

    await expect(RecipeController.removePicture(RECIPE, OWNER, files, NOW)).resolves.toEqual({ fileDeleted: false });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('deletes nothing from the public store when the audit row cannot be written: the picture stays as it was', async () => {
    const { files } = stores();

    record.mockRejectedValue(new DatabaseOperationError());

    await expect(RecipeController.removePicture(RECIPE, OWNER, files, NOW)).rejects.toBeInstanceOf(DatabaseOperationError);
    expect(files.unpublish).not.toHaveBeenCalled();
  });

  it('also deletes the private file of a candidate the row still held, and does not mind if that fails', async () => {
    const { files, order } = stores();

    removeAcceptedPicture.mockResolvedValue({ candidatePath: PATH, url: URL });

    await expect(RecipeController.removePicture(RECIPE, OWNER, files, NOW)).resolves.toEqual({ fileDeleted: true });
    expect(files.forget).toHaveBeenCalledWith(PATH);
    expect(order).toEqual(['forget', 'unpublish']);

    const failing = stores({ forget: async () => Promise.reject(new Error('Candidate del failed: 503')) });

    await expect(RecipeController.removePicture(RECIPE, OWNER, failing.files, NOW)).resolves.toEqual({ fileDeleted: true });
  });

  it('needs neither the `dishPictures` switch nor the month’s cap: taking a picture back is always possible', async () => {
    dishPictures.mockResolvedValue(false);

    await expect(RecipeController.removePicture(RECIPE, OWNER, stores().files, NOW)).resolves.toEqual({ fileDeleted: true });
    expect(dishPictures).not.toHaveBeenCalled();
    expect(monthSpendUsd).not.toHaveBeenCalled();
  });

  it.each<[string, () => void, string]>([
    ['a recipe that does not exist', () => recipeExists.mockResolvedValue(false), RECIPE],
    ['an id that is not one', () => undefined, 'not-a-uuid-zzq']
  ])('is not found for %s, never echoing it, and removes nothing', async (_case, arrange, id) => {
    arrange();

    const error = await RecipeController.removePicture(id, OWNER, stores().files, NOW).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe('Recipe not found');
    expect(removeAcceptedPicture).not.toHaveBeenCalled();
  });
});

/*
 * Between steps 5 and 6 — or for as long as step 6 keeps failing — the row is `ready` and still holds the candidate's
 * pointer, until the nightly cleanup takes it. Nothing may treat that row as a dish with a candidate.
 */
describe('a ready row that still holds its candidate’s pointer', () => {
  const held: Row = {
    lastAttemptAt: ENDED,
    provenance: {
      acceptedBy: 'owner',
      c2pa: true,
      candidate: CANDIDATE,
      overriddenAllergens: ['crustaceans', 'milk'],
      trainedAlgorithmicMedia: true
    },
    status: 'ready'
  };

  beforeEach(() => {
    candidateRow.mockResolvedValue(held);
  });

  it('holds no candidate that can be looked at, within its seven days or not', () => {
    expect(reviewableCandidate(held, NOW)).toBeNull();
    expect(reviewableCandidate({ ...held, lastAttemptAt: NOW }, NOW)).toBeNull();
  });

  it('serves no bytes: the file’s route finds no candidate', async () => {
    const error = await RecipeController.pictureCandidate(RECIPE, NOW).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe('Picture candidate not found');
  });

  it('cannot be discarded: no file is deleted, no pointer removed and no audit row written', async () => {
    const forget = vi.fn(async (_path: string) => undefined);

    await expect(RecipeController.discardCandidate(RECIPE, OWNER, forget, NOW)).rejects.toBeInstanceOf(NotFoundError);

    expect(forget).not.toHaveBeenCalled();
    expect(dropCandidate).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('cannot be accepted again: nothing is read, published or written', async () => {
    const { files } = stores();

    expect(refusal(await accept(files))).toBe('no_candidate');
    expect(files.read).not.toHaveBeenCalled();
    expectNothingWritten(files);
  });

  it('is cleaned of its private file when the owner removes the picture, before the public one', async () => {
    const order: string[] = [];
    const files = {
      forget: vi.fn(async (_path: string) => {
        order.push('private');
      }),
      unpublish: vi.fn(async (_url: string) => {
        order.push('public');
      })
    };

    removeAcceptedPicture.mockImplementation(async (_id, _now, audit) => {
      await audit('tx');

      return { candidatePath: PATH, url: URL };
    });

    await expect(RecipeController.removePicture(RECIPE, OWNER, files, NOW)).resolves.toEqual({ fileDeleted: true });

    expect(files.forget).toHaveBeenCalledWith(PATH);
    expect(files.unpublish).toHaveBeenCalledWith(URL);
    expect(order).toEqual(['private', 'public']);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'picture.removed' }), 'tx');
  });
});
