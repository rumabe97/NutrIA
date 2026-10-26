import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, DatabaseOperationError, InputParseError } from 'core/entities/Error';

import { PantryRepository } from './PantryRepository';

import type { ResolvedPantryEntry } from './PantryRepository';

/**
 * Every statement the repository sends, as Postgres would receive it, and
 * whether it went inside a transaction — `KitchenRepository.test.ts`'s harness,
 * for the same reason: the lock taken before the count, and the `WHERE` that
 * carries the account, *are* the behaviour, and a mocked query builder would
 * assert neither.
 */
const state = vi.hoisted(() => ({
  failOn: null as RegExp | null,
  locked: true,
  removed: [[]] as unknown[][],
  rows: [] as unknown[][],
  sent: [] as { params: unknown[]; sql: string; tx: boolean }[]
}));

vi.mock('database', async () => {
  const { drizzle } = await import('drizzle-orm/postgres-js');

  const client = (tx: boolean): Record<string, unknown> => ({
    begin: async (fn: (inner: unknown) => Promise<unknown>) => fn(client(true)),
    options: { parsers: {}, serializers: {} },
    unsafe: (sql: string, params: unknown[]) => {
      state.sent.push({ params, sql, tx });

      if (state.failOn?.test(sql)) {
        const failed = Promise.reject(new Error('connection to postgres://secret@host lost'));

        return Object.assign(failed, { values: () => failed });
      }

      const rows = sql.startsWith('delete') ? state.removed : sql.startsWith('select "id"') ? state.rows : [];
      const objects = sql.startsWith('select pg_try_advisory_xact_lock') ? [{ held: state.locked }] : [];

      return Object.assign(Promise.resolve(objects), { values: () => Promise.resolve(rows) });
    }
  });

  return { database: () => drizzle({ casing: 'snake_case', client: client(false) as never }) };
});

const USER = 'usr-1';
const ID = 'b1c2d3e4-f506-4a7b-8c9d-0e1f2a3b4c5d';
const RICE = 'c2d3e4f5-0617-4b8c-9d0e-1f2a3b4c5d6e';

const RICE_ENTRY: ResolvedPantryEntry = { grams: 500, ingredientId: RICE, label: 'Arroz largo', normalisedLabel: 'arroz largo', unit: 'g' };
const UNRESOLVED_ENTRY: ResolvedPantryEntry = { grams: null, ingredientId: null, label: 'Sobrasada', normalisedLabel: 'sobrasada', unit: null };

/** The five columns every read projects, positionally and in `COLUMNS`' own order, as the driver hands them back. */
function row(overrides: Partial<{ id: string; grams: unknown; ingredientId: string | null; label: string; unit: string | null }> = {}): unknown[] {
  const { id = ID, grams = null, ingredientId = RICE, label = 'Arroz largo', unit = null } = overrides;

  return [id, grams, ingredientId, label, unit];
}

/** The same row as the standing read sees it: the normalised label travels with it. */
function standing(normalisedLabel: string, overrides: Parameters<typeof row>[0] = {}): unknown[] {
  return [...row(overrides), normalisedLabel];
}

/** Every statement but the lock, which is asserted on its own where it matters. */
function statements(): { params: unknown[]; sql: string; tx: boolean }[] {
  return state.sent.filter(statement => !statement.sql.startsWith('select pg_try'));
}

beforeEach(() => {
  state.failOn = null;
  state.locked = true;
  state.removed = [[]];
  state.rows = [];
  state.sent.length = 0;
});

describe('PantryRepository.findByUser', () => {
  it('reads this account’s rows in the order they were said, and parses them', async () => {
    state.rows = [row({ grams: '500.00', unit: 'g' }), row({ id: 'd4e5f607-1829-4c0d-9e1f-2a3b4c5d6e7f', ingredientId: null, label: 'Sobrasada' })];

    await expect(PantryRepository.findByUser(USER)).resolves.toEqual([
      { id: ID, grams: 500, ingredientId: RICE, label: 'Arroz largo', unit: 'g' },
      { id: 'd4e5f607-1829-4c0d-9e1f-2a3b4c5d6e7f', grams: null, ingredientId: null, label: 'Sobrasada', unit: null }
    ]);

    const [sent] = state.sent;

    // The `WHERE user_id` is the ownership boundary, not a filter: there is no
    // row-level security behind this package. `created_at` and not the label, so
    // the list does not reorder itself under somebody's hands.
    expect(sent?.params).toEqual([USER]);
    expect(sent?.sql).toContain('where "pantry_items"."user_id" = $1');
    expect(sent?.sql).toContain('order by "pantry_items"."created_at" asc');
  });

  it('never projects the normalised label, which is the index’s and nobody else’s', async () => {
    await PantryRepository.findByUser(USER);

    expect(state.sent[0]?.sql).not.toContain('normalised_label');
  });

  it('answers nothing for somebody who never said anything', async () => {
    await expect(PantryRepository.findByUser(USER)).resolves.toEqual([]);
  });

  it('turns a driver failure into a DatabaseOperationError, so no connection string reaches a response', async () => {
    state.failOn = /select "id", "grams"/;

    await expect(PantryRepository.findByUser(USER)).rejects.toBeInstanceOf(DatabaseOperationError);
    await expect(PantryRepository.findByUser(USER)).rejects.not.toThrow(/postgres:\/\//);
  });

  it('keeps the typed label out of a schema-drift error, as it is kept out of a prompt and a log', async () => {
    state.rows = [row({ grams: 'not a number', label: 'una cosa secreta' })];

    const failed = PantryRepository.findByUser(USER);

    await expect(failed).rejects.toBeInstanceOf(DatabaseOperationError);
    await expect(failed).rejects.toSatisfy((error: Error) => !error.message.includes('una cosa secreta'));
    await expect(failed).rejects.toThrow('Schema mismatch on pantry_items');
  });
});

describe('PantryRepository.add', () => {
  it('locks on the account, reads, asks, writes and reads back — all in one transaction', async () => {
    await PantryRepository.add(USER, RICE_ENTRY, () => undefined);

    const [lock, read, write, after] = state.sent;

    expect(state.sent.every(statement => statement.tx)).toBe(true);
    // Keyed on the table and the account: two accounts never wait for each other.
    expect(lock?.sql).toBe('select pg_try_advisory_xact_lock(hashtext($1), hashtext($2)) as held');
    expect(lock?.params).toEqual(['pantry_items', USER]);
    expect(read?.sql).toContain('normalised_label');
    expect(write?.sql).toContain('insert into "pantry_items"');
    expect(after?.sql).not.toContain('normalised_label');
  });

  it('writes the amount as a string, because Drizzle takes numeric as one', async () => {
    await PantryRepository.add(USER, RICE_ENTRY, () => undefined);

    expect(statements()[1]?.params).toContain('500.00');
  });

  it('hands the decision every other entry and not the one being written, so re-stating a thing is never one more', async () => {
    const tuna = 'e5f60718-293a-4d1e-8f20-3b4c5d6e7f80';

    state.rows = [standing('arroz largo'), standing('atun al natural', { id: 'd4e5f607-1829-4c0d-9e1f-2a3b4c5d6e7f', ingredientId: tuna })];
    const allow = vi.fn();

    await PantryRepository.add(USER, RICE_ENTRY, allow);

    expect(allow).toHaveBeenCalledWith([
      { id: 'd4e5f607-1829-4c0d-9e1f-2a3b4c5d6e7f', grams: null, ingredientId: tuna, label: 'Arroz largo', unit: null }
    ]);
  });

  it('writes the amount over the old one when the same catalogue row is named again', async () => {
    state.rows = [standing('arroz')];

    await PantryRepository.add(USER, RICE_ENTRY, () => undefined);

    const write = statements()[1];

    // The match is found inside the lock, which is why it cannot race; the
    // partial unique index stands behind it for anything that skips this path.
    expect(write?.sql).toContain('update "pantry_items" set');
    expect(write?.sql).toContain('where ("pantry_items"."id" = $');
    expect(write?.sql).toContain('"pantry_items"."user_id" = $');
    expect(statements().some(statement => statement.sql.startsWith('insert'))).toBe(false);
  });

  it('matches an unresolved entry on the normalised word and not on a null id, which Postgres counts as distinct', async () => {
    // Two rows with no id: without the normalised label the first would match
    // every one of them, which is the bug the second partial index exists for.
    state.rows = [standing('sobrasada', { ingredientId: null, label: 'Sobrasada' }), standing('morcilla', { ingredientId: null, label: 'Morcilla' })];

    await PantryRepository.add(USER, UNRESOLVED_ENTRY, () => undefined);

    expect(statements()[1]?.sql).toContain('update "pantry_items" set');
  });

  it('takes in the word it used to be, when the catalogue has since learned it', async () => {
    // Both partial indexes allow the pair — one holds the resolved rows, the
    // other the unresolved ones — so the cupboard would otherwise show the word
    // twice and spend two of its sixty, and phase 2 would read a doubled
    // saving. The resolved row is the one that stays.
    const twin = 'd4e5f607-1829-4c0d-9e1f-2a3b4c5d6e7f';

    state.rows = [standing('arroz largo'), standing('arroz largo', { id: twin, ingredientId: null })];
    const allow = vi.fn();

    await PantryRepository.add(USER, RICE_ENTRY, allow);

    const [, write, removed] = statements();

    expect(write?.sql).toContain('update "pantry_items" set');
    expect(write?.params).toContain(ID);
    expect(removed?.sql).toContain('delete from "pantry_items"');
    expect(removed?.params).toEqual([twin, USER]);
    // Neither row is one of the others: this write is consuming both.
    expect(allow).toHaveBeenCalledWith([]);
  });

  it('makes the unresolved word the resolved row in place, where no row holds that ingredient yet', async () => {
    // Updating it rather than inserting beside it keeps the order it was typed
    // in, and it is only safe because nothing else holds this ingredient — the
    // other way round would hand `pantry_items_one_per_ingredient` two rows.
    const twin = 'd4e5f607-1829-4c0d-9e1f-2a3b4c5d6e7f';

    state.rows = [standing('arroz largo', { id: twin, ingredientId: null })];

    await PantryRepository.add(USER, RICE_ENTRY, () => undefined);

    const write = statements()[1];

    expect(write?.sql).toContain('update "pantry_items" set');
    expect(write?.sql).toContain('"ingredient_id" = $');
    expect(write?.params).toContain(RICE);
    expect(write?.params).toContain(twin);
    expect(statements().some(statement => /^(insert|delete)/.test(statement.sql))).toBe(false);
  });

  it('inserts an unresolved word the account has not said before', async () => {
    state.rows = [standing('morcilla', { ingredientId: null, label: 'Morcilla' })];

    await PantryRepository.add(USER, UNRESOLVED_ENTRY, () => undefined);

    expect(statements()[1]?.sql).toContain('insert into "pantry_items"');
  });

  it('writes nothing when the decision refuses, and lets the refusal travel as it is', async () => {
    const refusal = new InputParseError('too many', { label: ['too many'] });

    await expect(
      PantryRepository.add(USER, RICE_ENTRY, () => {
        throw refusal;
      })
    ).rejects.toBe(refusal);

    expect(statements().some(statement => /^(insert|update)/.test(statement.sql))).toBe(false);
  });

  it('gives the other request its turn and refuses rather than queueing on the lock', async () => {
    state.locked = false;

    await expect(PantryRepository.add(USER, RICE_ENTRY, () => undefined)).rejects.toBeInstanceOf(ConflictError);

    // Eight tries, each its own transaction, and never a read or a write past a
    // lock it did not get. The blocking form would have pinned a pooled
    // connection for the whole wait instead.
    expect(state.sent).toHaveLength(8);
    expect(statements()).toEqual([]);
  });

  it('wraps a failed write, keeping the driver’s message out of it', async () => {
    state.failOn = /insert into "pantry_items"/;

    await expect(PantryRepository.add(USER, RICE_ENTRY, () => undefined)).rejects.toBeInstanceOf(DatabaseOperationError);
  });
});

describe('PantryRepository.remove', () => {
  it('deletes by the id and the account together, and says it went', async () => {
    state.removed = [['row-1']];

    await expect(PantryRepository.remove(USER, ID)).resolves.toBe(true);

    const [sent] = state.sent;

    // Both in one `WHERE`: an id that is not this account's finds nothing, which
    // is what lets the controller answer it the same 404 as one that does not
    // exist (`0019`).
    expect(sent?.sql).toBe('delete from "pantry_items" where ("pantry_items"."user_id" = $1 and "pantry_items"."id" = $2) returning "id"');
    expect(sent?.params).toEqual([USER, ID]);
  });

  it('says so when there was nothing to remove, rather than pretending', async () => {
    state.removed = [];

    await expect(PantryRepository.remove(USER, ID)).resolves.toBe(false);
  });

  it('wraps a failed delete', async () => {
    state.failOn = /delete from/;

    await expect(PantryRepository.remove(USER, ID)).rejects.toBeInstanceOf(DatabaseOperationError);
  });
});

describe('PantryRepository.clear', () => {
  it('empties this account’s cupboard and nobody else’s', async () => {
    await expect(PantryRepository.clear(USER)).resolves.toBeUndefined();

    expect(state.sent[0]?.sql).toBe('delete from "pantry_items" where "pantry_items"."user_id" = $1');
    expect(state.sent[0]?.params).toEqual([USER]);
  });

  it('is idempotent: an empty cupboard is not an error, because a spent draft calls this too', async () => {
    state.removed = [];

    await expect(PantryRepository.clear(USER)).resolves.toBeUndefined();
  });

  it('wraps a failed delete', async () => {
    state.failOn = /delete from/;

    await expect(PantryRepository.clear(USER)).rejects.toBeInstanceOf(DatabaseOperationError);
  });
});
