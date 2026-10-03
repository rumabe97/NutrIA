import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';

import { DatabaseOperationError } from 'core/entities/Error';

import { SignInBrakeRepository } from './SignInBrakeRepository';

import type { BrakeDecision, SignInAttempts } from 'core/domain/SignInBrake';

/**
 * The real Drizzle query builder over a fake postgres-js client, as in
 * `TwoFactorRepository.test.ts`: each statement is asserted as the SQL
 * Postgres would receive, because the lock the upsert takes and the sweep's
 * `WHERE` are the whole point.
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

const KEY = 'a'.repeat(64);
const NOW = new Date('2026-10-03T10:00:00.000Z');
const LATER = new Date('2026-10-03T10:00:30.000Z');

beforeEach(() => {
  statements.length = 0;
  answers = [];
  failing = false;
  transactions = 0;
});

describe('SignInBrakeRepository.attempt', () => {
  it('locks the key with an upsert, hands the row to the decision, and writes the next state, in one transaction', async () => {
    answers = [[[9, null, NOW]], []];
    const next: SignInAttempts = { count: 10, nextAllowedAt: LATER, windowStartedAt: NOW };
    const decide = vi.fn<(attempts: SignInAttempts) => BrakeDecision>().mockReturnValue({ kind: 'allowed', next });

    await expect(SignInBrakeRepository.attempt(KEY, NOW, decide)).resolves.toEqual({ kind: 'allowed', next });

    expect(transactions).toBe(1);
    expect(decide).toHaveBeenCalledWith({ count: 9, nextAllowedAt: null, windowStartedAt: NOW });
    expect(statements[0]?.sql).toBe(
      'insert into "sign_in_failure" ("count", "key", "next_allowed_at", "window_started_at") values ($1, $2, $3, $4) ' +
        'on conflict ("key") do update set "key" = excluded.key returning "count", "next_allowed_at", "window_started_at"'
    );
    expect(statements[0]?.params).toEqual([0, KEY, null, NOW.toISOString()]);
    expect(statements[1]?.sql).toBe(
      'update "sign_in_failure" set "count" = $1, "next_allowed_at" = $2, "window_started_at" = $3 where "sign_in_failure"."key" = $4'
    );
    expect(statements[1]?.params).toEqual([10, LATER.toISOString(), NOW.toISOString(), KEY]);
  });

  it('writes nothing when braked, so a wait is never stretched by the attempts made during it', async () => {
    answers = [[[10, LATER, NOW]]];

    await expect(SignInBrakeRepository.attempt(KEY, NOW, () => ({ kind: 'braked', retryAfterSeconds: 30 }))).resolves.toEqual({
      kind: 'braked',
      retryAfterSeconds: 30
    });
    expect(statements).toHaveLength(1);
  });

  it('never lets a driver message out', async () => {
    failing = true;

    const attempt = SignInBrakeRepository.attempt(KEY, NOW, () => ({ kind: 'braked', retryAfterSeconds: 1 }));

    await expect(attempt).rejects.toBeInstanceOf(DatabaseOperationError);
    await expect(attempt).rejects.not.toThrow(/postgres:/);
  });
});

describe('SignInBrakeRepository.clear', () => {
  it('deletes that key only', async () => {
    await SignInBrakeRepository.clear(KEY);

    expect(statements).toEqual([{ params: [KEY], sql: 'delete from "sign_in_failure" where "sign_in_failure"."key" = $1' }]);
  });
});

describe('SignInBrakeRepository.forgetQuiet', () => {
  it('deletes only rows whose window began and whose wait ended before the cutoff, and counts them', async () => {
    answers = [[[KEY], ['b'.repeat(64)]]];

    await expect(SignInBrakeRepository.forgetQuiet(NOW)).resolves.toBe(2);
    expect(statements[0]?.sql).toBe(
      'delete from "sign_in_failure" where ("sign_in_failure"."window_started_at" < $1 and ' +
        '("sign_in_failure"."next_allowed_at" is null or "sign_in_failure"."next_allowed_at" < $2)) returning "key"'
    );
    expect(statements[0]?.params).toEqual([NOW.toISOString(), NOW.toISOString()]);
  });
});
