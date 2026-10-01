import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';

import { DatabaseOperationError } from 'core/entities/Error';

import { TwoFactorRepository } from './TwoFactorRepository';

/**
 * The real Drizzle query builder over a fake postgres-js client, so each
 * statement is asserted as the SQL Postgres would receive — the guarded
 * `WHERE`s are the whole point of this repository, and a mocked chain would
 * prove nothing about them. Each statement answers the next queued rows,
 * as arrays in the order of its selected fields.
 */
const statements: { params: unknown[]; sql: string }[] = [];
let answers: unknown[][][] = [];
let failing = false;

/** Only `.values()` is ever awaited here: every statement selects or returns fields. */
function answer(sql: string, params: unknown[]): { values: () => Promise<unknown[][]> } {
  statements.push({ params, sql });

  const rows = answers.shift() ?? [];

  return { values: () => (failing ? Promise.reject(new Error('connection to postgres://secret@host failed')) : Promise.resolve(rows)) };
}

const client = { begin: (fn: (tx: unknown) => Promise<unknown>) => fn(client), options: { parsers: {}, serializers: {} }, unsafe: answer };

const db = drizzle(client as never, { casing: 'snake_case' });

vi.mock('database', () => ({ database: () => db }));

const NOW = new Date('2026-10-01T19:00:00.000Z');
const DUE = new Date('2026-10-03T19:00:00.000Z');
const record = vi.fn<(tx: unknown) => Promise<void>>();

beforeEach(() => {
  statements.length = 0;
  answers = [];
  failing = false;
  record.mockReset();
  record.mockResolvedValue(undefined);
});

describe('TwoFactorRepository.request', () => {
  it('reads the account, then inserts or revives only a cancelled row, and records inside the transaction', async () => {
    answers = [[['ana@example.invalid', true]], [[DUE]]];

    await expect(TwoFactorRepository.request('usr-7', 'adm-1', NOW, DUE, record)).resolves.toEqual({
      dueAt: DUE,
      email: 'ana@example.invalid',
      kind: 'requested'
    });

    expect(statements[0]?.sql).toBe('select "email", "two_factor_enabled" from "user" where "user"."id" = $1 limit $2');
    expect(statements[0]?.params[0]).toBe('usr-7');
    expect(statements[1]?.sql).toContain('insert into "two_factor_removal"');
    expect(statements[1]?.sql).toContain('on conflict ("user_id") do update set');
    expect(statements[1]?.sql).toContain('where "two_factor_removal"."cancelled_at" is not null returning "due_at"');
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('answers pending, and records nothing, when the upsert found a live request', async () => {
    answers = [[['ana@example.invalid', true]], []];

    await expect(TwoFactorRepository.request('usr-7', 'adm-1', NOW, DUE, record)).resolves.toEqual({ kind: 'pending' });
    expect(record).not.toHaveBeenCalled();
  });

  it('answers not_enabled for an account without the factor, and writes nothing', async () => {
    answers = [[['ana@example.invalid', false]]];

    await expect(TwoFactorRepository.request('usr-7', 'adm-1', NOW, DUE, record)).resolves.toEqual({ kind: 'not_enabled' });
    expect(statements).toHaveLength(1);
    expect(record).not.toHaveBeenCalled();
  });

  it('answers missing for an unknown account, and writes nothing', async () => {
    answers = [[]];

    await expect(TwoFactorRepository.request('nobody', 'adm-1', NOW, DUE, record)).resolves.toEqual({ kind: 'missing' });
    expect(statements).toHaveLength(1);
    expect(record).not.toHaveBeenCalled();
  });
});

describe('TwoFactorRepository.cancel', () => {
  it('cancels only a pending row of this account, then records', async () => {
    answers = [[['rem-1']], [['ana@example.invalid']]];

    await expect(TwoFactorRepository.cancel('usr-7', NOW, record)).resolves.toEqual({ email: 'ana@example.invalid' });
    expect(statements[0]?.sql).toBe(
      'update "two_factor_removal" set "cancelled_at" = $1, "updated_at" = $2 where ("two_factor_removal"."user_id" = $3 and "two_factor_removal"."cancelled_at" is null) returning "id"'
    );
    expect(statements[0]?.params[2]).toBe('usr-7');
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('answers null and records nothing when nothing was pending', async () => {
    answers = [[]];

    await expect(TwoFactorRepository.cancel('usr-7', NOW, record)).resolves.toBeNull();
    expect(record).not.toHaveBeenCalled();
  });
});

describe('TwoFactorRepository.claimTotpStep', () => {
  it('claims a step only when it is newer than the last one, in one statement', async () => {
    answers = [[['tf-1']]];

    await expect(TwoFactorRepository.claimTotpStep('usr-7', 59_000_001)).resolves.toBe(true);
    expect(statements[0]?.sql).toBe(
      'update "two_factor" set "last_totp_step" = $1 where ("two_factor"."user_id" = $2 and ("two_factor"."last_totp_step" is null or "two_factor"."last_totp_step" < $3)) returning "id"'
    );
    expect(statements[0]?.params).toEqual([59_000_001, 'usr-7', 59_000_001]);
  });

  it('answers false for a replayed or older step', async () => {
    answers = [[]];

    await expect(TwoFactorRepository.claimTotpStep('usr-7', 59_000_001)).resolves.toBe(false);
  });
});

describe('TwoFactorRepository.due', () => {
  it('lists the pending requests whose due date has passed', async () => {
    answers = [[['usr-7'], ['usr-8']]];

    await expect(TwoFactorRepository.due(NOW)).resolves.toEqual(['usr-7', 'usr-8']);
    expect(statements[0]?.sql).toBe(
      'select "user_id" from "two_factor_removal" where ("two_factor_removal"."cancelled_at" is null and "two_factor_removal"."due_at" <= $1)'
    );
  });
});

describe('TwoFactorRepository.remove', () => {
  it('deletes the request only if still pending and due, then the factor, the flag and the trusted devices, then records', async () => {
    answers = [[['rem-1']], [['tf-1']], [['ana@example.invalid']], []];

    await expect(TwoFactorRepository.remove('usr-7', NOW, record)).resolves.toEqual({ email: 'ana@example.invalid' });
    expect(statements.map(statement => statement.sql)).toEqual([
      'delete from "two_factor_removal" where ("two_factor_removal"."user_id" = $1 and "two_factor_removal"."cancelled_at" is null and "two_factor_removal"."due_at" <= $2) returning "id"',
      'delete from "two_factor" where "two_factor"."user_id" = $1 returning "id"',
      'update "user" set "two_factor_enabled" = $1, "updated_at" = $2 where "user"."id" = $3 returning "email"',
      'delete from "verification" where ("verification"."value" = $1 and "verification"."identifier" like $2)'
    ]);
    expect(statements[0]?.params[0]).toBe('usr-7');
    expect(statements[3]?.params).toEqual(['usr-7', 'trust-device-%']);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('does nothing past the first statement when the request is not due, was cancelled or is gone', async () => {
    answers = [[]];

    await expect(TwoFactorRepository.remove('usr-7', NOW, record)).resolves.toBeNull();
    expect(statements).toHaveLength(1);
    expect(record).not.toHaveBeenCalled();
  });

  it('closes the request quietly when the account had already turned the factor off itself', async () => {
    answers = [[['rem-1']], [], [['ana@example.invalid']], []];

    await expect(TwoFactorRepository.remove('usr-7', NOW, record)).resolves.toBeNull();
    expect(record).not.toHaveBeenCalled();
  });
});

describe('errors', () => {
  it('never lets a driver message out', async () => {
    failing = true;

    const error = await TwoFactorRepository.claimTotpStep('usr-7', 1).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DatabaseOperationError);
    expect(String((error as Error).message)).not.toContain('secret');
  });
});
