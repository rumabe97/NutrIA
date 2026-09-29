import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { AdminGenerationsRepository, generationFilters } from './AdminGenerationsRepository';

/**
 * Every statement the repository sends, as Postgres would receive it. A
 * postgres.js stand-in records the text and answers nothing, so the SQL under
 * test is the SQL the real method builds — not a copy of it (project 007,
 * phase 5: a copy is where the missing table name hid).
 */
const sent = vi.hoisted(() => [] as { params: unknown[]; sql: string }[]);

vi.mock('database', async () => {
  const { drizzle } = await import('drizzle-orm/postgres-js');

  const answer = (sql: string, params: unknown[]) => {
    sent.push({ params, sql });

    return Object.assign(Promise.resolve([]), { values: () => Promise.resolve([]) });
  };

  const db = drizzle({ casing: 'snake_case', client: { options: { parsers: {}, serializers: {} }, unsafe: answer } as never });

  return { database: () => db };
});

const dialect = new PgDialect({ casing: 'snake_case' });

beforeEach(() => {
  sent.length = 0;
});

describe('generationFilters', () => {
  it('is no condition at all when nothing is asked', () => {
    expect(generationFilters({})).toBeUndefined();
  });

  it('searches the address as a literal, case-insensitive "contains", bound as a parameter', () => {
    const { params, sql } = dialect.sqlToQuery(generationFilters({ q: '50%_x' })!);

    expect(sql).toBe('"user"."email" ilike $1');
    expect(params).toEqual(['%50\\%\\_x%']);
  });

  it('matches the status and the code exactly, and bounds the instant the job was made', () => {
    const after = new Date('2026-09-01T22:00:00Z');
    const before = new Date('2026-09-28T22:00:00Z');
    const { params, sql } = dialect.sqlToQuery(generationFilters({ after, before, code: 'GENERATION_INVALID_PLAN', status: 'failed' })!);

    expect(sql).toBe(
      '("plan_generation_jobs"."status" = $1 and "plan_generation_jobs"."error" = $2 and "plan_generation_jobs"."created_at" >= $3 and "plan_generation_jobs"."created_at" < $4)'
    );
    expect(params).toEqual(['failed', 'GENERATION_INVALID_PLAN', after.toISOString(), before.toISOString()]);
  });
});

describe('AdminGenerationsRepository.page', () => {
  it('reads the same row the log always read, newest first with a stable tail, and counts under the same WHERE', async () => {
    await AdminGenerationsRepository.page({ q: 'ana', status: 'succeeded' }, 50, 25);

    const [page, counted] = sent;

    expect(page?.sql).toContain('from "plan_generation_jobs" inner join "user" on "user"."id" = "plan_generation_jobs"."user_id"');
    expect(page?.sql).toContain('left join "meal_plans" on "meal_plans"."id" = "plan_generation_jobs"."plan_id"');
    expect(page?.sql).toContain('"user"."email"');
    // Only the keys the log shows, cut in SQL: the advisories (an event's name, a plan's figures) and the
    // plan's quality never leave the database on this path (`0071`).
    expect(page?.sql).toContain(
      `case when "meal_plans"."generation_metadata" is null then null else jsonb_build_object('backfilled', "meal_plans"."generation_metadata" -> 'backfilled', 'fallback', "meal_plans"."generation_metadata" -> 'fallback', 'model', "meal_plans"."generation_metadata" -> 'model', 'promptVersion', "meal_plans"."generation_metadata" -> 'promptVersion', 'rejected', "meal_plans"."generation_metadata" -> 'rejected', 'reused', "meal_plans"."generation_metadata" -> 'reused') end`
    );
    expect(page?.sql).not.toMatch(/advisories|quality|loadedTargets/);
    expect(page?.sql.match(/"meal_plans"\."generation_metadata"(?! (is null|->))/g)).toBeNull();
    // An address and a name; nothing else of the account's, and nothing of the plan but what it recorded of its own making.
    expect(page?.sql).not.toMatch(/"meal_plans"\."(user_id|targets|days)"/);
    expect(page?.sql).toContain('order by "plan_generation_jobs"."created_at" desc, "plan_generation_jobs"."id" asc limit $3 offset $4');
    expect(page?.params).toEqual(['succeeded', '%ana%', 25, 50]);
    expect(counted?.sql).toBe(
      'select count(*) from "plan_generation_jobs" inner join "user" on "user"."id" = "plan_generation_jobs"."user_id" where ("plan_generation_jobs"."status" = $1 and "user"."email" ilike $2)'
    );
  });
});

describe('AdminGenerationsRepository charts', () => {
  it('takes the percentiles over the seconds of the jobs that finished, by the Madrid day they were made', async () => {
    await AdminGenerationsRepository.durationsPerDay(new Date('2026-09-01T22:00:00Z'), new Date('2026-09-28T10:00:00Z'));

    const [durations] = sent;

    expect(durations?.sql).toContain(
      'percentile_cont(0.5) within group (order by extract(epoch from ("plan_generation_jobs"."finished_at" - "plan_generation_jobs"."started_at")))'
    );
    expect(durations?.sql).toContain('percentile_cont(0.95)');
    expect(durations?.sql).toContain('"plan_generation_jobs"."status" in ($3, $4)');
    expect(durations?.sql).toContain('"plan_generation_jobs"."started_at" is not null and "plan_generation_jobs"."finished_at" is not null');
    expect(durations?.sql).toContain(
      `group by to_char(date_trunc('day', "plan_generation_jobs"."created_at" at time zone 'Europe/Madrid'), 'YYYY-MM-DD')`
    );
    expect(durations?.params.slice(2)).toEqual(['succeeded', 'failed']);
  });

  it('counts the period’s failures by code, the commonest first', async () => {
    await AdminGenerationsRepository.failuresByCode(new Date('2026-09-01T22:00:00Z'), new Date('2026-09-28T10:00:00Z'));

    const [failures] = sent;

    expect(failures?.sql).toContain('group by "plan_generation_jobs"."error" order by count(*) desc, "plan_generation_jobs"."error" asc');
    expect(failures?.params.at(-1)).toBe('failed');
  });

  it('sums every call’s rejections by reason over the period, reading only the counts', async () => {
    await AdminGenerationsRepository.rejectionsByReason(new Date('2026-09-01T22:00:00Z'), new Date('2026-09-28T10:00:00Z'));

    const [rejections] = sent;

    expect(rejections?.sql).toContain('jsonb_array_elements');
    expect(rejections?.sql).toContain("jsonb_each(case when jsonb_typeof(call -> 'rejected') = 'object'");
    expect(rejections?.sql).toContain('group by reason.key');
    // Grouped by reason alone: nothing about a job, an account or an address leaves the query.
    expect(rejections?.sql).not.toMatch(/"user"|email|user_id/);
    // The window's two ends are the only values bound.
    expect(rejections?.params).toHaveLength(2);
  });
});
