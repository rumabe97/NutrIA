import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { UserController } from 'core/controllers/User';
import { monthStart } from 'core/controllers/Recipe';
import { database } from 'database';

import { AI_REWRITE_CLIENT } from '../src/modules/ai/ai.config.js';
import { createApp, deleteAccounts, enableTotp, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

type Feature = { readonly calls: number; readonly costUsd: number; readonly feature: string };
type Month = {
  readonly byFeature: readonly Feature[];
  readonly capUsd?: number;
  readonly monthStart: string;
  readonly share?: number;
  readonly spentUsd: number;
  readonly sweepPaused?: boolean;
  readonly uncostedCalls: number;
};

/** Marks every row this suite seeds, so `afterAll` removes exactly those. */
const TAG = 'text-cap-e2e';
const FEATURES = ['plan', 'swap', 'rewrite', 'unknown'];

/**
 * The text models' month against an optional cap (`0071`, project 008 phase 4):
 * `AI_TEXT_MONTHLY_CAP_USD` set before the application boots, `ai_call` rows
 * seeded straight into the real table, and the console's readings taken as
 * deltas — the dev database already holds this month's real calls. Also the
 * run of the `monthByFeature` SQL against a real Postgres with a cap.
 * The model is never called: the sweep is held back before it asks for one.
 */
describe('the text models’ month against a cap (0071, phase 4)', () => {
  let app: INestApplication;
  let ai: ScriptedAiClient;
  let owner: Account;
  const made: string[] = [];
  const cronSecret = randomBytes(24).toString('hex');
  const previous = { cap: process.env['AI_TEXT_MONTHLY_CAP_USD'], cron: process.env['CRON_SECRET'], steps: process.env['AI_REWRITE_STEPS'] };
  const since = new Date();
  /** The dollars seeded in the month, whole numbers so the arithmetic is exact. */
  let unit = 0;
  let cap = 0;

  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  };

  const get = (path: string) => request(httpServer(app)).get(`/${PREFIX}/admin/${path}`).set('Cookie', owner.cookie);
  const month = async (): Promise<Month> => ((await get('ai').expect(200)).body as { month: Month }).month;

  const summaryMonth = async () => {
    const body = (await get('summary?period=7').expect(200)).body as { tiles: { textAi: { month?: Record<string, unknown> } } };

    return body.tiles.textAi.month;
  };

  const feature = (view: Month, name: string): Feature => {
    const found = view.byFeature.find(entry => entry.feature === name);

    if (!found) {
      throw new Error(`no ${name} entry`);
    }

    return found;
  };

  const seed = async (properties: Record<string, unknown>, createdAt: Date) => {
    await sql()`
      insert into analytics_events (event, user_id, properties, created_at)
      values ('ai_call', null, ${JSON.stringify({ ...properties, model: TAG })}::jsonb, ${createdAt.toISOString()})`;
  };

  beforeAll(async () => {
    const start = monthStart(new Date());
    const [spent] = await sql()<{ spent: string | null }>`
      select sum((properties ->> 'costUsd')::numeric) filter (where jsonb_typeof(properties -> 'costUsd') = 'number') as spent
      from analytics_events where event = 'ai_call' and created_at >= ${start.toISOString()}`;
    const existing = Number(spent?.spent ?? 0);

    // What the month holds already (real calls on this database): the seed is larger than it,
    // so the gauge is under 80 % before the seed and over it after, whatever the database holds.
    unit = Math.ceil(existing) + 1;
    cap = Math.ceil(((existing + 8 * unit) / 0.9) * 100) / 100;

    if (cap > 1000) {
      throw new Error(`This database's month is too large (${String(existing)} USD) for a cap the environment accepts`);
    }

    process.env['AI_TEXT_MONTHLY_CAP_USD'] = String(cap);
    process.env['AI_REWRITE_STEPS'] = 'true';
    process.env['CRON_SECRET'] = cronSecret;
    ai = new ScriptedAiClient(POOL);
    // The sweep asks its own client (built from the environment, so a stub in this run): the scripted one stands in, to prove it is never asked.
    app = await createApp(ai, builder => builder.overrideProvider(AI_REWRITE_CLIENT).useValue(ai));
    owner = await register(app, `text-cap-owner-${Date.now()}@e2e.invalid`);
    await UserController.grantAdmin(owner.email);
    owner = await enableTotp(app, owner);
    made.push(owner.cookie);
  });

  afterAll(async () => {
    await deleteAccounts(app, made);
    await sql()`delete from analytics_events where event = 'ai_call' and properties ->> 'model' = ${TAG}`;
    await sql()`
      delete from analytics_events
      where event = 'cron_run' and properties ->> 'job' = 'rewrite' and properties ->> 'skipped' = 'cap' and created_at >= ${since.toISOString()}`;

    const [left] = await sql()<{ accounts: number; cronRuns: number; seeded: number }>`
      select (select count(*)::int from "user" where email like 'text-cap-owner-%@e2e.invalid') as accounts,
             (select count(*)::int from analytics_events where event = 'ai_call' and properties ->> 'model' = ${TAG}) as seeded,
             (select count(*)::int from analytics_events
                where event = 'cron_run' and properties ->> 'skipped' = 'cap' and created_at >= ${since.toISOString()}) as "cronRuns"`;

    expect(left).toEqual({ accounts: 0, cronRuns: 0, seeded: 0 });

    restore('AI_TEXT_MONTHLY_CAP_USD', previous.cap);
    restore('AI_REWRITE_STEPS', previous.steps);
    restore('CRON_SECRET', previous.cron);
    await app?.close();
  });

  let before: Month;
  let summaryBefore: Record<string, unknown> | undefined;

  it('carries the gauge with the cap set: seven keys, four features in order, share = spent ÷ cap, not paused', async () => {
    before = await month();
    summaryBefore = await summaryMonth();

    expect(Object.keys(before).sort()).toEqual(['byFeature', 'capUsd', 'monthStart', 'share', 'spentUsd', 'sweepPaused', 'uncostedCalls']);
    expect(before.capUsd).toBe(cap);
    expect(before.byFeature.map(entry => entry.feature)).toEqual(FEATURES);

    for (const entry of before.byFeature) {
      expect(Object.keys(entry).sort()).toEqual(['calls', 'costUsd', 'feature']);
    }

    expect(before.monthStart).toBe(monthStart(new Date()).toISOString());
    expect(before.byFeature.reduce((sum, entry) => sum + entry.costUsd, 0)).toBeCloseTo(before.spentUsd, 5);
    expect(before.share).toBeCloseTo(before.spentUsd / cap, 5);
    expect(before.sweepPaused).toBe(false);
    expect(Object.keys(summaryBefore ?? {}).sort()).toEqual(['capUsd', 'monthSpentUsd', 'monthStart', 'share', 'sweepPaused']);
    expect(summaryBefore?.['capUsd']).toBe(cap);
    expect(summaryBefore?.['sweepPaused']).toBe(false);
  });

  it('does not exist for an ordinary account or nobody', async () => {
    const ordinary = await register(app, `text-cap-owner-ordinary-${Date.now()}@e2e.invalid`);

    made.push(ordinary.cookie);

    for (const path of ['ai', 'summary']) {
      await request(httpServer(app)).get(`/${PREFIX}/admin/${path}`).set('Cookie', ordinary.cookie).expect(404);
      await request(httpServer(app)).get(`/${PREFIX}/admin/${path}`).expect(404);
    }
  });

  it('counts each feature, the featureless call as unknown and the uncosted call as uncosted — and not a row from before the month', async () => {
    const now = new Date();
    const lastMonth = new Date(monthStart(now).getTime() - 24 * 3600 * 1000);

    await seed({ costUsd: 4 * unit, feature: 'plan' }, now);
    await seed({ costUsd: 2 * unit, feature: 'swap' }, now);
    await seed({ costUsd: unit, feature: 'rewrite' }, now);
    await seed({ costUsd: unit }, now);
    await seed({ costUsd: null, feature: 'plan' }, now);
    await seed({ costUsd: 1000, feature: 'plan' }, lastMonth);

    const after = await month();
    const delta = (name: string) => ({
      calls: feature(after, name).calls - feature(before, name).calls,
      costUsd: feature(after, name).costUsd - feature(before, name).costUsd
    });

    expect(delta('plan').calls).toBe(2);
    expect(delta('plan').costUsd).toBeCloseTo(4 * unit, 5);
    expect(delta('swap').calls).toBe(1);
    expect(delta('swap').costUsd).toBeCloseTo(2 * unit, 5);
    expect(delta('rewrite').calls).toBe(1);
    expect(delta('rewrite').costUsd).toBeCloseTo(unit, 5);
    expect(delta('unknown').calls).toBe(1);
    expect(delta('unknown').costUsd).toBeCloseTo(unit, 5);
    expect(after.uncostedCalls - before.uncostedCalls).toBe(1);
    // The by-feature totals are the month's spend, and last month's row is in neither.
    expect(after.spentUsd - before.spentUsd).toBeCloseTo(8 * unit, 5);
    expect(after.byFeature.reduce((sum, entry) => sum + entry.costUsd, 0)).toBeCloseTo(after.spentUsd, 5);
    expect(after.share).toBeCloseTo(after.spentUsd / cap, 5);
    expect(after.share).toBeGreaterThanOrEqual(0.8);
    expect(after.sweepPaused).toBe(true);

    const summary = await summaryMonth();

    expect(Number(summary?.['monthSpentUsd']) - Number(summaryBefore?.['monthSpentUsd'])).toBeCloseTo(8 * unit, 5);
    expect(summary?.['sweepPaused']).toBe(true);
  });

  it('holds the nightly rewrite back at 80 % of the cap, records it as skipped: cap, and calls no model', async () => {
    const started = new Date();
    const response: Response = await request(httpServer(app))
      .get(`/${PREFIX}/cron/rewrite-steps`)
      .set('Authorization', `Bearer ${cronSecret}`)
      .expect(200);

    expect(response.body).toEqual({ heldBy: 'cap', pending: 0, rewritten: 0, skipped: 0, unreached: 0 });
    expect(ai.calls).toBe(0);

    const [latest] = await sql()<{ properties: Record<string, unknown> }>`
      select properties from analytics_events
      where event = 'cron_run' and properties ->> 'job' = 'rewrite' and created_at >= ${started.toISOString()}
      order by created_at desc limit 1`;

    expect(latest?.properties['skipped']).toBe('cap');
    expect(latest?.properties['job']).toBe('rewrite');
  });

  it('refuses the rewrite route without the cron secret, cap or not', async () => {
    await request(httpServer(app)).get(`/${PREFIX}/cron/rewrite-steps`).expect(404);
    expect(ai.calls).toBe(0);
  });
});
