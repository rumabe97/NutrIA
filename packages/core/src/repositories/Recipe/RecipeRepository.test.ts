import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { recipeImageCalls, recipeImages } from 'database/schema/recipe';

import { RecipeRepository } from './RecipeRepository';

import type { SQL } from 'drizzle-orm';

// As the client reads column names (`database`): snake_case.
const dialect = new PgDialect({ casing: 'snake_case' });

type Upsert = { readonly set: Record<string, unknown>; readonly setWhere: { params: unknown[]; sql: string }; readonly target: unknown };
type Statement =
  | { readonly kind: 'delete'; readonly table: unknown; readonly where: { params: unknown[]; sql: string } }
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
        return { for: next, limit: next, orderBy: () => ({ limit: next }), then: (resolve: (rows: unknown[]) => unknown) => next().then(resolve) };
      }
    })
  };
}

const db = { delete: remove, insert, select, update };

/** A handle of its own, so a statement sent outside the transaction cannot pass for one sent inside it. */
const tx = { ...db, update: updateVia('tx') };

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

beforeEach(() => {
  statements.length = 0;
  updatedThrough.length = 0;
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
    answers = [[{ recipeId: RECIPE }]];
    const picture = {
      attempts: 2,
      model: 'google/gemini-3.1-flash-lite-image',
      promptVersion: '2.0.0',
      provenance: { c2pa: true },
      url: 'https://blob/x.jpg'
    };

    await expect(RecipeRepository.completePicture(RECIPE, CLAIMED, picture)).resolves.toBe(true);

    const [done] = statements;

    if (done?.kind !== 'update') {
      throw new Error('expected an update');
    }

    expect(done.table).toBe(recipeImages);
    expect(done.set).toMatchObject({ attempts: 2, model: picture.model, promptVersion: '2.0.0', status: 'ready', url: picture.url });
    expect(written(done.set.provenance)).toMatchObject({ params: ['{"c2pa":true}'], sql: KEEPING });
    expect(done.set).not.toHaveProperty('bytes');
    expect(done.where.sql).toBe('("recipe_images"."recipe_id" = $1 and "recipe_images"."status" = $2 and "recipe_images"."last_attempt_at" = $3)');
    expect(done.where.params).toEqual([RECIPE, 'drawing', CLAIMED.toISOString()]);
  });

  it('completePicture answers false when the row is no longer this caller’s drawing — ended, or taken over as stale', async () => {
    await expect(
      RecipeRepository.completePicture(RECIPE, CLAIMED, { attempts: 1, model: 'm', promptVersion: 'v', provenance: {}, url: 'u' })
    ).resolves.toBe(false);
  });

  it('failPicture starts the cool-off from when the drawing ended, only over the drawing this caller claimed', async () => {
    answers = [[{ recipeId: RECIPE }]];

    await expect(RecipeRepository.failPicture(RECIPE, CLAIMED, { attempts: 3, provenance: { rejected: 3 } }, NOW)).resolves.toBe(true);

    const [failed] = statements;

    if (failed?.kind !== 'update') {
      throw new Error('expected an update');
    }

    expect(failed.set).toMatchObject({ attempts: 3, lastAttemptAt: NOW, status: 'failed' });
    expect(written(failed.set.provenance)).toMatchObject({ params: ['{"rejected":3}'], sql: KEEPING });
    expect(failed.where.params).toEqual([RECIPE, 'drawing', CLAIMED.toISOString()]);
  });

  /* 0072: a drawing's end never forgets where a rejected file is kept. */
  it('failPicture writes the candidate it is given, inside what the row stores', async () => {
    answers = [[{ recipeId: RECIPE }]];
    const provenance = { candidate: { extras: [], model: 'm', path: CANDIDATE, promptVersion: '2.0.0' }, notes: [], reason: 'judge_allergen' };

    await RecipeRepository.failPicture(RECIPE, CLAIMED, { attempts: 3, provenance }, NOW);

    const [failed] = statements;

    if (failed?.kind !== 'update') {
      throw new Error('expected an update');
    }

    expect(written(failed.set.provenance).params).toEqual([JSON.stringify(provenance)]);
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
    answers = [[{ recipeId: RECIPE }]];

    await expect(RecipeRepository.releasePicture(RECIPE, CLAIMED, { attempts: 2, reason: 'cap_reached', why: 'cap' }, NOW)).resolves.toBe(true);

    const [release] = statements;

    if (release?.kind !== 'update') {
      throw new Error('expected an update');
    }

    expect(release.table).toBe(recipeImages);
    expect(release.set).toMatchObject({ attempts: 2, lastAttemptAt: NOW, status: 'failed' });
    expect(written(release.set.provenance)).toMatchObject({ params: ['{"reason":"cap_reached","released":"cap"}'], sql: KEEPING });
    expect(release.where.sql).toBe('("recipe_images"."recipe_id" = $1 and "recipe_images"."status" = $2 and "recipe_images"."last_attempt_at" = $3)');
    expect(release.where.params).toEqual([RECIPE, 'drawing', CLAIMED.toISOString()]);
  });

  it('answers false when the claim was taken over or ended', async () => {
    await expect(RecipeRepository.releasePicture(RECIPE, CLAIMED, { attempts: 0, reason: 'cap_reached', why: 'cap' }, NOW)).resolves.toBe(false);
  });
});

describe('RecipeRepository.retryPicture', () => {
  it('claims only a failed row, released or past its cool-off or not, for a fresh three attempts — and the audit row goes in the same transaction', async () => {
    answers = [[{ path: null }], [{ recipeId: RECIPE }]];
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
    expect(drop.where).toMatchObject({
      params: [RECIPE, CANDIDATE],
      sql: '("recipe_images"."recipe_id" = $1 and ("recipe_images"."provenance" -> \'candidate\' ->> \'path\') = $2)'
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

  it('dropCandidate needs no audit for the cleanup, which is no admin’s action', async () => {
    answers = [[{ recipeId: RECIPE }]];

    await expect(RecipeRepository.dropCandidate(RECIPE, CANDIDATE)).resolves.toBe(true);
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
