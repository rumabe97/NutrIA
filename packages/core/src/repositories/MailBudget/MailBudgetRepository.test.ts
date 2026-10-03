import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';

import { DatabaseOperationError } from 'core/entities/Error';

import { MailBudgetRepository } from './MailBudgetRepository';

import type { MailDecision, MailsSent } from 'core/domain/MailBudget';

/**
 * The real Drizzle query builder over a fake postgres-js client, as in
 * `SignInBrakeRepository.test.ts`: each statement is asserted as the SQL
 * Postgres would receive, because the lock taken before the read is the whole
 * point.
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
const IDENTIFIER = `mail-budget:${KEY}`;
const NOW = new Date('2026-10-03T10:00:00.000Z');
const HOUR_LATER = new Date('2026-10-03T11:00:00.000Z');
const LOCK = 'select pg_advisory_xact_lock(hashtext($1))';
const READ =
  'select "id", "expires_at", "value" from "verification" where ("verification"."identifier" = $1 and "verification"."expires_at" > $2) limit $3';

beforeEach(() => {
  statements.length = 0;
  answers = [];
  failing = false;
  transactions = 0;
});

describe('MailBudgetRepository.spend', () => {
  it('locks the key, reads its live row, and inserts the first one, in one transaction', async () => {
    answers = [[], [], []];
    const next: MailsSent = { count: 1, windowEndsAt: HOUR_LATER };
    const decide = vi.fn<(sent: MailsSent | undefined) => MailDecision>().mockReturnValue({ kind: 'send', next });

    await expect(MailBudgetRepository.spend(KEY, NOW, decide)).resolves.toEqual({ kind: 'send', next });

    expect(transactions).toBe(1);
    expect(decide).toHaveBeenCalledWith(undefined);
    expect(statements[0]).toEqual({ params: [IDENTIFIER], sql: LOCK });
    expect(statements[1]).toEqual({ params: [IDENTIFIER, NOW.toISOString(), 1], sql: READ });
    expect(statements[2]?.sql).toBe(
      'insert into "verification" ("id", "expires_at", "identifier", "value", "created_at", "updated_at") ' +
        'values ($1, $2, $3, $4, default, default)'
    );
    expect(statements[2]?.params.slice(1)).toEqual([HOUR_LATER.toISOString(), IDENTIFIER, '1']);
  });

  it('hands the live row to the decision and updates it', async () => {
    answers = [[], [['row-1', HOUR_LATER, '2']], []];
    const next: MailsSent = { count: 3, windowEndsAt: HOUR_LATER };
    const decide = vi.fn<(sent: MailsSent | undefined) => MailDecision>().mockReturnValue({ kind: 'send', next });

    await MailBudgetRepository.spend(KEY, NOW, decide);

    expect(decide).toHaveBeenCalledWith({ count: 2, windowEndsAt: HOUR_LATER });
    expect(statements[2]?.sql).toBe('update "verification" set "expires_at" = $1, "value" = $2, "updated_at" = $3 where "verification"."id" = $4');
    expect([statements[2]?.params[0], statements[2]?.params[1], statements[2]?.params[3]]).toEqual([HOUR_LATER.toISOString(), '3', 'row-1']);
  });

  it('writes nothing when the mail is held', async () => {
    answers = [[], [['row-1', HOUR_LATER, '3']]];

    await expect(MailBudgetRepository.spend(KEY, NOW, () => ({ kind: 'held' }))).resolves.toEqual({ kind: 'held' });
    expect(statements).toHaveLength(2);
  });

  it('never lets a driver message out', async () => {
    failing = true;

    const spend = MailBudgetRepository.spend(KEY, NOW, () => ({ kind: 'held' }));

    await expect(spend).rejects.toBeInstanceOf(DatabaseOperationError);
    await expect(spend).rejects.not.toThrow(/postgres:/);
  });
});
