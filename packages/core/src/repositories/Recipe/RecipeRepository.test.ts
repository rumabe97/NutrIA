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

        // Awaited directly (an aggregate) or through `.limit()`: one answer either way.
        return { limit: next, then: (resolve: (rows: unknown[]) => unknown) => next().then(resolve) };
      }
    })
  };
}

vi.mock('database', () => ({ database: () => ({ delete: remove, insert, select, update }) }));

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
const NOW = new Date('2026-09-27T12:00:00Z');
/** When the drawing being ended was claimed. */
const CLAIMED = new Date('2026-09-27T11:58:00Z');

beforeEach(() => {
  statements.length = 0;
  answers = [];
});

/*
 * What is pinned here is the statement each method sends. That Postgres keeps
 * its promise for `INSERT … ON CONFLICT` — the second of two concurrent
 * inserters waits on the first's row and re-evaluates the `WHERE` against it —
 * is the end-to-end suite's to prove (project 006, phase 3).
 */
describe('RecipeRepository.claimPicture', () => {
  it('is one statement: an insert that claims, an update only of a failed row past its cool-off or a stale drawing, and RETURNING', async () => {
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
    // A takeover of a stale drawing counts it; a claim after a failure's cool-off starts again.
    expect(dialect.sqlToQuery(claim.upsert?.set.attempts as SQL).sql).toBe(
      'case when "recipe_images"."status" = \'drawing\' then "recipe_images"."attempts" + 1 else 0 end'
    );
    expect(claim.upsert?.setWhere.sql).toBe(
      '(("recipe_images"."status" = $1 and "recipe_images"."last_attempt_at" < $2) or ("recipe_images"."status" = $3 and "recipe_images"."last_attempt_at" < $4))'
    );
    // 7 days of cool-off after a failure; a drawing is stale 15 minutes after its claim by default.
    expect(claim.upsert?.setWhere.params).toEqual([
      'failed',
      new Date('2026-09-20T12:00:00Z').toISOString(),
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

    expect(claim.upsert?.setWhere.params[3]).toBe(new Date('2026-09-27T11:30:00Z').toISOString());
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
    expect(done.set).toMatchObject({ ...picture, status: 'ready' });
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

    expect(failed.set).toMatchObject({ attempts: 3, lastAttemptAt: NOW, provenance: { rejected: 3 }, status: 'failed' });
    expect(failed.where.params).toEqual([RECIPE, 'drawing', CLAIMED.toISOString()]);
  });
});

describe('RecipeRepository — reading a picture and its spend', () => {
  it('pictureState answers `none` for a dish with no row', async () => {
    await expect(RecipeRepository.pictureState(RECIPE)).resolves.toEqual({ attempts: 0, lastAttemptAt: null, status: 'none', url: null });
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
  it('deletes the row only while it is still the drawing this caller claimed, and says whether it did', async () => {
    answers = [[{ recipeId: RECIPE }]];

    await expect(RecipeRepository.releasePicture(RECIPE, CLAIMED)).resolves.toBe(true);

    const [release] = statements;

    if (release?.kind !== 'delete') {
      throw new Error('expected a delete');
    }

    expect(release.table).toBe(recipeImages);
    expect(release.where.sql).toBe('("recipe_images"."recipe_id" = $1 and "recipe_images"."status" = $2 and "recipe_images"."last_attempt_at" = $3)');
    expect(release.where.params).toEqual([RECIPE, 'drawing', CLAIMED.toISOString()]);
  });

  it('answers false when the claim was taken over or ended', async () => {
    await expect(RecipeRepository.releasePicture(RECIPE, CLAIMED)).resolves.toBe(false);
  });
});
