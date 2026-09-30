import { randomBytes, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { database } from 'database';
import { PICTURE_CANDIDATE_FOLDER } from 'core/entities/DishPicture';
import { PICTURE_PROMPT_VERSION } from 'core/domain/DishPicture';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import { ENV, validateEnv } from '../src/config/index.js';
import { PICTURE_CANDIDATE_CLOCK } from '../src/modules/ai/ai.config.js';
import { PictureCandidateStore } from '../src/modules/ai/clients/PictureCandidateStore.js';
import { PictureImageClient } from '../src/modules/ai/clients/PictureImageClient.js';
import { PictureJudgeClient } from '../src/modules/ai/clients/PictureJudgeClient.js';
import { PictureStore } from '../src/modules/ai/clients/PictureStore.js';
import {
  STUB_PICTURE,
  StubPictureCandidateStore,
  StubPictureImageClient,
  StubPictureJudgeClient,
  StubPictureStore
} from '../src/modules/ai/clients/StubPictureClients.js';

import {
  auditCount,
  completeOnboarding,
  createApp,
  deleteAccounts,
  generateAndWait,
  httpServer,
  latestAuditRow,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient
} from './harness.js';

import type { Account } from './harness.js';
import type { AdminRecipesView, AdminRecipeView } from 'core/controllers/Admin';
import type { AuditLogView } from 'core/controllers/Audit';
import type { DrawnPicture } from '../src/modules/ai/clients/PictureImageClient.js';
import type { Env } from '../src/config/index.js';
import type { INestApplication } from '@nestjs/common';
import type { JudgeCall, JudgedIngredient } from '../src/modules/ai/clients/PictureJudgeClient.js';
import type { Paged } from 'core/controllers/User';
import type { PictureMatch, SeenFood, SeenPicture } from 'core/domain/DishPicture';
import type { Response } from 'supertest';
import type { TestingModuleBuilder } from '@nestjs/testing';

/**
 * A picture the judge rejected waits for the owner (`0072`, project 009 phase 2):
 * kept privately, shown and served to an admin session only, discarded by hand,
 * deleted by a retry, and cleaned by the nightly cron once its seven days are over.
 *
 * Two applications share one database:
 *
 * - `app`: the private store is the product's own in-memory stub, as `AI_PROVIDER=stub`
 *   binds it — read through the module, not replaced — and the candidates' clock
 *   (`PICTURE_CANDIDATE_CLOCK`) is the test's, so "eight days later" needs no waiting.
 * - `bare`: the private store is unavailable, as a deploy without its token.
 *
 * The drawing, the judge and the public store are the product's stubs, subclassed: the
 * judge sees a prawn unless a case says otherwise, and the drawing can come back without
 * its C2PA manifest. Everything between them is real. A candidate is always made by its
 * real path — a view opens a meal, the claim is drawn after the response, the judge
 * rejects it three times against the **real catalogue** — and never written on the table.
 *
 * The injected clock drives what the console shows, the file's route, the discard and the
 * cleanup. It does not drive a view's claim, which reads the wall clock: "cooled off" is a
 * row whose `last_attempt_at` the case dates eight days back.
 *
 * The cleanup takes every candidate the database holds that is past its seven days, and
 * with the clock moved that is every one of them. So candidates the database already
 * held are put aside for the run — their pointers removed, and put back at the end
 * whatever the clean-up meets — and each case deletes what it made before it ends: the
 * counts a cron records are then the case's own. `AI_REWRITE_STEPS` is off whatever the
 * machine says: `/cron/rewrite-steps` is called here, and its sweep's client is the real one.
 *
 * Recipes are shared by every account, so the suite only draws dishes that had no picture
 * row and no picture call when it started, none carrying crustaceans, and deletes the
 * rows, the calls, the audit rows and the stub's files it made for them.
 *
 * Not proved here, and where: an upload that fails or outlasts its budget, and a claim
 * taken over while the candidate is kept (`DishPicture.spec.ts`); a deletion that fails
 * leaving the pointer, and the cleanup's time budget (`PictureCandidates.spec.ts`,
 * `RecipeCandidate.test.ts`); the real store's privacy (`VercelBlobPictureCandidateStore.spec.ts`).
 *
 * Requires a real, seeded database — see ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

/** A JPEG with no header segment at all: no C2PA manifest, and no XMP either. */
const UNSIGNED_PICTURE = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

/** Draws the stub file — which carries its manifest — or a file without one; counts every draw. */
class ControlledImages extends StubPictureImageClient {
  calls = 0;
  unsigned = false;

  async draw(): Promise<DrawnPicture> {
    this.calls += 1;

    const drawn = await super.draw();

    return this.unsigned ? { ...drawn, bytes: UNSIGNED_PICTURE } : drawn;
  }
}

/** Sees a prawn on every picture, which no dish of this suite carries; with `prawns` off it is the stub judge, which accepts. */
class PrawnsJudge extends StubPictureJudgeClient {
  calls = 0;
  prawns = true;

  async see(): Promise<JudgeCall<SeenPicture>> {
    this.calls += 1;

    return this.prawns
      ? { costUsd: 0, model: 'e2e/judge', provider: 'e2e', result: { foods: [{ amount: 'main', name: 'shrimp', specific: true }] } }
      : super.see();
  }

  async match(seen: readonly SeenFood[], ingredients: readonly JudgedIngredient[]): Promise<JudgeCall<PictureMatch>> {
    return this.prawns
      ? { costUsd: 0, model: 'e2e/judge', provider: 'e2e', result: { extras: ['shrimp'], ingredients: [] } }
      : super.match(seen, ingredients);
  }
}

type Dish = { mealId: string; name: string; recipeId: string; slug: string };
type MealDetail = { illustrationPath: string | null; pictureStatus: string };
type StoredCandidate = { extras: { foreignAllergens: string[]; mappedTo: string[] }[]; model: string; path: string; promptVersion: string };
type Provenance = { candidate?: StoredCandidate; diagnostic?: Record<string, unknown>; notes?: string[]; reason?: string };
/** `lastAttemptAt` as ISO text with its milliseconds, whatever the driver makes of a timestamp. */
type Row = { attempts: number; lastAttemptAt: string; provenance: Provenance | null; status: string; url: string | null };
type RecipeRow = AdminRecipesView['rows'][number];
type Shelved = { readonly candidate: string; readonly recipeId: string };
type Left = { accounts: number; audits: number; crons: number; images: number };

const DAY = 24 * 60 * 60 * 1000;
const COOL_OFF_DAYS = 7;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const NO_CANDIDATE = { code: 'NOT_FOUND', message: 'Picture candidate not found', statusCode: 404 };
const NO_RECIPE = { code: 'NOT_FOUND', message: 'Recipe not found', statusCode: 404 };
/** What the sweep answers and records with `AI_REWRITE_STEPS` off: nothing claimed, nothing rewritten. */
const NO_SWEEP = { pending: 0, rewritten: 0, skipped: 0, unreached: 0 };

describe('a rejected picture waits for the owner (0072, phase 2)', () => {
  const cronSecret = randomBytes(24).toString('hex');
  const stamp = Date.now();
  const made: string[] = [];
  const shelved: Shelved[] = [];
  /** Every recipe this suite let a drawing touch: its rows, calls and audit rows are deleted when it ends. */
  const touched = new Set<string>();
  const images = new ControlledImages();
  const judge = new PrawnsJudge();
  const published = new StubPictureStore();
  /** The private store with no token: nothing is kept in it, which is how every drawing was before `0072`. */
  const absent: StubPictureCandidateStore = Object.defineProperty(new StubPictureCandidateStore(), 'isAvailable', { get: () => false });
  /** How far ahead of the wall clock the candidates' clock of `app` runs. */
  let aheadMs = 0;
  let app: INestApplication;
  let bare: INestApplication;
  let store: StubPictureCandidateStore;
  let owner: Account;
  let ordinary: Account;
  let planner: Account;
  /** The planner's dishes with no picture row when the suite started, none carrying crustaceans; taken one per candidate. */
  let fresh: Dish[] = [];
  let started = '';
  let flagBefore = false;

  // No mail whatever the machine's environment says, and the month's cap far above anything the database already spent.
  const env = (): Env =>
    validateEnv({
      ...process.env,
      AI_IMAGE_MONTHLY_CAP_USD: '1000',
      AI_REWRITE_STEPS: 'false',
      CRON_SECRET: cronSecret,
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
      .useValue(published);

  const admin = (path: string, cookie?: string, on: INestApplication = app) => {
    const call = request(httpServer(on)).get(`/${PREFIX}/admin/${path}`);

    return cookie === undefined ? call : call.set('Cookie', cookie);
  };

  const post = (path: string, cookie?: string, on: INestApplication = app) => {
    const call = request(httpServer(on)).post(`/${PREFIX}/admin/${path}`);

    return cookie === undefined ? call : call.set('Cookie', cookie);
  };

  const file = (id: string, cookie?: string, on: INestApplication = app) => admin(`catalogue/recipes/${id}/picture/candidate`, cookie, on);

  const discard = (id: string, cookie?: string, on: INestApplication = app) => post(`catalogue/recipes/${id}/picture/candidate/discard`, cookie, on);

  const cron = () => request(httpServer(app)).get(`/${PREFIX}/cron/rewrite-steps`).set('Authorization', `Bearer ${cronSecret}`);

  const take = (): Dish => {
    const dish = fresh.shift();

    if (!dish) {
      throw new Error('The planner’s plan has run out of dishes without a picture row');
    }

    touched.add(dish.recipeId);

    return dish;
  };

  const openMeal = async (dish: Dish, on: INestApplication = app): Promise<MealDetail> => {
    const response: Response = await request(httpServer(on))
      .get(`/${PREFIX}/meal-plans/meals/${dish.mealId}`)
      .set('Cookie', planner.cookie)
      .expect(200);

    return response.body as MealDetail;
  };

  const row = async (recipeId: string): Promise<Row | undefined> =>
    (
      await sql()<Row>`
        select attempts, provenance, status, url,
               to_char(last_attempt_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "lastAttemptAt"
        from recipe_images where recipe_id = ${recipeId}`
    )[0];

  const calls = async (recipeId: string): Promise<string[]> =>
    (await sql()<{ kind: string }>`select kind from recipe_image_calls where recipe_id = ${recipeId} order by created_at`).map(call => call.kind);

  /** The private files kept for a dish: the paths under its id. */
  const files = (recipeId: string, of: StubPictureCandidateStore = store): string[] => [...of.files.keys()].filter(path => path.includes(recipeId));

  /** A view of the dish's meal claims its picture, and the drawing scheduled after the response ends. */
  const draw = async (dish: Dish, on: INestApplication = app): Promise<Row> => {
    expect((await openMeal(dish, on)).pictureStatus).toBe('drawing');

    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      const now = await row(dish.recipeId);

      if (now !== undefined && now.status !== 'drawing') {
        return now;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`The picture of ${dish.recipeId} was still drawing after 30 s`);
  };

  /** A dish whose drawing the judge rejected, holding its candidate: the row and where the file is. */
  const rejected = async (dish: Dish): Promise<{ path: string; row: Row }> => {
    const ended = await draw(dish);
    const path = ended.provenance?.candidate?.path ?? '';

    expect(ended).toMatchObject({ attempts: 3, status: 'failed', url: null });
    expect(files(dish.recipeId)).toEqual([path]);

    return { path, row: ended };
  };

  /** Nothing of a case: the dish's row, its calls and its private files. */
  const clear = async (dish: Dish): Promise<void> => {
    await sql()`delete from recipe_image_calls where recipe_id = ${dish.recipeId}`;
    await sql()`delete from recipe_images where recipe_id = ${dish.recipeId}`;

    for (const holder of [store, absent]) {
      for (const path of files(dish.recipeId, holder)) {
        holder.files.delete(path);
      }
    }
  };

  const listed = async (dish: Dish): Promise<{ row: RecipeRow | undefined; text: string }> => {
    const response: Response = await admin(`catalogue/recipes?q=${encodeURIComponent(dish.name)}&size=100`, owner.cookie).expect(200);

    return { row: (response.body as AdminRecipesView).rows.find(candidate => candidate.slug === dish.slug), text: JSON.stringify(response.body) };
  };

  const one = async (dish: Dish): Promise<{ text: string; view: AdminRecipeView }> => {
    const response: Response = await admin(`catalogue/recipes/${dish.recipeId}`, owner.cookie).expect(200);

    return { text: JSON.stringify(response.body), view: response.body as AdminRecipeView };
  };

  /** The part of a candidate's path nobody could guess: the uuid its file is named with, after the prompt version. */
  const randomPart = (path: string): string => path.slice(-'.jpg'.length - 36, -'.jpg'.length);

  const expiry = (lastAttemptAt: string): string => new Date(new Date(lastAttemptAt).getTime() + COOL_OFF_DAYS * DAY).toISOString();

  const databaseNow = async (): Promise<string> => (await sql()<{ now: string }>`select now()::text as now`)[0]?.now ?? '';

  /** What the `rewrite` cron recorded since `since`, oldest first. */
  const rewriteRuns = (since: string) =>
    sql()<{ properties: Record<string, unknown>; userId: string | null }>`
      select properties, user_id as "userId" from analytics_events
      where event = 'cron_run' and properties ->> 'job' = 'rewrite' and created_at >= ${since}
      order by created_at`;

  /** The planner's dishes no drawing has ever touched and that carry no crustaceans, with one meal that serves each. */
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
    started = await databaseNow();

    const ai = new ScriptedAiClient(POOL);

    app = await createApp(ai, builder =>
      stubbed(builder)
        .overrideProvider(PICTURE_CANDIDATE_CLOCK)
        .useValue(() => new Date(Date.now() + aheadMs))
    );
    bare = await createApp(ai, builder => stubbed(builder).overrideProvider(PictureCandidateStore).useValue(absent));

    // The private store as the module binds it with `AI_PROVIDER=stub`: the suite reads it, and replaces nothing.
    const bound: unknown = app.get(PictureCandidateStore, { strict: false });

    if (!(bound instanceof StubPictureCandidateStore)) {
      throw new Error('The private store is not the stub: these cases would write to a real one');
    }

    store = bound;

    flagBefore = await SettingsController.dishPictures();
    await SettingsController.setFlag('dishPictures', true, UNAUDITED);

    // The candidates the database already held: out of the cleanup's reach for the run, back at the end.
    const held = await sql()<Shelved>`
      select recipe_id::text as "recipeId", (provenance -> 'candidate')::text as candidate from recipe_images
      where provenance -> 'candidate' ->> 'path' is not null`;

    shelved.push(...held);
    await sql()`update recipe_images set provenance = provenance - 'candidate' where recipe_id::text = any(${held.map(found => found.recipeId)})`;

    owner = await register(app, `picture-candidates-owner-${stamp}@e2e.invalid`);
    made.push(owner.cookie);
    await UserController.grantAdmin(owner.email);

    ordinary = await register(app, `picture-candidates-ordinary-${stamp}@e2e.invalid`);
    made.push(ordinary.cookie);

    planner = await register(app, `picture-candidates-planner-${stamp}@e2e.invalid`);
    made.push(planner.cookie);
    await completeOnboarding(app, planner);
    expect((await generateAndWait(app, planner)).status).toBe('succeeded');

    fresh = await untouchedDishes(planner);
    // One for the candidate the reading cases share, and one for each of the seven cases that draw their own.
    expect(fresh.length).toBeGreaterThanOrEqual(8);
  }, 300_000);

  afterAll(async () => {
    let left: Left | undefined;

    // What the run moved goes back whatever the clean-up meets — a refused statement included.
    try {
      left = await clean();
    } finally {
      for (const found of shelved) {
        await sql()`
          update recipe_images set provenance = coalesce(provenance, '{}'::jsonb) || jsonb_build_object('candidate', ${found.candidate}::text::jsonb)
          where recipe_id::text = ${found.recipeId}`.catch(() => undefined);
      }

      await SettingsController.setFlag('dishPictures', flagBefore, UNAUDITED).catch(() => undefined);
      await Promise.all([app?.close(), bare?.close()]);
    }

    expect(left).toEqual({ accounts: 0, audits: 0, crons: 0, images: 0 });
  });

  /** Removes every row and every private file the run made, and counts what is left of them. */
  async function clean(): Promise<Left | undefined> {
    await deleteAccounts(app, made);

    const recipeIds = [...touched];

    await sql()`delete from recipe_image_calls where recipe_id::text = any(${recipeIds})`;
    await sql()`delete from recipe_images where recipe_id::text = any(${recipeIds})`;
    await sql()`delete from audit_logs where action in ('picture.discarded', 'picture.retried') and entity_id::text = any(${recipeIds})`;
    await sql()`delete from analytics_events where event = 'cron_run' and created_at >= ${started}`;
    store?.files.clear();
    absent.files.clear();

    const [left] = await sql()<Left>`
      select (select count(*)::int from "user" where email like ${`picture-candidates-%-${String(stamp)}@e2e.invalid`}) as accounts,
             (select count(*)::int from audit_logs where action in ('picture.discarded', 'picture.retried') and entity_id::text = any(${recipeIds})) as audits,
             (select count(*)::int from analytics_events where event = 'cron_run' and created_at >= ${started}) as crons,
             (select count(*)::int from recipe_images where recipe_id::text = any(${recipeIds})) as images`;

    return left;
  }

  describe('a candidate that waits', () => {
    let waiting: { dish: Dish; path: string; row: Row } | undefined;

    /** The dish every case of this block reads, and the candidate it holds — made in `beforeAll`, which fails without them. */
    const held = (): { dish: Dish; path: string; row: Row } => {
      if (!waiting) {
        throw new Error('No dish holds a candidate');
      }

      return waiting;
    };

    beforeAll(async () => {
      const dish = take();

      waiting = { dish, ...(await rejected(dish)) };
    }, 60_000);

    // Gone before the clock's cases: their crons count the candidates they delete.
    afterAll(async () => {
      if (waiting) {
        await clear(waiting.dish);
      }
    });

    it('is one private file and one pointer: the last picture the judge rejected, as it was drawn, and nothing public', async () => {
      const { dish, path, row: failed } = held();

      expect(path).toMatch(
        new RegExp(`^${PICTURE_CANDIDATE_FOLDER}/${dish.recipeId}/${PICTURE_PROMPT_VERSION.replace(/\./g, '\\.')}-${UUID}\\.jpg$`)
      );
      // Three rejected pictures, one file: the drawing keeps the last, and only once it has ended failed.
      expect(await calls(dish.recipeId)).toEqual(['image', 'judge', 'judge', 'image', 'judge', 'judge', 'image', 'judge', 'judge']);
      expect(Buffer.from(store.files.get(path) ?? []).equals(Buffer.from(STUB_PICTURE))).toBe(true);
      expect(published.stored.filter(put => put.path.includes(dish.recipeId))).toEqual([]);

      // The pointer, beside what a failed row always stored: the reason the owner's mail counts is intact.
      expect(Object.keys(failed.provenance ?? {}).sort()).toEqual(['candidate', 'notes', 'reason']);
      expect(failed.provenance?.reason).toBe('judge_allergen');
      expect(failed.provenance?.notes).toHaveLength(3);
      expect(Object.keys(failed.provenance?.candidate ?? {}).sort()).toEqual(['extras', 'model', 'path', 'promptVersion']);
      expect(failed.provenance?.candidate).toMatchObject({ model: 'stub/picture', promptVersion: PICTURE_PROMPT_VERSION });

      // What the judge flagged, in the catalogue's words: the judge said "shrimp", and the row says neither that nor anything like it.
      const extras = failed.provenance?.candidate?.extras ?? [];

      expect(extras).toHaveLength(1);
      expect(Object.keys(extras[0] ?? {}).sort()).toEqual(['foreignAllergens', 'mappedTo']);
      expect(extras[0]?.foreignAllergens).toContain('crustaceans');
      expect(extras[0]?.mappedTo.length).toBeGreaterThan(0);
      expect(JSON.stringify(failed.provenance?.candidate)).not.toContain('shrimp');
    });

    it('shows the owner the allergen keys and the catalogue ingredients the judge flagged, and when it expires', async () => {
      const { dish, row: failed } = held();
      const { row: shown } = await listed(dish);
      const candidate = shown?.pictureCandidate;
      const [extra] = failed.provenance?.candidate?.extras ?? [];

      expect(shown).toMatchObject({ picture: 'failed', pictureReason: 'judge_allergen' });
      expect(Object.keys(candidate ?? {}).sort()).toEqual(['allergens', 'expiresAt', 'ingredients']);
      // One clock: the candidate expires the instant the dish's cool-off ends.
      expect(candidate?.expiresAt).toBe(expiry(failed.lastAttemptAt));
      expect(shown?.retryableAt).toBe(candidate?.expiresAt);
      expect(candidate?.allergens).toEqual([...(extra?.foreignAllergens ?? [])].sort());
      expect(candidate?.allergens).toContain('crustaceans');

      // Each flagged food as a catalogue ingredient, by slug and name, sorted — and each one really is in the catalogue.
      const slugs = [...new Set(extra?.mappedTo ?? [])].sort();

      expect(candidate?.ingredients.map(ingredient => ingredient.slug)).toEqual(slugs);

      for (const ingredient of candidate?.ingredients ?? []) {
        expect(Object.keys(ingredient).sort()).toEqual(['name', 'slug']);
        expect(ingredient.name).not.toBe('');
      }

      const [known] = await sql()<{ carrying: number; n: number }>`
        select count(distinct i.id)::int as n,
               count(distinct i.id) filter (where a.key = 'crustaceans')::int as carrying
        from ingredients i
        left join ingredient_allergens ia on ia.ingredient_id = i.id
        left join allergens a on a.id = ia.allergen_id
        where i.slug = any(${slugs})`;

      expect(known?.n).toBe(slugs.length);
      expect(known?.carrying).toBeGreaterThan(0);
    });

    it('reads one recipe as its list row plus its served ingredients, heaviest first', async () => {
      const { dish } = held();
      const { row: shown } = await listed(dish);
      const { ingredients, pictureUrl, ...rest } = (await one(dish)).view;

      expect(rest).toEqual(shown);
      expect(rest.pictureCandidate).not.toBeNull();
      // A picture's public address, once there is one (phase 3): a candidate has none, and its path is never put here.
      expect(pictureUrl).toBeNull();

      const served = await sql()<{ grams: number; slug: string }>`
        select ri.grams::float8 as grams, i.slug
        from recipe_ingredients ri
        join ingredients i on i.id = ri.ingredient_id
        where ri.recipe_id = ${dish.recipeId} and ri.is_optional = false`;

      expect(ingredients.length).toBeGreaterThan(0);
      expect(ingredients.map(({ grams, slug }) => ({ grams, slug }))).toEqual(
        [...served].sort((a, b) => b.grams - a.grams || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
      );

      for (const ingredient of ingredients) {
        expect(Object.keys(ingredient).sort()).toEqual(['grams', 'name', 'slug']);
        expect(ingredient.name).not.toBe('');
      }

      // An id that is no recipe, or no id at all, is the same 404.
      expect((await admin(`catalogue/recipes/${randomUUID()}`, owner.cookie).expect(404)).body).toEqual(NO_RECIPE);
      expect((await admin('catalogue/recipes/not-a-uuid', owner.cookie).expect(404)).body).toEqual(NO_RECIPE);
    });

    it('serves the file to the owner byte for byte, as a JPEG nobody may cache or sniff', async () => {
      const { dish, path } = held();
      // `blob` hands the body back as the bytes that arrived, not as text.
      const response: Response = await file(dish.recipeId, owner.cookie).responseType('blob').expect(200);

      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect((response.body as Buffer).equals(Buffer.from(STUB_PICTURE))).toBe(true);
      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['cache-control']).toBe('private, no-store');
      // Reading it changes nothing: the file and its pointer are still there.
      expect(files(dish.recipeId)).toEqual([path]);
      expect((await row(dish.recipeId))?.provenance?.candidate?.path).toBe(path);
    });

    it('never says where the file is: no path, no folder and none of the judge’s words in any answer', async () => {
      const { dish, path } = held();

      expect(randomPart(path)).toMatch(new RegExp(`^${UUID}$`));

      const served: Response = await file(dish.recipeId, owner.cookie).expect(200);
      const failedPage: Response = await admin(`catalogue/recipes?picture=failed&q=${encodeURIComponent(dish.name)}&size=100`, owner.cookie).expect(
        200
      );
      const pictures: Response = await admin('pictures?period=30', owner.cookie).expect(200);
      const answers = {
        file: JSON.stringify(served.headers),
        list: (await listed(dish)).text,
        listFailed: JSON.stringify(failedPage.body),
        pictures: JSON.stringify(pictures.body),
        recipe: (await one(dish)).text
      };

      // The dish is on the pages that were read: the scan is of bodies that carry its candidate.
      expect((failedPage.body as AdminRecipesView).rows.find(found => found.slug === dish.slug)?.pictureCandidate ?? null).not.toBeNull();

      for (const [answer, text] of Object.entries(answers)) {
        expect({ answer, found: text.includes(path) }).toEqual({ answer, found: false });
        expect({ answer, found: text.includes(PICTURE_CANDIDATE_FOLDER) }).toEqual({ answer, found: false });
        // Nor the one part of it that is not the dish's id or the prompt's version.
        expect({ answer, found: text.includes(randomPart(path)) }).toEqual({ answer, found: false });
        expect({ answer, found: text.includes('shrimp') }).toEqual({ answer, found: false });
      }
    });

    it('does not exist for an ordinary account nor without a session — the file, the discard and the recipe — and nothing is written', async () => {
      const { dish, path, row: failed } = held();
      const audits = await auditCount('picture.discarded');

      for (const cookie of [ordinary.cookie, undefined]) {
        // What this caller is told by a console route that has always been there: every denial below is that, word for word.
        const denied: unknown = (await admin('pictures', cookie).expect(404)).body;

        for (const id of [dish.recipeId, randomUUID(), 'not-a-uuid']) {
          expect((await file(id, cookie).expect(404)).body).toEqual(denied);
          expect((await discard(id, cookie).expect(404)).body).toEqual(denied);
          expect((await admin(`catalogue/recipes/${id}`, cookie).expect(404)).body).toEqual(denied);
        }
      }

      expect(await auditCount('picture.discarded')).toBe(audits);
      expect(files(dish.recipeId)).toEqual([path]);
      expect(await row(dish.recipeId)).toEqual(failed);
      // And the owner still reads it: the wall was the session, not the candidate.
      await file(dish.recipeId, owner.cookie).expect(200);
    });

    it('is a 404 for the owner when there is nothing to look at: no candidate, no recipe, a row that is not failed, a file that is gone', async () => {
      const { dish, path, row: failed } = held();
      const audits = await auditCount('picture.discarded');
      const [without] = fresh;

      expect(without).toBeDefined();

      // A dish nobody drew, an id that is no recipe, and no id at all.
      for (const id of [without?.recipeId ?? '', randomUUID(), 'not-a-uuid']) {
        expect((await file(id, owner.cookie).expect(404)).body).toEqual(NO_CANDIDATE);
        expect((await discard(id, owner.cookie).expect(404)).body).toEqual(NO_CANDIDATE);
      }

      // The same row being drawn again holds a pointer nobody may look at.
      await sql()`update recipe_images set status = 'drawing' where recipe_id = ${dish.recipeId}`;

      try {
        expect((await file(dish.recipeId, owner.cookie).expect(404)).body).toEqual(NO_CANDIDATE);
        expect((await discard(dish.recipeId, owner.cookie).expect(404)).body).toEqual(NO_CANDIDATE);
        expect((await listed(dish)).row).toMatchObject({ picture: 'drawing', pictureCandidate: null });
      } finally {
        await sql()`update recipe_images set status = 'failed' where recipe_id = ${dish.recipeId}`;
      }

      // The pointer with no file behind it: the route has nothing to serve.
      const bytes = store.files.get(path);

      store.files.delete(path);

      try {
        expect((await file(dish.recipeId, owner.cookie).expect(404)).body).toEqual(NO_CANDIDATE);
      } finally {
        if (bytes) {
          store.files.set(path, bytes);
        }
      }

      // None of it wrote anything, and the candidate is as it was.
      expect(await auditCount('picture.discarded')).toBe(audits);
      expect(await row(dish.recipeId)).toEqual(failed);
      await file(dish.recipeId, owner.cookie).expect(200);
    });

    it('is a 404 on an application without the private store, which touches neither the pointer nor the file', async () => {
      const { dish, path, row: failed } = held();
      const audits = await auditCount('picture.discarded');

      expect((await file(dish.recipeId, owner.cookie, bare).expect(404)).body).toEqual(NO_CANDIDATE);
      expect((await discard(dish.recipeId, owner.cookie, bare).expect(404)).body).toEqual(NO_CANDIDATE);

      expect(await auditCount('picture.discarded')).toBe(audits);
      expect(await row(dish.recipeId)).toEqual(failed);
      expect(files(dish.recipeId)).toEqual([path]);
    });
  });

  describe('a drawing that leaves none', () => {
    it('the judge accepts: the picture is published, and nothing is kept privately', async () => {
      const dish = take();

      judge.prawns = false;

      try {
        const ended = await draw(dish);

        expect(ended).toMatchObject({ attempts: 1, status: 'ready' });
        expect(ended.provenance?.candidate).toBeUndefined();
        expect(files(dish.recipeId)).toEqual([]);
        expect(published.stored.filter(put => put.path.includes(dish.recipeId))).toHaveLength(1);
        expect((await listed(dish)).row).toMatchObject({ picture: 'ready', pictureCandidate: null });
        expect((await file(dish.recipeId, owner.cookie).expect(404)).body).toEqual(NO_CANDIDATE);
      } finally {
        judge.prawns = true;
        await clear(dish);
      }
    }, 60_000);

    it('a file without its C2PA manifest is never uploaded, judged or drawn again: the row keeps what it was instead', async () => {
      const dish = take();
      const judged = judge.calls;

      images.unsigned = true;

      try {
        const ended = await draw(dish);

        // Failed at once, on the first attempt: another drawing would come back the same.
        expect(ended).toMatchObject({ attempts: 1, status: 'failed', url: null });
        expect(await calls(dish.recipeId)).toEqual(['image']);
        expect(judge.calls).toBe(judged);

        // The closed diagnostic, and no pointer: the file itself is kept nowhere.
        expect(Object.keys(ended.provenance ?? {}).sort()).toEqual(['diagnostic', 'notes', 'reason']);
        expect(ended.provenance?.reason).toBe('no_provenance');
        expect(ended.provenance?.diagnostic).toEqual({
          c2pa: false,
          contentType: 'image/jpeg',
          jpeg: true,
          size: UNSIGNED_PICTURE.length,
          trainedAlgorithmicMedia: false
        });
        expect(files(dish.recipeId)).toEqual([]);
        expect(published.stored.filter(put => put.path.includes(dish.recipeId))).toEqual([]);

        expect((await listed(dish)).row).toMatchObject({ picture: 'failed', pictureCandidate: null, pictureReason: 'no_provenance' });
        expect((await file(dish.recipeId, owner.cookie).expect(404)).body).toEqual(NO_CANDIDATE);
      } finally {
        images.unsigned = false;
        await clear(dish);
      }
    }, 60_000);

    it('without the private store a rejected drawing fails exactly as before: no pointer, no file, nothing to show', async () => {
      const dish = take();

      try {
        const ended = await draw(dish, bare);

        expect(ended).toMatchObject({ attempts: 3, status: 'failed', url: null });
        // What a failed row stored before `0072`, and not a key more.
        expect(Object.keys(ended.provenance ?? {}).sort()).toEqual(['notes', 'reason']);
        expect(ended.provenance?.reason).toBe('judge_allergen');
        expect(ended.provenance?.notes).toHaveLength(3);
        expect(await calls(dish.recipeId)).toEqual(['image', 'judge', 'judge', 'image', 'judge', 'judge', 'image', 'judge', 'judge']);

        expect(absent.files.size).toBe(0);
        expect(files(dish.recipeId)).toEqual([]);
        expect(published.stored.filter(put => put.path.includes(dish.recipeId))).toEqual([]);

        const shown = (await listed(dish)).row;

        expect(shown).toMatchObject({ picture: 'failed', pictureCandidate: null, pictureReason: 'judge_allergen' });
        expect(shown?.retryableAt).toBe(expiry(ended.lastAttemptAt));
        expect((await one(dish)).view.pictureCandidate).toBeNull();
        expect((await file(dish.recipeId, owner.cookie).expect(404)).body).toEqual(NO_CANDIDATE);
        expect((await file(dish.recipeId, owner.cookie, bare).expect(404)).body).toEqual(NO_CANDIDATE);

        // With no pointer the cool-off is all that holds it, as before: eight days on, a view claims it.
        const drawn = images.calls;

        expect((await openMeal(dish, bare)).pictureStatus).toBe('none');
        expect(images.calls).toBe(drawn);
        await sql()`update recipe_images set last_attempt_at = now() - interval '8 days' where recipe_id = ${dish.recipeId}`;
        judge.prawns = false;
        expect((await draw(dish, bare)).status).toBe('ready');
      } finally {
        judge.prawns = true;
        await clear(dish);
      }
    }, 60_000);
  });

  describe('the clock', () => {
    it('a view never claims a dish that holds a candidate, cooled off or not — until the cron has deleted it', async () => {
      const dish = take();

      try {
        const { path } = await rejected(dish);
        const drawn = images.calls;

        // Inside its cool-off.
        expect(await openMeal(dish)).toMatchObject({ illustrationPath: null, pictureStatus: 'none' });
        expect(images.calls).toBe(drawn);

        // Eight days on: a failed dish without a candidate is claimed by this same view (the case above).
        await sql()`update recipe_images set last_attempt_at = now() - interval '8 days' where recipe_id = ${dish.recipeId}`;

        const dated = await row(dish.recipeId);

        expect(await openMeal(dish)).toMatchObject({ illustrationPath: null, pictureStatus: 'none' });
        expect(images.calls).toBe(drawn);
        expect(await row(dish.recipeId)).toEqual(dated);
        expect(files(dish.recipeId)).toEqual([path]);

        // The cron: the file, then the pointer — and nothing else of the row.
        const since = await databaseNow();

        expect((await cron().expect(200)).body).toEqual(NO_SWEEP);
        expect((await rewriteRuns(since)).map(run => run.properties)).toEqual([{ ...NO_SWEEP, candidatesDeleted: 1, job: 'rewrite' }]);
        expect(files(dish.recipeId)).toEqual([]);

        const cleaned = await row(dish.recipeId);

        expect(cleaned).toMatchObject({ attempts: 3, lastAttemptAt: dated?.lastAttemptAt, status: 'failed' });
        expect(Object.keys(cleaned?.provenance ?? {}).sort()).toEqual(['notes', 'reason']);
        expect(cleaned?.provenance?.reason).toBe('judge_allergen');

        // Claimable again: the same view, the same date, and now a drawing.
        judge.prawns = false;
        expect((await draw(dish)).status).toBe('ready');
        expect(images.calls).toBe(drawn + 1);
      } finally {
        judge.prawns = true;
        await clear(dish);
      }
    }, 60_000);

    it('with the clock past seven days the candidate is neither shown, served nor discardable, and the cron deletes it and records how many', async () => {
      const dish = take();

      try {
        const { path, row: failed } = await rejected(dish);
        const audits = await auditCount('picture.discarded');

        // Today the cron has nothing to delete: a candidate inside its seven days stays.
        let since = await databaseNow();

        await cron().expect(200);
        expect((await rewriteRuns(since)).map(run => run.properties)).toEqual([{ ...NO_SWEEP, candidatesDeleted: 0, job: 'rewrite' }]);
        expect(files(dish.recipeId)).toEqual([path]);
        expect((await listed(dish)).row?.pictureCandidate ?? null).not.toBeNull();

        // Eight days later, before any cron: expired, and still on disk.
        aheadMs = 8 * DAY;

        expect((await listed(dish)).row).toMatchObject({ picture: 'failed', pictureCandidate: null });
        expect((await one(dish)).view.pictureCandidate).toBeNull();
        expect((await file(dish.recipeId, owner.cookie).expect(404)).body).toEqual(NO_CANDIDATE);
        expect((await discard(dish.recipeId, owner.cookie).expect(404)).body).toEqual(NO_CANDIDATE);
        expect(await auditCount('picture.discarded')).toBe(audits);
        expect(files(dish.recipeId)).toEqual([path]);
        expect(await row(dish.recipeId)).toEqual(failed);

        // The cron of that night.
        since = await databaseNow();

        expect((await cron().expect(200)).body).toEqual(NO_SWEEP);

        const runs = await rewriteRuns(since);

        expect(runs.map(run => run.properties)).toEqual([{ ...NO_SWEEP, candidatesDeleted: 1, job: 'rewrite' }]);
        expect(runs[0]?.userId).toBeNull();
        expect(files(dish.recipeId)).toEqual([]);

        // The pointer is gone, which is what lets the dish be drawn again; the rest of the row is as the drawing left it.
        const cleaned = await row(dish.recipeId);

        expect(cleaned).toMatchObject({ attempts: 3, lastAttemptAt: failed.lastAttemptAt, status: 'failed' });
        expect(Object.keys(cleaned?.provenance ?? {}).sort()).toEqual(['notes', 'reason']);

        // The next night finds nothing.
        since = await databaseNow();
        await cron().expect(200);
        expect((await rewriteRuns(since)).map(run => run.properties)).toEqual([{ ...NO_SWEEP, candidatesDeleted: 0, job: 'rewrite' }]);
      } finally {
        aheadMs = 0;
        await clear(dish);
      }
    }, 60_000);
  });

  describe('discard and retry', () => {
    it('discarding deletes the file and the pointer, leaves the cool-off as it was and writes one picture.discarded; a second is a 404', async () => {
      const dish = take();

      try {
        const { path, row: failed } = await rejected(dish);
        const audits = await auditCount('picture.discarded');
        const retried = await auditCount('picture.retried');
        const drawn = images.calls;
        const response: Response = await discard(dish.recipeId, owner.cookie).expect(200);

        expect(response.body).toEqual({ status: 'discarded' });
        expect(files(dish.recipeId)).toEqual([]);

        // The pointer and nothing else: the same status, attempts and date, the same notes and reason.
        const after = await row(dish.recipeId);

        expect(after).toMatchObject({ attempts: failed.attempts, lastAttemptAt: failed.lastAttemptAt, status: 'failed', url: null });
        expect(after?.provenance).toEqual({ notes: failed.provenance?.notes, reason: failed.provenance?.reason });

        // Exactly one row, about this recipe, by the owner, about nobody.
        expect(await auditCount('picture.discarded')).toBe(audits + 1);

        const written = await latestAuditRow('picture.discarded');

        expect(written).toMatchObject({
          action: 'picture.discarded',
          actorId: owner.id,
          entity: 'recipe',
          entityId: dish.recipeId,
          subjectUserId: null
        });
        expect(written?.metadata ?? {}).toEqual({});

        // Still failed, still waiting out the same seven days; nothing was drawn and nothing retried.
        const shown = (await listed(dish)).row;

        expect(shown).toMatchObject({ picture: 'failed', pictureCandidate: null, pictureReason: 'judge_allergen' });
        expect(shown?.retryableAt).toBe(expiry(failed.lastAttemptAt));
        expect(await openMeal(dish)).toMatchObject({ illustrationPath: null, pictureStatus: 'none' });
        expect(images.calls).toBe(drawn);
        expect(await auditCount('picture.retried')).toBe(retried);

        // Visible in the trail under the action's own filter, and no answer says where the file was.
        const trail: Response = await admin('audit?action=picture.discarded&size=5', owner.cookie).expect(200);
        const page = trail.body as Paged<AuditLogView>;

        expect(page.total).toBe(audits + 1);
        expect(page.rows[0]).toMatchObject({ action: 'picture.discarded', actor: owner.email, subject: null });

        for (const text of [JSON.stringify(response.body), JSON.stringify(page), JSON.stringify(written)]) {
          expect(text).not.toContain(path);
          expect(text).not.toContain(PICTURE_CANDIDATE_FOLDER);
          expect(text).not.toContain(randomPart(path));
        }

        // Gone: a second discard and the file's route are the same 404, and no second row is written.
        expect((await discard(dish.recipeId, owner.cookie).expect(404)).body).toEqual(NO_CANDIDATE);
        expect((await file(dish.recipeId, owner.cookie).expect(404)).body).toEqual(NO_CANDIDATE);
        expect(await auditCount('picture.discarded')).toBe(audits + 1);
        expect(await row(dish.recipeId)).toEqual(after);
      } finally {
        await clear(dish);
      }
    }, 60_000);

    it('a retry deletes the candidate with its claim — a refused one leaves it — and a drawing rejected again keeps one file, a new one', async () => {
      const dish = take();

      try {
        const { path, row: failed } = await rejected(dish);
        const discarded = await auditCount('picture.discarded');
        const retried = await auditCount('picture.retried');

        // A retry the system refuses claims nothing, so it deletes nothing: the candidate is as it was.
        await SettingsController.setFlag('dishPictures', false, UNAUDITED);

        try {
          const refused: Response = await post(`catalogue/recipes/${dish.recipeId}/picture/retry`, owner.cookie).expect(409);

          expect((refused.body as { code?: string }).code).toBe('PICTURE_FLAG_OFF');
          expect(files(dish.recipeId)).toEqual([path]);
          expect(await row(dish.recipeId)).toEqual(failed);
          expect(await auditCount('picture.retried')).toBe(retried);
        } finally {
          await SettingsController.setFlag('dishPictures', true, UNAUDITED);
        }

        const response: Response = await post(`catalogue/recipes/${dish.recipeId}/picture/retry`, owner.cookie).expect(202);

        expect(response.body).toEqual({ status: 'drawing' });
        expect(JSON.stringify(response.body)).not.toContain(PICTURE_CANDIDATE_FOLDER);
        expect(JSON.stringify(response.body)).not.toContain(randomPart(path));
        // Exactly one row for the retry that started, and none for the one that was refused.
        expect(await auditCount('picture.retried')).toBe(retried + 1);
        // The old file went with the claim, before the answer: whatever the new drawing does, that picture is gone.
        expect(store.files.has(path)).toBe(false);

        const deadline = Date.now() + 30_000;
        let ended = await row(dish.recipeId);

        while (ended?.status === 'drawing' && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 100));
          ended = await row(dish.recipeId);
        }

        // Rejected three times more: one candidate again, and not the one that was there.
        expect(ended).toMatchObject({ attempts: 3, status: 'failed' });

        const again = ended?.provenance?.candidate?.path ?? '';

        expect(again).not.toBe(path);
        expect(files(dish.recipeId)).toEqual([again]);
        expect((await listed(dish)).row?.pictureCandidate ?? null).not.toBeNull();
        // A retry is not a discard: the trail says `picture.retried`, and that alone.
        expect(await auditCount('picture.discarded')).toBe(discarded);
        expect(await latestAuditRow('picture.retried')).toMatchObject({ actorId: owner.id, entity: 'recipe', entityId: dish.recipeId });
      } finally {
        await clear(dish);
      }
    }, 60_000);
  });
});
