import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { recipeImageCalls, recipeImages } from 'database/schema/recipe';

import { ACCEPTED_BY_OWNER, PICTURE_DRAWINGS_KEPT, pictureJudgedDrawing, pictureJudgement } from 'core/entities/DishPicture';

import { ACCEPTED_BY_OWNER_SQL, RecipeRepository } from './RecipeRepository';

import type { SQL } from 'drizzle-orm';
import type { PictureJudgedDrawing } from 'core/entities/DishPicture';

// As the client reads column names (`database`): snake_case.
const dialect = new PgDialect({ casing: 'snake_case' });

type Upsert = { readonly set: Record<string, unknown>; readonly setWhere: { params: unknown[]; sql: string }; readonly target: unknown };
type Statement =
  | { readonly kind: 'delete'; readonly table: unknown; readonly where: { params: unknown[]; sql: string } }
  | { readonly kind: 'execute'; readonly params: unknown[]; readonly sql: string }
  | { readonly kind: 'insert'; readonly table: unknown; readonly upsert?: Upsert; readonly values: Record<string, unknown> }
  | { readonly kind: 'select'; readonly table: unknown; readonly where: { params: unknown[]; sql: string } }
  | { readonly kind: 'update'; readonly set: Record<string, unknown>; readonly table: unknown; readonly where: { params: unknown[]; sql: string } };

const statements: Statement[] = [];
/** What each `RETURNING` / read answers, in order; empty means no row. */
let answers: unknown[][] = [];

function next(): Promise<unknown[]> {
  return Promise.resolve(answers.shift() ?? []);
}

function insert(table: unknown) {
  return {
    values: (values: Record<string, unknown>) => {
      const statement: { kind: 'insert'; table: unknown; upsert?: Upsert; values: Record<string, unknown> } = { kind: 'insert', table, values };

      statements.push(statement);

      return Object.assign(Promise.resolve(), {
        onConflictDoUpdate: (upsert: { set: Record<string, unknown>; setWhere: SQL; target: unknown }) => {
          statement.upsert = { ...upsert, setWhere: dialect.sqlToQuery(upsert.setWhere) };

          return { returning: next };
        }
      });
    }
  };
}

/** The strength of every locking read, in order. */
const locks: string[] = [];

/** Which handle each UPDATE went through: the transaction's, or the client's own. */
const updatedThrough: string[] = [];

function updateVia(handle: string) {
  return (table: unknown) => {
    updatedThrough.push(handle);

    return update(table);
  };
}

function update(table: unknown) {
  return {
    set: (set: Record<string, unknown>) => ({
      where: (where: SQL) => {
        statements.push({ kind: 'update', set, table, where: dialect.sqlToQuery(where) });

        return { returning: next };
      }
    })
  };
}

function remove(table: unknown) {
  return {
    where: (where: SQL) => {
      statements.push({ kind: 'delete', table, where: dialect.sqlToQuery(where) });

      return { returning: next };
    }
  };
}

function select() {
  return {
    from: (table: unknown) => ({
      where: (where: SQL) => {
        statements.push({ kind: 'select', table, where: dialect.sqlToQuery(where) });

        // Awaited directly (an aggregate), through `.limit()`, locked (`.for()`) or ordered first: one answer either way.
        return {
          for: (strength: string) => {
            locks.push(strength);

            return next();
          },
          limit: next,
          orderBy: () => ({ limit: next }),
          then: (resolve: (rows: unknown[]) => unknown) => next().then(resolve)
        };
      }
    })
  };
}

const db = { delete: remove, insert, select, update };

/** A handle of its own, so a statement sent outside the transaction cannot pass for one sent inside it. */
const tx = {
  ...db,
  execute: async (query: SQL) => {
    statements.push({ kind: 'execute', ...dialect.sqlToQuery(query) });

    return Promise.resolve([]);
  },
  update: updateVia('tx')
};

vi.mock('database', () => ({
  database: () => ({ ...db, transaction: async (run: (handle: typeof tx) => Promise<unknown>) => run(tx), update: updateVia('client') })
}));

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
const NOW = new Date('2026-09-27T12:00:00Z');
/** When the drawing being ended was claimed. */
const CLAIMED = new Date('2026-09-27T11:58:00Z');

/** A candidate's place in the private store. */
const CANDIDATE = `dish-picture-candidates/${RECIPE}/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg`;

/** What a drawing's end writes as `provenance`: what it was given, and the candidate's pointer the row already holds. */
const KEEPING =
  "$1::jsonb || case when ((\"recipe_images\".\"provenance\" -> 'candidate' ->> 'path') is not null) then jsonb_build_object('candidate', \"recipe_images\".\"provenance\" -> 'candidate') else '{}'::jsonb end";

function written(value: unknown): { params: unknown[]; sql: string } {
  return dialect.sqlToQuery(value as SQL);
}

/** What `KEEPING` was given, parsed back: the provenance a write stores, before the pointer is carried over. */
function stored(value: unknown): Record<string, unknown> {
  return JSON.parse(String(written(value).params[0])) as Record<string, unknown>;
}

/** A drawing whose one attempt was rejected for `food`, judged at `at`: what a drawing's end hands the repository. */
function judgedDrawing(at: string, food: string): PictureJudgedDrawing {
  const judgement = pictureJudgement({
    at: new Date(at),
    match: { extras: [food], ingredients: [{ matched: [], slug: 'arroz-blanco-cocido', status: 'seen' }] },
    number: 1,
    seen: { foods: [{ amount: 'main', name: food, specific: true }] },
    verdict: { accepted: false, notes: [`extra_food:${food}`] }
  });
  const drawing =
    judgement === null
      ? null
      : pictureJudgedDrawing({ ingredients: [{ grams: 200, name: 'Cooked white rice', slug: 'arroz-blanco-cocido' }], name: 'Arroz' }, [judgement]);

  if (drawing === null) {
    throw new Error('expected a drawing');
  }

  return drawing;
}

/** The statement a drawing's end sends after its locked read, checked to be an update. */
function endOf(index = 1): Extract<Statement, { kind: 'update' }> {
  const statement = statements[index];

  if (statement?.kind !== 'update') {
    throw new Error('expected an update');
  }

  return statement;
}

/** The locked read every end of a drawing starts with: the row this caller still holds. */
const HELD = {
  kind: 'select',
  table: recipeImages,
  where: {
    params: [RECIPE, 'drawing', CLAIMED.toISOString()],
    sql: '("recipe_images"."recipe_id" = $1 and "recipe_images"."status" = $2 and "recipe_images"."last_attempt_at" = $3)'
  }
};

beforeEach(() => {
  statements.length = 0;
  updatedThrough.length = 0;
  locks.length = 0;
  answers = [];
});

/*
 * What is pinned here is the statement each method sends. That Postgres keeps
 * its promise for `INSERT … ON CONFLICT` — the second of two concurrent
 * inserters waits on the first's row and re-evaluates the `WHERE` against it —
 * is the end-to-end suite's to prove (project 006, phase 3).
 */
describe('RecipeRepository.claimPicture', () => {
  it('is one statement: an insert that claims, an update only of a failed row past its cool-off, a released one or a stale drawing, and RETURNING', async () => {
    answers = [[{ recipeId: RECIPE }]];

    await expect(RecipeRepository.claimPicture(RECIPE, NOW, 7)).resolves.toBe(true);

    expect(statements).toHaveLength(1);
    const [claim] = statements;

    expect(claim?.kind).toBe('insert');

    if (claim?.kind !== 'insert') {
      return;
    }

    expect(claim.table).toBe(recipeImages);
    expect(claim.values).toEqual({ attempts: 0, lastAttemptAt: NOW, recipeId: RECIPE, status: 'drawing' });
    expect(claim.upsert?.target).toBe(recipeImages.recipeId);
    expect(claim.upsert?.set).toMatchObject({ lastAttemptAt: NOW, status: 'drawing' });
    // A takeover of a stale drawing counts it; a released row keeps its count; a claim after a failure's cool-off starts again.
    expect(dialect.sqlToQuery(claim.upsert?.set.attempts as SQL).sql).toBe(
      'case when "recipe_images"."status" = \'drawing\' then "recipe_images"."attempts" + 1 when ("recipe_images"."provenance" ->> \'released\') is not null then "recipe_images"."attempts" else 0 end'
    );
    // 0072: a row holding a candidate is never claimed, whichever of the three it is.
    expect(claim.upsert?.setWhere.sql).toBe(
      '(not (("recipe_images"."provenance" -> \'candidate\' ->> \'path\') is not null) and (("recipe_images"."status" = $1 and "recipe_images"."last_attempt_at" < $2) or ("recipe_images"."status" = $3 and ("recipe_images"."provenance" ->> \'released\') is not null) or ("recipe_images"."status" = $4 and "recipe_images"."last_attempt_at" < $5)))'
    );
    // 7 days of cool-off after a failure; a drawing is stale 15 minutes after its claim by default.
    expect(claim.upsert?.setWhere.params).toEqual([
      'failed',
      new Date('2026-09-20T12:00:00Z').toISOString(),
      'failed',
      'drawing',
      new Date('2026-09-27T11:45:00Z').toISOString()
    ]);
  });

  it('takes the stale-after value it is given', async () => {
    await RecipeRepository.claimPicture(RECIPE, NOW, 7, 30);

    const [claim] = statements;

    if (claim?.kind !== 'insert') {
      throw new Error('expected the claim');
    }

    expect(claim.upsert?.setWhere.params[4]).toBe(new Date('2026-09-27T11:30:00Z').toISOString());
  });

  it('of two callers, the one whose statement returns no row has lost — a ready, drawing or recently failed row', async () => {
    answers = [[{ recipeId: RECIPE }], []];

    const [first, second] = await Promise.all([RecipeRepository.claimPicture(RECIPE, NOW, 7), RecipeRepository.claimPicture(RECIPE, NOW, 7)]);

    expect([first, second]).toEqual([true, false]);
    expect(statements.map(statement => statement.kind)).toEqual(['insert', 'insert']);
  });

  it('never matches a ready row: `ready` is nowhere in the condition', async () => {
    await RecipeRepository.claimPicture(RECIPE, NOW, 7);

    const [claim] = statements;

    if (claim?.kind !== 'insert') {
      throw new Error('expected the claim');
    }

    expect(claim.upsert?.setWhere.params).not.toContain('ready');
  });
});

describe('RecipeRepository — ending a drawing', () => {
  it('completePicture writes the address and what drew it, only over the drawing this caller claimed', async () => {
    answers = [[{ provenance: null }], [{ recipeId: RECIPE }]];
    const picture = {
      attempts: 2,
      judged: null,
      model: 'google/gemini-3.1-flash-lite-image',
      promptVersion: '2.0.0',
      provenance: { c2pa: true },
      url: 'https://blob/x.jpg'
    };

    await expect(RecipeRepository.completePicture(RECIPE, CLAIMED, picture)).resolves.toBe(true);

    // The row this drawing still holds is read and locked first, in the transaction the update goes through.
    expect(statements[0]).toMatchObject(HELD);
    expect(locks).toEqual(['update']);
    expect(updatedThrough).toEqual(['tx']);

    const done = endOf();

    expect(done.table).toBe(recipeImages);
    expect(done.set).toMatchObject({ attempts: 2, model: picture.model, promptVersion: '2.0.0', status: 'ready', url: picture.url });
    expect(written(done.set.provenance)).toMatchObject({ params: ['{"c2pa":true}'], sql: KEEPING });
    expect(done.set).not.toHaveProperty('bytes');
    expect(done.where.sql).toBe('("recipe_images"."recipe_id" = $1 and "recipe_images"."status" = $2 and "recipe_images"."last_attempt_at" = $3)');
    expect(done.where.params).toEqual([RECIPE, 'drawing', CLAIMED.toISOString()]);
  });

  it('completePicture answers false when the row is no longer this caller’s drawing — ended, or taken over as stale', async () => {
    await expect(
      RecipeRepository.completePicture(RECIPE, CLAIMED, { attempts: 1, judged: null, model: 'm', promptVersion: 'v', provenance: {}, url: 'u' })
    ).resolves.toBe(false);
    // Nothing held: nothing is written.
    expect(statements.map(statement => statement.kind)).toEqual(['select']);

    // Held when read, and taken over before the write: the guarded update reaches nothing.
    answers = [[{ provenance: null }], []];

    await expect(
      RecipeRepository.completePicture(RECIPE, CLAIMED, { attempts: 1, judged: null, model: 'm', promptVersion: 'v', provenance: {}, url: 'u' })
    ).resolves.toBe(false);
  });

  it('failPicture starts the cool-off from when the drawing ended, only over the drawing this caller claimed', async () => {
    answers = [[{ provenance: null }], [{ recipeId: RECIPE }]];

    await expect(RecipeRepository.failPicture(RECIPE, CLAIMED, { attempts: 3, judged: null, provenance: { rejected: 3 } }, NOW)).resolves.toBe(true);

    expect(statements[0]).toMatchObject(HELD);
    expect(updatedThrough).toEqual(['tx']);

    const failed = endOf();

    expect(failed.set).toMatchObject({ attempts: 3, lastAttemptAt: NOW, status: 'failed' });
    expect(written(failed.set.provenance)).toMatchObject({ params: ['{"rejected":3}'], sql: KEEPING });
    expect(failed.where.params).toEqual([RECIPE, 'drawing', CLAIMED.toISOString()]);
  });

  /* 0072: a drawing's end never forgets where a rejected file is kept. */
  it('failPicture writes the candidate it is given, inside what the row stores', async () => {
    answers = [[{ provenance: null }], [{ recipeId: RECIPE }]];
    const provenance = { candidate: { extras: [], model: 'm', path: CANDIDATE, promptVersion: '2.0.0' }, notes: [], reason: 'judge_allergen' };

    await RecipeRepository.failPicture(RECIPE, CLAIMED, { attempts: 3, judged: null, provenance }, NOW);

    expect(written(endOf().set.provenance).params).toEqual([JSON.stringify(provenance)]);
  });
});

describe('RecipeRepository — reading a picture and its spend', () => {
  it('pictureState answers `none` for a dish with no row', async () => {
    await expect(RecipeRepository.pictureState(RECIPE)).resolves.toEqual({
      attempts: 0,
      candidate: false,
      lastAttemptAt: null,
      released: false,
      status: 'none',
      url: null
    });
  });

  it('pictureState returns the stored row', async () => {
    answers = [[{ attempts: 1, lastAttemptAt: NOW, status: 'ready', url: 'https://blob/x.jpg' }]];

    await expect(RecipeRepository.pictureState(RECIPE)).resolves.toEqual({
      attempts: 1,
      lastAttemptAt: NOW,
      status: 'ready',
      url: 'https://blob/x.jpg'
    });
  });

  it('pictureState refuses a status the schema does not know', async () => {
    answers = [[{ attempts: 0, lastAttemptAt: null, status: 'queued', url: null }]];

    await expect(RecipeRepository.pictureState(RECIPE)).rejects.toThrow('Schema mismatch on recipe_images');
  });

  it('monthSpendUsd sums from the month’s start and turns Postgres’s numeric string into a number', async () => {
    answers = [[{ total: '0.067394' }]];

    await expect(RecipeRepository.monthSpendUsd(new Date('2026-09-01T00:00:00Z'))).resolves.toBe(0.067394);

    const [read] = statements;

    if (read?.kind !== 'select') {
      throw new Error('expected a read');
    }

    expect(read.table).toBe(recipeImageCalls);
    expect(read.where.sql).toBe('"recipe_image_calls"."created_at" >= $1');
  });

  it('recordPictureCall stores the cost as the numeric string Postgres keeps', async () => {
    await RecipeRepository.recordPictureCall({
      costUsd: 0.03369775,
      kind: 'image',
      model: 'google/gemini-3.1-flash-lite-image',
      outcome: 'accepted',
      recipeId: RECIPE
    });

    const [call] = statements;

    if (call?.kind !== 'insert') {
      throw new Error('expected an insert');
    }

    expect(call.table).toBe(recipeImageCalls);
    expect(call.values).toEqual({
      costUsd: '0.03369775',
      kind: 'image',
      model: 'google/gemini-3.1-flash-lite-image',
      outcome: 'accepted',
      recipeId: RECIPE
    });
  });
});

describe('RecipeRepository.releasePicture', () => {
  it('ends the claim as a released failure that keeps its attempts, only over the drawing this caller claimed', async () => {
    answers = [[{ provenance: null }], [{ recipeId: RECIPE }]];

    await expect(
      RecipeRepository.releasePicture(RECIPE, CLAIMED, { attempts: 2, judged: null, reason: 'cap_reached', why: 'cap' }, NOW)
    ).resolves.toBe(true);

    expect(statements[0]).toMatchObject(HELD);
    expect(updatedThrough).toEqual(['tx']);

    const release = endOf();

    expect(release.table).toBe(recipeImages);
    expect(release.set).toMatchObject({ attempts: 2, lastAttemptAt: NOW, status: 'failed' });
    expect(written(release.set.provenance)).toMatchObject({ params: ['{"reason":"cap_reached","released":"cap"}'], sql: KEEPING });
    expect(release.where.sql).toBe('("recipe_images"."recipe_id" = $1 and "recipe_images"."status" = $2 and "recipe_images"."last_attempt_at" = $3)');
    expect(release.where.params).toEqual([RECIPE, 'drawing', CLAIMED.toISOString()]);
  });

  it('answers false when the claim was taken over or ended', async () => {
    await expect(
      RecipeRepository.releasePicture(RECIPE, CLAIMED, { attempts: 0, judged: null, reason: 'cap_reached', why: 'cap' }, NOW)
    ).resolves.toBe(false);
  });
});

describe('RecipeRepository.retryPicture', () => {
  it('claims only a failed row, released or past its cool-off or not, for a fresh three attempts — and the audit row goes in the same transaction', async () => {
    answers = [[{ path: null, provenance: { notes: ['1:failed:x'], reason: 'call_failed' } }], [{ recipeId: RECIPE }]];
    const record = vi.fn(async () => Promise.resolve());

    await expect(RecipeRepository.retryPicture(RECIPE, NOW, 15, record)).resolves.toEqual({ candidatePath: null });

    const [locked, claim] = statements;

    // The row is read and locked first, so the path the claim clears is the one handed back.
    expect(locked).toMatchObject({ kind: 'select', table: recipeImages, where: { params: [RECIPE], sql: '"recipe_images"."recipe_id" = $1' } });

    if (claim?.kind !== 'update') {
      throw new Error('expected an update');
    }

    expect(claim.table).toBe(recipeImages);
    expect(claim.set).toMatchObject({ attempts: 0, lastAttemptAt: NOW, status: 'drawing' });
    expect(claim.set).toMatchObject({ provenance: null });
    // A failed row, or a drawing older than the stale bound; a fresh drawing is not reached.
    expect(claim.where.sql).toBe(
      '("recipe_images"."recipe_id" = $1 and ("recipe_images"."status" = $2 or ("recipe_images"."status" = $3 and "recipe_images"."last_attempt_at" < $4)))'
    );
    expect(claim.where.params).toEqual([RECIPE, 'failed', 'drawing', new Date(NOW.getTime() - 15 * 60_000).toISOString()]);
    expect(updatedThrough).toEqual(['tx']);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(tx);
  });

  /* 0072: the retry discards the candidate — the claim clears the pointer and hands the path back for the file to be deleted. */
  it('hands back the path of the candidate the row held, which the claim cleared', async () => {
    answers = [[{ path: CANDIDATE }], [{ recipeId: RECIPE }]];

    await expect(RecipeRepository.retryPicture(RECIPE, NOW, 15, async () => Promise.resolve())).resolves.toEqual({ candidatePath: CANDIDATE });
  });

  it('hands back no path when nothing was claimed, even for a row that holds a candidate', async () => {
    answers = [[{ path: CANDIDATE }], []];

    await expect(RecipeRepository.retryPicture(RECIPE, NOW, 15, async () => Promise.resolve())).resolves.toBeNull();
  });

  it('fails when the audit row cannot be written, so the claim rolls back with it', async () => {
    answers = [[], [{ recipeId: RECIPE }]];
    const record = vi.fn(async () => Promise.reject(new Error('audit down')));

    await expect(RecipeRepository.retryPicture(RECIPE, NOW, 15, record)).rejects.toThrow();
  });

  it('writes no audit row when nothing was claimed', async () => {
    const record = vi.fn(async () => Promise.resolve());

    await expect(RecipeRepository.retryPicture(RECIPE, NOW, 15, record)).resolves.toBeNull();
    expect(record).not.toHaveBeenCalled();
  });
});

/* 0072: a rejected picture waits for the owner as a pointer inside `provenance` — no state and no column of its own. */
describe('RecipeRepository — a candidate', () => {
  const HAS = '("recipe_images"."provenance" -> \'candidate\' ->> \'path\') is not null';

  it('candidateRow reads only a row that holds a pointer', async () => {
    const row = { lastAttemptAt: NOW, provenance: { candidate: { path: CANDIDATE } }, status: 'failed' };

    answers = [[row]];

    await expect(RecipeRepository.candidateRow(RECIPE)).resolves.toEqual(row);
    await expect(RecipeRepository.candidateRow(RECIPE)).resolves.toBeNull();

    const [read] = statements;

    if (read?.kind !== 'select') {
      throw new Error('expected a read');
    }

    expect(read.where).toMatchObject({ params: [RECIPE], sql: `("recipe_images"."recipe_id" = $1 and (${HAS}))` });
  });

  it('dropCandidate removes the pointer and nothing else, only from a row that still holds that very path, with the audit row in the same transaction', async () => {
    answers = [[{ recipeId: RECIPE }]];
    const record = vi.fn(async () => Promise.resolve());

    await expect(RecipeRepository.dropCandidate(RECIPE, CANDIDATE, record)).resolves.toBe(true);

    const [drop] = statements;

    if (drop?.kind !== 'update') {
      throw new Error('expected an update');
    }

    // The cool-off is left as it was: no status, no attempts, no date.
    expect(Object.keys(drop.set).sort()).toEqual(['provenance', 'updatedAt']);
    expect(written(drop.set.provenance)).toMatchObject({ params: [], sql: '"recipe_images"."provenance" - \'candidate\'' });
    // The owner's discard needs the row to still be failed: a candidate accepted in another tab is not recorded as discarded.
    expect(drop.where).toMatchObject({
      params: [RECIPE, CANDIDATE, 'failed'],
      sql: '("recipe_images"."recipe_id" = $1 and ("recipe_images"."provenance" -> \'candidate\' ->> \'path\') = $2 and "recipe_images"."status" = $3)'
    });
    expect(updatedThrough).toEqual(['tx']);
    expect(record).toHaveBeenCalledWith(tx);
  });

  it('dropCandidate writes no audit row when the pointer was no longer that one, and rolls back when the audit row cannot be written', async () => {
    const record = vi.fn(async () => Promise.resolve());

    await expect(RecipeRepository.dropCandidate(RECIPE, CANDIDATE, record)).resolves.toBe(false);
    expect(record).not.toHaveBeenCalled();

    answers = [[{ recipeId: RECIPE }]];
    await expect(RecipeRepository.dropCandidate(RECIPE, CANDIDATE, async () => Promise.reject(new Error('audit down')))).rejects.toThrow();
  });

  it('dropCandidate needs no audit for the cleanup or the end of an acceptance, and takes the pointer off a row in any state', async () => {
    answers = [[{ recipeId: RECIPE }]];

    await expect(RecipeRepository.dropCandidate(RECIPE, CANDIDATE)).resolves.toBe(true);

    const [drop] = statements;

    if (drop?.kind !== 'update') {
      throw new Error('expected an update');
    }

    // No status in the condition: the row an acceptance made `ready` still holds the pointer until its file is gone.
    expect(drop.where).toMatchObject({
      params: [RECIPE, CANDIDATE],
      sql: '("recipe_images"."recipe_id" = $1 and ("recipe_images"."provenance" -> \'candidate\' ->> \'path\') = $2)'
    });
  });

  it('unreviewableCandidates reads the rows whose candidate expired or whose row is no longer failed, from the database and never the store', async () => {
    const expiredAt = new Date('2026-09-20T12:00:00Z');

    answers = [[{ path: CANDIDATE, recipeId: RECIPE }]];

    await expect(RecipeRepository.unreviewableCandidates(expiredAt, 100)).resolves.toEqual([{ path: CANDIDATE, recipeId: RECIPE }]);

    const [read] = statements;

    if (read?.kind !== 'select') {
      throw new Error('expected a read');
    }

    expect(read.where).toMatchObject({
      params: ['failed', expiredAt.toISOString()],
      sql: `((${HAS}) and ("recipe_images"."status" <> $1 or "recipe_images"."last_attempt_at" is null or "recipe_images"."last_attempt_at" <= $2))`
    });
  });

  it('pictureState says whether the row holds a candidate', async () => {
    answers = [[{ attempts: 3, candidate: true, lastAttemptAt: NOW, released: false, status: 'failed', url: null }]];

    await expect(RecipeRepository.pictureState(RECIPE)).resolves.toMatchObject({ candidate: true, status: 'failed' });
  });
});

/*
 * 0072, PRD 009 criteria 5, 6 and 8: the second door. A picture becomes `ready` by the owner's hand only in the
 * transaction that writes `picture.accepted`, and only a picture accepted so can be taken back.
 */
describe('RecipeRepository.acceptCandidate', () => {
  const SEEN = { lastAttemptAt: CLAIMED, path: CANDIDATE };
  const PROVENANCE = { acceptedBy: 'owner', c2pa: true, overriddenAllergens: ['crustaceans'], trainedAlgorithmicMedia: true };
  const PICTURE = { model: 'stub/picture', promptVersion: '2.0.0', provenance: PROVENANCE, url: 'https://store.example/dish-pictures/x.jpg' };

  it('makes the row ready only while it is the failed row that was read, holding that very candidate — and the audit row goes in the same transaction', async () => {
    answers = [[{ recipeId: RECIPE }]];
    const record = vi.fn(async () => Promise.resolve());

    await expect(RecipeRepository.acceptCandidate(RECIPE, SEEN, PICTURE, NOW, record)).resolves.toBe(true);

    expect(statements).toHaveLength(1);
    const [accept] = statements;

    if (accept?.kind !== 'update') {
      throw new Error('expected an update');
    }

    expect(accept.table).toBe(recipeImages);
    // What drew the candidate, not what would draw one today; the attempts and the date stay as they were.
    expect(Object.keys(accept.set).sort()).toEqual(['model', 'promptVersion', 'provenance', 'status', 'updatedAt', 'url']);
    expect(accept.set).toMatchObject({ model: 'stub/picture', promptVersion: '2.0.0', status: 'ready', updatedAt: NOW, url: PICTURE.url });
    // The pointer is carried over on purpose, until the private file is deleted: the cleanup finds the row if that fails.
    expect(written(accept.set.provenance)).toMatchObject({ params: [JSON.stringify(PROVENANCE)], sql: KEEPING });
    expect(accept.where).toMatchObject({
      params: [RECIPE, 'failed', CANDIDATE, CLAIMED.toISOString()],
      sql: '("recipe_images"."recipe_id" = $1 and "recipe_images"."status" = $2 and ("recipe_images"."provenance" -> \'candidate\' ->> \'path\') = $3 and "recipe_images"."last_attempt_at" = $4)'
    });
    expect(updatedThrough).toEqual(['tx']);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(tx);
  });

  // What the judge said is the controller's to hand over (`pictureEvidenceOf`, project 010); no path ever is.
  it('writes nothing that is a path or an address of the private file', async () => {
    answers = [[{ recipeId: RECIPE }]];
    await RecipeRepository.acceptCandidate(RECIPE, SEEN, PICTURE, NOW, async () => Promise.resolve());

    const [accept] = statements;

    if (accept?.kind !== 'update') {
      throw new Error('expected an update');
    }

    expect(JSON.stringify(written(accept.set.provenance).params)).not.toMatch(/dish-picture-candidates|candidate/);
  });

  it('answers false and writes no audit row when the row moved since it was read: another tab, a retry, a discard, the cleanup', async () => {
    const record = vi.fn(async () => Promise.resolve());

    await expect(RecipeRepository.acceptCandidate(RECIPE, SEEN, PICTURE, NOW, record)).resolves.toBe(false);
    expect(record).not.toHaveBeenCalled();
  });

  it('fails when the audit row cannot be written, inside the transaction — so the picture is not made ready', async () => {
    answers = [[{ recipeId: RECIPE }]];
    const record = vi.fn(async () => Promise.reject(new Error('audit down')));

    await expect(RecipeRepository.acceptCandidate(RECIPE, SEEN, PICTURE, NOW, record)).rejects.toThrow();
    // The update and the audit write share the transaction's handle: what throws inside rolls both back.
    expect(updatedThrough).toEqual(['tx']);
    expect(record).toHaveBeenCalledWith(tx);
  });
});

describe('RecipeRepository.removeAcceptedPicture', () => {
  const URL = 'https://store.example/dish-pictures/x.jpg';

  it('takes back only a ready picture the owner accepted: failed with `owner_removed`, no address, the cool-off from now — and the audit row in the same transaction', async () => {
    answers = [[{ path: null, url: URL }], [{ recipeId: RECIPE }]];
    const record = vi.fn(async () => Promise.resolve());

    await expect(RecipeRepository.removeAcceptedPicture(RECIPE, NOW, record)).resolves.toEqual({ candidatePath: null, url: URL });

    const [locked, removal] = statements;

    // The row is read and locked first, so the address handed back is the one the removal cleared.
    expect(locked).toMatchObject({ kind: 'select', table: recipeImages, where: { params: [RECIPE], sql: '"recipe_images"."recipe_id" = $1' } });

    if (removal?.kind !== 'update') {
      throw new Error('expected an update');
    }

    // A row with no judged drawings keeps nothing but the reason.
    expect(removal.set).toEqual({ lastAttemptAt: NOW, provenance: { reason: 'owner_removed' }, status: 'failed', updatedAt: NOW, url: null });
    expect(removal.where).toMatchObject({
      params: [RECIPE, 'ready'],
      sql: '("recipe_images"."recipe_id" = $1 and "recipe_images"."status" = $2 and ("recipe_images"."provenance" ->> \'acceptedBy\') = \'owner\')'
    });
    expect(updatedThrough).toEqual(['tx']);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(tx);
  });

  it('refuses a picture the judge accepted, and any other row: nothing is removed and no audit row is written', async () => {
    // The row is there and ready, with an address — the guarded update simply does not reach it.
    answers = [[{ path: null, url: URL }], []];
    const record = vi.fn(async () => Promise.resolve());

    await expect(RecipeRepository.removeAcceptedPicture(RECIPE, NOW, record)).resolves.toBeNull();
    expect(record).not.toHaveBeenCalled();

    // A dish with no row at all.
    await expect(RecipeRepository.removeAcceptedPicture(RECIPE, NOW, record)).resolves.toBeNull();
    expect(record).not.toHaveBeenCalled();
  });

  it('hands back the path of a candidate the row still held, since the removal clears the pointer with the rest', async () => {
    answers = [[{ path: CANDIDATE, url: URL }], [{ recipeId: RECIPE }]];

    await expect(RecipeRepository.removeAcceptedPicture(RECIPE, NOW, async () => Promise.resolve())).resolves.toEqual({
      candidatePath: CANDIDATE,
      url: URL
    });
  });

  it('fails when the audit row cannot be written, so the removal rolls back with it', async () => {
    answers = [[{ path: null, url: URL }], [{ recipeId: RECIPE }]];

    await expect(RecipeRepository.removeAcceptedPicture(RECIPE, NOW, async () => Promise.reject(new Error('audit down')))).rejects.toThrow();
  });
});

/*
 * An acceptance whose transaction threw must learn whether it committed before it deletes a file. A plain read sees
 * only what has committed; a locking read waits for the transaction that still holds the row.
 */
describe('RecipeRepository.settledPicture', () => {
  it('reads the row under a share lock, in a transaction whose lock timeout is its own', async () => {
    answers = [[{ status: 'ready', url: 'https://store.example/dish-pictures/x.jpg' }]];

    await expect(RecipeRepository.settledPicture(RECIPE, 3_000)).resolves.toEqual({
      status: 'ready',
      url: 'https://store.example/dish-pictures/x.jpg'
    });

    const [timeout, read] = statements;

    // `set_config(…, true)` is `SET LOCAL`: it ends with this transaction and touches no other statement of the pool.
    expect(timeout).toMatchObject({ kind: 'execute', params: ['3000ms'], sql: "select set_config('lock_timeout', $1, true)" });
    expect(read).toMatchObject({ kind: 'select', table: recipeImages, where: { params: [RECIPE], sql: '"recipe_images"."recipe_id" = $1' } });
    expect(locks).toEqual(['share']);
  });

  it('answers null for a dish with no row: nothing could have been committed onto it', async () => {
    await expect(RecipeRepository.settledPicture(RECIPE, 3_000)).resolves.toBeNull();
  });

  it('throws when the row cannot be had in time, so the caller knows the outcome is still unknown', async () => {
    const waiting = vi.spyOn(tx, 'select').mockImplementationOnce(() => {
      throw new Error('canceling statement due to lock timeout');
    });

    await expect(RecipeRepository.settledPicture(RECIPE, 3_000)).rejects.toThrow('Database operation failed');
    waiting.mockRestore();
  });
});

/*
 * Project 010, phase 3: what the judge answered on a dish's drawings is kept in its row, and survives the next
 * drawing — a view's claim after the cool-off, the owner's retry — within `PICTURE_DRAWINGS_KEPT`.
 */
describe('RecipeRepository — what the judge said is kept', () => {
  const first = judgedDrawing('2026-09-01T10:00:00Z', 'first');
  const second = judgedDrawing('2026-09-09T10:00:00Z', 'second');
  const third = judgedDrawing('2026-09-17T10:00:00Z', 'third');
  const fourth = judgedDrawing('2026-09-27T11:59:00Z', 'fourth');

  it('a failed drawing stores its judged attempts after the ones the row held, and drops the oldest beyond the bound', async () => {
    answers = [[{ provenance: { drawings: [first, second, third], notes: ['3:rejected:x'], reason: 'judge_allergen' } }], [{ recipeId: RECIPE }]];

    await RecipeRepository.failPicture(
      RECIPE,
      CLAIMED,
      { attempts: 3, judged: fourth, provenance: { notes: ['1:rejected:y'], reason: 'judge_rejected' } },
      NOW
    );

    expect(PICTURE_DRAWINGS_KEPT).toBe(3);
    // What this drawing wrote replaces the rest; the drawings are the one thing carried over, in order.
    expect(stored(endOf().set.provenance)).toEqual({ drawings: [second, third, fourth], notes: ['1:rejected:y'], reason: 'judge_rejected' });
  });

  it('an accepted drawing keeps them too, beside its own marks', async () => {
    answers = [[{ provenance: { drawings: [first], reason: 'cap_reached', released: 'cap' } }], [{ recipeId: RECIPE }]];
    const provenance = { c2pa: true, judge: [], notes: [], trainedAlgorithmicMedia: true };

    await RecipeRepository.completePicture(RECIPE, CLAIMED, { attempts: 1, judged: second, model: 'm', promptVersion: 'v', provenance, url: 'u' });

    expect(stored(endOf().set.provenance)).toEqual({ ...provenance, drawings: [first, second] });
  });

  it('a drawing given back keeps what its attempts were judged before it stopped', async () => {
    answers = [[{ provenance: null }], [{ recipeId: RECIPE }]];

    await RecipeRepository.releasePicture(RECIPE, CLAIMED, { attempts: 1, judged: first, reason: 'payment_refused', why: 'refused' }, NOW);

    expect(stored(endOf().set.provenance)).toEqual({ drawings: [first], reason: 'payment_refused', released: 'refused' });
  });

  it('a drawing that judged nothing leaves the drawings the row held as they were, and adds no key to a row that held none', async () => {
    answers = [[{ provenance: { drawings: [first] } }], [{ recipeId: RECIPE }], [{ provenance: null }], [{ recipeId: RECIPE }]];

    await RecipeRepository.failPicture(RECIPE, CLAIMED, { attempts: 1, judged: null, provenance: { notes: [], reason: 'no_provenance' } }, NOW);
    await RecipeRepository.failPicture(RECIPE, CLAIMED, { attempts: 1, judged: null, provenance: { notes: [], reason: 'no_provenance' } }, NOW);

    expect(stored(endOf(1).set.provenance)).toEqual({ drawings: [first], notes: [], reason: 'no_provenance' });
    expect(stored(endOf(3).set.provenance)).toEqual({ notes: [], reason: 'no_provenance' });
  });

  it('trusts no drawings key in what is written, carries a stored drawing of another shape as it is, and drops what is not an object', async () => {
    const older = { attempts: [], recipe: 'x' };

    answers = [[{ provenance: { drawings: [older, first, 'garbage'] } }], [{ recipeId: RECIPE }]];

    await RecipeRepository.failPicture(RECIPE, CLAIMED, { attempts: 1, judged: null, provenance: { drawings: ['forged'], reason: 'other' } }, NOW);

    expect(stored(endOf().set.provenance)).toEqual({ drawings: [older, first], reason: 'other' });
  });

  it('a drawing’s end writes no NUL and no lone surrogate from a provider’s or the judge’s words: the write cannot fail on them', async () => {
    answers = [[{ provenance: null }], [{ recipeId: RECIPE }]];

    await RecipeRepository.failPicture(
      RECIPE,
      CLAIMED,
      {
        attempts: 1,
        judged: null,
        provenance: { notes: ['1:failed:answered 503: a\u0000b', '2:rejected:extra_food:c\ud800'], reason: 'call_failed' }
      },
      NOW
    );

    expect(written(endOf().set.provenance).params[0]).not.toMatch(/\\u0000|\\ud800/);
    expect(stored(endOf().set.provenance)).toEqual({ notes: ['1:failed:answered 503: a b', '2:rejected:extra_food:c'], reason: 'call_failed' });
  });

  it('the owner’s retry clears everything but the drawings, so the row is neither released nor holding a candidate while it draws', async () => {
    const candidate = { extras: [], model: 'm', path: CANDIDATE, promptVersion: '2.0.0' };

    answers = [
      [{ path: CANDIDATE, provenance: { candidate, drawings: [first, second], reason: 'cap_reached', released: 'cap' } }],
      [{ recipeId: RECIPE }]
    ];

    await expect(RecipeRepository.retryPicture(RECIPE, NOW, 15, async () => Promise.resolve())).resolves.toEqual({ candidatePath: CANDIDATE });

    expect(endOf().set).toMatchObject({ provenance: { drawings: [first, second] }, status: 'drawing' });
  });

  it('the owner’s removal keeps them beside its reason, and nothing of the acceptance', async () => {
    const provenance = { acceptedBy: 'owner', c2pa: true, drawings: [first], notes: ['1:rejected:x'], overriddenAllergens: ['milk'] };

    answers = [[{ path: null, provenance, url: 'https://store.example/dish-pictures/x.jpg' }], [{ recipeId: RECIPE }]];

    await RecipeRepository.removeAcceptedPicture(RECIPE, NOW, async () => Promise.resolve());

    expect(endOf().set).toMatchObject({ provenance: { drawings: [first], reason: 'owner_removed' }, status: 'failed', url: null });
    expect(Object.keys((endOf().set.provenance ?? {}) as object).sort()).toEqual(['drawings', 'reason']);
  });
});

/* PRD 009, criterion 8: two doors and no third. Only these two writes set `status` to `ready`. */
describe('RecipeRepository — what makes a picture ready', () => {
  const SRC = join(__dirname, '..', '..');
  const source = readFileSync(join(__dirname, 'RecipeRepository.ts'), 'utf8');

  it('is the judge’s completePicture and the owner’s acceptCandidate, and no other method of the repository', () => {
    const methods = [...source.matchAll(/^ {2}async (\w+)\(/gm)].map(found => ({ at: found.index, name: found[1] ?? '' }));
    const writers = [...source.matchAll(/status: 'ready'/g)].map(found => methods.filter(method => method.at < found.index).at(-1)?.name);

    expect(writers.sort()).toEqual(['acceptCandidate', 'completePicture']);
  });

  /* A literal scan of one file is not enough: a write of the table anywhere else would be a door this pin cannot see. */
  it('is written by this repository alone: no other source of core inserts into, updates or deletes from recipe_images', () => {
    const sources = readdirSync(SRC, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
      .map(entry => join(entry.parentPath, entry.name));
    const writers = sources
      .filter(path => /\.(?:insert|update|delete)\(\s*recipeImages\s*\)/.test(readFileSync(path, 'utf8')))
      .map(path => relative(SRC, path).replaceAll('\\', '/'));

    expect(sources.length).toBeGreaterThan(50);
    expect(writers).toEqual(['repositories/Recipe/RecipeRepository.ts']);
  });

  /* The column defaults to `ready` (`recipe.schema.ts`): an insert that names no status would publish by omission. */
  it('never inserts a row without naming its status, and the one insert claims a drawing', () => {
    const inserts = [...source.matchAll(/\.insert\(recipeImages\)\s*\.values\(\{([^}]*)\}\)/g)].map(found => found[1] ?? '');

    expect(source.match(/\.insert\(recipeImages\)/g)).toHaveLength(1);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatch(/status: 'drawing'/);
  });
});

/* One spelling of the owner's mark for every statement that asks it: the removal's guard, the console's flag, filter and count. */
describe('ACCEPTED_BY_OWNER_SQL', () => {
  it('is the entity’s constant as a literal, and a plain word', () => {
    expect(dialect.sqlToQuery(ACCEPTED_BY_OWNER_SQL as unknown as SQL)).toEqual({ params: [], sql: "'owner'" });
    expect(ACCEPTED_BY_OWNER).toMatch(/^[a-z]+$/);
  });
});
