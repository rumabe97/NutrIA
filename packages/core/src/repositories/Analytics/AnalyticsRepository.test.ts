import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsRepository } from './AnalyticsRepository';

/**
 * Every statement the repository sends, as Postgres would receive it, and
 * whether it went inside a transaction. A postgres.js stand-in records the text
 * and answers a count of `existing` for the check, so the SQL under test is the
 * SQL the real method builds.
 */
const state = vi.hoisted(() => ({
  existing: 0,
  failOn: null as RegExp | null,
  locked: true,
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

      const rows = sql.startsWith('select count(*)') ? [[state.existing]] : [];
      const objects = sql.startsWith('select pg_try_advisory_xact_lock') ? [{ locked: state.locked }] : [];

      return Object.assign(Promise.resolve(objects), { values: () => Promise.resolve(rows) });
    }
  });

  const db = drizzle({ casing: 'snake_case', client: client(false) as never });

  return { database: () => db };
});

const SINCE = new Date('2026-09-28T22:00:00Z');

beforeEach(() => {
  state.existing = 0;
  state.failOn = null;
  state.locked = true;
  state.sent.length = 0;
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

describe('AnalyticsRepository.recordOnceSince', () => {
  it('locks on the event and the person, checks since the instant given, then writes — all in one transaction', async () => {
    await AnalyticsRepository.recordOnceSince('app_used', 'usr-1', SINCE);

    const [lock, check, write] = state.sent;

    expect(state.sent.every(statement => statement.tx)).toBe(true);
    expect(lock?.sql).toBe('select pg_try_advisory_xact_lock(hashtext($1), hashtext($2)) as locked');
    expect(lock?.params).toEqual(['app_used', 'usr-1']);
    expect(check?.sql).toContain('select count(*) from "analytics_events"');
    expect(check?.sql).toContain('"analytics_events"."event" = $1 and "analytics_events"."user_id" = $2 and "analytics_events"."created_at" >= $3');
    expect(check?.params).toEqual(['app_used', 'usr-1', SINCE.toISOString()]);
    expect(write?.sql).toContain('insert into "analytics_events"');
    // Nothing travels with it but the fact: no properties.
    expect(write?.params).toContain('usr-1');
    expect(write?.params).toContain('app_used');
    expect(write?.params).toContain(null);
  });

  it('writes nothing when the person already has one since then', async () => {
    state.existing = 1;

    await AnalyticsRepository.recordOnceSince('app_used', 'usr-1', SINCE);

    expect(state.sent.some(statement => statement.sql.startsWith('insert'))).toBe(false);
  });

  it('neither waits nor writes when another request holds the lock: that one writes the row', async () => {
    state.locked = false;

    await expect(AnalyticsRepository.recordOnceSince('app_used', 'usr-1', SINCE)).resolves.toBeUndefined();
    expect(state.sent.map(statement => statement.sql)).toEqual(['select pg_try_advisory_xact_lock(hashtext($1), hashtext($2)) as locked']);
  });

  it('never throws when the lock itself fails', async () => {
    state.failOn = /pg_try_advisory_xact_lock/;

    await expect(AnalyticsRepository.recordOnceSince('app_used', 'usr-1', SINCE)).resolves.toBeUndefined();
    expect(state.sent.some(statement => statement.sql.startsWith('insert'))).toBe(false);
  });

  it('never throws: a counter must not fail the request that renewed a session', async () => {
    state.failOn = /^insert/;

    await expect(AnalyticsRepository.recordOnceSince('app_used', 'usr-1', SINCE)).resolves.toBeUndefined();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"app_used" not recorded'));
  });
});

describe('AnalyticsRepository.record', () => {
  it('writes a system event with no user and only the properties it was given', async () => {
    await AnalyticsRepository.record('cron_run', null, { job: 'reminders', sent: 2 });

    const [write] = state.sent;

    expect(write?.sql).toContain('insert into "analytics_events"');
    expect(write?.params).toContain('cron_run');
    expect(write?.params).toContain(JSON.stringify({ job: 'reminders', sent: 2 }));
  });

  it('never throws', async () => {
    state.failOn = /^insert/;

    await expect(AnalyticsRepository.record('mail_sent', null, { kind: 'verify-email', ok: true })).resolves.toBeUndefined();
  });
});
