import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseOperationError } from 'core/entities/Error';

import { AccountNoticeRepository } from './AccountNoticeRepository';

/**
 * Every statement the repository sends, as Postgres would receive it, and
 * whether it went inside the lock's transaction. A postgres.js stand-in records
 * the text, so the SQL under test is the SQL the real method builds.
 */
const state = vi.hoisted(() => ({
  failOn: null as RegExp | null,
  locked: true,
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
        const failed = Promise.reject(new Error('connection lost'));

        return Object.assign(failed, { values: () => failed });
      }

      const objects = sql.startsWith('select pg_try_advisory_xact_lock') ? [{ locked: state.locked }] : [];
      const rows = sql.startsWith('select') && !sql.startsWith('select pg_') ? (state.rows.shift() ?? []) : [];

      return Object.assign(Promise.resolve(objects), { values: () => Promise.resolve(rows) });
    }
  });

  const db = drizzle({ casing: 'snake_case', client: client(false) as never });

  return { database: () => db };
});

beforeEach(() => {
  state.failOn = null;
  state.locked = true;
  state.rows = [];
  state.sent.length = 0;
});

/*
 * Project 025 phase 10: the owner's notice to every account, once each. The
 * repository decides who is owed it in SQL, so the SQL is what is tested.
 */
describe('AccountNoticeRepository.candidates', () => {
  it('owes the notice to a confirmed address with no row for that notice, oldest account first, bounded', async () => {
    state.rows = [[['usr-1', 'someone@example.invalid']]];

    await expect(AccountNoticeRepository.candidates('terms-2.4.0', 25)).resolves.toEqual([{ id: 'usr-1', email: 'someone@example.invalid' }]);

    const [query] = state.sent;

    expect(query?.sql).toContain('"user"."email_verified" = $1');
    expect(query?.sql).toContain(
      'not exists (select 1 from "account_notices" where ("account_notices"."user_id" = "user"."id" and "account_notices"."notice" = $2))'
    );
    expect(query?.sql).toContain('order by "user"."created_at" asc, "user"."id" asc limit $3');
    expect(query?.params).toEqual([true, 'terms-2.4.0', 25]);
  });

  it('lists every account owed it when no limit is given — the preview', async () => {
    await AccountNoticeRepository.candidates('terms-2.4.0');

    expect(state.sent[0]?.sql).not.toContain('limit');
  });
});

describe('AccountNoticeRepository.counts', () => {
  it('counts the owed, the unconfirmed and the told, for that notice alone', async () => {
    state.rows = [[[7, 2]], [[3]]];

    await expect(AccountNoticeRepository.counts('terms-2.4.0')).resolves.toEqual({ alreadySent: 3, toSend: 7, unconfirmed: 2 });

    const [accounts, told] = state.sent;

    expect(accounts?.sql).toContain('count(*) filter (where "email_verified")::int');
    expect(accounts?.sql).toContain('count(*) filter (where not "email_verified")::int');
    expect(accounts?.sql).toContain('not exists (select 1 from "account_notices"');
    expect(told?.sql).toContain('from "account_notices" where "account_notices"."notice" = $1');
  });

  it('reads zero, not a failure, from empty answers', async () => {
    await expect(AccountNoticeRepository.counts('terms-2.4.0')).resolves.toEqual({ alreadySent: 0, toSend: 0, unconfirmed: 0 });
  });
});

describe('AccountNoticeRepository.effectiveOn', () => {
  it('is the day the first row announced, or null while nobody has been told', async () => {
    state.rows = [[['2026-12-01']]];

    await expect(AccountNoticeRepository.effectiveOn('terms-2.4.0')).resolves.toBe('2026-12-01');
    await expect(AccountNoticeRepository.effectiveOn('terms-2.4.0')).resolves.toBeNull();
    expect(state.sent[0]?.sql).toContain('order by "account_notices"."sent_at" asc limit $2');
  });
});

describe('AccountNoticeRepository.record', () => {
  it('writes one row on its own — not in a transaction — and leaves a row already there as it is', async () => {
    const sentAt = new Date('2026-11-21T10:00:00.000Z');

    await AccountNoticeRepository.record('usr-1', 'terms-2.4.0', { effectiveOn: '2026-12-01', locale: 'en-GB', sentAt });

    const [write] = state.sent;

    expect(write?.tx).toBe(false);
    expect(write?.sql).toContain('insert into "account_notices"');
    expect(write?.sql).toContain('on conflict do nothing');
    expect(write?.params).toEqual(expect.arrayContaining(['usr-1', 'terms-2.4.0', '2026-12-01', 'en-GB']));
  });

  it('fails as a database failure, never with the driver’s words', async () => {
    state.failOn = /^insert/;

    await expect(
      AccountNoticeRepository.record('usr-1', 'terms-2.4.0', { effectiveOn: '2026-12-01', locale: 'es-ES', sentAt: new Date() })
    ).rejects.toBeInstanceOf(DatabaseOperationError);
  });
});

describe('AccountNoticeRepository.exclusively', () => {
  it('runs the batch under this notice’s try-lock, and the batch writes outside the lock’s transaction', async () => {
    const value = await AccountNoticeRepository.exclusively('terms-2.4.0', async () => {
      await AccountNoticeRepository.record('usr-1', 'terms-2.4.0', { effectiveOn: '2026-12-01', locale: 'es-ES', sentAt: new Date() });

      return 'done';
    });

    const [lock, write] = state.sent;

    expect(value).toBe('done');
    expect(lock).toMatchObject({
      params: ['terms-2.4.0'],
      sql: "select pg_try_advisory_xact_lock(hashtext('account_notice'), hashtext($1)) as locked",
      tx: true
    });
    // Its own connection: the row commits at once, and a batch cut short keeps it.
    expect(write?.tx).toBe(false);
  });

  it('answers null, and runs nothing, while another press holds the lock', async () => {
    state.locked = false;
    const batch = vi.fn(async () => 'done');

    await expect(AccountNoticeRepository.exclusively('terms-2.4.0', batch)).resolves.toBeNull();
    expect(batch).not.toHaveBeenCalled();
  });

  it('lets what the batch threw through as it was, not as a database failure', async () => {
    const refusal = new Error('the batch’s own refusal');

    await expect(AccountNoticeRepository.exclusively('terms-2.4.0', () => Promise.reject(refusal))).rejects.toBe(refusal);
  });

  it('turns a failure of the lock itself into a database failure', async () => {
    state.failOn = /^select pg_try/;

    await expect(AccountNoticeRepository.exclusively('terms-2.4.0', async () => 'done')).rejects.toBeInstanceOf(DatabaseOperationError);
  });
});
