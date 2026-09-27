import { randomBytes, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { database } from 'database';
import { PICTURE_PROMPT_VERSION } from 'core/domain/DishPicture';
import { SettingsController } from 'core/controllers/Settings';
import { UserController } from 'core/controllers/User';

import { AI_PICTURE_CAP } from '../src/modules/ai/ai.config.js';
import { PictureCallError } from '../src/modules/ai/clients/pictureTransport.js';
import { PictureImageClient } from '../src/modules/ai/clients/PictureImageClient.js';
import { PictureJudgeClient } from '../src/modules/ai/clients/PictureJudgeClient.js';
import { PictureStore } from '../src/modules/ai/clients/PictureStore.js';
import { STUB_PICTURE, StubPictureImageClient, StubPictureJudgeClient, StubPictureStore } from '../src/modules/ai/clients/StubPictureClients.js';

import { completeOnboarding, createApp, deleteAccounts, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { DrawnPicture } from '../src/modules/ai/clients/PictureImageClient.js';
import type { JudgeCall, JudgedIngredient } from '../src/modules/ai/clients/PictureJudgeClient.js';
import type { INestApplication } from '@nestjs/common';
import type { PictureMatch, SeenFood, SeenPicture } from 'core/domain/DishPicture';
import type { Response } from 'supertest';

/**
 * Dish pictures drawn on first view (`0066`, project 006 phase 3).
 *
 * The drawing, the judge and the store are the product's own stubs, subclassed
 * so a test can make one draw fail, refuse, hold, or see a prawn. Everything
 * between them is real: the claim is the one `INSERT … ON CONFLICT` against
 * Postgres, the cap is summed from `recipe_image_calls`, and the allergen rule
 * reads the whole seeded catalogue — the judge only says "shrimp", and the
 * catalogue is what makes that crustaceans.
 *
 * Recipes are shared by every account, so the suite only draws dishes that
 * had no picture row when it started, and deletes the rows it made for them
 * (`recipe_images`, `recipe_image_calls`) when it ends. The `dishPictures`
 * flag is a shared row: on while the suite runs, off after it.
 *
 * Requires a real, seeded database — see ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

/** Draws the stub file, unless a test has said otherwise; counts every draw and can hold one until released. */
class ControlledImages extends StubPictureImageClient {
  calls = 0;
  /** What the next draws do instead of the stub file; null draws the stub file. */
  behaviour: (() => Promise<DrawnPicture>) | null = null;
  /** While set, a draw waits for it — so several views can arrive while one drawing is under way. */
  hold: Promise<void> | null = null;

  async draw(): Promise<DrawnPicture> {
    this.calls += 1;

    if (this.hold) {
      await this.hold;
    }

    return this.behaviour ? this.behaviour() : super.draw();
  }
}

/** The stub judge, unless a test hands it what a real judge would have seen and matched. */
class ControlledJudge extends StubPictureJudgeClient {
  seen: SeenPicture | null = null;
  matched: PictureMatch | null = null;

  async see(): Promise<JudgeCall<SeenPicture>> {
    return this.seen ? { costUsd: 0, model: 'e2e/judge', provider: 'e2e', result: this.seen } : super.see();
  }

  async match(seen: readonly SeenFood[], ingredients: readonly JudgedIngredient[]): Promise<JudgeCall<PictureMatch>> {
    return this.matched ? { costUsd: 0, model: 'e2e/judge', provider: 'e2e', result: this.matched } : super.match(seen, ingredients);
  }
}

type Stubs = { readonly images: ControlledImages; readonly judge: ControlledJudge; readonly store: StubPictureStore };

function stubs(): Stubs {
  return { images: new ControlledImages(), judge: new ControlledJudge(), store: new StubPictureStore() };
}

async function pictureApp(ai: ScriptedAiClient, { images, judge, store }: Stubs, capUsd?: number): Promise<INestApplication> {
  return createApp(ai, builder => {
    const replaced = builder
      .overrideProvider(PictureImageClient)
      .useValue(images)
      .overrideProvider(PictureJudgeClient)
      .useValue(judge)
      .overrideProvider(PictureStore)
      .useValue(store);

    return capUsd === undefined ? replaced : replaced.overrideProvider(AI_PICTURE_CAP).useValue(capUsd);
  });
}

type MealDetail = { illustrationPath: string | null; pictureStatus: string; recipeId: string };
type PictureStatus = { status: string; url: string | null };
type Row = { attempts: number; bytes: unknown; provenance: { notes?: string[] } | null; status: string; url: string | null };
type Call = { costUsd: string; kind: string; model: string; outcome: string | null };
type Dish = { mealId: string; recipeId: string };

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

describe('dish pictures', () => {
  let app: INestApplication;
  const main = stubs();
  let owner: Account;
  let alice: Account;
  let second: Account | undefined;
  /** Alice's dishes with no picture row when the suite started, none carrying crustaceans; taken one per case. */
  let fresh: Dish[] = [];
  /** A dish on both Alice's and Bob's plans, with no picture row when the suite started. */
  let sharing: { alice: Dish; bob: Dish } | undefined;
  /** Every recipe this suite let a drawing touch: its picture rows and calls are deleted in `afterAll`. */
  const touched = new Set<string>();
  const made: string[] = [];
  const cronSecret = randomBytes(24).toString('hex');
  const previousCronSecret = process.env['CRON_SECRET'];

  const server = () => httpServer(app);

  /** The person who shares a dish with Alice, and that dish — found in `beforeAll`, which fails without them. */
  const shared = (): { alice: Dish; bob: Dish; who: Account } => {
    if (!second || !sharing) {
      throw new Error('No second person with a shared dish');
    }

    return { ...sharing, who: second };
  };

  const take = (): Dish => {
    const dish = fresh.shift();

    if (!dish) {
      throw new Error('Alice’s plan has run out of dishes without a picture row');
    }

    touched.add(dish.recipeId);

    return dish;
  };

  const openMeal = async (on: INestApplication, who: Account, mealId: string): Promise<MealDetail> => {
    const response: Response = await request(httpServer(on)).get(`/${PREFIX}/meal-plans/meals/${mealId}`).set('Cookie', who.cookie).expect(200);

    return response.body as MealDetail;
  };

  const status = async (who: Account, recipeId: string): Promise<PictureStatus> => {
    const response: Response = await request(server()).get(`/${PREFIX}/recipes/${recipeId}/picture-status`).set('Cookie', who.cookie).expect(200);

    return response.body as PictureStatus;
  };

  /** Polls the way the meal page does, until the drawing has ended one way or another. */
  const settled = async (who: Account, recipeId: string): Promise<PictureStatus> => {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      const now = await status(who, recipeId);

      if (now.status !== 'drawing') {
        return now;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`The picture of ${recipeId} was still drawing after 30 s`);
  };

  const row = async (recipeId: string): Promise<Row | undefined> =>
    (
      await sql()<Row>`
        select attempts, bytes, provenance, status, url from recipe_images where recipe_id = ${recipeId}`
    )[0];

  const calls = async (recipeId: string): Promise<Call[]> =>
    sql()<Call>`
      select cost_usd as "costUsd", kind, model, outcome from recipe_image_calls where recipe_id = ${recipeId} order by created_at`;

  /** Every dish on this person's plans that no drawing has ever touched, with one meal that serves it. */
  const untouchedDishes = async (who: Account): Promise<Dish[]> =>
    sql()<Dish>`
      select m.recipe_id as "recipeId", min(m.id::text) as "mealId"
      from meals m
      join plan_days d on d.id = m.plan_day_id
      join meal_plans p on p.id = d.plan_id
      where p.user_id = ${who.id}
        and not exists (select 1 from recipe_images i where i.recipe_id = m.recipe_id)
        and not exists (select 1 from recipe_image_calls c where c.recipe_id = m.recipe_id)
        and not exists (
          select 1 from recipe_ingredients ri
          join ingredient_allergens ia on ia.ingredient_id = ri.ingredient_id
          join allergens a on a.id = ia.allergen_id
          where ri.recipe_id = m.recipe_id and a.key = 'crustaceans')
      group by m.recipe_id
      order by m.recipe_id`;

  const planned = async (who: Account): Promise<Set<string>> =>
    new Set(
      (
        await sql()<{ recipeId: string }>`
          select distinct m.recipe_id as "recipeId" from meals m
          join plan_days d on d.id = m.plan_day_id
          join meal_plans p on p.id = d.plan_id
          where p.user_id = ${who.id}`
      ).map(({ recipeId }) => recipeId)
    );

  const withPlan = async (name: string, stamp: number): Promise<Account> => {
    const account = await register(app, `pictures-${name}-${stamp}@e2e.invalid`);

    made.push(account.cookie);
    await completeOnboarding(app, account);

    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');

    return account;
  };

  beforeAll(async () => {
    // The cron's door opened for this suite alone, so "/cron/illustrate is gone"
    // is proved against a bearer that opens the sweeps that remain.
    process.env['CRON_SECRET'] = cronSecret;
    app = await pictureApp(new ScriptedAiClient(POOL), main);

    const stamp = Date.now();

    owner = await register(app, `pictures-owner-${stamp}@e2e.invalid`);
    made.push(owner.cookie);
    await UserController.grantAdmin(owner.email);

    alice = await withPlan('alice', stamp);
    fresh = await untouchedDishes(alice);

    // A second person with a plan that shares a dish with Alice's. Plans are
    // shuffled per person out of one library, so a shared dish is likely, not
    // certain: a third and a fourth person are asked before the suite gives up.
    const alices = new Map(fresh.map(dish => [dish.recipeId, dish]));

    for (const name of ['bob', 'carol', 'dave']) {
      const candidate = await withPlan(name, stamp);
      const common = (await untouchedDishes(candidate)).find(dish => alices.has(dish.recipeId));

      if (common) {
        second = candidate;
        sharing = { alice: alices.get(common.recipeId) as Dish, bob: common };
        fresh = fresh.filter(dish => dish.recipeId !== common.recipeId);
        touched.add(common.recipeId);
        break;
      }
    }

    if (!sharing) {
      throw new Error('No dish without a picture is on both plans: the second-person cases have nothing to read');
    }

    // Nine cases draw a dish of Alice's each.
    expect(fresh.length).toBeGreaterThanOrEqual(9);

    await SettingsController.setFlag('dishPictures', true);
  });

  afterAll(async () => {
    await SettingsController.setFlag('dishPictures', false);
    await deleteAccounts(app, made);

    for (const recipeId of touched) {
      await sql()`delete from recipe_image_calls where recipe_id = ${recipeId}`;
      await sql()`delete from recipe_images where recipe_id = ${recipeId}`;
    }

    if (previousCronSecret === undefined) {
      delete process.env['CRON_SECRET'];
    } else {
      process.env['CRON_SECRET'] = previousCronSecret;
    }

    await app?.close();
  });

  it('with the flag off, opening a meal claims nothing and draws nothing', async () => {
    const dish = take();

    await SettingsController.setFlag('dishPictures', false);

    try {
      const before = main.images.calls;
      const meal = await openMeal(app, alice, dish.mealId);

      expect(meal).toMatchObject({ illustrationPath: null, pictureStatus: 'none', recipeId: dish.recipeId });
      expect(await row(dish.recipeId)).toBeUndefined();
      expect(await calls(dish.recipeId)).toEqual([]);
      expect(main.images.calls).toBe(before);
    } finally {
      await SettingsController.setFlag('dishPictures', true);
    }
  });

  it('picture-status only reads, and only a dish on the caller’s own plans', async () => {
    const dish = take();

    // Read-only: with the flag on, polling a dish nobody opened starts nothing.
    expect(await status(alice, dish.recipeId)).toEqual({ status: 'none', url: null });
    expect(await row(dish.recipeId)).toBeUndefined();

    // A dish on Alice's plan and not on Bob's is a 404 for Bob, like any stranger's data.
    const { who: bob } = shared();
    const bobs = await planned(bob);
    const notBobs = [dish, ...fresh].find(candidate => !bobs.has(candidate.recipeId));

    expect(notBobs).toBeDefined();
    await request(server()).get(`/${PREFIX}/recipes/${notBobs?.recipeId}/picture-status`).set('Cookie', bob.cookie).expect(404);
    // A recipe that does not exist answers the same.
    await request(server()).get(`/${PREFIX}/recipes/${randomUUID()}/picture-status`).set('Cookie', alice.cookie).expect(404);
    await request(server()).get(`/${PREFIX}/recipes/not-a-uuid/picture-status`).set('Cookie', alice.cookie).expect(400);

    // No session: nothing to see.
    await request(server()).get(`/${PREFIX}/recipes/${dish.recipeId}/picture-status`).expect(404);

    // A session that has not finished onboarding is told so.
    const newcomer = await register(app, `pictures-newcomer-${Date.now()}@e2e.invalid`);

    made.push(newcomer.cookie);

    const refused: Response = await request(server())
      .get(`/${PREFIX}/recipes/${dish.recipeId}/picture-status`)
      .set('Cookie', newcomer.cookie)
      .expect(409);

    expect((refused.body as { code?: string }).code).toBe('ONBOARDING_INCOMPLETE');
  });

  it('picture-status answers a dish on the caller’s active plan, and a 404 once that plan is waiting for review', async () => {
    // A person whose only plan holds the dish, so "only on a pending plan" is exactly that.
    const erin = await withPlan('erin', Date.now());
    const [recipeId = ''] = [...(await planned(erin))];

    expect(recipeId).not.toBe('');
    const [plan] = await sql()<{ id: string }>`select id from meal_plans where user_id = ${erin.id} and status = 'active'`;

    expect(plan).toBeDefined();

    // On her active plan: hers to ask about (`status` expects the 200).
    await status(erin, recipeId);

    // The same plan as a professional's draft waiting for review (`0060`), which she may not see.
    // Written on the table: reaching this state through the care routes is `care-review.e2e-spec.ts`'s job.
    await sql()`update meal_plans set status = 'pending_review' where id = ${plan?.id}`;

    try {
      await request(server()).get(`/${PREFIX}/recipes/${recipeId}/picture-status`).set('Cookie', erin.cookie).expect(404);
    } finally {
      await sql()`update meal_plans set status = 'active' where id = ${plan?.id}`;
    }

    // And back to active, back to 200: the plan's status was what refused it.
    await status(erin, recipeId);
  });

  it('draws an accepted picture once, keeps the file untouched at its path, and serves its address', async () => {
    const dish = take();
    const kept = main.store.stored.length;

    const opened = await openMeal(app, alice, dish.mealId);

    expect(opened).toMatchObject({ illustrationPath: null, pictureStatus: 'drawing' });

    const done = await settled(alice, dish.recipeId);

    expect(done.status).toBe('ready');

    const puts = main.store.stored.slice(kept).filter(put => put.path.includes(dish.recipeId));

    expect(puts).toHaveLength(1);
    expect(puts[0]?.path).toMatch(new RegExp(`^dish-pictures/${dish.recipeId}/${PICTURE_PROMPT_VERSION.replace(/\./g, '\\.')}-${UUID}\\.jpg$`));
    expect(Buffer.from(puts[0]?.bytes ?? []).equals(Buffer.from(STUB_PICTURE))).toBe(true);
    expect(done.url).toBe(`data:image/jpeg;base64,${Buffer.from(STUB_PICTURE).toString('base64')}`);

    const again = await openMeal(app, alice, dish.mealId);

    expect(again).toMatchObject({ illustrationPath: done.url, pictureStatus: 'ready' });

    // The row carries an address and no bytes; one image call and the judge's two were recorded.
    expect(await row(dish.recipeId)).toMatchObject({ bytes: null, status: 'ready', url: done.url });
    expect((await calls(dish.recipeId)).map(call => call.kind)).toEqual(['image', 'judge', 'judge']);

    // The old public image route and the old sweep are gone — even with a bearer
    // that opens the sweeps that remain.
    await request(server()).get(`/${PREFIX}/recipes/${dish.recipeId}/image`).expect(404);
    await request(server()).get(`/${PREFIX}/recipes/${dish.recipeId}/image`).set('Cookie', alice.cookie).expect(404);
    await request(server()).get(`/${PREFIX}/cron/reminders`).set('Authorization', `Bearer ${cronSecret}`).expect(200);
    await request(server()).get(`/${PREFIX}/cron/illustrate`).set('Authorization', `Bearer ${cronSecret}`).expect(404);
  });

  it('never keeps a picture the judge saw a prawn on — the catalogue, not the judge, makes it crustaceans', async () => {
    const dish = take();
    const kept = main.store.stored.length;

    main.judge.seen = { foods: [{ amount: 'main', name: 'shrimp', specific: true }] };
    main.judge.matched = { extras: ['shrimp'], ingredients: [] };

    try {
      expect((await openMeal(app, alice, dish.mealId)).pictureStatus).toBe('drawing');
      expect(await settled(alice, dish.recipeId)).toEqual({ status: 'none', url: null });
    } finally {
      main.judge.seen = null;
      main.judge.matched = null;
    }

    expect(main.store.stored.slice(kept).filter(put => put.path.includes(dish.recipeId))).toEqual([]);

    const failed = await row(dish.recipeId);

    expect(failed).toMatchObject({ attempts: 3, bytes: null, status: 'failed', url: null });
    // Rejected three times for the allergen, and for nothing else the rule might have tripped on.
    expect(failed?.provenance?.notes).toHaveLength(3);

    for (const note of failed?.provenance?.notes ?? []) {
      expect(note).toMatch(/^\d:rejected:.*extra_allergen:shrimp=[a-z+]*crustaceans/);
    }

    expect((await calls(dish.recipeId)).map(call => call.kind)).toEqual([
      'image',
      'judge',
      'judge',
      'image',
      'judge',
      'judge',
      'image',
      'judge',
      'judge'
    ]);
    expect(await openMeal(app, alice, dish.mealId)).toMatchObject({ illustrationPath: null, pictureStatus: 'none' });
  });

  it('fails a dish whose drawing keeps failing, and leaves it alone for the seven days after', async () => {
    const dish = take();

    main.images.behaviour = () => Promise.reject(new PictureCallError('upstream fell over', 500));

    try {
      expect((await openMeal(app, alice, dish.mealId)).pictureStatus).toBe('drawing');
      expect(await settled(alice, dish.recipeId)).toEqual({ status: 'none', url: null });
    } finally {
      main.images.behaviour = null;
    }

    expect(await row(dish.recipeId)).toMatchObject({ attempts: 3, status: 'failed', url: null });

    // Three image calls, each recorded at the floor: nobody knows whether a 5xx was billed.
    const recorded = await calls(dish.recipeId);

    expect(recorded.map(call => [call.kind, call.outcome])).toEqual([
      ['image', 'error'],
      ['image', 'error'],
      ['image', 'error']
    ]);
    expect(recorded.every(call => Number(call.costUsd) > 0)).toBe(true);

    // Within the cool-off: read, not claimed, not drawn.
    const before = main.images.calls;

    expect(await openMeal(app, alice, dish.mealId)).toMatchObject({ illustrationPath: null, pictureStatus: 'none' });
    expect(main.images.calls).toBe(before);
    expect(await row(dish.recipeId)).toMatchObject({ status: 'failed' });

    // Eight days later the same view claims it again, from zero attempts: the cool-off was what held it.
    await sql()`update recipe_images set last_attempt_at = now() - interval '8 days' where recipe_id = ${dish.recipeId}`;

    expect((await openMeal(app, alice, dish.mealId)).pictureStatus).toBe('drawing');
    expect((await settled(alice, dish.recipeId)).status).toBe('ready');
    expect(main.images.calls).toBe(before + 1);
  });

  it.each([
    [402, 'Key limit exceeded'],
    [429, 'Rate limit exceeded']
  ])('gives the claim back when the key refuses to pay (%i): the dish is none, not failed', async (code, message) => {
    const dish = take();

    main.images.behaviour = () => Promise.reject(new PictureCallError(message, code));

    try {
      expect((await openMeal(app, alice, dish.mealId)).pictureStatus).toBe('drawing');
      expect(await settled(alice, dish.recipeId)).toEqual({ status: 'none', url: null });
    } finally {
      main.images.behaviour = null;
    }

    expect(await row(dish.recipeId)).toBeUndefined();
    // One attempt and no more: a refusal stops the loop. OpenRouter turned it away, so it cost nothing.
    expect((await calls(dish.recipeId)).map(call => [call.kind, call.outcome, Number(call.costUsd)])).toEqual([['image', 'error', 0]]);

    // Given back, not failed: the next view claims it at once.
    expect((await openMeal(app, alice, dish.mealId)).pictureStatus).toBe('drawing');
    expect((await settled(alice, dish.recipeId)).status).toBe('ready');
  });

  it('starts one drawing for views that arrive together, and serves its picture to the second person', async () => {
    const { alice: hers, bob: his, who: bob } = shared();
    const before = main.images.calls;
    const gate: { open?: () => void } = {};

    main.images.hold = new Promise<void>(resolve => {
      gate.open = resolve;
    });

    let answers: MealDetail[];

    try {
      answers = await Promise.all([
        openMeal(app, alice, hers.mealId),
        openMeal(app, bob, his.mealId),
        openMeal(app, alice, hers.mealId),
        openMeal(app, bob, his.mealId)
      ]);
    } finally {
      main.images.hold = null;
      gate.open?.();
    }

    // At least the winner says drawing; a loser that read the row before the claim says none. Nobody says ready.
    expect(answers.filter(answer => answer.pictureStatus === 'drawing').length).toBeGreaterThanOrEqual(1);
    expect(answers.every(answer => answer.pictureStatus !== 'ready')).toBe(true);

    const done = await settled(alice, hers.recipeId);

    expect(done.status).toBe('ready');
    // One claim, one drawing: one image call between four views, in memory and in the ledger.
    expect(main.images.calls).toBe(before + 1);
    expect((await calls(hers.recipeId)).filter(call => call.kind === 'image')).toHaveLength(1);
    expect(main.store.stored.filter(put => put.path.includes(hers.recipeId))).toHaveLength(1);

    // Bob sees the same picture, at the same address, and his view draws nothing.
    expect(await status(bob, his.recipeId)).toEqual(done);
    expect(await openMeal(app, bob, his.mealId)).toMatchObject({ illustrationPath: done.url, pictureStatus: 'ready' });
    expect(main.images.calls).toBe(before + 1);
  });

  it('at the month’s cap no drawing is claimed and no image call is made — the cap is read from the ledger', async () => {
    const dish = take();
    const [spend] = await sql()<{ total: string }>`
      select coalesce(sum(cost_usd), 0)::text as total from recipe_image_calls where created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'`;
    // Half a dollar of room above what the month has spent; the ledger row below takes it away.
    const cap = Number(spend?.total ?? 0) + 0.5;
    const capped = stubs();
    const cappedApp = await pictureApp(new ScriptedAiClient([]), capped, cap);

    try {
      await sql()`
        insert into recipe_image_calls (cost_usd, kind, model, outcome, recipe_id)
        values (1, 'image', 'e2e/ledger', 'drawn', ${dish.recipeId})`;

      expect(await openMeal(cappedApp, alice, dish.mealId)).toMatchObject({ illustrationPath: null, pictureStatus: 'none' });
      expect(capped.images.calls).toBe(0);
      expect(await row(dish.recipeId)).toBeUndefined();

      // The same app, the same dish, the ledger row gone: now it is drawn. The cap was what held it.
      await sql()`delete from recipe_image_calls where recipe_id = ${dish.recipeId} and model = 'e2e/ledger'`;

      expect((await openMeal(cappedApp, alice, dish.mealId)).pictureStatus).toBe('drawing');
      expect((await settled(alice, dish.recipeId)).status).toBe('ready');
      expect(capped.images.calls).toBe(1);
    } finally {
      await sql()`delete from recipe_image_calls where recipe_id = ${dish.recipeId} and model = 'e2e/ledger'`;
      await cappedApp.close();
    }
  });

  it('shows the owner this month’s pictures, counts only, and nobody else', async () => {
    await request(server()).get(`/${PREFIX}/admin/pictures`).set('Cookie', alice.cookie).expect(404);

    const response: Response = await request(server()).get(`/${PREFIX}/admin/pictures`).set('Cookie', owner.cookie).expect(200);
    const body = response.body as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual(['capUsd', 'drawing', 'enabled', 'failed', 'ready', 'since', 'spentUsd']);
    expect(body['enabled']).toBe(true);
    expect(body['ready']).toEqual(expect.any(Number));
    expect(body['ready'] as number).toBeGreaterThanOrEqual(1);
    expect(body['failed'] as number).toBeGreaterThanOrEqual(1);
    expect(body['capUsd']).toEqual(expect.any(Number));
    // The failed drawings above were recorded at the floor, so the month has spent something.
    expect(body['spentUsd'] as number).toBeGreaterThan(0);

    const now = new Date();

    expect(body['since']).toBe(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString());
  });
});
