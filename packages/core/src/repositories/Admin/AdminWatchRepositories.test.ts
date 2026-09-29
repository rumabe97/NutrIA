import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminConsentRepository } from './AdminConsentRepository';
import { AdminNotificationRepository } from './AdminNotificationRepository';
import { AdminSeriesRepository } from './AdminSeriesRepository';
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

const FROM = new Date('2026-09-01T22:00:00Z');
const TO = new Date('2026-09-28T10:00:00Z');

beforeEach(() => {
  sent.length = 0;
});

describe('"active" (0071)', () => {
  it('is a sign-in or a use of a session, in both the daily series and the period totals', async () => {
    await AdminSeriesRepository.activePeoplePerDay(FROM, TO);
    await AdminSeriesRepository.activePeopleTotals({ from: FROM, previousFrom: new Date('2026-08-05T22:00:00Z'), to: TO });

    expect(sent).toHaveLength(2);

    for (const statement of sent) {
      expect(statement.sql).toContain('"analytics_events"."event" in ($');
      expect(statement.params).toEqual(expect.arrayContaining(['session_started', 'app_used']));
      expect(statement.params).not.toContain('swap_requested');
    }
  });
});

describe('AdminConsentRepository', () => {
  it('selects a version and a count, grouped by the version — never an account', async () => {
    await AdminConsentRepository.profileVersions();
    await AdminConsentRepository.healthVersions();
    await AdminConsentRepository.careVersions();
    await AdminConsentRepository.professionalVersions();

    expect(sent.map(statement => statement.sql)).toEqual([
      'select count(*), "version" from "profile_data_consents" group by "profile_data_consents"."version"',
      'select count(*), "version" from "health_data_consents" group by "health_data_consents"."version"',
      'select count(*), "consent_version" from "care_links" where "care_links"."status" in ($1, $2) group by "care_links"."consent_version"',
      'select count(*), "agreement_version" from "professionals" group by "professionals"."agreement_version"'
    ]);
    expect(sent[2]?.params).toEqual(['active', 'paused']);
  });

  it('sets the profile consent against accounts that finished onboarding', async () => {
    await AdminConsentRepository.onboardedAgainstProfileConsent('1.0.0');

    expect(sent[0]?.sql).toContain(
      'from "onboarding_state" left join "profile_data_consents" on "profile_data_consents"."user_id" = "onboarding_state"."user_id"'
    );
    expect(sent[0]?.sql).toContain('"onboarding_state"."completed_at" is not null');
    expect(sent[0]?.params).toContain('1.0.0');
  });
});

describe('AdminNotificationRepository', () => {
  it('counts subscriptions and the people who hold them, reading neither an endpoint nor a key', async () => {
    await AdminNotificationRepository.pushSubscriptionTotals();

    expect(sent[0]?.sql).toBe('select count(distinct "user_id"), count(*) from "push_subscriptions"');
  });

  it('counts reminders per Madrid day and channel from the check-in reminders only', async () => {
    await AdminNotificationRepository.remindersPerDay(FROM, TO);

    expect(sent[0]?.sql).toContain(`"notifications"."type" = $1 and "notifications"."channel" in ($2, $3)`);
    expect(sent[0]?.params.slice(0, 3)).toEqual(['checkin_due', 'email', 'push']);
    expect(sent[0]?.sql).toContain(`at time zone 'Europe/Madrid'`);
  });

  it('asks whether the same person checked in within three days of a reminder, naming every column of both tables', async () => {
    await AdminNotificationRepository.answeredReminders(FROM, TO);

    const text = sent[0]?.sql ?? '';

    expect(text).toContain('select count(distinct "user_id") filter (where exists (select 1 from "check_ins"');
    expect(text).toContain('"check_ins"."user_id" = "notifications"."user_id"');
    expect(text).toContain('"check_ins"."created_at" >= "notifications"."sent_at"');
    expect(text).toContain(`"check_ins"."created_at" < "notifications"."sent_at" + make_interval(days => $`);
    expect(text).not.toMatch(/= "user_id"/);
    expect(sent[0]?.params).toContain(3);
  });
});

describe('AdminSystemRepository', () => {
  it('reads the last cron_run of each job and nothing else of the event', async () => {
    await AdminSystemRepository.lastCronRuns();

    expect(sent[0]?.sql).toContain('max("created_at")');
    expect(sent[0]?.sql).toContain(`"analytics_events"."event" = $3`);
    expect(sent[0]?.sql).toMatch(/group by 2$/);
    expect(sent[0]?.params).toContain('cron_run');
    expect(sent[0]?.sql).not.toContain('user_id');
  });

  it('counts mail per Madrid day, template and outcome, never a recipient', async () => {
    await AdminSystemRepository.mailPerDay(FROM, TO);

    expect(sent[0]?.sql).toContain(`-> 'ok' = 'false'::jsonb`);
    expect(sent[0]?.sql).toMatch(/group by 1, 2, 3$/);
    expect(sent[0]?.params).toContain('mail_sent');
    // The key is a bound value, not text spliced into the statement.
    expect(sent[0]?.params).toContain('kind');
    expect(sent[0]?.sql).not.toContain(`'kind'`);
    expect(sent[0]?.sql).not.toMatch(/user_id|email/);
  });
});
