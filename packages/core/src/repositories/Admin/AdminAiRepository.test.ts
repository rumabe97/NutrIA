import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminAiRepository } from './AdminAiRepository';
import { AdminSeriesRepository } from './AdminSeriesRepository';

/** Every statement sent, as Postgres receives it: the real method's SQL, not a copy (see `AdminGenerationsRepository.test`). */
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

const FROM = new Date('2026-08-29T22:00:00Z');
const TO = new Date('2026-09-28T10:00:00Z');

beforeEach(() => {
  sent.length = 0;
});

describe('AdminAiRepository.callsPerDay', () => {
  it('sums the ai_call properties StructuredAiClient records, reading a number only where one was recorded', async () => {
    await AdminAiRepository.callsPerDay(FROM, TO);

    const [statement] = sent;

    for (const key of ['inputTokens', 'outputTokens', 'reasoningTokens', 'costUsd', 'ms']) {
      expect(statement?.sql).toContain(
        `coalesce(sum(case when jsonb_typeof("properties" -> '${key}') = 'number' then ("properties" ->> '${key}')::numeric else 0 end), 0)`
      );
    }

    expect(statement?.sql).toContain(`count(*) filter (where jsonb_typeof("properties" -> 'ms') = 'number')`);
    expect(statement?.params).toEqual(['ai_call', FROM.toISOString(), TO.toISOString()]);
  });

  // Drizzle writes the select list without the table and the GROUP BY with it; over one table
  // Postgres resolves both to the same column, so they are one expression (run on the dev branch).
  it('groups by the Madrid day, the three names as recorded text, and the outcome', async () => {
    await AdminAiRepository.callsPerDay(FROM, TO);

    const text = sent[0]?.sql ?? '';
    const grouped = text.slice(text.indexOf(' group by '));

    expect(grouped).toContain(`to_char(date_trunc('day', "analytics_events"."created_at" at time zone 'Europe/Madrid'), 'YYYY-MM-DD')`);

    for (const key of ['answeredModel', 'model', 'provider']) {
      expect(grouped).toContain(
        `case when jsonb_typeof("analytics_events"."properties" -> '${key}') = 'string' then "analytics_events"."properties" ->> '${key}' end`
      );
    }

    expect(grouped).toContain(`coalesce("analytics_events"."properties" -> 'ok' = 'false'::jsonb, false)`);
    // Nothing bound in a grouped expression: two placeholders would be two expressions to Postgres.
    expect(grouped).not.toMatch(/\$\d/);
  });
});

describe('AdminSeriesRepository.pictureSpendPerDay', () => {
  it('sums what the picture calls billed per Madrid day, over the created_at index', async () => {
    await AdminSeriesRepository.pictureSpendPerDay(FROM, TO);

    expect(sent[0]?.sql).toContain('coalesce(sum("cost_usd"), 0)');
    expect(sent[0]?.sql).toContain(
      'from "recipe_image_calls" where ("recipe_image_calls"."created_at" >= $1 and "recipe_image_calls"."created_at" < $2)'
    );
    expect(sent[0]?.sql).toContain(
      `group by to_char(date_trunc('day', "recipe_image_calls"."created_at" at time zone 'Europe/Madrid'), 'YYYY-MM-DD')`
    );
  });
});
