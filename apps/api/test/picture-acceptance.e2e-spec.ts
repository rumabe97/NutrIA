import { randomBytes, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { database } from 'database';
import { PICTURE_CANDIDATE_FOLDER } from 'core/entities/DishPicture';
import { pictureMarks } from 'core/domain/DishPicture';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import { AI_PICTURE_CAP, PICTURE_CANDIDATE_CLOCK } from '../src/modules/ai/ai.config.js';
import { ENV, validateEnv } from '../src/config/index.js';
import { PictureCandidatesService } from '../src/modules/ai/services/PictureCandidates.service.js';
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
  auditCount,
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
import type { AdminPicturesPeriodView, AdminRecipesView, AdminRecipeView } from 'core/controllers/Admin';
import type { AuditLogView } from 'core/controllers/Audit';
import type { DrawnPicture } from '../src/modules/ai/clients/PictureImageClient.js';
import type { Env } from '../src/config/index.js';
import type { INestApplication } from '@nestjs/common';
import type { JudgeCall, JudgedIngredient } from '../src/modules/ai/clients/PictureJudgeClient.js';
import type { Paged } from 'core/controllers/User';
import type { PictureAcceptance, PictureJudgedDrawing } from 'core/entities/DishPicture';
import type { PictureCandidateClock } from '../src/modules/ai/ai.config.js';
import type { PictureMatch, SeenFood, SeenPicture } from 'core/domain/DishPicture';
import type { Response } from 'supertest';
import type { StoredPicture } from '../src/modules/ai/clients/PictureStore.js';
import type { TestingModuleBuilder } from '@nestjs/testing';

/**
 * The owner publishes a picture the judge rejected, and takes it back (`0072`, project 009
 * phase 3): `POST …/picture/candidate/accept` and `POST …/picture/remove` — the second of
 * the only two doors a picture reaches a person through, and the way back out of it. Since
 * project 010 phase 4 the way out is for every published picture, the judge's too: a
 * picture the judge accepted wrongly is taken back as one the owner accepted is, and the
 * `picture.removed` row says in a closed word — `acceptedBy: 'judge' | 'owner'` — which of
 * the two had let it through. The cases that pinned "the judge's picture cannot be
 * removed" were rewritten on purpose.
 *
 * Three applications share one database, both stores and the candidates' clock:
 *
 * - `app`: where everything is drawn and nearly everything is asked.
 * - `ghost`: its `PictureCandidatesService` hands core an actor that is no account, so the
 *   `picture.accepted` row — and the `picture.removed` one — is refused by the database
 *   (`audit_logs.actor_id` is a foreign key) inside the transaction that changes the picture's
 *   row. The route, the guard, the body, the six steps, the rollback and the read-back under
 *   the row's lock are the product's and Postgres's; nothing is replaced but who acted.
 * - `capped`: the month's cap at zero, where a retry is refused and an accept is not.
 *
 * The drawing, the judge and the two stores are the product's stubs, subclassed: every
 * drawing is a different file, the judge sees a prawn unless a case says otherwise, a
 * published file has an address of its own, and either store can lose its token. A
 * candidate is always made by its real path — a view opens a meal, the claim is drawn
 * after the response, the judge rejects it three times against the **real catalogue** —
 * and never written on the table. What a case replaces in the private store (a file
 * without its manifest) it puts back.
 *
 * Accept, remove, discard and retry are each limited to 30 an hour per caller and per
 * application. The owner sends 22 accepts to `app` and one each to `ghost` and `capped`; the
 * 17 that are refused for what their body carries are a second admin's.
 *
 * `/cron/rewrite-steps` is called here with the clock moved, and then it takes every
 * candidate the database holds: those it already held are put aside for the run, and put
 * back at the end whatever the clean-up meets. `AI_REWRITE_STEPS` is off whatever the
 * machine says. Recipes are shared by every account, so the suite only draws dishes that
 * had no picture row and no picture call when it started, none carrying crustaceans, and
 * deletes the rows, the calls, the audit rows and the stubs' files it made for them.
 *
 * Not proved here, and where: a candidate with nothing flagged, accepted with the empty
 * list — the judge only rejects for an allergen, so the real path never makes one — and
 * the allergens compared as sets (`PictureCandidate.test.ts`); a commit whose answer is
 * lost, a row that cannot be read back, a private file that outlives its acceptance and a
 * public file that cannot be deleted (`RecipeAcceptance.test.ts`, `RecipeRepository.test.ts`,
 * `PictureCandidates.spec.ts`); that no drawing, retry or cron calls `accept`
 * (`picture-doors.spec.ts`); that the read-back waits for a commit still in flight before a
 * file is deleted — the accept's own transaction would have to throw and still be
 * committing, which nothing outside it can arrange (`RecipeAcceptance.test.ts`,
 * `RecipeRepository.test.ts`). The races are run, not steered — two accepts, two removals,
 * an accept and a retry: whichever wins is checked, and the guards that decide them are
 * pinned in `RecipeRepository.test.ts`.
 *
 * Requires a real, seeded database — see ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

/** A JPEG with no header segment at all: no C2PA manifest, and no XMP either. */
const BARE_PICTURE = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

/**
 * A picture with its APP11 segments cut out: still a JPEG that says a model made it, and no
 * C2PA manifest — what a copy that went through an editor looks like.
 */
function withoutManifest(bytes: Uint8Array): Uint8Array {
  const kept: number[] = [0xff, 0xd8];
  let at = 2;

  while (at + 4 <= bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1] ?? 0;

    // The scan, or the end: what follows is the image, kept as it is.
    if (marker === 0xda || marker === 0xd9) {
      break;
    }

    const end = at + 2 + ((bytes[at + 2] ?? 0) << 8) + (bytes[at + 3] ?? 0);

    if (marker !== 0xeb) {
      kept.push(...bytes.subarray(at, end));
    }

    at = end;
  }

  return Uint8Array.from([...kept, ...bytes.subarray(at)]);
}

/** The same bytes with the first one wrong: every segment is still there, and it is not a JPEG. */
function notJpeg(bytes: Uint8Array): Uint8Array {
  const copy = Uint8Array.from(bytes);

  copy[0] = 0x00;

  return copy;
}

/** Draws the stub file with a tail of its own after the image — so no two drawings are the same bytes — and counts every draw. */
class ControlledImages extends StubPictureImageClient {
  calls = 0;

  async draw(): Promise<DrawnPicture> {
    this.calls += 1;

    const drawn = await super.draw();

    return { ...drawn, bytes: Uint8Array.from([...drawn.bytes, ...Buffer.from(`e2e-drawing-${String(this.calls)}`)]) };
  }
}

/**
 * Sees a prawn on every picture, which no dish of this suite carries; with `prawns` off it is the stub judge, which accepts —
 * and, with a `garnish` named, sees that too: a name no catalogue maps, so it carries no allergen and the picture still passes.
 */
class PrawnsJudge extends StubPictureJudgeClient {
  calls = 0;
  garnish: string | null = null;
  prawns = true;

  async see(): Promise<JudgeCall<SeenPicture>> {
    this.calls += 1;

    if (this.prawns) {
      return { costUsd: 0, model: 'e2e/judge', provider: 'e2e', result: { foods: [{ amount: 'main', name: 'shrimp', specific: true }] } };
    }

    return this.garnish === null
      ? super.see()
      : { costUsd: 0, model: 'e2e/judge', provider: 'e2e', result: { foods: [{ amount: 'garnish', name: this.garnish, specific: true }] } };
  }

  async match(seen: readonly SeenFood[], ingredients: readonly JudgedIngredient[]): Promise<JudgeCall<PictureMatch>> {
    return this.prawns
      ? { costUsd: 0, model: 'e2e/judge', provider: 'e2e', result: { extras: ['shrimp'], ingredients: [] } }
      : super.match(seen, ingredients);
  }
}

const PUBLIC_ORIGIN = 'https://pictures.e2e.invalid';

/**
 * The public store's stub with an address of its own for every file — the stub's is the file
 * itself, the same for every copy of the same bytes — and a token that can be taken away.
 */
class PublicStore extends StubPictureStore {
  available = true;

  get isAvailable(): boolean {
    return this.available;
  }

  async put(path: string, bytes: Uint8Array, contentType: 'image/jpeg'): Promise<StoredPicture> {
    await super.put(path, bytes, contentType);

    return { url: `${PUBLIC_ORIGIN}/${path}` };
  }
}

/** The private store's stub, with a token that can be taken away. */
class PrivateStore extends StubPictureCandidateStore {
  available = true;

  get isAvailable(): boolean {
    return this.available;
  }
}

/**
 * The candidates' service as it is, except for who it says accepted or removed: an id that
 * is no account's. The audit row of that act breaks `audit_logs.actor_id`'s foreign key, so
 * the database refuses it inside the transaction that would have changed the picture's row.
 */
class UnknownActor extends PictureCandidatesService {
  constructor(
    store: PictureCandidateStore,
    published: PictureStore,
    clock: PictureCandidateClock,
    private readonly nobody: string
  ) {
    super(store, published, clock);
  }

  async accept(id: string, _actorId: string, shown: PictureAcceptance): Promise<void> {
    await super.accept(id, this.nobody, shown);
  }

  async remove(id: string, _actorId: string): Promise<{ readonly fileDeleted: boolean }> {
    return super.remove(id, this.nobody);
  }
}

type Dish = { mealId: string; name: string; recipeId: string; slug: string };
type MealDetail = { illustrationPath: string | null; pictureStatus: string; recipeId: string };
type PictureStatus = { status: string; url: string | null };
type StoredCandidate = { extras: { foreignAllergens: string[]; mappedTo: string[] }[]; model: string; path: string; promptVersion: string };
type Provenance = { acceptedBy?: string; candidate?: StoredCandidate; drawings?: PictureJudgedDrawing[]; notes?: string[]; reason?: string };
/** `lastAttemptAt` as ISO text with its milliseconds, whatever the driver makes of a timestamp. */
type Row = {
  attempts: number;
  lastAttemptAt: string;
  model: string | null;
  promptVersion: string | null;
  provenance: Provenance | null;
  status: string;
  url: string | null;
};
type RecipeRow = AdminRecipesView['rows'][number];
/** One row of the trail about a recipe, as the table holds it. */
type Trail = { action: string; actorId: string | null; entity: string; metadata: Record<string, unknown> | null; subjectUserId: string | null };
/** Everything an accept or a remove could write: the row, the trail, the private files with their bytes, and the public store's two lists. */
type State = { audits: number; deleted: number; kept: Record<string, string>; row: Row | undefined; stored: number };
/** What the console shows of a candidate and an acceptance repeats: the flagged allergen keys, and when it expires. */
type Seen = { allergens: string[]; expiresAt: string };
/** A dish holding a candidate: its file's path and bytes, its row, the allergen keys the console shows for it, and the body that accepts it. */
type Held = { bytes: Uint8Array; dish: Dish; keys: string[]; path: string; row: Row; seen: Seen };
type Shelved = { readonly candidate: string; readonly recipeId: string };
type Left = { accounts: number; audits: number; crons: number; images: number };

const DAY = 24 * 60 * 60 * 1000;
const COOL_OFF_DAYS = 7;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PICTURE_ACTIONS = ['picture.accepted', 'picture.removed', 'picture.discarded', 'picture.retried'];
const NO_RECIPE = { code: 'NOT_FOUND', message: 'Recipe not found', statusCode: 404 };

/** What every refused accept, remove or retry answers: a code, one fixed sentence, and nothing of the picture. */
function refusal(reason: string): { code: string; message: string; statusCode: number } {
  return { code: `PICTURE_${reason}`, message: 'No se puede hacer eso con la imagen ahora.', statusCode: 409 };
}

describe('the owner accepts a picture against the judge, and takes it back (0072, phase 3)', () => {
  const cronSecret = randomBytes(24).toString('hex');
  const stamp = Date.now();
  const made: string[] = [];
  const shelved: Shelved[] = [];
  /** Every recipe this suite let a drawing touch: its rows, calls and audit rows are deleted when it ends. */
  const touched = new Set<string>();
  /** The dishes this suite made `ready`, by which door: what the last case checks the table against. */
  const byHand = new Set<string>();
  const byJudge = new Set<string>();
  const images = new ControlledImages();
  const judge = new PrawnsJudge();
  const published = new PublicStore();
  const store = new PrivateStore();
  /** How far ahead of the wall clock the candidates' clock runs, on every application. */
  let aheadMs = 0;
  let app: INestApplication;
  let ghost: INestApplication;
  let capped: INestApplication;
  let owner: Account;
  /** A second admin: the requests refused for what they carry are its, so the owner's thirty accepts an hour are not spent on them. */
  let deputy: Account;
  let ordinary: Account;
  let planner: Account;
  /** The planner's dishes with no picture row when the suite started, none carrying crustaceans; taken one per candidate. */
  let fresh: Dish[] = [];
  let started = '';
  let flagBefore = false;

  const clock: PictureCandidateClock = () => new Date(Date.now() + aheadMs);

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
      .useValue(published)
      .overrideProvider(PictureCandidateStore)
      .useValue(store)
      .overrideProvider(PICTURE_CANDIDATE_CLOCK)
      .useValue(clock);

  const admin = (path: string, cookie?: string, on: INestApplication = app) => {
    const call = request(httpServer(on)).get(`/${PREFIX}/admin/${path}`);

    return cookie === undefined ? call : call.set('Cookie', cookie);
  };

  /** A POST to the console; with no `body` nothing is sent at all. */
  const post = (path: string, cookie?: string, on: INestApplication = app, body?: unknown) => {
    const call = request(httpServer(on)).post(`/${PREFIX}/admin/${path}`);
    const signed = cookie === undefined ? call : call.set('Cookie', cookie);

    return body === undefined ? signed : signed.send(body as object);
  };

  const accept = (id: string, body: unknown, cookie?: string, on: INestApplication = app) =>
    post(`catalogue/recipes/${id}/picture/candidate/accept`, cookie, on, body);

  const remove = (id: string, cookie?: string, on: INestApplication = app) => post(`catalogue/recipes/${id}/picture/remove`, cookie, on);

  const discard = (id: string, cookie?: string) => post(`catalogue/recipes/${id}/picture/candidate/discard`, cookie);

  const retry = (id: string, cookie?: string, on: INestApplication = app) => post(`catalogue/recipes/${id}/picture/retry`, cookie, on);

  const cron = () => request(httpServer(app)).get(`/${PREFIX}/cron/rewrite-steps`).set('Authorization', `Bearer ${cronSecret}`);

  const take = (): Dish => {
    const dish = fresh.shift();

    if (!dish) {
      throw new Error('The planner’s plan has run out of dishes without a picture row');
    }

    touched.add(dish.recipeId);

    return dish;
  };

  /** The planner's own view of a meal that serves the dish: the whole answer. */
  const meal = async (dish: Dish): Promise<MealDetail> => {
    const response: Response = await request(httpServer(app))
      .get(`/${PREFIX}/meal-plans/meals/${dish.mealId}`)
      .set('Cookie', planner.cookie)
      .expect(200);

    return response.body as MealDetail;
  };

  /** What the planner's meal page polls. */
  const status = async (dish: Dish): Promise<PictureStatus> => {
    const response: Response = await request(httpServer(app))
      .get(`/${PREFIX}/recipes/${dish.recipeId}/picture-status`)
      .set('Cookie', planner.cookie)
      .expect(200);

    return response.body as PictureStatus;
  };

  const row = async (recipeId: string): Promise<Row | undefined> =>
    (
      await sql()<Row>`
        select attempts, model, prompt_version as "promptVersion", provenance, status, url,
               to_char(last_attempt_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "lastAttemptAt"
        from recipe_images where recipe_id = ${recipeId}`
    )[0];

  const calls = async (recipeId: string): Promise<string[]> =>
    (await sql()<{ kind: string }>`select kind from recipe_image_calls where recipe_id = ${recipeId} order by created_at`).map(call => call.kind);

  /** What the trail holds about a recipe's picture, oldest first. */
  const trail = (recipeId: string): Promise<Trail[]> =>
    sql()<Trail>`
      select action, actor_id as "actorId", entity, metadata, subject_user_id as "subjectUserId" from audit_logs
      where action = any(${PICTURE_ACTIONS}) and entity_id = ${recipeId}
      order by created_at, id`;

  /** The private files kept for a dish: the paths under its id. */
  const files = (recipeId: string): string[] => [...store.files.keys()].filter(path => path.includes(recipeId));

  /** Every file ever put in the public store for a dish, deleted since or not. */
  const puts = (recipeId: string) => published.stored.filter(put => put.path.includes(recipeId));

  /** The address the public store answered for a path. */
  const address = (path: string): string => `${PUBLIC_ORIGIN}/${path}`;

  /** Of the files put in the public store for a dish, those nothing has deleted. */
  const alive = (recipeId: string) => puts(recipeId).filter(put => !published.deleted.includes(address(put.path)));

  const state = async (dish: Dish): Promise<State> => ({
    audits: await auditCount(),
    deleted: published.deleted.length,
    kept: Object.fromEntries(files(dish.recipeId).map(path => [path, Buffer.from(store.files.get(path) ?? []).toString('base64')])),
    row: await row(dish.recipeId),
    stored: published.stored.length
  });

  /** Waits for a drawing under way to end, one way or another. */
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

  /** A view of the dish's meal claims its picture, and the drawing scheduled after the response ends. */
  const draw = async (dish: Dish): Promise<Row> => {
    expect((await meal(dish)).pictureStatus).toBe('drawing');

    return settled(dish.recipeId);
  };

  const listed = async (dish: Dish): Promise<{ row: RecipeRow | undefined; text: string }> => {
    const response: Response = await admin(`catalogue/recipes?q=${encodeURIComponent(dish.name)}&size=100`, owner.cookie).expect(200);

    return { row: (response.body as AdminRecipesView).rows.find(candidate => candidate.slug === dish.slug), text: JSON.stringify(response.body) };
  };

  /** The candidate a drawing the judge rejected left on a dish, and what the console shows the owner of it. */
  const candidateOf = async (dish: Dish, ended: Row): Promise<Held> => {
    const path = ended.provenance?.candidate?.path ?? '';

    expect(ended).toMatchObject({ attempts: 3, status: 'failed', url: null });
    expect(files(dish.recipeId)).toEqual([path]);

    const candidate = (await listed(dish)).row?.pictureCandidate;
    const keys = [...(candidate?.allergens ?? [])];

    // The premise of every case: something was flagged, in the catalogue's keys, and the file kept is one that may be published.
    expect(keys).toContain('crustaceans');
    // One clock: what the console shows as the candidate's expiry is the end of the cool-off of the drawing that left it.
    expect(candidate?.expiresAt).toBe(new Date(new Date(ended.lastAttemptAt).getTime() + COOL_OFF_DAYS * DAY).toISOString());

    const bytes = Uint8Array.from(store.files.get(path) ?? []);

    expect(pictureMarks(bytes)).toEqual({ c2pa: true, jpeg: true, trainedAlgorithmicMedia: true });

    return { bytes, dish, keys, path, row: ended, seen: { allergens: keys, expiresAt: candidate?.expiresAt ?? '' } };
  };

  /** A dish whose drawing the judge rejected, holding its candidate. */
  const rejected = async (dish: Dish): Promise<Held> => candidateOf(dish, await draw(dish));

  /** One recipe as the review page reads it. */
  const one = async (dish: Dish): Promise<{ text: string; view: AdminRecipeView }> => {
    const response: Response = await admin(`catalogue/recipes/${dish.recipeId}`, owner.cookie).expect(200);

    return { text: JSON.stringify(response.body), view: response.body as AdminRecipeView };
  };

  const pictures = async (): Promise<{ text: string; view: AdminPicturesPeriodView }> => {
    const response: Response = await admin('pictures?period=30', owner.cookie).expect(200);

    return { text: JSON.stringify(response.body), view: response.body as AdminPicturesPeriodView };
  };

  const countOf = (entries: readonly { n: number; reason: string }[], reason: string): number =>
    entries.find(entry => entry.reason === reason)?.n ?? 0;

  /** The newest rows of the trail under one action's filter, as the console reads them. */
  const trailPage = async (action: string): Promise<{ page: Paged<AuditLogView>; text: string }> => {
    const response: Response = await admin(`audit?action=${action}&size=5`, owner.cookie).expect(200);

    return { page: response.body as Paged<AuditLogView>, text: JSON.stringify(response.body) };
  };

  /** The part of a path nobody could guess: the uuid its file is named with, after the prompt version. */
  const randomPart = (path: string): string => path.slice(-'.jpg'.length - 36, -'.jpg'.length);

  const expiry = (lastAttemptAt: string): string => new Date(new Date(lastAttemptAt).getTime() + COOL_OFF_DAYS * DAY).toISOString();

  const databaseNow = async (): Promise<string> => (await sql()<{ now: string }>`select now()::text as now`)[0]?.now ?? '';

  /**
   * No answer says where a candidate was kept, nor repeats the judge's word — and none of the console's
   * carries a published picture's address either: that goes to the people whose plans serve the dish.
   */
  const expectSilent = (answers: Record<string, string>, candidatePath: string, addresses: readonly string[]): void => {
    for (const [answer, text] of Object.entries(answers)) {
      expect({ answer, found: text.includes(candidatePath) }).toEqual({ answer, found: false });
      expect({ answer, found: text.includes(PICTURE_CANDIDATE_FOLDER) }).toEqual({ answer, found: false });
      expect({ answer, found: text.includes(randomPart(candidatePath)) }).toEqual({ answer, found: false });
      expect({ answer, found: text.includes('shrimp') }).toEqual({ answer, found: false });

      for (const url of addresses) {
        expect({ answer, found: text.includes(url) }).toEqual({ answer, found: false });
      }
    }
  };

  /**
   * Of the rows this suite made: the `ready` ones the owner accepted, how many of those have no
   * `picture.accepted` row about their recipe, and every `ready` one by whose hand it says it is.
   */
  const readyRows = async (): Promise<{ ready: { byOwner: boolean; recipeId: string }[]; unaudited: number }> => {
    const ready = await sql()<{ audited: boolean; byOwner: boolean; recipeId: string }>`
      select i.recipe_id::text as "recipeId",
             coalesce(i.provenance ->> 'acceptedBy' = 'owner', false) as "byOwner",
             exists (
               select 1 from audit_logs a
               where a.action = 'picture.accepted' and a.entity = 'recipe' and a.entity_id = i.recipe_id::text) as audited
      from recipe_images i
      where i.status = 'ready' and i.recipe_id::text = any(${[...touched]})
      order by i.recipe_id`;

    return {
      ready: ready.map(({ byOwner, recipeId }) => ({ byOwner, recipeId })),
      unaudited: ready.filter(found => found.byOwner && !found.audited).length
    };
  };

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

    app = await createApp(ai, stubbed);
    ghost = await createApp(ai, builder =>
      stubbed(builder)
        .overrideProvider(PictureCandidatesService)
        .useValue(new UnknownActor(store, published, clock, `e2e-nobody-${String(stamp)}`))
    );
    capped = await createApp(ai, builder => stubbed(builder).overrideProvider(AI_PICTURE_CAP).useValue(0));

    flagBefore = await SettingsController.dishPictures();
    await SettingsController.setFlag('dishPictures', true, UNAUDITED);

    // The candidates the database already held: out of the cleanup's reach for the run, back at the end.
    const held = await sql()<Shelved>`
      select recipe_id::text as "recipeId", (provenance -> 'candidate')::text as candidate from recipe_images
      where provenance -> 'candidate' ->> 'path' is not null`;

    shelved.push(...held);
    await sql()`update recipe_images set provenance = provenance - 'candidate' where recipe_id::text = any(${held.map(found => found.recipeId)})`;

    owner = await register(app, `picture-acceptance-owner-${stamp}@e2e.invalid`);
    await UserController.grantAdmin(owner.email);
    owner = await enableTotp(app, owner);
    made.push(owner.cookie);

    deputy = await register(app, `picture-acceptance-deputy-${stamp}@e2e.invalid`);
    await UserController.grantAdmin(deputy.email);
    deputy = await enableTotp(app, deputy);
    made.push(deputy.cookie);

    ordinary = await register(app, `picture-acceptance-ordinary-${stamp}@e2e.invalid`);
    made.push(ordinary.cookie);

    planner = await register(app, `picture-acceptance-planner-${stamp}@e2e.invalid`);
    made.push(planner.cookie);
    await completeOnboarding(app, planner);
    expect((await generateAndWait(app, planner)).status).toBe('succeeded');

    fresh = await untouchedDishes(planner);
    // Eight are drawn — two candidates the blocks share, the judge's own picture, the judge's picture that is taken back, and one for
    // each of the four cases that make theirs — and one more is only asked about.
    expect(fresh.length).toBeGreaterThanOrEqual(9);
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
      await Promise.all([app?.close(), ghost?.close(), capped?.close()]);
    }

    expect(left).toEqual({ accounts: 0, audits: 0, crons: 0, images: 0 });
  });

  /** Removes every row and every file the run made, and counts what is left of them. */
  async function clean(): Promise<Left | undefined> {
    await deleteAccounts(app, made);

    const recipeIds = [...touched];

    await sql()`delete from recipe_image_calls where recipe_id::text = any(${recipeIds})`;
    await sql()`delete from recipe_images where recipe_id::text = any(${recipeIds})`;
    await sql()`delete from audit_logs where action = any(${PICTURE_ACTIONS}) and entity_id = any(${recipeIds})`;
    await sql()`delete from analytics_events where event = 'cron_run' and created_at >= ${started}`;
    store.files.clear();
    published.stored.length = 0;
    published.deleted.length = 0;

    const [left] = await sql()<Left>`
      select (select count(*)::int from "user" where email like ${`picture-acceptance-%-${String(stamp)}@e2e.invalid`}) as accounts,
             (select count(*)::int from audit_logs where action = any(${PICTURE_ACTIONS}) and entity_id = any(${recipeIds})) as audits,
             (select count(*)::int from analytics_events where event = 'cron_run' and created_at >= ${started}) as crons,
             (select count(*)::int from recipe_images where recipe_id::text = any(${recipeIds})) as images`;

    return left;
  }

  describe('a candidate the owner is refused', () => {
    let waiting: Held | undefined;

    /** The dish every case of this block asks about, and the candidate it holds — made in `beforeAll`, which fails without them. */
    const held = (): Held => {
      if (!waiting) {
        throw new Error('No dish holds a candidate');
      }

      return waiting;
    };

    beforeAll(async () => {
      waiting = await rejected(take());
    }, 60_000);

    it('neither route exists for an ordinary account nor without a session — with the right body, a wrong one or none — and nothing is written', async () => {
      const { dish, seen } = held();
      const before = await state(dish);

      for (const cookie of [ordinary.cookie, undefined]) {
        // What this caller is told by a console route that has always been there: every denial below is that, word for word.
        const denied: unknown = (await admin('pictures', cookie).expect(404)).body;

        for (const id of [dish.recipeId, randomUUID(), 'not-a-uuid']) {
          // The body the owner would send, none, and one the route would refuse as input: the denial comes before any of them is read.
          for (const body of [seen, undefined, { allergens: 'crustaceans', confirmed: true }]) {
            expect((await accept(id, body, cookie).expect(404)).body).toEqual(denied);
          }

          expect((await remove(id, cookie).expect(404)).body).toEqual(denied);
        }
      }

      expect(await state(dish)).toEqual(before);
      expect(puts(dish.recipeId)).toEqual([]);
    });

    it('an accept that does not repeat what the console showed is refused — 422 without both keys, 409 for another candidate’s expiry or another list — and writes nothing', async () => {
      const { dish, keys, seen } = held();
      const before = await state(dish);
      // An allergen of the catalogue the judge did not flag on this picture, and an instant that is not this candidate's expiry.
      const other = ['celery', 'gluten', 'milk'].find(key => !keys.includes(key)) ?? 'celery';
      const later = new Date(new Date(seen.expiresAt).getTime() + 1).toISOString();
      const { expiresAt } = seen;

      expect(later).not.toBe(expiresAt);

      // No body; neither key; one without the other; a list that is not one, or null, or holds an empty key; a key the route does not
      // take; and an expiry that is no instant, or has no zone.
      const malformed: unknown[] = [
        undefined,
        {},
        { allergens: keys },
        { expiresAt },
        { allergens: keys.join(','), expiresAt },
        { allergens: null, expiresAt },
        { allergens: [''], expiresAt },
        { ...seen, confirmed: true },
        { allergens: keys, expiresAt: 'in seven days' },
        { allergens: keys, expiresAt: expiresAt.replace(/Z$/, '') }
      ];

      for (const body of malformed) {
        const response: Response = await accept(dish.recipeId, body, deputy.cookie).expect(422);
        const text = JSON.stringify(response.body);

        expect({ body, code: (response.body as { code?: string }).code }).toEqual({ body, code: 'INVALID_INPUT' });
        // Whatever it says of the request, it says nothing the candidate stores.
        expect(text).not.toContain(expiresAt);

        for (const key of keys) {
          expect(text).not.toContain(key);
        }
      }

      // Another candidate's expiry — a millisecond off is another drawing — is no candidate at all, whatever the list: the
      // expiry is read first, so a page that shows another picture is never told whether its allergens were right.
      for (const allergens of [keys, [other]]) {
        const response: Response = await accept(dish.recipeId, { allergens, expiresAt: later }, deputy.cookie).expect(409);

        expect({ allergens, body: response.body as unknown }).toEqual({ allergens, body: refusal('NO_CANDIDATE') });
      }

      // This candidate's expiry and a list that is not the stored one: fewer keys, one more, another, another case, a trailing space.
      for (const allergens of [keys.slice(1), [...keys, other], [other], keys.map(key => key.toUpperCase()), keys.map(key => `${key} `)]) {
        const response: Response = await accept(dish.recipeId, { allergens, expiresAt }, deputy.cookie).expect(409);

        // The code, the fixed sentence and the status: nothing that says what the stored keys are.
        expect({ allergens, body: response.body as unknown }).toEqual({ allergens, body: refusal('ALLERGENS_MISMATCH') });
      }

      expect(await state(dish)).toEqual(before);
      expect(puts(dish.recipeId)).toEqual([]);
      expect(await trail(dish.recipeId)).toEqual([]);
    });

    it('a file that is not a JPEG carrying its C2PA manifest is never published, whatever the row says it was: 409 PICTURE_NOT_ACCEPTABLE', async () => {
      const { bytes, dish, path, seen } = held();
      const before = await state(dish);
      const swaps: [string, Uint8Array][] = [
        ['a JPEG with no header', BARE_PICTURE],
        ['the candidate with its manifest cut out', withoutManifest(bytes)],
        ['the candidate, no longer a JPEG', notJpeg(bytes)]
      ];

      // The premises: the second still says a model made it and the third still holds every segment — and neither passes.
      expect(pictureMarks(withoutManifest(bytes))).toEqual({ c2pa: false, jpeg: true, trainedAlgorithmicMedia: true });
      expect(pictureMarks(notJpeg(bytes)).jpeg).toBe(false);

      for (const [what, swapped] of swaps) {
        // The file at the stored path is another one: the row, its pointer and the flagged allergens are as the drawing left them.
        store.files.set(path, swapped);

        try {
          const response: Response = await accept(dish.recipeId, seen, owner.cookie).expect(409);

          expect({ body: response.body as unknown, what }).toEqual({ body: refusal('NOT_ACCEPTABLE'), what });
          expect(puts(dish.recipeId)).toEqual([]);
          expect(await row(dish.recipeId)).toEqual(before.row);
          expect(await auditCount()).toBe(before.audits);
          // Refused, and the file is still where it was: nothing deleted it for being wrong.
          expect(files(dish.recipeId)).toEqual([path]);
        } finally {
          store.files.set(path, bytes);
        }
      }

      expect(await state(dish)).toEqual(before);
      expect(await meal(dish)).toMatchObject({ illustrationPath: null, pictureStatus: 'none' });
    });

    it('is refused by the system’s state — the switch off, a store without its token, a row being drawn, a file that is gone, no candidate — and writes nothing', async () => {
      const { bytes, dish, path, seen } = held();
      const before = await state(dish);
      const [without] = fresh;

      expect(without).toBeDefined();

      await SettingsController.setFlag('dishPictures', false, UNAUDITED);

      try {
        expect((await accept(dish.recipeId, seen, owner.cookie).expect(409)).body).toEqual(refusal('FLAG_OFF'));
      } finally {
        await SettingsController.setFlag('dishPictures', true, UNAUDITED);
      }

      // Either store without its token, as a deploy that lacks one: the private one, then the public one.
      for (const holder of [store, published]) {
        holder.available = false;

        try {
          expect((await accept(dish.recipeId, seen, owner.cookie).expect(409)).body).toEqual(refusal('UNAVAILABLE'));
        } finally {
          holder.available = true;
        }
      }

      // The same row being drawn again holds a pointer nobody may accept.
      await sql()`update recipe_images set status = 'drawing' where recipe_id = ${dish.recipeId}`;

      try {
        expect((await accept(dish.recipeId, seen, owner.cookie).expect(409)).body).toEqual(refusal('NO_CANDIDATE'));
      } finally {
        await sql()`update recipe_images set status = 'failed' where recipe_id = ${dish.recipeId}`;
      }

      // The pointer with no file behind it: there is nothing to check, so nothing to publish.
      store.files.delete(path);

      try {
        expect((await accept(dish.recipeId, seen, owner.cookie).expect(409)).body).toEqual(refusal('NO_CANDIDATE'));
      } finally {
        store.files.set(path, bytes);
      }

      // A dish nobody drew has no candidate, and gets no row for having been asked about; an id that is no recipe, or no id, is a 404.
      expect((await accept(without?.recipeId ?? '', seen, owner.cookie).expect(409)).body).toEqual(refusal('NO_CANDIDATE'));
      expect((await remove(without?.recipeId ?? '', owner.cookie).expect(409)).body).toEqual(refusal('NOT_REMOVABLE'));
      expect(await row(without?.recipeId ?? '')).toBeUndefined();

      for (const id of [randomUUID(), 'not-a-uuid']) {
        expect((await accept(id, seen, owner.cookie).expect(404)).body).toEqual(NO_RECIPE);
        expect((await remove(id, owner.cookie).expect(404)).body).toEqual(NO_RECIPE);
      }

      // And a failed picture is not one to remove: only a published one is.
      expect((await remove(dish.recipeId, owner.cookie).expect(409)).body).toEqual(refusal('NOT_REMOVABLE'));

      // An id written in capitals is the recipe it is — found, and refused for what it holds — and one that is no recipe is the same 404.
      const capitals = dish.recipeId.toUpperCase();
      const stale = { ...seen, expiresAt: new Date(new Date(seen.expiresAt).getTime() + 1).toISOString() };

      expect(capitals).not.toBe(dish.recipeId);
      expect((await accept(capitals, stale, owner.cookie).expect(409)).body).toEqual(refusal('NO_CANDIDATE'));
      expect((await remove(capitals, owner.cookie).expect(409)).body).toEqual(refusal('NOT_REMOVABLE'));
      expect((await accept(randomUUID().toUpperCase(), seen, owner.cookie).expect(404)).body).toEqual(NO_RECIPE);

      expect(await state(dish)).toEqual(before);
      expect(puts(dish.recipeId)).toEqual([]);
    });

    it('an audit row the database refuses leaves the picture unpublished: a 500, the row still failed with its candidate, and the public file deleted', async () => {
      const { dish, keys, path, seen } = held();
      const before = await state(dish);
      const drawn = images.calls;
      // The whole of step 5 against the real database: the guarded UPDATE, the insert it refuses, the rollback, and the read-back under the row's lock.
      const response: Response = await accept(dish.recipeId, seen, owner.cookie, ghost).expect(500);

      expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'Algo ha ido mal. Inténtalo de nuevo.', statusCode: 500 });

      // It got as far as the transaction: the file was put in the public store at step 4 — and deleted when step 5 rolled back.
      const written = puts(dish.recipeId);

      expect(written).toHaveLength(1);
      expect(published.deleted.slice(before.deleted)).toEqual([address(written[0]?.path ?? '')]);
      expect(alive(dish.recipeId)).toEqual([]);

      // Neither half of the transaction is there: no `ready` row, no audit row — of any action, about anything.
      expect(await row(dish.recipeId)).toEqual(before.row);
      expect(await auditCount()).toBe(before.audits);
      expect(await trail(dish.recipeId)).toEqual([]);
      // The candidate still waits, file and pointer, and is still what the console shows.
      expect((await state(dish)).kept).toEqual(before.kept);
      expect(files(dish.recipeId)).toEqual([path]);

      const shown = (await listed(dish)).row;

      expect(shown).toMatchObject({ picture: 'failed', pictureAcceptedByHand: false });
      expect(shown?.pictureCandidate).toMatchObject(seen);
      expect(seen.allergens).toEqual(keys);

      // The review page too: a candidate, and no address — a file that waits privately has none, and its path is never put there.
      const alone = await one(dish);

      expect(alone.view).toMatchObject({ picture: 'failed', pictureAcceptedByHand: false, pictureUrl: null });
      expect(alone.view.pictureCandidate).toMatchObject(seen);
      expectSilent({ recipe: alone.text }, path, [address(written[0]?.path ?? '')]);
      // And nobody is shown a picture.
      expect(await meal(dish)).toMatchObject({ illustrationPath: null, pictureStatus: 'none' });
      expect(await status(dish)).toEqual({ status: 'none', url: null });
      expect(images.calls).toBe(drawn);
    });

    it('the month’s cap does not hold an accept: where a retry is refused for it, the same request by the session’s own account publishes', async () => {
      const { bytes, dish, keys, seen } = held();
      const before = await state(dish);
      const had = puts(dish.recipeId).length;

      // The cap is real on this application: the retry of this very dish is refused for it, and claims nothing.
      expect((await retry(dish.recipeId, owner.cookie, capped).expect(409)).body).toEqual(refusal('CAP_REACHED'));
      expect(await state(dish)).toEqual(before);

      // The request `ghost` failed, word for word: what differed there was who the audit row named.
      expect((await accept(dish.recipeId, seen, owner.cookie, capped).expect(200)).body).toEqual({ status: 'ready' });
      byHand.add(dish.recipeId);

      const written = puts(dish.recipeId);
      const [kept] = alive(dish.recipeId);

      expect(written).toHaveLength(had + 1);
      expect(alive(dish.recipeId)).toHaveLength(1);
      expect(Buffer.from(kept?.bytes ?? []).equals(Buffer.from(bytes))).toBe(true);
      expect(await row(dish.recipeId)).toMatchObject({ status: 'ready', url: address(kept?.path ?? '') });
      expect(files(dish.recipeId)).toEqual([]);
      expect(await trail(dish.recipeId)).toEqual([
        { action: 'picture.accepted', actorId: owner.id, entity: 'recipe', metadata: { allergens: keys }, subjectUserId: null }
      ]);
      expect(await auditCount()).toBe(before.audits + 1);
    });
  });

  describe('an acceptance', () => {
    let waiting: Held | undefined;
    let judged: Dish | undefined;
    /** What the accept answered, for the case that scans every answer. */
    let answered = '';

    const held = (): Held => {
      if (!waiting) {
        throw new Error('No dish holds a candidate');
      }

      return waiting;
    };

    /** A dish whose picture the judge accepted: what the owner's acceptance is read beside. */
    const byTheJudge = (): Dish => {
      if (!judged) {
        throw new Error('No dish has a picture the judge accepted');
      }

      return judged;
    };

    /** The address of the one picture a dish has in the public store. */
    const pictureOf = (dish: Dish): string => address(alive(dish.recipeId)[0]?.path ?? '');

    beforeAll(async () => {
      const dish = take();

      judge.prawns = false;

      try {
        expect((await draw(dish)).status).toBe('ready');
      } finally {
        judge.prawns = true;
      }

      judged = dish;
      byJudge.add(dish.recipeId);
      waiting = await rejected(take());
    }, 60_000);

    it('publishes the candidate byte for byte under its own prompt version, makes the row ready with what was overridden, writes one picture.accepted and deletes the private file', async () => {
      const { bytes, dish, keys, path, row: failed, seen } = held();
      const before = await state(dish);
      const counts = (await pictures()).view;
      const accepted = await auditCount('picture.accepted');
      const paid = await calls(dish.recipeId);
      const [drawn, judgings] = [images.calls, judge.calls];
      const response: Response = await accept(dish.recipeId, seen, owner.cookie).expect(200);

      answered = JSON.stringify(response.body);
      expect(response.body).toEqual({ status: 'ready' });
      byHand.add(dish.recipeId);

      // One file in the public store: the candidate's very bytes, at the usual path, with the version it was drawn from.
      const written = puts(dish.recipeId);
      const version = (failed.provenance?.candidate?.promptVersion ?? '').replace(/\./g, '\\.');

      expect(version).not.toBe('');
      expect(written).toHaveLength(1);
      expect(written[0]?.path).toMatch(new RegExp(`^dish-pictures/${dish.recipeId}/${version}-${UUID}\\.jpg$`));
      expect(Buffer.from(written[0]?.bytes ?? []).equals(Buffer.from(bytes))).toBe(true);
      // Those bytes and no other drawing's: every drawing of this run is a different file, and one put holds these.
      expect(bytes.length).toBeGreaterThan(0);
      expect(published.stored.filter(put => Buffer.from(put.bytes).equals(Buffer.from(bytes)))).toHaveLength(1);
      // A name of its own: the public file's says nothing of where the private one was.
      expect(written[0]?.path).not.toContain(randomPart(path));
      expect(published.deleted.slice(before.deleted)).toEqual([]);
      // The private file is gone, and so is its pointer.
      expect(files(dish.recipeId)).toEqual([]);

      // The row: ready at that address, with who let it through and which allergens were overridden — and no path.
      const after = await row(dish.recipeId);

      expect(after).toMatchObject({
        attempts: failed.attempts,
        lastAttemptAt: failed.lastAttemptAt,
        model: failed.provenance?.candidate?.model,
        promptVersion: failed.provenance?.candidate?.promptVersion,
        status: 'ready',
        url: address(written[0]?.path ?? '')
      });
      // What the judge said is kept beside it (project 010): the rejections' notes and its three judged attempts, as the failed row held them.
      expect(failed.provenance?.drawings).toHaveLength(1);
      expect(failed.provenance?.drawings?.[0]?.attempts).toHaveLength(3);
      expect(after?.provenance).toEqual({
        acceptedBy: 'owner',
        c2pa: true,
        drawings: failed.provenance?.drawings,
        notes: failed.provenance?.notes,
        overriddenAllergens: keys,
        trainedAlgorithmicMedia: true
      });

      // No model was asked anything, and nothing was paid.
      expect([images.calls, judge.calls]).toEqual([drawn, judgings]);
      expect(await calls(dish.recipeId)).toEqual(paid);

      // Exactly one row, about this recipe, by the owner, about nobody, carrying the allergen keys and nothing else.
      expect(await auditCount()).toBe(before.audits + 1);
      expect(await trail(dish.recipeId)).toEqual([
        { action: 'picture.accepted', actorId: owner.id, entity: 'recipe', metadata: { allergens: keys }, subjectUserId: null }
      ]);

      const { page } = await trailPage('picture.accepted');

      expect(page.total).toBe(accepted + 1);
      expect(page.rows[0]).toEqual({
        action: 'picture.accepted',
        actor: owner.email,
        at: expect.any(String),
        detail: { allergens: keys },
        subject: null
      });

      // The console: accepted by hand, nothing left to review — and the judge's own picture is not.
      expect((await listed(dish)).row).toMatchObject({
        picture: 'ready',
        pictureAcceptedByHand: true,
        pictureCandidate: null,
        pictureReason: null,
        retryableAt: null
      });
      expect((await listed(byTheJudge())).row).toMatchObject({ picture: 'ready', pictureAcceptedByHand: false, pictureCandidate: null });

      const now = (await pictures()).view;

      expect({ acceptedByHand: now.acceptedByHand, drawing: now.drawing, failed: now.failed, ready: now.ready, spentUsd: now.spentUsd }).toEqual({
        acceptedByHand: counts.acceptedByHand + 1,
        drawing: counts.drawing,
        failed: counts.failed - 1,
        ready: counts.ready + 1,
        spentUsd: counts.spentUsd
      });

      // Every `ready` row of this run that says the owner accepted it has its audit row.
      const rows = await readyRows();

      expect(rows.ready).toContainEqual({ byOwner: true, recipeId: dish.recipeId });
      expect(rows.unaudited).toBe(0);
    });

    it('reaches a person exactly as a picture the judge accepted does: ready, its address, and nothing about who accepted it', async () => {
      const { dish, path } = held();
      const drawn = images.calls;
      const [mine, theirs] = [await meal(dish), await meal(byTheJudge())];
      const polled = await status(dish);

      // The same answer, key for key, as for the dish the judge let through.
      expect(Object.keys(mine).sort()).toEqual(Object.keys(theirs).sort());
      expect(mine).toMatchObject({ illustrationPath: pictureOf(dish), pictureStatus: 'ready', recipeId: dish.recipeId });
      expect(theirs).toMatchObject({ illustrationPath: pictureOf(byTheJudge()), pictureStatus: 'ready' });
      expect(polled).toEqual({ status: 'ready', url: pictureOf(dish) });
      expect(await status(byTheJudge())).toEqual({ status: 'ready', url: pictureOf(byTheJudge()) });

      for (const text of [JSON.stringify(mine), JSON.stringify(polled)]) {
        expect(text).not.toContain('acceptedBy');
        expect(text).not.toContain('AcceptedByHand');
        expect(text).not.toContain('overriddenAllergens');
        expect(text).not.toContain(PICTURE_CANDIDATE_FOLDER);
        expect(text).not.toContain(randomPart(path));
      }

      // Looking at it draws nothing.
      expect(images.calls).toBe(drawn);
    });

    it('a second accept, and an accept of a picture the judge accepted, are 409 PICTURE_NO_CANDIDATE: still one audit row and one public file', async () => {
      const { dish, seen } = held();
      const before = await state(dish);
      const other = await state(byTheJudge());

      expect((await accept(dish.recipeId, seen, owner.cookie).expect(409)).body).toEqual(refusal('NO_CANDIDATE'));
      expect((await accept(byTheJudge().recipeId, seen, owner.cookie).expect(409)).body).toEqual(refusal('NO_CANDIDATE'));

      expect(await state(dish)).toEqual(before);
      expect(await state(byTheJudge())).toEqual(other);
      expect((await trail(dish.recipeId)).map(written => written.action)).toEqual(['picture.accepted']);
      expect(puts(dish.recipeId)).toHaveLength(1);
      expect(await trail(byTheJudge().recipeId)).toEqual([]);
    });

    it('the console lists it among the pictures accepted by hand and the judge’s among the ready ones alone, and only the review page carries an address: the one a person is given', async () => {
      const { dish, path } = held();
      const theirs = byTheJudge();
      const addresses = [pictureOf(dish), pictureOf(theirs)];

      const page = async (picture: string, of: Dish): Promise<{ rows: AdminRecipesView['rows']; text: string }> => {
        const response: Response = await admin(`catalogue/recipes?picture=${picture}&q=${encodeURIComponent(of.name)}&size=100`, owner.cookie).expect(
          200
        );

        return { rows: (response.body as AdminRecipesView).rows, text: JSON.stringify(response.body) };
      };

      const [ready, accepted] = [await page('ready', dish), await page('accepted_by_hand', dish)];

      // `accepted_by_hand` lists the dish the owner accepted and not the one the judge did; `ready` lists both.
      expect(accepted.rows.map(found => found.slug)).toContain(dish.slug);
      expect(accepted.rows.every(found => found.picture === 'ready' && found.pictureAcceptedByHand)).toBe(true);
      expect((await page('accepted_by_hand', theirs)).rows.map(found => found.slug)).not.toContain(theirs.slug);
      expect(ready.rows.find(found => found.slug === dish.slug)?.pictureAcceptedByHand).toBe(true);
      expect((await page('ready', theirs)).rows.find(found => found.slug === theirs.slug)?.pictureAcceptedByHand).toBe(false);
      await admin('catalogue/recipes?picture=by_hand', owner.cookie).expect(422);

      // The review page: the address the planner's app is given for the same dish, whoever accepted the picture.
      const [alone, judged] = [await one(dish), await one(theirs)];

      expect(alone.view).toMatchObject({ pictureAcceptedByHand: true, pictureCandidate: null, pictureUrl: pictureOf(dish) });
      expect(alone.view.pictureUrl).toBe((await status(dish)).url);
      expect(judged.view).toMatchObject({ pictureAcceptedByHand: false, pictureCandidate: null, pictureUrl: pictureOf(theirs) });
      expect(judged.view.pictureUrl).toBe((await status(theirs)).url);
      expect(answered).not.toBe('');

      // No answer says where the candidate was or repeats the judge's word, and none but the review page carries an address.
      expectSilent(
        {
          accept: answered,
          list: (await listed(dish)).text,
          listByHand: accepted.text,
          listReady: ready.text,
          pictures: (await pictures()).text,
          trail: (await trailPage('picture.accepted')).text
        },
        path,
        addresses
      );
      // And the review page carries its own dish's, not another's.
      expectSilent({ recipe: alone.text }, path, [pictureOf(theirs)]);

      // The address is a person's to read: the planner's meal carries it, as it carries the judge's.
      expect(JSON.stringify(await meal(dish))).toContain(pictureOf(dish));
    });

    // Rewritten on purpose (project 010 phase 4): until then this case also pinned that the owner's removal of the judge's picture was a 409.
    it('nobody but the owner can remove a picture — neither the one the owner accepted nor the judge’s: nothing is written', async () => {
      const { dish } = held();
      const mine = await state(dish);
      const theirs = await state(byTheJudge());

      // Either published picture is not there to remove for an ordinary account, nor without a session.
      for (const cookie of [ordinary.cookie, undefined]) {
        const denied: unknown = (await admin('pictures', cookie).expect(404)).body;

        for (const id of [dish.recipeId, byTheJudge().recipeId]) {
          expect((await remove(id, cookie).expect(404)).body).toEqual(denied);
        }
      }

      expect(await state(dish)).toEqual(mine);
      expect(await state(byTheJudge())).toEqual(theirs);
      expect(await trail(byTheJudge().recipeId)).toEqual([]);
      expect(await status(dish)).toEqual({ status: 'ready', url: pictureOf(dish) });
      expect(await status(byTheJudge())).toEqual({ status: 'ready', url: pictureOf(byTheJudge()) });
    });

    it('a removal whose audit row the database refuses removes nothing: a 500, the picture still ready at its address, and its file not deleted', async () => {
      const { dish } = held();
      const before = await state(dish);
      const url = pictureOf(dish);
      const response: Response = await remove(dish.recipeId, owner.cookie, ghost).expect(500);

      expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'Algo ha ido mal. Inténtalo de nuevo.', statusCode: 500 });
      // The row went back with the audit row that was refused, and the file is deleted only after a removal that committed.
      expect(await state(dish)).toEqual(before);
      expect(before.row).toMatchObject({ status: 'ready', url });
      expect(alive(dish.recipeId)).toHaveLength(1);
      expect((await trail(dish.recipeId)).map(written => written.action)).toEqual(['picture.accepted']);
      expect(await status(dish)).toEqual({ status: 'ready', url });
    });

    it('removing it — with the switch off — fails the dish as owner_removed from now, writes one picture.removed and deletes the public file; a second is 409', async () => {
      const { dish, keys, path } = held();
      const before = await state(dish);
      const counts = (await pictures()).view;
      const url = pictureOf(dish);
      const drawn = images.calls;
      let response: Response | undefined;

      expect(before.row).toMatchObject({ status: 'ready', url });

      // Taking a picture back is always possible: it needs neither the switch nor the cap.
      await SettingsController.setFlag('dishPictures', false, UNAUDITED);

      const from = Date.now();

      try {
        response = await remove(dish.recipeId, owner.cookie).expect(200);
      } finally {
        await SettingsController.setFlag('dishPictures', true, UNAUDITED);
      }

      const until = Date.now();

      expect(response.body).toEqual({ fileDeleted: true, status: 'removed' });

      // The row: failed for the owner's own reason and nothing else, no address, and its cool-off counted from the removal.
      const after = await row(dish.recipeId);
      const removedAt = new Date(after?.lastAttemptAt ?? '').getTime();

      expect(after).toMatchObject({ attempts: before.row?.attempts, status: 'failed', url: null });
      // And what the judge said on the drawing the owner had overruled: the picture taken back is what a refinement reads (project 010).
      expect(before.row?.provenance?.drawings).toHaveLength(1);
      expect(after?.provenance).toEqual({ drawings: before.row?.provenance?.drawings, reason: 'owner_removed' });
      expect(removedAt).toBeGreaterThanOrEqual(from);
      expect(removedAt).toBeLessThanOrEqual(until);
      // The public file, by the address the row held — and that one alone — and nothing put anywhere.
      expect(published.deleted.slice(before.deleted)).toEqual([url]);
      expect(published.stored).toHaveLength(before.stored);
      expect(alive(dish.recipeId)).toEqual([]);

      // Exactly one row more, beside the acceptance it undoes — saying, in its closed word and nothing else, that the owner had let it through.
      expect(await auditCount()).toBe(before.audits + 1);
      expect(await trail(dish.recipeId)).toEqual([
        { action: 'picture.accepted', actorId: owner.id, entity: 'recipe', metadata: { allergens: keys }, subjectUserId: null },
        { action: 'picture.removed', actorId: owner.id, entity: 'recipe', metadata: { acceptedBy: 'owner' }, subjectUserId: null }
      ]);

      const removed = await trailPage('picture.removed');

      expect(removed.page.rows[0]).toEqual({
        action: 'picture.removed',
        actor: owner.email,
        at: expect.any(String),
        detail: { acceptedBy: 'owner' },
        subject: null
      });

      // The console: a failed dish with a closed reason, waiting out a whole cool-off from the removal.
      const shown = await listed(dish);

      expect(shown.row).toMatchObject({
        picture: 'failed',
        pictureAcceptedByHand: false,
        pictureCandidate: null,
        pictureReason: 'owner_removed',
        retryableAt: expiry(after?.lastAttemptAt ?? '')
      });

      const now = await pictures();

      expect({ acceptedByHand: now.view.acceptedByHand, failed: now.view.failed, ready: now.view.ready }).toEqual({
        acceptedByHand: counts.acceptedByHand - 1,
        failed: counts.failed + 1,
        ready: counts.ready - 1
      });
      expect(countOf(now.view.failedByReason, 'owner_removed')).toBe(countOf(counts.failedByReason, 'owner_removed') + 1);

      // Gone from the pictures accepted by hand, and the review page has no address to show.
      const alone = await one(dish);
      const listedByHand: Response = await admin(
        `catalogue/recipes?picture=accepted_by_hand&q=${encodeURIComponent(dish.name)}&size=100`,
        owner.cookie
      ).expect(200);

      expect((listedByHand.body as AdminRecipesView).rows.map(found => found.slug)).not.toContain(dish.slug);
      expect(alone.view).toMatchObject({ picture: 'failed', pictureAcceptedByHand: false, pictureCandidate: null, pictureUrl: null });

      expectSilent({ list: shown.text, pictures: now.text, recipe: alone.text, remove: JSON.stringify(response.body), trail: removed.text }, path, [
        url
      ]);

      // Nobody is shown the picture any more, and a view does not draw the dish again inside its cool-off.
      expect(await meal(dish)).toMatchObject({ illustrationPath: null, pictureStatus: 'none' });
      expect(await status(dish)).toEqual({ status: 'none', url: null });
      expect(images.calls).toBe(drawn);
      expect(await row(dish.recipeId)).toEqual(after);

      // Removed once: a second finds nothing published, and writes nothing.
      const again = await state(dish);

      expect((await remove(dish.recipeId, owner.cookie).expect(409)).body).toEqual(refusal('NOT_REMOVABLE'));
      expect(await state(dish)).toEqual(again);
    });

    // Rewritten on purpose (project 010 phase 4): until then its last step pinned that the judge's picture that followed was a 409.
    it('the owner’s retry draws the removed dish again — one picture.retried — and the judge’s picture that follows is removed as the judge’s, whatever the dish’s history', async () => {
      const { dish } = held();
      const drawn = images.calls;
      let ended: Row | undefined;

      judge.prawns = false;

      try {
        expect((await retry(dish.recipeId, owner.cookie).expect(202)).body).toEqual({ status: 'drawing' });

        ended = await settled(dish.recipeId);
      } finally {
        judge.prawns = true;
      }

      // Through the first door this time: the judge's, and the row says nothing of the owner.
      expect(ended.status).toBe('ready');
      expect(ended.provenance?.acceptedBy).toBeUndefined();
      byHand.delete(dish.recipeId);
      expect(images.calls).toBe(drawn + 1);
      expect((await trail(dish.recipeId)).map(written => written.action)).toEqual(['picture.accepted', 'picture.removed', 'picture.retried']);
      expect((await listed(dish)).row).toMatchObject({ picture: 'ready', pictureAcceptedByHand: false });

      // That it was once accepted by hand is history: what is there now is the judge's, and the removal says so.
      const before = await state(dish);
      const [url] = alive(dish.recipeId).map(put => address(put.path));

      expect(url).toBeDefined();
      expect(before.row).toMatchObject({ status: 'ready', url });
      expect((await remove(dish.recipeId, owner.cookie).expect(200)).body).toEqual({ fileDeleted: true, status: 'removed' });

      const after = await row(dish.recipeId);

      expect(after).toMatchObject({ attempts: ended.attempts, status: 'failed', url: null });
      expect(after?.provenance).toEqual({ drawings: ended.provenance?.drawings, reason: 'owner_removed' });
      expect(published.deleted.slice(before.deleted)).toEqual([url]);
      expect(published.stored).toHaveLength(before.stored);
      expect(alive(dish.recipeId)).toEqual([]);
      expect(await auditCount()).toBe(before.audits + 1);

      const written = await trail(dish.recipeId);

      expect(written.map(found => found.action)).toEqual(['picture.accepted', 'picture.removed', 'picture.retried', 'picture.removed']);
      // The first removal took back the owner's acceptance, this one the judge's: the word is the picture's, read when it is removed.
      expect(written.filter(found => found.action === 'picture.removed').map(found => found.metadata)).toEqual([
        { acceptedBy: 'owner' },
        { acceptedBy: 'judge' }
      ]);
      expect(await status(dish)).toEqual({ status: 'none', url: null });
    }, 60_000);

    it('a picture the judge accepted is taken back too — with the switch off and the cap spent — failed as owner_removed from now, its file deleted, one picture.removed saying judge and nothing the judge wrote', async () => {
      const dish = take();
      const garnish = `zqxgarnish${String(stamp)}`;
      let ended: Row | undefined;

      judge.prawns = false;
      judge.garnish = garnish;

      try {
        ended = await draw(dish);
      } finally {
        judge.prawns = true;
        judge.garnish = null;
      }

      // The premises: the judge let it through, the owner had no hand in it, and what the judge wrote — a food of its own naming — is in its row.
      expect(ended).toMatchObject({ status: 'ready' });
      expect(ended.provenance?.acceptedBy).toBeUndefined();
      expect(ended.provenance?.drawings).toHaveLength(1);
      expect(JSON.stringify(ended.provenance)).toContain(garnish);
      expect(await trail(dish.recipeId)).toEqual([]);
      expect((await listed(dish)).row).toMatchObject({ picture: 'ready', pictureAcceptedByHand: false });

      const [url] = alive(dish.recipeId).map(put => address(put.path));

      expect(url).toBeDefined();
      expect(ended.url).toBe(url);

      // Its last drawing a week and a day ago: were the removal not to count a cool-off from now, a view would draw the dish again at once.
      await sql()`update recipe_images set last_attempt_at = now() - interval '8 days' where recipe_id = ${dish.recipeId}`;

      // A removal whose audit row the database refuses removes nothing, the judge's picture as the owner's.
      const refused = await state(dish);

      expect((await remove(dish.recipeId, owner.cookie, ghost).expect(500)).body).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Algo ha ido mal. Inténtalo de nuevo.',
        statusCode: 500
      });
      expect(await state(dish)).toEqual(refused);
      expect(await status(dish)).toEqual({ status: 'ready', url });

      const before = await state(dish);
      const counts = (await pictures()).view;
      const drawn = images.calls;
      let response: Response | undefined;

      // Taking a picture back is always possible: on the application whose month's cap is zero, with the switch off.
      await SettingsController.setFlag('dishPictures', false, UNAUDITED);

      const from = Date.now();

      try {
        response = await remove(dish.recipeId, owner.cookie, capped).expect(200);
      } finally {
        await SettingsController.setFlag('dishPictures', true, UNAUDITED);
      }

      const until = Date.now();

      expect(response.body).toEqual({ fileDeleted: true, status: 'removed' });

      // The row: failed for the owner's own reason, no address, the judged drawing kept, and its cool-off counted from the removal.
      const after = await row(dish.recipeId);
      const removedAt = new Date(after?.lastAttemptAt ?? '').getTime();

      expect(after).toMatchObject({ attempts: ended.attempts, status: 'failed', url: null });
      expect(after?.provenance).toEqual({ drawings: ended.provenance?.drawings, reason: 'owner_removed' });
      expect(removedAt).toBeGreaterThanOrEqual(from);
      expect(removedAt).toBeLessThanOrEqual(until);

      // The public file, by the address the row held, and that one alone; nothing is put anywhere, and no model is asked.
      expect(published.deleted.slice(before.deleted)).toEqual([url]);
      expect(published.stored).toHaveLength(before.stored);
      expect(alive(dish.recipeId)).toEqual([]);
      expect(images.calls).toBe(drawn);

      // Exactly one audit row: by the owner, about the recipe, about nobody, and its metadata the closed word alone.
      expect(await auditCount()).toBe(before.audits + 1);
      expect(await trail(dish.recipeId)).toEqual([
        { action: 'picture.removed', actorId: owner.id, entity: 'recipe', metadata: { acceptedBy: 'judge' }, subjectUserId: null }
      ]);

      const removed = await trailPage('picture.removed');

      expect(removed.page.rows[0]).toEqual({
        action: 'picture.removed',
        actor: owner.email,
        at: expect.any(String),
        detail: { acceptedBy: 'judge' },
        subject: null
      });

      // The console: a failed dish with the closed reason, waiting out a whole cool-off; one fewer ready, none fewer accepted by hand.
      const shown = await listed(dish);

      expect(shown.row).toMatchObject({
        picture: 'failed',
        pictureAcceptedByHand: false,
        pictureCandidate: null,
        pictureReason: 'owner_removed',
        retryableAt: expiry(after?.lastAttemptAt ?? '')
      });

      const now = await pictures();

      expect({ acceptedByHand: now.view.acceptedByHand, failed: now.view.failed, ready: now.view.ready }).toEqual({
        acceptedByHand: counts.acceptedByHand,
        failed: counts.failed + 1,
        ready: counts.ready - 1
      });
      expect(countOf(now.view.failedByReason, 'owner_removed')).toBe(countOf(counts.failedByReason, 'owner_removed') + 1);

      const alone = await one(dish);

      expect(alone.view).toMatchObject({ picture: 'failed', pictureAcceptedByHand: false, pictureCandidate: null, pictureUrl: null });

      // No answer — the removal, the trail, the list, the counts, the review page — carries the address, a path, or the judge's words.
      const answers = {
        list: shown.text,
        pictures: now.text,
        recipe: alone.text,
        remove: JSON.stringify(response.body),
        trail: removed.text,
        written: JSON.stringify(await trail(dish.recipeId))
      };

      for (const [answer, text] of Object.entries(answers)) {
        for (const word of [url ?? '', 'dish-pictures/', garnish]) {
          expect({ answer, found: text.includes(word), word }).toEqual({ answer, found: false, word });
        }
      }

      // Nobody is shown the picture any more, and a view inside the cool-off does not draw the dish again.
      expect(await meal(dish)).toMatchObject({ illustrationPath: null, pictureStatus: 'none' });
      expect(await status(dish)).toEqual({ status: 'none', url: null });
      expect(images.calls).toBe(drawn);
      expect(await row(dish.recipeId)).toEqual(after);

      // Removed once: a second is refused, and writes nothing.
      const again = await state(dish);

      expect((await remove(dish.recipeId, owner.cookie).expect(409)).body).toEqual(refusal('NOT_REMOVABLE'));
      expect(await state(dish)).toEqual(again);
    }, 60_000);
  });

  describe('nothing else publishes a candidate', () => {
    it('not a view, not the cron: past its seven days it cannot be accepted either, and the cleanup deletes it unpublished', async () => {
      const { dish, path, seen } = await rejected(take());
      const audits = await auditCount();
      const drawn = images.calls;

      // A view of the dish, and tonight's cron: the candidate waits, and nobody is shown it.
      expect(await meal(dish)).toMatchObject({ illustrationPath: null, pictureStatus: 'none' });
      await cron().expect(200);
      expect(files(dish.recipeId)).toEqual([path]);
      expect((await row(dish.recipeId))?.status).toBe('failed');

      // Eight days later, before any cron: expired, still on disk, and not acceptable.
      aheadMs = 8 * DAY;

      try {
        const expired = await state(dish);

        expect((await accept(dish.recipeId, seen, owner.cookie).expect(409)).body).toEqual(refusal('NO_CANDIDATE'));
        expect(await state(dish)).toEqual(expired);
        expect(files(dish.recipeId)).toEqual([path]);

        // The cron of that night deletes the file and the pointer.
        await cron().expect(200);
      } finally {
        aheadMs = 0;
      }

      expect(files(dish.recipeId)).toEqual([]);

      const cleaned = await row(dish.recipeId);

      expect(cleaned).toMatchObject({ status: 'failed', url: null });
      expect(cleaned?.provenance?.candidate).toBeUndefined();
      // Nothing of it was ever put in the public store, no model was asked again, and the trail has nothing to say.
      expect(puts(dish.recipeId)).toEqual([]);
      expect(images.calls).toBe(drawn);
      expect(await auditCount()).toBe(audits);
      expect(await trail(dish.recipeId)).toEqual([]);
      expect((await listed(dish)).row).toMatchObject({ picture: 'failed', pictureAcceptedByHand: false, pictureCandidate: null });
    }, 60_000);

    it('not a discard, not a retry: an accept after a discard finds nothing, and a dish drawn again and rejected again is failed, with a candidate of its own', async () => {
      const { dish, path, seen } = await rejected(take());

      expect((await discard(dish.recipeId, owner.cookie).expect(200)).body).toEqual({ status: 'discarded' });

      const discarded = await state(dish);

      expect((await accept(dish.recipeId, seen, owner.cookie).expect(409)).body).toEqual(refusal('NO_CANDIDATE'));
      expect(await state(dish)).toEqual(discarded);
      expect(puts(dish.recipeId)).toEqual([]);

      // The retry: three more pictures, three more rejections.
      expect((await retry(dish.recipeId, owner.cookie).expect(202)).body).toEqual({ status: 'drawing' });

      const ended = await settled(dish.recipeId);
      const again = ended.provenance?.candidate?.path ?? '';

      expect(ended).toMatchObject({ attempts: 3, status: 'failed', url: null });
      expect(again).not.toBe('');
      expect(again).not.toBe(path);
      expect(files(dish.recipeId)).toEqual([again]);
      expect(puts(dish.recipeId)).toEqual([]);
      expect((await trail(dish.recipeId)).map(written => written.action)).toEqual(['picture.discarded', 'picture.retried']);
      expect((await listed(dish)).row).toMatchObject({ picture: 'failed', pictureAcceptedByHand: false });
      expect(await meal(dish)).toMatchObject({ illustrationPath: null, pictureStatus: 'none' });
    }, 60_000);

    it('a page that shows an older candidate accepts nothing: after a retry left another with the same allergens, only that one’s expiry accepts it — once, of two accepts together — and of two removals together one removes it', async () => {
      const first = await rejected(take());
      const { dish } = first;

      // The review page is open on the first candidate. Meanwhile a retry draws the dish again, and the judge rejects it again.
      expect((await retry(dish.recipeId, owner.cookie).expect(202)).body).toEqual({ status: 'drawing' });

      const second = await candidateOf(dish, await settled(dish.recipeId));

      // The premise: another file from another drawing, flagged for the very same allergens — all that tells the two apart is when they expire.
      expect(second.path).not.toBe(first.path);
      expect(Buffer.from(second.bytes).equals(Buffer.from(first.bytes))).toBe(false);
      expect(second.seen.allergens).toEqual(first.seen.allergens);
      expect(new Date(second.seen.expiresAt).getTime()).toBeGreaterThan(new Date(first.seen.expiresAt).getTime());

      // What the open page sends: refused, and the picture nobody looked at stays where it is.
      const before = await state(dish);

      expect((await accept(dish.recipeId, first.seen, owner.cookie).expect(409)).body).toEqual(refusal('NO_CANDIDATE'));
      expect(await state(dish)).toEqual(before);
      expect(puts(dish.recipeId)).toEqual([]);
      expect(files(dish.recipeId)).toEqual([second.path]);

      // The page read again, accepted from two tabs at once — the recipe's id in capitals in both, so whichever wins
      // publishes under it, and in one the same instant written with another zone's spelling. Both name this candidate; one publishes it.
      const capitals = dish.recipeId.toUpperCase();
      const zoned = { ...second.seen, expiresAt: second.seen.expiresAt.replace(/Z$/, '+00:00') };

      expect(capitals).not.toBe(dish.recipeId);
      expect(zoned.expiresAt).not.toBe(second.seen.expiresAt);

      const accepts: Response[] = await Promise.all([accept(capitals, zoned, owner.cookie), accept(capitals, second.seen, owner.cookie)]);

      expect(accepts.map(response => response.status).sort()).toEqual([200, 409]);
      expect(accepts.find(response => response.status === 409)?.body).toEqual(refusal('NO_CANDIDATE'));
      expect(accepts.find(response => response.status === 200)?.body).toEqual({ status: 'ready' });

      // One file left in the public store — whatever the other tab put there is deleted — under the recipe's id as the table
      // spells it, and one row in the trail.
      const kept = alive(dish.recipeId);
      const version = (second.row.provenance?.candidate?.promptVersion ?? '').replace(/\./g, '\\.');

      expect(kept).toHaveLength(1);
      expect(kept[0]?.path).toMatch(new RegExp(`^dish-pictures/${dish.recipeId}/${version}-${UUID}\\.jpg$`));
      expect(Buffer.from(kept[0]?.bytes ?? []).equals(Buffer.from(second.bytes))).toBe(true);
      expect(await row(dish.recipeId)).toMatchObject({ status: 'ready', url: address(kept[0]?.path ?? '') });
      expect(files(dish.recipeId)).toEqual([]);
      expect(await trail(dish.recipeId)).toEqual([
        { action: 'picture.retried', actorId: owner.id, entity: 'recipe', metadata: {}, subjectUserId: null },
        { action: 'picture.accepted', actorId: owner.id, entity: 'recipe', metadata: { allergens: second.keys }, subjectUserId: null }
      ]);
      expect((await readyRows()).unaudited).toBe(0);

      // Taken back from two tabs at once: one removal, one audit row, and the file deleted once.
      const url = address(kept[0]?.path ?? '');
      const deleted = published.deleted.length;
      const removals: Response[] = await Promise.all([remove(capitals, owner.cookie), remove(dish.recipeId, owner.cookie)]);

      expect(removals.map(response => response.status).sort()).toEqual([200, 409]);
      expect(removals.find(response => response.status === 200)?.body).toEqual({ fileDeleted: true, status: 'removed' });
      expect(removals.find(response => response.status === 409)?.body).toEqual(refusal('NOT_REMOVABLE'));
      expect(published.deleted.slice(deleted)).toEqual([url]);
      expect((await trail(dish.recipeId)).map(written => written.action)).toEqual(['picture.retried', 'picture.accepted', 'picture.removed']);
      // Both drawings' judged attempts survive the retry, the acceptance and the removal, oldest first (project 010).
      const removed = await row(dish.recipeId);

      expect(removed).toMatchObject({ status: 'failed', url: null });
      expect(Object.keys(removed?.provenance ?? {}).sort()).toEqual(['drawings', 'reason']);
      expect(removed?.provenance?.reason).toBe('owner_removed');
      expect(first.row.provenance?.drawings).toHaveLength(1);
      expect(second.row.provenance?.drawings).toEqual([...(first.row.provenance?.drawings ?? []), expect.anything()]);
      expect(removed?.provenance?.drawings).toEqual(second.row.provenance?.drawings);
      expect(await status(dish)).toEqual({ status: 'none', url: null });
    }, 60_000);

    it('an accept racing a retry: one of them wins, and there is never both a ready picture and a new drawing', async () => {
      const { bytes, dish, path, seen } = await rejected(take());
      const drawn = images.calls;
      const [accepted, retried]: [Response, Response] = await Promise.all([
        accept(dish.recipeId, seen, owner.cookie),
        retry(dish.recipeId, owner.cookie)
      ]);
      // Whatever the retry started has ended before anything is read.
      const after = await settled(dish.recipeId);
      const actions = (await trail(dish.recipeId)).map(written => written.action);
      const kept = alive(dish.recipeId);

      expect([
        [200, 409],
        [409, 202]
      ]).toContainEqual([accepted.status, retried.status]);

      if (accepted.status === 200) {
        // The acceptance won: the retry found a picture that is ready — or lost the claim to it — and drew nothing.
        byHand.add(dish.recipeId);
        expect(['PICTURE_NOT_RETRYABLE', 'PICTURE_DRAWING']).toContain((retried.body as { code?: string }).code);
        expect(kept).toHaveLength(1);
        expect(Buffer.from(kept[0]?.bytes ?? []).equals(Buffer.from(bytes))).toBe(true);
        expect(after).toMatchObject({ status: 'ready', url: address(kept[0]?.path ?? '') });
        expect(after.provenance?.acceptedBy).toBe('owner');
        expect(actions).toEqual(['picture.accepted']);
        expect(images.calls).toBe(drawn);
        expect(files(dish.recipeId)).toEqual([]);
      } else {
        // The retry won: the candidate went with its claim, and whatever the accept had put in the public store is deleted.
        expect(accepted.body).toEqual(refusal('NO_CANDIDATE'));
        expect(retried.body).toEqual({ status: 'drawing' });
        expect(kept).toEqual([]);
        expect(after).toMatchObject({ attempts: 3, status: 'failed', url: null });
        expect(after.provenance?.acceptedBy).toBeUndefined();
        expect(actions).toEqual(['picture.retried']);
        expect(images.calls).toBe(drawn + 3);
        expect(store.files.has(path)).toBe(false);
      }
    }, 60_000);
  });

  it('every ready row of this run is there by one of the two doors, and each one the owner accepted has its picture.accepted row', async () => {
    const { ready, unaudited } = await readyRows();
    const expected = [
      ...[...byHand].map(recipeId => ({ byOwner: true, recipeId })),
      ...[...byJudge].map(recipeId => ({ byOwner: false, recipeId }))
    ].sort((a, b) => (a.recipeId < b.recipeId ? -1 : 1));

    // Not an empty claim: the run ends with a picture the owner accepted, and with the judge's own.
    expect(byHand.size).toBeGreaterThanOrEqual(1);
    expect(byJudge.size).toBeGreaterThanOrEqual(1);
    // What the table says, row by row: nothing is `ready` that a case did not see through a door, and none says the wrong one.
    expect(ready).toEqual(expected);
    expect(unaudited).toBe(0);

    // And each of those by hand has exactly one acceptance in the trail, by the owner's session.
    for (const recipeId of byHand) {
      expect((await trail(recipeId)).filter(written => written.action === 'picture.accepted')).toEqual([
        expect.objectContaining({ actorId: owner.id, entity: 'recipe' })
      ]);
    }
  });
});
