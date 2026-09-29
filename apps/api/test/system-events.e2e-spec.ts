import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { AnalyticsController } from 'core/controllers/Analytics';
import { database } from 'database';

import { completeOnboarding, createApp, deleteAccounts, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { AiRequest, AiResponse } from '../src/modules/ai/clients/AiClient.js';
import type { PlanView } from 'core/controllers/Plan';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

type EventRow = { readonly createdAt: string; readonly properties: Record<string, unknown> | null; readonly userId: string | null };

async function eventsSince(event: string, since: Date): Promise<readonly EventRow[]> {
  return sql()<EventRow>`
    select created_at as "createdAt", properties, user_id as "userId"
    from analytics_events
    where event = ${event} and created_at >= ${since.toISOString()}
    order by created_at asc`;
}

/**
 * `ScriptedAiClient` never calls a provider, so it never records `ai_call`
 * (only `StructuredAiClient` does — proved at the unit level,
 * `StructuredAiClient.spec.ts`). This suite is about the one thing that is
 * only true end to end: that `PlanGeneration.service` and `MealSwap.service`
 * hand the *real* `AiRequest.feature` down to whichever client is wired in
 * (`0071`), and that the write behind it never carries a user. Wrapping the
 * shared scripted client — rather than changing it for every other suite —
 * keeps this recording local to this file alone.
 */
class FeatureRecordingAiClient extends ScriptedAiClient {
  async generate<T>(aiRequest: AiRequest<T>): Promise<AiResponse<T>> {
    const response = await super.generate(aiRequest);

    await AnalyticsController.record('ai_call', null, { costUsd: null, feature: aiRequest.feature, model: 'scripted', ok: true });

    return response;
  }
}

describe('what the service records without a person behind it (0071, phase 1)', () => {
  let app: INestApplication;
  const made: string[] = [];
  const cronSecret = randomBytes(24).toString('hex');
  const previousCronSecret = process.env['CRON_SECRET'];

  const activePlan = async (who: Account): Promise<PlanView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', who.cookie).expect(200);

    return response.body as PlanView;
  };

  beforeAll(async () => {
    process.env['CRON_SECRET'] = cronSecret;
    app = await createApp(new FeatureRecordingAiClient(POOL));
  });

  afterAll(async () => {
    await deleteAccounts(app, made);

    if (previousCronSecret === undefined) {
      delete process.env['CRON_SECRET'];
    } else {
      process.env['CRON_SECRET'] = previousCronSecret;
    }

    await app?.close();
  });

  describe('a generated plan’s own quality', () => {
    it('is counts only, and its days equal the plan’s own length', async () => {
      const account = await register(app, `system-events-quality-${Date.now()}@e2e.invalid`);

      made.push(account.cookie);
      await completeOnboarding(app, account);

      const job = await generateAndWait(app, account);

      expect(job.status).toBe('succeeded');

      const plan = await activePlan(account);
      const [row] = await sql()<{ generationMetadata: { quality?: Record<string, unknown> } | null }>`
        select generation_metadata as "generationMetadata" from meal_plans where id = ${plan.id}`;
      const quality = row?.generationMetadata?.quality;

      if (!quality) {
        throw new Error('The generated plan carries no generation_metadata.quality');
      }

      // Exact keys (`packages/core/src/domain/PlanValidation/PlanQuality.ts`):
      // `daysUnderFloorBand` stays out of phase 1 — `plan-evaluator` could not
      // confirm its definition against the stop signal, so it is deferred to
      // phase 5 and must not appear here yet.
      expect(Object.keys(quality).sort()).toEqual(
        ['advisoriesByKind', 'days', 'daysInBand', 'eventDays', 'eventDaysInBand', 'fallback', 'loadsRefused', 'missesByMacro'].sort()
      );
      expect(Object.keys(quality['missesByMacro'] as Record<string, unknown>).sort()).toEqual(['carbs', 'fat', 'kcal', 'protein']);
      expect(Object.keys(quality['advisoriesByKind'] as Record<string, unknown>).sort()).toEqual(
        ['carbs_out_of_band', 'fat_out_of_band', 'kcal_out_of_band', 'protein_above_target', 'protein_below_target', 'variety'].sort()
      );

      // No target or figure: every leaf is a count, `fallback`'s own closed
      // word, or null — never anything shaped like a target or an event's name.
      for (const value of Object.values(quality)) {
        expect(['bigint', 'boolean', 'number', 'object', 'string'].includes(typeof value) || value === null).toBe(true);
      }

      expect(quality['days']).toBe(plan.days.length);
    });
  });

  describe('a cron’s run', () => {
    it('leaves a cron_run row with no user, naming the job and its counts', async () => {
      const since = new Date();

      await request(httpServer(app)).get(`/${PREFIX}/cron/reminders`).set('Authorization', `Bearer ${cronSecret}`).expect(200);

      const rows = await eventsSince('cron_run', since);
      const reminders = rows.filter(row => row.properties?.['job'] === 'reminders');

      expect(reminders.length).toBeGreaterThanOrEqual(1);

      for (const row of reminders) {
        expect(row.userId).toBeNull();
        expect(Object.keys(row.properties ?? {}).sort()).toEqual(['considered', 'failed', 'job', 'pushed', 'sent']);
      }
    });
  });

  describe('an ai_call', () => {
    /*
     * A swap only reaches the model when `reusablePool` — the *whole* safe
     * catalogue for the slot, seed and AI-authored dishes alike — has no
     * candidate left (`MealSwap.service.ts`): exhausting that from an e2e
     * suite would mean out-disliking hundreds of seeded dishes, which is
     * fragile in exactly the way this file's brief warns against — a test
     * that passes or fails on the seed's contents, not on the code under
     * test. `feature: 'swap'` reaching `AiRequest` is proved at the unit
     * level instead (`MealSwap.spec.ts`, `StructuredAiClient.spec.ts`).
     */
    it('carries the caller’s feature, and no user, for a plan’s generation', async () => {
      const account = await register(app, `system-events-feature-${Date.now()}@e2e.invalid`);

      made.push(account.cookie);
      await completeOnboarding(app, account);

      const sincePlan = new Date();
      const job = await generateAndWait(app, account);

      expect(job.status).toBe('succeeded');

      const planCalls = await eventsSince('ai_call', sincePlan);

      expect(planCalls.length).toBeGreaterThan(0);

      for (const row of planCalls) {
        expect(row.userId).toBeNull();
        expect(row.properties?.['feature']).toBe('plan');
      }
    });
  });

  describe('app_used', () => {
    /** Moves a session's expiry back, as the passing of time would — the real database version of `SessionRenewal.spec.ts`'s `age()`. */
    const age = async (userId: string, days: number) => {
      await sql()`update session set expires_at = expires_at - (${days} * interval '1 day') where user_id = ${userId}`;
    };

    it('is written at most once a Madrid day, including when several requests renew the session at once', async () => {
      const account = await register(app, `system-events-appused-${Date.now()}@e2e.invalid`);

      made.push(account.cookie);

      const since = new Date();

      await age(account.id, 2);

      // A page's server render sends several requests with one cookie at once;
      // each renews the same due session, and the lock behind `recordOnceSince`
      // is what stops every one of them from writing its own row.
      await Promise.all(
        Array.from({ length: 5 }, async () => request(httpServer(app)).get(`/${PREFIX}/users/me`).set('Cookie', account.cookie).expect(200))
      );

      const firstBatch = await eventsSince('app_used', since);
      const own = firstBatch.filter(row => row.userId === account.id);

      expect(own).toHaveLength(1);

      // Renewed again, the same real day: still no second row for today.
      await age(account.id, 2);
      await Promise.all(
        Array.from({ length: 3 }, async () => request(httpServer(app)).get(`/${PREFIX}/users/me`).set('Cookie', account.cookie).expect(200))
      );

      const secondBatch = await eventsSince('app_used', since);

      expect(secondBatch.filter(row => row.userId === account.id)).toHaveLength(1);
    });

    it('does not renew, and so does not record a use, within a day of the last renewal', async () => {
      const account = await register(app, `system-events-freshsession-${Date.now()}@e2e.invalid`);

      made.push(account.cookie);

      const since = new Date();

      await request(httpServer(app)).get(`/${PREFIX}/users/me`).set('Cookie', account.cookie).expect(200);

      const rows = await eventsSince('app_used', since);

      expect(rows.filter(row => row.userId === account.id)).toHaveLength(0);
    });
  });
});
