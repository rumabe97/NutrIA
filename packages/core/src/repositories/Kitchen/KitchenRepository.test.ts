import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, DatabaseOperationError, InputParseError } from 'core/entities/Error';

import { KitchenRepository } from './KitchenRepository';

import type { KitchenStance } from 'core/entities/Kitchen';

/**
 * Every statement the repository sends, as Postgres would receive it, and
 * whether it went inside a transaction — the harness
 * `AnalyticsRepository.test.ts` uses, for the same reason: the lock taken
 * before the count, and the conflict target the upsert names, *are* the
 * behaviour, and a mocked query builder would assert neither.
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

      const rows = sql.startsWith('delete') ? state.removed : sql.startsWith('select "appliance"') ? state.rows : [];
      const objects = sql.startsWith('select pg_try_advisory_xact_lock') ? [{ held: state.locked }] : [];

      return Object.assign(Promise.resolve(objects), { values: () => Promise.resolve(rows) });
    }
  });

  return { database: () => drizzle({ casing: 'snake_case', client: client(false) as never }) };
});

const USER = 'usr-1';
const OVEN: KitchenStance = { appliance: 'oven', stance: 'missing' };
const READ =
  'select "appliance", "stance" from "kitchen_equipment" where "kitchen_equipment"."user_id" = $1 order by "kitchen_equipment"."appliance" asc';

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

describe('KitchenRepository.findByUser', () => {
  it('reads this account’s rows, ordered by the appliance, and parses them', async () => {
    state.rows = [
      ['air_fryer', 'prefers'],
      ['oven', 'missing']
    ];

    await expect(KitchenRepository.findByUser(USER)).resolves.toEqual([
      { appliance: 'air_fryer', stance: 'prefers' },
      { appliance: 'oven', stance: 'missing' }
    ]);

    // The `WHERE user_id` is the ownership boundary, not a filter: there is no
    // row-level security behind this package.
    expect(state.sent[0]).toEqual({ params: [USER], sql: READ, tx: false });
  });

  it('answers the default kitchen’s worth of nothing for somebody who never spoke', async () => {
    await expect(KitchenRepository.findByUser(USER)).resolves.toEqual([]);
  });

  it('turns a driver failure into a DatabaseOperationError, so no connection string reaches a response', async () => {
    state.failOn = /select "appliance"/;

    await expect(KitchenRepository.findByUser(USER)).rejects.toBeInstanceOf(DatabaseOperationError);
    await expect(KitchenRepository.findByUser(USER)).rejects.not.toThrow(/postgres:\/\//);
  });

  it('refuses a stance the catalogue does not hold rather than handing it on', async () => {
    state.rows = [['sous_vide', 'missing']];

    // A row written by a later release. It fails the parse at the boundary
    // instead of travelling as an appliance nothing downstream can read.
    await expect(KitchenRepository.findByUser(USER)).rejects.toThrow();
  });
});

describe('KitchenRepository.setStance', () => {
  it('locks on the account, reads, asks, writes and reads back — all in one transaction', async () => {
    state.rows = [['oven', 'missing']];
    const allow = vi.fn();

    await expect(KitchenRepository.setStance(USER, OVEN, allow)).resolves.toEqual([OVEN]);

    const [lock, read, write, after] = state.sent;

    expect(state.sent.every(statement => statement.tx)).toBe(true);
    // Keyed on the table and the account: two accounts never wait for each other.
    expect(lock?.sql).toBe('select pg_try_advisory_xact_lock(hashtext($1), hashtext($2)) as held');
    expect(lock?.params).toEqual(['kitchen_equipment', USER]);
    expect(read?.sql).toBe(READ);
    expect(write?.sql).toContain('insert into "kitchen_equipment"');
    expect(after?.sql).toBe(READ);
  });

  it('upserts on (user_id, appliance), which is the constraint the table declares', async () => {
    await KitchenRepository.setStance(USER, OVEN, () => undefined);

    const write = statements()[1];

    // Without this exact target Postgres answers 42P10 and the person gets an
    // opaque 500 — the mistake `userOwnedSingleton` exists because of.
    expect(write?.sql).toContain('on conflict ("user_id","appliance") do update set');
    expect(write?.sql).toContain('"stance" = $');
    expect(write?.params).toContain('oven');
    expect(write?.params).toContain('missing');
  });

  it('hands the decision every other appliance and not the one being written', async () => {
    state.rows = [
      ['air_fryer', 'prefers'],
      ['oven', 'has']
    ];
    const allow = vi.fn();

    await KitchenRepository.setStance(USER, { appliance: 'oven', stance: 'prefers' }, allow);

    // Re-stating a preference somebody already has must never count as one more.
    expect(allow).toHaveBeenCalledWith([{ appliance: 'air_fryer', stance: 'prefers' }]);
  });

  it('writes nothing when the decision refuses, and lets the refusal travel as it is', async () => {
    state.rows = [['oven', 'missing']];
    const refusal = new InputParseError('too many', { appliance: ['too many'] });

    await expect(
      KitchenRepository.setStance(USER, { appliance: 'air_fryer', stance: 'prefers' }, () => {
        throw refusal;
      })
    ).rejects.toBe(refusal);

    expect(statements().some(statement => statement.sql.startsWith('insert'))).toBe(false);
  });

  it('gives the other request its turn and refuses rather than queueing on the lock', async () => {
    state.locked = false;

    await expect(KitchenRepository.setStance(USER, OVEN, () => undefined)).rejects.toBeInstanceOf(ConflictError);

    // Eight tries, each its own transaction, and never a read or a write past a
    // lock it did not get. The blocking form would have pinned a pooled
    // connection for the whole wait instead.
    expect(state.sent).toHaveLength(8);
    expect(statements()).toEqual([]);
  });

  it('wraps a failed write, keeping the driver’s message out of it', async () => {
    state.failOn = /insert into "kitchen_equipment"/;

    await expect(KitchenRepository.setStance(USER, OVEN, () => undefined)).rejects.toBeInstanceOf(DatabaseOperationError);
  });
});

describe('KitchenRepository.remove', () => {
  it('deletes this account’s row for that appliance and says it went', async () => {
    state.removed = [['row-1']];

    await expect(KitchenRepository.remove(USER, 'oven')).resolves.toBe(true);

    const [sent] = state.sent;

    expect(sent?.sql).toBe(
      'delete from "kitchen_equipment" where ("kitchen_equipment"."user_id" = $1 and "kitchen_equipment"."appliance" = $2) returning "id"'
    );
    expect(sent?.params).toEqual([USER, 'oven']);
  });

  it('says so when there was nothing to remove, rather than pretending', async () => {
    state.removed = [];

    await expect(KitchenRepository.remove(USER, 'oven')).resolves.toBe(false);
  });

  it('wraps a failed delete', async () => {
    state.failOn = /delete from/;

    await expect(KitchenRepository.remove(USER, 'oven')).rejects.toBeInstanceOf(DatabaseOperationError);
  });
});
