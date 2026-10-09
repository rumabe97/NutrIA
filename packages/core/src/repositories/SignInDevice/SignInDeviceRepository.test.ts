import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';

import { DatabaseOperationError } from 'core/entities/Error';

import { SignInDeviceRepository } from './SignInDeviceRepository';

/**
 * The real Drizzle query builder over a fake postgres-js client, as in
 * `SignInBrakeRepository.test.ts`: each statement is asserted as the SQL
 * Postgres would receive, because what the `WHERE` names — the digest, the
 * account, the clock — is the whole point.
 */
const statements: { params: unknown[]; sql: string }[] = [];
let answers: unknown[][][] = [];
let failing = false;
let transactions = 0;

function answer(sql: string, params: unknown[]): { values: () => Promise<unknown[][]> } {
  statements.push({ params, sql });

  const rows = answers.shift() ?? [];

  return { values: () => (failing ? Promise.reject(new Error('connection to postgres://secret@host failed')) : Promise.resolve(rows)) };
}

const client = {
  begin: (fn: (tx: unknown) => Promise<unknown>) => {
    transactions += 1;

    return fn(client);
  },
  options: { parsers: {}, serializers: {} },
  unsafe: answer
};

const db = drizzle(client as never, { casing: 'snake_case' });

vi.mock('database', () => ({ database: () => db }));

const TOKEN = 'a-token-that-only-the-browser-holds';
const IDENTIFIER = `sign-in-device:${createHash('sha256').update(TOKEN).digest('hex')}`;
const NOW = new Date('2026-10-09T10:00:00.000Z');
const ENDS = new Date('2027-01-07T10:00:00.000Z');

beforeEach(() => {
  statements.length = 0;
  answers = [];
  failing = false;
  transactions = 0;
});

describe('SignInDeviceRepository.whoseIs', () => {
  it('reads the address of the account the digest names while the row is live, in one statement, and never selects the token', async () => {
    answers = [[['ana@example.com']]];

    await expect(SignInDeviceRepository.whoseIs(TOKEN, NOW)).resolves.toBe('ana@example.com');

    expect(statements).toHaveLength(1);
    expect(statements[0]?.sql).toBe(
      'select "user"."email" from "verification" inner join "user" on "user"."id" = "verification"."value" ' +
        'where ("verification"."identifier" = $1 and "verification"."expires_at" > $2) limit $3'
    );
    expect(statements[0]?.params).toEqual([IDENTIFIER, NOW.toISOString(), 1]);
    expect(JSON.stringify(statements[0]?.params)).not.toContain(TOKEN);
  });

  it('is null for an unknown or expired cookie', async () => {
    await expect(SignInDeviceRepository.whoseIs(TOKEN, NOW)).resolves.toBeNull();
  });

  it('never lets a driver message out', async () => {
    failing = true;

    const read = SignInDeviceRepository.whoseIs(TOKEN, NOW);

    await expect(read).rejects.toBeInstanceOf(DatabaseOperationError);
    await expect(read).rejects.not.toThrow(/postgres:/);
  });
});

describe('SignInDeviceRepository.renew', () => {
  it('moves the end of that account’s own live row only, and says whether it did', async () => {
    answers = [[['row-1']]];

    await expect(SignInDeviceRepository.renew('usr-1', TOKEN, NOW, ENDS)).resolves.toBe(true);

    expect(statements[0]?.sql).toBe(
      'update "verification" set "expires_at" = $1, "updated_at" = $2 where ' +
        '("verification"."identifier" = $3 and "verification"."value" = $4 and "verification"."expires_at" > $5) returning "id"'
    );
    expect(statements[0]?.params.slice(2)).toEqual([IDENTIFIER, 'usr-1', NOW.toISOString()]);
    expect(statements[0]?.params[0]).toBe(ENDS.toISOString());
  });

  it('is false when no row was the account’s own', async () => {
    await expect(SignInDeviceRepository.renew('usr-2', TOKEN, NOW, ENDS)).resolves.toBe(false);
  });
});

describe('SignInDeviceRepository.issue', () => {
  it('stores the digest beside the account, then forgets the account’s devices past the newest ones, in one transaction', async () => {
    answers = [[], [['d-new'], ['d-2'], ['d-3'], ['d-old']], []];

    await SignInDeviceRepository.issue('usr-1', TOKEN, ENDS, 3);

    expect(transactions).toBe(1);
    expect(statements[0]?.sql).toMatch(/^insert into "verification" \("id", "expires_at", "identifier", "value", "created_at", "updated_at"\)/);
    expect(statements[0]?.params).toEqual(expect.arrayContaining([IDENTIFIER, 'usr-1', ENDS.toISOString()]));
    expect(JSON.stringify(statements[0]?.params)).not.toContain(TOKEN);
    expect(statements[1]?.sql).toBe(
      'select "id" from "verification" where ("verification"."value" = $1 and "verification"."identifier" like $2) ' +
        'order by "verification"."expires_at" desc, "verification"."created_at" desc'
    );
    expect(statements[1]?.params).toEqual(['usr-1', 'sign-in-device:%']);
    expect(statements[2]?.sql).toBe('delete from "verification" where "verification"."id" in ($1)');
    expect(statements[2]?.params).toEqual(['d-old']);
  });

  it('deletes nothing while the account holds no more than it may', async () => {
    answers = [[], [['d-new'], ['d-2']]];

    await SignInDeviceRepository.issue('usr-1', TOKEN, ENDS, 10);

    expect(statements).toHaveLength(2);
  });

  it('never lets a driver message out', async () => {
    failing = true;

    await expect(SignInDeviceRepository.issue('usr-1', TOKEN, ENDS, 10)).rejects.toBeInstanceOf(DatabaseOperationError);
  });
});

describe('SignInDeviceRepository.forgetAll', () => {
  it('deletes that account’s device rows only — by value and by prefix — and counts them', async () => {
    answers = [[['r1'], ['r2']]];

    await expect(SignInDeviceRepository.forgetAll('usr-1')).resolves.toBe(2);

    expect(statements[0]?.sql).toBe(
      'delete from "verification" where ("verification"."value" = $1 and "verification"."identifier" like $2) returning "id"'
    );
    expect(statements[0]?.params).toEqual(['usr-1', 'sign-in-device:%']);
  });
});
