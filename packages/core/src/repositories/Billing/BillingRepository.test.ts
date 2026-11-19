import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { careLinks } from 'database/schema/care';
import { professionals } from 'database/schema/professional';
import { subscriptions } from 'database/schema/platform';
import { user } from 'database/schema/auth';

import { BillingRepository } from './BillingRepository';

import type { Grants, SubscriptionRecord } from './BillingRepository';
import type { SQL } from 'drizzle-orm';

type Update = { readonly params: unknown[]; readonly set: Record<string, unknown>; readonly sql: string; readonly table: unknown };

// As the client reads column names (`database`): snake_case.
const dialect = new PgDialect({ casing: 'snake_case' });
const updates: Update[] = [];
const inserted: unknown[] = [];
/** What the professional's row answers after its update: open or not, or no row for an account that is not a professional. */
let professional: { practiceOpen: boolean } | undefined;

/** A read: the account's lock, then the stored row, both found. */
function select() {
  const rows = { for: () => Promise.resolve([{ id: 'usr-pro' }]), limit: () => Promise.resolve([]) };

  return { from: () => ({ where: () => rows }) };
}

function update(table: unknown) {
  return {
    set: (set: Record<string, unknown>) => ({
      where: (where: SQL) => {
        const { params, sql } = dialect.sqlToQuery(where);

        updates.push({ params, set, sql, table });

        return Object.assign(Promise.resolve(), { returning: () => Promise.resolve(professional ? [professional] : []) });
      }
    })
  };
}

function insert(table: unknown) {
  return { values: () => ({ onConflictDoUpdate: () => (inserted.push(table), Promise.resolve()) }) };
}

vi.mock('database', () => ({ database: () => ({ transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({ insert, select, update }) }) }));

const RECORD: SubscriptionRecord = {
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  customerId: 'cus_1',
  status: 'canceled',
  subscriptionId: 'sub_1'
};

async function write(grants: Grants): Promise<void> {
  await expect(BillingRepository.recordSubscription('usr-pro', async () => ({ ...grants, record: RECORD }))).resolves.toBe('written');
}

/*
 * A practice's grants are written with the `subscriptions` row, in its
 * transaction (`0061`). What is pinned here is which rows each statement may
 * reach; that Postgres does as told is the end-to-end suite's to prove.
 */
describe('BillingRepository.recordSubscription — a practice', () => {
  beforeEach(() => {
    updates.length = 0;
    inserted.length = 0;
    professional = { practiceOpen: false };
  });

  /*
   * PRD 025 scope 2 (invariant review of phase 6, P1-1) — inverts PRD 004 criterion
   * 13's pause: a practice nobody pays for works, so a lapse touches no link.
   */
  it('pauses nothing on a lapse: the practice falls back to its free seats, every link as it was', async () => {
    await write({ practice: { includedClients: 30, open: false }, tier: 'free' });

    expect(inserted).toEqual([subscriptions]);
    expect(updates.map(statement => statement.table)).toEqual([user, professionals]);
  });

  it('a practitioner’s own premium subscription leaves their free practice’s links active', async () => {
    await write({ practice: { includedClients: null, open: false }, tier: 'premium' });

    expect(updates.map(statement => statement.table)).toEqual([user, professionals]);
    expect(updates.some(statement => statement.table === careLinks)).toBe(false);
  });

  it('makes the paused links active again when the practice pays again', async () => {
    professional = { practiceOpen: true };

    await write({ practice: { includedClients: 30, open: true }, tier: 'free' });

    expect(updates[1]?.set).toMatchObject({ includedClients: 30, practiceOpen: true });
    expect(updates[2]?.set).toEqual({ status: 'active', updatedAt: expect.any(Date) as Date });
    expect(updates[2]?.params).toEqual(['usr-pro', 'paused']);
  });

  it('leaves the included number as it is when the price names none', async () => {
    await write({ practice: { includedClients: null, open: false }, tier: 'premium' });

    expect(updates[1]?.set).not.toHaveProperty('includedClients');
    expect(updates[0]?.set).toMatchObject({ tier: 'premium' });
  });

  /* No professional row: nothing is open, whatever was paid for, and no link is touched. */
  it('touches no link of an account that is not a professional', async () => {
    professional = undefined;

    await write({ practice: { includedClients: 30, open: true }, tier: 'free' });

    expect(updates.some(statement => statement.table === careLinks)).toBe(false);
  });
});
