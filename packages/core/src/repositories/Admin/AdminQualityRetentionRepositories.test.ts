import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminAiRepository } from './AdminAiRepository';
import { AdminPlanQualityRepository } from './AdminPlanQualityRepository';
import { AdminRetentionRepository } from './AdminRetentionRepository';
import { AdminSystemRepository } from './AdminSystemRepository';

/** Every statement sent, as Postgres receives it (see `AdminGenerationsRepository.test`). */
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

const FROM = new Date('2026-08-30T22:00:00Z');
const TO = new Date('2026-09-29T10:00:00Z');

beforeEach(() => {
  sent.length = 0;
});

describe('AdminPlanQualityRepository (0071)', () => {
  it('reads only quality and the creation time, summed — no person, no plan id, no day grouping', async () => {
    const totals = await AdminPlanQualityRepository.totals(FROM, TO);
    const statement = sent[0]?.sql ?? '';

    expect(sent).toHaveLength(1);
    expect(totals.stretchPlans).toEqual([]);
    expect(statement).toContain(`"meal_plans"."generation_metadata" -> 'quality'`);
    expect(statement).not.toMatch(/"user_id"|"meal_plans"\."id"|"strategy"|"plan_days"|"meals"/);
    expect(statement).not.toContain('group by');
    // Plans stored before a key existed add 0: every sum is guarded by the JSON type.
    expect(statement).toContain(`jsonb_typeof("meal_plans"."generation_metadata" -> 'quality' #> '{daysFloorNarrowed}') = 'number'`);
    expect(totals).toMatchObject({ days: 0, plans: 0, withoutQuality: 0 });
    expect(Object.keys(totals.advisoriesByKind)).toEqual([
      'carbs_out_of_band',
      'fat_out_of_band',
      'kcal_out_of_band',
      'protein_above_target',
      'protein_below_target',
      'variety'
    ]);
  });

  it('finds when the data starts with a minimum, not a row', async () => {
    expect(await AdminPlanQualityRepository.dataStart()).toBeNull();
    expect(sent[0]?.sql).toContain('min("created_at")');
    expect(sent[0]?.sql).not.toContain('"user_id"');
  });
});

describe('AdminRetentionRepository (0071)', () => {
  const input = { from: '2026-03-31T22:00:00.000Z', to: TO.toISOString(), today: '2026-09-29' } as const;

  it('returns counts per cohort and week and nothing that names a person', async () => {
    await AdminRetentionRepository.cohorts({ ...input, source: 'did_something' });

    const statement = sent[0]?.sql ?? '';

    // The projection is the cohort, the week and three counts — grouped by those two, so no row is a person.
    expect(statement).toMatch(/select to_char\(date_trunc\('month', p\.d0\), 'YYYY-MM-DD'\) as cohort,\s+k\.weeks as weeks,\s+count\(\*\) as size,/);
    expect(statement).toMatch(/\) as active\s+from people p cross join .*group by 1, 2$/s);
    expect(statement).toContain('cross join (values (1), (2), (4)) as k(weeks)');
    // Only a week that is over counts, and each table is read for a person only through its user id.
    expect(statement).toContain('<= $');

    for (const table of ['meal_completions', 'meal_swaps', 'check_ins', 'progress_entries']) {
      expect(statement).toContain(`from "${table}"`);
    }

    expect(statement).toContain(`"completed_at" is not null`);
  });

  it('reads the events version from the two active events, and only people who signed up since the events began', async () => {
    await AdminRetentionRepository.cohorts({ ...input, since: '2026-09-29', source: 'events' });

    expect(sent[0]?.sql).toContain('from "analytics_events"');
    expect(sent[0]?.params).toEqual(expect.arrayContaining(['session_started', 'app_used', '2026-09-29']));
    expect(sent[0]?.sql).not.toContain('meal_completions');
  });
});

describe('the sweep’s history (0071)', () => {
  it('reads the rewrite job’s runs per Madrid day, summing counts and taking the last run’s pending', async () => {
    await AdminSystemRepository.rewriteRunsPerDay(FROM, TO);

    const statement = sent[0]?.sql ?? '';

    expect(statement).toContain(`"properties" ->> 'job' = 'rewrite'`);
    expect(sent[0]?.params).toEqual(expect.arrayContaining(['cron_run']));
    expect(statement).toContain('array_agg(');
    expect(statement).not.toContain('"user_id"');
  });

  it('reads the rewrite feature’s spend per day from ai_call events', async () => {
    await AdminAiRepository.featurePerDay('rewrite', FROM, TO);

    expect(sent[0]?.params).toEqual(expect.arrayContaining(['ai_call', 'rewrite']));
    expect(sent[0]?.sql).toContain(`"properties" ->> 'feature' = $`);
    expect(sent[0]?.sql).not.toContain('"user_id"');
  });
});
