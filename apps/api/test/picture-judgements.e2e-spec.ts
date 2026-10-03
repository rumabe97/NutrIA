import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { database } from 'database';
import { judgePicture } from 'core/domain/DishPicture';
import { PICTURE_CANDIDATE_FOLDER, PICTURE_DRAWINGS_KEPT } from 'core/entities/DishPicture';
import { RecipeController } from 'core/controllers/Recipe';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import { DishPictureService } from '../src/modules/ai/services/DishPicture.service.js';
import { ENV, validateEnv } from '../src/config/index.js';
import { PictureCallError } from '../src/modules/ai/clients/pictureTransport.js';
import { PICTURE_CANDIDATE_CLOCK } from '../src/modules/ai/ai.config.js';
import { PictureCandidateStore } from '../src/modules/ai/clients/PictureCandidateStore.js';
import { PictureImageClient } from '../src/modules/ai/clients/PictureImageClient.js';
import { PictureJudgeClient } from '../src/modules/ai/clients/PictureJudgeClient.js';
import { PictureStore } from '../src/modules/ai/clients/PictureStore.js';
import {
  StubPictureCandidateStore,
  StubPictureImageClient,
  StubPictureJudgeClient,
  StubPictureStore
} from '../src/modules/ai/clients/StubPictureClients.js';

import {
  completeOnboarding,
  createApp,
  deleteAccounts,
  enableTotp,
  generateAndWait,
  httpServer,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient
} from './harness.js';

import type { Account } from './harness.js';
import type { AdminRecipesView } from 'core/controllers/Admin';
import type { DrawnPicture } from '../src/modules/ai/clients/PictureImageClient.js';
import type { Env } from '../src/config/index.js';
import type { INestApplication } from '@nestjs/common';
import type { JudgeCall, JudgedIngredient } from '../src/modules/ai/clients/PictureJudgeClient.js';
import type { PictureCatalogueEntry, PictureMatch, PictureRecipe, SeenFood, SeenPicture } from 'core/domain/DishPicture';
import type { PictureJudgedDrawing } from 'core/entities/DishPicture';
import type { Response } from 'supertest';
import type { TestingModuleBuilder } from '@nestjs/testing';

/**
 * What the judge said is kept (project 010 phase 3, PRD 10): every attempt that reached
 * the judge stores its two answers and the verdict in `recipe_images.provenance.drawings`,
 * with the recipe as it was judged, and none of it leaves the API.
 *
 * One application. The drawing, the judge and both stores are the product's stubs,
 * subclassed: every drawing is a different file and can be held before it starts, and
 * the judge answers what a case scripts — a prawn, a food with a sentinel name, a name
 * carrying a NUL byte and a lone surrogate, a hundred foods — or, left alone, the stub's
 * empty plate, which the rule accepts. Every drawing is made by its real path: a view
 * opens a meal, or the owner retries, and the claim is drawn after the response against
 * the **real catalogue**. Nothing is written on the table.
 *
 * `picture-candidates.e2e-spec.ts` and `picture-acceptance.e2e-spec.ts` pin the exact keys
 * of `provenance` after each writer; this suite follows the drawings across a dish's
 * drawings, replays them through the rule, and looks for a model's word in every answer.
 *
 * Recipes are shared by every account, so the suite only draws dishes that had no picture
 * row and no picture call when it started, none carrying crustaceans, and deletes the
 * rows, the calls, the audit rows and the stubs' files it made for them. The `dishPictures`
 * flag is a shared row: put back to what it was. Nothing here calls `/cron/rewrite-steps`;
 * `AI_REWRITE_STEPS` is off all the same. Four retries and one accept are sent, under the
 * thirty an hour each allows.
 *
 * Not proved here, and where: the caps one by one, a value of the wrong type, an attempt
 * too large to store, and a stored `drawings` that no longer fits the shape
 * (`PictureJudgement.test.ts`); a failure or a release that loses its claim — here only the
 * judge's door is raced — and the release's and the removal's drawings
 * (`RecipeRepository.test.ts`, `DishPicture.spec.ts`).
 *
 * Requires a real, seeded database — see ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

/**
 * Draws the stub file with a tail of its own, so no two drawings are the same bytes. The next
 * draw can be held before it starts — that one alone, and `held` counts it once it waits — and
 * every draw can be made to fail with an error a case chooses.
 */
class ControlledImages extends StubPictureImageClient {
  calls = 0;
  hold: Promise<void> | null = null;
  held = 0;
  failing: Error | null = null;

  async draw(): Promise<DrawnPicture> {
    const hold = this.hold;

    if (hold !== null) {
      this.hold = null;
      this.held += 1;
      await hold;
    }

    this.calls += 1;

    if (this.failing !== null) {
      throw this.failing;
    }

    const drawn = await super.draw();

    return { ...drawn, bytes: Uint8Array.from([...drawn.bytes, ...Buffer.from(`e2e-judgement-${String(this.calls)}`)]) };
  }
}

/**
 * Answers what a case scripts, and the stub's empty plate — every ingredient seen, which the
 * rule accepts — when it scripts nothing. Keeps every answer it gave, for a case to judge again.
 */
class ScriptedJudge extends StubPictureJudgeClient {
  seeing: SeenPicture | null = null;
  /** Call (b)'s extras; its ingredients are always the stub's, every one seen. */
  extras: string[] | null = null;
  answered: { match: PictureMatch; seen: SeenPicture }[] = [];
  private last: SeenPicture = { foods: [] };

  async see(): Promise<JudgeCall<SeenPicture>> {
    const called = await super.see();

    this.last = this.seeing ?? called.result;

    return this.seeing === null ? called : { costUsd: 0, model: 'e2e/judge', provider: 'e2e', result: this.seeing };
  }

  async match(seen: readonly SeenFood[], ingredients: readonly JudgedIngredient[]): Promise<JudgeCall<PictureMatch>> {
    const called = await super.match(seen, ingredients);
    const result = this.extras === null ? called.result : { ...called.result, extras: this.extras };

    this.answered.push({ match: result, seen: this.last });

    return { ...called, result };
  }
}

type Dish = { mealId: string; name: string; recipeId: string; slug: string };
type Provenance = Record<string, unknown> & { candidate?: { path: string }; drawings?: PictureJudgedDrawing[]; notes?: string[] };
type Row = { attempts: number; lastAttemptAt: string; provenance: Provenance | null; status: string; url: string | null };
type Left = { accounts: number; audits: number; images: number };

const DAY = 24 * 60 * 60 * 1000;
const COOL_OFF_DAYS = 7;
const PICTURE_ACTIONS = ['picture.accepted', 'picture.removed', 'picture.discarded', 'picture.retried'];
const PRAWN: SeenPicture = { foods: [{ amount: 'main', name: 'shrimp', specific: true }] };

describe('what the judge said is kept (project 010, phase 3)', () => {
  const stamp = Date.now();
  /** A food's name no dish, catalogue or dictionary holds: once stored, it must reach no answer. */
  const SENTINEL = `zqxsentinelfood${String(stamp)}`;
  const made: string[] = [];
  const touched = new Set<string>();
  const images = new ControlledImages();
  const judge = new ScriptedJudge();
  const published = new StubPictureStore();
  const store = new StubPictureCandidateStore();
  let app: INestApplication;
  let owner: Account;
  let planner: Account;
  let fresh: Dish[] = [];
  let flagBefore = false;

  const env = (): Env =>
    validateEnv({
      ...process.env,
      AI_IMAGE_MONTHLY_CAP_USD: '1000',
      AI_REWRITE_STEPS: 'false',
      CRON_SECRET: randomBytes(24).toString('hex'),
      EMAIL_FROM: '',
      OWNER_EMAIL: '',
      SMTP_HOST: '',
      SMTP_PASS: '',
      SMTP_USER: ''
    });

  const stubbed = (builder: TestingModuleBuilder): TestingModuleBuilder =>
    builder
      .overrideProvider(ENV)
      .useValue(env())
      .overrideProvider(PictureImageClient)
      .useValue(images)
      .overrideProvider(PictureJudgeClient)
      .useValue(judge)
      .overrideProvider(PictureStore)
      .useValue(published)
      .overrideProvider(PictureCandidateStore)
      .useValue(store)
      .overrideProvider(PICTURE_CANDIDATE_CLOCK)
      .useValue(() => new Date());

  const admin = (path: string) => request(httpServer(app)).get(`/${PREFIX}/admin/${path}`).set('Cookie', owner.cookie);

  const post = (path: string, body?: object) => {
    const call = request(httpServer(app)).post(`/${PREFIX}/admin/${path}`).set('Cookie', owner.cookie);

    return body === undefined ? call : call.send(body);
  };

  const retry = (dish: Dish) => post(`catalogue/recipes/${dish.recipeId}/picture/retry`);

  const take = (): Dish => {
    const dish = fresh.shift();

    if (!dish) {
      throw new Error('The planner’s plan has run out of dishes without a picture row');
    }

    touched.add(dish.recipeId);

    return dish;
  };

  const row = async (recipeId: string): Promise<Row | undefined> =>
    (
      await sql()<Row>`
        select attempts, provenance, status, url,
               to_char(last_attempt_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "lastAttemptAt"
        from recipe_images where recipe_id = ${recipeId}`
    )[0];

  const settled = async (recipeId: string): Promise<Row> => {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      const now = await row(recipeId);

      if (now !== undefined && now.status !== 'drawing') {
        return now;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`The picture of ${recipeId} was still drawing after 30 s`);
  };

  /** The planner's own view of a meal that serves the dish, as text. */
  const meal = async (dish: Dish): Promise<{ body: { pictureStatus: string }; text: string }> => {
    const response: Response = await request(httpServer(app))
      .get(`/${PREFIX}/meal-plans/meals/${dish.mealId}`)
      .set('Cookie', planner.cookie)
      .expect(200);

    return { body: response.body as { pictureStatus: string }, text: JSON.stringify(response.body) };
  };

  /** What the planner's meal page polls, as text. */
  const status = async (dish: Dish): Promise<string> =>
    JSON.stringify(
      (await request(httpServer(app)).get(`/${PREFIX}/recipes/${dish.recipeId}/picture-status`).set('Cookie', planner.cookie).expect(200)).body
    );

  /** A view of the dish's meal claims its picture, and the drawing scheduled after the response ends. */
  const draw = async (dish: Dish): Promise<Row> => {
    expect((await meal(dish)).body.pictureStatus).toBe('drawing');

    return settled(dish.recipeId);
  };

  /** Every answer that shows the dish, to a person or to the console, as text. */
  const answers = async (dish: Dish): Promise<Record<string, string>> => {
    const list: Response = await admin(`catalogue/recipes?q=${encodeURIComponent(dish.name)}&size=100`).expect(200);
    const failedList: Response = await admin('catalogue/recipes?picture=failed&size=100').expect(200);
    const one: Response = await admin(`catalogue/recipes/${dish.recipeId}`).expect(200);
    const pictures: Response = await admin('pictures?period=30').expect(200);
    const trail: Response = await admin('audit?size=20').expect(200);

    return {
      failedList: JSON.stringify(failedList.body),
      list: JSON.stringify(list.body),
      meal: (await meal(dish)).text,
      one: JSON.stringify(one.body),
      pictures: JSON.stringify(pictures.body),
      status: await status(dish),
      trail: JSON.stringify(trail.body)
    };
  };

  const expectSilent = (said: Record<string, string>, word: string): void => {
    for (const [answer, text] of Object.entries(said)) {
      expect({ answer, found: text.toLowerCase().includes(word.toLowerCase()) }).toEqual({ answer, found: false });
    }
  };

  /** The whole catalogue and the recipe the drawing was judged against — what the service reads before its first attempt. */
  const inputsOf = async (dish: Dish): Promise<{ catalogue: readonly PictureCatalogueEntry[]; recipe: PictureRecipe }> => {
    const inputs = await RecipeController.pictureInputs(dish.recipeId);

    if (inputs === null) {
      throw new Error(`No recipe ${dish.recipeId}`);
    }

    return inputs;
  };

  /** Each stored attempt through the rule again, with the drawing's recipe and the whole catalogue: the verdict it gives, beside the stored one. */
  const replayed = (drawings: readonly PictureJudgedDrawing[], catalogue: readonly PictureCatalogueEntry[]) =>
    drawings.flatMap(drawing =>
      drawing.attempts.map(attempt => {
        const verdict = judgePicture({
          catalogue,
          match: attempt.match as PictureMatch,
          recipe: { ingredients: drawing.recipe.ingredients, name: drawing.recipe.name },
          seen: attempt.seen as SeenPicture
        });

        return { replayed: { accepted: verdict.accepted, notes: verdict.notes }, stored: attempt.verdict };
      })
    );

  const untouchedDishes = async (who: Account): Promise<Dish[]> =>
    sql()<Dish>`
      select m.recipe_id as "recipeId", min(m.id::text) as "mealId", r.name, r.slug
      from meals m
      join plan_days d on d.id = m.plan_day_id
      join meal_plans p on p.id = d.plan_id
      join recipes r on r.id = m.recipe_id
      where p.user_id = ${who.id}
        and r.name is not null
        and not exists (select 1 from recipe_images i where i.recipe_id = m.recipe_id)
        and not exists (select 1 from recipe_image_calls c where c.recipe_id = m.recipe_id)
        and not exists (
          select 1 from recipe_ingredients ri
          join ingredient_allergens ia on ia.ingredient_id = ri.ingredient_id
          join allergens a on a.id = ia.allergen_id
          where ri.recipe_id = m.recipe_id and a.key = 'crustaceans')
      group by m.recipe_id, r.name, r.slug
      order by m.recipe_id`;

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL), stubbed);

    flagBefore = await SettingsController.dishPictures();
    await SettingsController.setFlag('dishPictures', true, UNAUDITED);

    owner = await register(app, `picture-judgements-owner-${stamp}@e2e.invalid`);
    await UserController.grantAdmin(owner.email);
    owner = await enableTotp(app, owner);
    made.push(owner.cookie);

    planner = await register(app, `picture-judgements-planner-${stamp}@e2e.invalid`);
    made.push(planner.cookie);
    await completeOnboarding(app, planner);
    expect((await generateAndWait(app, planner)).status).toBe('succeeded');

    fresh = await untouchedDishes(planner);
    // One drawn four times, one accepted by hand, two with malformed answers, two whose provider's message is, and one taken over.
    expect(fresh.length).toBeGreaterThanOrEqual(7);
  }, 300_000);

  afterAll(async () => {
    let left: Left | undefined;

    try {
      await deleteAccounts(app, made);

      const recipeIds = [...touched];

      await sql()`delete from recipe_image_calls where recipe_id::text = any(${recipeIds})`;
      await sql()`delete from recipe_images where recipe_id::text = any(${recipeIds})`;
      await sql()`delete from audit_logs where action = any(${PICTURE_ACTIONS}) and entity_id = any(${recipeIds})`;
      store.files.clear();
      published.stored.length = 0;
      published.deleted.length = 0;

      [left] = await sql()<Left>`
        select (select count(*)::int from "user" where email like ${`picture-judgements-%-${String(stamp)}@e2e.invalid`}) as accounts,
               (select count(*)::int from audit_logs where action = any(${PICTURE_ACTIONS}) and entity_id = any(${recipeIds})) as audits,
               (select count(*)::int from recipe_images where recipe_id::text = any(${recipeIds})) as images`;
    } finally {
      judge.seeing = null;
      judge.extras = null;
      images.failing = null;
      await SettingsController.setFlag('dishPictures', flagBefore, UNAUDITED).catch(() => undefined);
      await app?.close();
    }

    expect(left).toEqual({ accounts: 0, audits: 0, images: 0 });
  });

  describe('across a dish’s drawings', () => {
    let drawn: Dish | undefined;
    /** The row after each of the dish's four drawings, in order. */
    const ends: Row[] = [];

    const dish = (): Dish => {
      if (!drawn) {
        throw new Error('No dish was drawn');
      }

      return drawn;
    };

    const drawingsOf = (at: number): PictureJudgedDrawing[] => ends[at]?.provenance?.drawings ?? [];

    beforeAll(() => {
      drawn = take();
    });

    it('a rejected drawing keeps its three judged attempts, in order, with the recipe as it was judged', async () => {
      judge.seeing = PRAWN;
      judge.extras = ['shrimp'];

      try {
        const from = new Date().toISOString();
        const ended = await draw(dish());
        const until = new Date().toISOString();
        const { recipe } = await inputsOf(dish());

        ends.push(ended);
        expect(ended).toMatchObject({ attempts: 3, status: 'failed', url: null });
        expect(Object.keys(ended.provenance ?? {}).sort()).toEqual(['candidate', 'drawings', 'notes', 'reason']);

        const [first, ...more] = drawingsOf(0);

        expect(more).toEqual([]);
        // A drawing's own keys, with its version.
        expect(Object.keys(first ?? {}).sort()).toEqual(['attempts', 'recipe', 'v']);
        expect(first?.v).toBe(1);
        // The recipe is read with no order: compared ingredient by ingredient, by slug.
        const bySlug = <T extends { slug: string }>(list: readonly T[]): T[] => [...list].sort((a, b) => (a.slug < b.slug ? -1 : 1));

        expect(first?.recipe.name).toBe(recipe.name);
        expect(first?.recipe.reduced).toBe(false);
        expect(bySlug(first?.recipe.ingredients ?? [])).toEqual(bySlug(recipe.ingredients.map(({ grams, name, slug }) => ({ grams, name, slug }))));
        expect(first?.attempts.map(attempt => attempt.attempt)).toEqual([1, 2, 3]);

        for (const attempt of first?.attempts ?? []) {
          expect(attempt).toMatchObject({ reduced: false, seen: PRAWN, verdict: { accepted: false } });
          expect(attempt.match.extras).toEqual(['shrimp']);
          expect(attempt.verdict.notes.some(note => note.startsWith('extra_allergen:shrimp='))).toBe(true);
          expect(attempt.at >= from && attempt.at <= until).toBe(true);
        }

        // The notes the failed row always kept are the same three rejections, one per stored attempt.
        expect(ended.provenance?.notes).toHaveLength(3);
      } finally {
        judge.seeing = null;
        judge.extras = null;
      }
    }, 60_000);

    it('the owner’s retry keeps them while it draws, and the next rejected drawing is kept after them', async () => {
      judge.seeing = PRAWN;
      judge.extras = ['shrimp'];

      const gate: { open?: () => void } = {};

      images.hold = new Promise<void>(resolve => {
        gate.open = resolve;
      });

      try {
        expect((await retry(dish()).expect(202)).body).toEqual({ status: 'drawing' });

        // Claimed and held before its first picture: the row holds the earlier drawing and nothing else.
        const claimed = await row(dish().recipeId);

        expect(claimed).toMatchObject({ attempts: 0, status: 'drawing' });
        expect(claimed?.provenance).toEqual({ drawings: drawingsOf(0) });
      } finally {
        images.hold = null;
        gate.open?.();
      }

      try {
        const ended = await settled(dish().recipeId);

        ends.push(ended);
        expect(ended).toMatchObject({ attempts: 3, status: 'failed' });

        const [first, second, ...more] = drawingsOf(1);

        expect(more).toEqual([]);
        // Oldest first, and the first exactly as it was stored.
        expect(first).toEqual(drawingsOf(0)[0]);
        expect(second?.attempts.map(attempt => [attempt.attempt, attempt.verdict.accepted])).toEqual([
          [1, false],
          [2, false],
          [3, false]
        ]);
        expect((second?.attempts[0]?.at ?? '') > (first?.attempts[2]?.at ?? '')).toBe(true);
      } finally {
        judge.seeing = null;
        judge.extras = null;
      }
    }, 60_000);

    it('a third rejected drawing and a fourth the judge accepts: the row keeps the last three, the accepted one last', async () => {
      judge.seeing = PRAWN;
      judge.extras = ['shrimp'];

      try {
        expect((await retry(dish()).expect(202)).body).toEqual({ status: 'drawing' });
        ends.push(await settled(dish().recipeId));
      } finally {
        judge.seeing = null;
        judge.extras = null;
      }

      expect(drawingsOf(2)).toEqual([...drawingsOf(1), expect.anything()]);

      // The stub's empty plate: accepted on the first attempt.
      expect((await retry(dish()).expect(202)).body).toEqual({ status: 'drawing' });

      const ended = await settled(dish().recipeId);

      ends.push(ended);
      expect(ended).toMatchObject({ attempts: 1, status: 'ready' });
      expect(Object.keys(ended.provenance ?? {}).sort()).toEqual(['c2pa', 'drawings', 'judge', 'notes', 'trainedAlgorithmicMedia']);

      const kept = drawingsOf(3);

      expect(kept).toHaveLength(PICTURE_DRAWINGS_KEPT);
      // The first drawing is gone; the second and third are as they were stored.
      expect(kept.slice(0, 2)).toEqual(drawingsOf(2).slice(1));
      expect(kept).not.toContainEqual(drawingsOf(0)[0]);
      expect(kept[2]?.attempts.map(attempt => [attempt.attempt, attempt.verdict.accepted])).toEqual([[1, true]]);
      expect(kept[2]?.attempts[0]).toMatchObject({ match: { extras: [] }, reduced: false, seen: { foods: [] } });
    }, 120_000);

    it('the stored answers replay: each attempt through the rule again, with the whole catalogue, gives the verdict it stored', async () => {
      const drawings = drawingsOf(3);
      const { catalogue } = await inputsOf(dish());
      const replays = replayed(drawings, catalogue);

      // Nothing was cut, so the replay is a faithful one; and there is a rejection and an acceptance to replay.
      expect(drawings.every(drawing => !drawing.recipe.reduced && drawing.attempts.every(attempt => !attempt.reduced))).toBe(true);
      expect(replays).toHaveLength(7);
      expect(replays.map(replay => replay.stored.accepted)).toEqual([false, false, false, false, false, false, true]);

      for (const { replayed: again, stored } of replays) {
        expect(again).toEqual(stored);
      }
    });
  });

  describe('a model’s word reaches no answer', () => {
    let waiting: { dish: Dish; failed: Row } | undefined;

    const held = (): { dish: Dish; failed: Row } => {
      if (!waiting) {
        throw new Error('No dish holds a candidate');
      }

      return waiting;
    };

    beforeAll(async () => {
      const dish = take();

      // A prawn the rule rejects for, and beside it a garnish with a name that is nobody's word but the model's.
      judge.seeing = {
        foods: [
          { amount: 'main', name: 'shrimp', specific: true },
          { amount: 'garnish', name: SENTINEL, specific: true }
        ]
      };
      judge.extras = ['shrimp', SENTINEL];

      try {
        waiting = { dish, failed: await draw(dish) };
      } finally {
        judge.seeing = null;
        judge.extras = null;
      }
    }, 60_000);

    it('while the picture waits for the owner: stored in the row, and in no answer of the console or of the planner', async () => {
      const { dish, failed } = held();

      // The premise: the word is there to leak — in what the judge answered, as the row keeps it.
      expect(failed).toMatchObject({ attempts: 3, status: 'failed' });
      expect(JSON.stringify(failed.provenance?.drawings)).toContain(SENTINEL);
      expect(failed.provenance?.drawings?.[0]?.attempts[0]?.seen.foods.map(food => food.name)).toEqual(['shrimp', SENTINEL]);

      expectSilent(await answers(dish), SENTINEL);
    });

    it('an acceptance by hand keeps the rejections’ notes and the judged drawings, holds no path, and says the word nowhere', async () => {
      const { dish, failed } = held();
      const path = failed.provenance?.candidate?.path ?? '';
      const listed: Response = await admin(`catalogue/recipes?q=${encodeURIComponent(dish.name)}&size=100`).expect(200);
      const candidate = (listed.body as AdminRecipesView).rows.find(found => found.slug === dish.slug)?.pictureCandidate;

      expect(path).not.toBe('');
      expect(candidate?.allergens).toContain('crustaceans');
      expect(candidate?.expiresAt).toBe(new Date(new Date(failed.lastAttemptAt).getTime() + COOL_OFF_DAYS * DAY).toISOString());

      const accepted: Response = await post(`catalogue/recipes/${dish.recipeId}/picture/candidate/accept`, {
        allergens: candidate?.allergens,
        expiresAt: candidate?.expiresAt
      }).expect(200);

      expect(accepted.body).toEqual({ status: 'ready' });

      const after = await row(dish.recipeId);
      const text = JSON.stringify(after?.provenance);

      expect(after).toMatchObject({ status: 'ready' });
      expect(Object.keys(after?.provenance ?? {}).sort()).toEqual([
        'acceptedBy',
        'c2pa',
        'drawings',
        'notes',
        'overriddenAllergens',
        'trainedAlgorithmicMedia'
      ]);
      expect(after?.provenance?.drawings).toEqual(failed.provenance?.drawings);
      expect(after?.provenance?.notes).toEqual(failed.provenance?.notes);
      // No path: not the candidate's, not its folder, not its random part.
      expect(text).not.toContain(path);
      expect(text).not.toContain(PICTURE_CANDIDATE_FOLDER);
      expect(text).not.toContain(path.slice(-'.jpg'.length - 36, -'.jpg'.length));

      // The audit row carries the allergen keys, and nothing the model wrote.
      const audits = await sql()<{ metadata: unknown }>`
        select metadata from audit_logs where action = 'picture.accepted' and entity_id = ${dish.recipeId}`;

      expect(audits).toEqual([{ metadata: { allergens: candidate?.allergens } }]);
      expectSilent({ accept: JSON.stringify(accepted.body), ...(await answers(dish)) }, SENTINEL);
    });
  });

  describe('a malformed answer never fails a drawing', () => {
    /** Draws a dish with the judge scripted, and the verdict the rule gives on what the judge really answered. */
    const drawnWith = async (seeing: SeenPicture, extras: string[]): Promise<{ accepted: boolean; ended: Row }> => {
      const dish = take();
      const since = judge.answered.length;

      judge.seeing = seeing;
      judge.extras = extras;

      try {
        const ended = await draw(dish);
        const [answer] = judge.answered.slice(since);
        const { catalogue, recipe } = await inputsOf(dish);

        if (answer === undefined) {
          throw new Error('The judge was never asked');
        }

        return { accepted: judgePicture({ catalogue, match: answer.match, recipe, seen: answer.seen }).accepted, ended };
      } finally {
        judge.seeing = null;
        judge.extras = null;
      }
    };

    it('a name with a NUL byte and a lone surrogate: the drawing ends as the rule says, and the attempt is stored cleaned and marked reduced', async () => {
      const name = 'shrimp\u0000\uD800';
      const { accepted, ended } = await drawnWith({ foods: [{ amount: 'main', name, specific: true }] }, [name]);

      expect(ended).toMatchObject(accepted ? { attempts: 1, status: 'ready' } : { attempts: 3, status: 'failed' });

      const attempts = ended.provenance?.drawings?.flatMap(drawing => drawing.attempts) ?? [];

      expect(attempts).toHaveLength(accepted ? 1 : 3);

      for (const attempt of attempts) {
        expect(attempt.reduced).toBe(true);
        expect(attempt.seen.foods.map(food => food.name)).toEqual(['shrimp']);
        expect(attempt.match.extras).toEqual(['shrimp']);

        // The rule's notes name the food as the model wrote it: stored, they are cleaned the same way.
        for (const note of attempt.verdict.notes) {
          expect({ nul: note.includes('\u0000'), surrogate: /\p{Cs}/u.test(note) }).toEqual({ nul: false, surrogate: false });
        }
      }
    }, 60_000);

    it('a hundred foods: the drawing ends as the rule says, and the attempt keeps the first sixteen, marked reduced', async () => {
      const names = Array.from({ length: 100 }, (_, index) => `qqzfood${String(index)}`);
      const { accepted, ended } = await drawnWith({ foods: names.map(name => ({ amount: 'trace' as const, name, specific: true })) }, names);

      expect(ended).toMatchObject(accepted ? { attempts: 1, status: 'ready' } : { attempts: 3, status: 'failed' });

      const attempts = ended.provenance?.drawings?.flatMap(drawing => drawing.attempts) ?? [];

      expect(attempts).toHaveLength(accepted ? 1 : 3);

      for (const attempt of attempts) {
        expect(attempt.reduced).toBe(true);
        expect(attempt.seen.foods.map(food => food.name)).toEqual(names.slice(0, 16));
        expect(attempt.match.extras).toEqual(names.slice(0, 16));
      }
    }, 60_000);
  });
  describe('what a drawing’s end writes, whatever a provider said', () => {
    /** Neither Postgres accepts inside `jsonb`: what a provider's error message may carry. */
    const BROKEN = 'Key limit\u0000 exceeded \uD800';
    /** The same two characters in a message the service does not read as a refused key (`/key limit/i` is). */
    const BROKEN_UPSTREAM = 'Upstream\u0000 overloaded \uD800';

    const clean = (text: string): { nul: boolean; surrogate: boolean } => ({ nul: text.includes('\u0000'), surrogate: /\p{Cs}/u.test(text) });

    it('a failed call whose message carries a NUL byte and a lone surrogate ends the drawing failed, its notes cleaned', async () => {
      const dish = take();

      images.failing = new PictureCallError(BROKEN_UPSTREAM, 500);

      try {
        const ended = await draw(dish);

        expect(ended).toMatchObject({ status: 'failed', url: null });
        // Nothing reached the judge, so nothing of it is kept.
        expect(Object.keys(ended.provenance ?? {}).sort()).toEqual(['notes', 'reason']);
        expect(ended.provenance?.notes?.length).toBeGreaterThan(0);

        for (const note of ended.provenance?.notes ?? []) {
          expect(clean(note)).toEqual({ nul: false, surrogate: false });
        }

        expect(ended.provenance?.notes?.some(note => note.includes('Upstream'))).toBe(true);
      } finally {
        images.failing = null;
      }
    }, 60_000);

    it('a key that refuses to pay with such a message gives the claim back, its `released` cleaned', async () => {
      const dish = take();

      images.failing = new PictureCallError(BROKEN, 402);

      try {
        const ended = await draw(dish);

        expect(ended).toMatchObject({ attempts: 0, status: 'failed', url: null });
        expect(Object.keys(ended.provenance ?? {}).sort()).toEqual(['reason', 'released']);

        const released = String(ended.provenance?.released);

        expect(clean(released)).toEqual({ nul: false, surrogate: false });
        expect(released).toContain('Key limit');
      } finally {
        images.failing = null;
      }
    }, 60_000);

    it('a drawing whose claim was taken over as stale ends as lost: the newer drawing’s row is left as it ended', async () => {
      const dish = take();
      const service = app.get(DishPictureService);
      const spy = jest.spyOn(service, 'draw');
      const gate: { open?: () => void } = {};
      const held = images.held;

      images.hold = new Promise<void>(resolve => {
        gate.open = resolve;
      });

      try {
        // A view's drawing, held before its first picture.
        expect((await meal(dish)).body.pictureStatus).toBe('drawing');

        const deadline = Date.now() + 10_000;

        while (images.held === held && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        expect(images.held).toBe(held + 1);

        // Twenty minutes on, it reads as stuck: the owner's retry takes it over, and that drawing ends — the judge accepts.
        await sql()`update recipe_images set last_attempt_at = now() - interval '20 minutes' where recipe_id = ${dish.recipeId}`;
        expect((await retry(dish).expect(202)).body).toEqual({ status: 'drawing' });

        const newer = await settled(dish.recipeId);

        expect(newer).toMatchObject({ attempts: 1, status: 'ready' });
        expect(newer.provenance?.drawings).toHaveLength(1);

        // The first drawing goes on, is judged, and finds its claim gone: it writes nothing.
        gate.open?.();

        const outcomes = await Promise.all(spy.mock.results.map(result => result.value as Promise<string>));

        expect(outcomes).toEqual(['lost', 'accepted']);
        expect(await row(dish.recipeId)).toEqual(newer);
      } finally {
        images.hold = null;
        gate.open?.();
        spy.mockRestore();
      }
    }, 60_000);
  });
});
