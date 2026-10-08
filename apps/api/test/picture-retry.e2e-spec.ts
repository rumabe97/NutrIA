import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { database } from 'database';
import { PICTURE_REASONS } from 'core/entities/DishPicture';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import { AI_PICTURE_CAP } from '../src/modules/ai/ai.config.js';
import { PictureImageClient } from '../src/modules/ai/clients/PictureImageClient.js';
import { PictureJudgeClient } from '../src/modules/ai/clients/PictureJudgeClient.js';
import { PictureStore } from '../src/modules/ai/clients/PictureStore.js';
import { StubPictureImageClient, StubPictureJudgeClient, StubPictureStore } from '../src/modules/ai/clients/StubPictureClients.js';

import {
  auditCount,
  completeOnboarding,
  createApp,
  deleteAccounts,
  enableTotp,
  generateAndWait,
  httpServer,
  latestAuditRow,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient
} from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { Paged } from 'core/controllers/User';
import type { AuditLogView } from 'core/controllers/Audit';
import type { AdminPicturesPeriodView, AdminRecipesView } from 'core/controllers/Admin';
import type { Response } from 'supertest';
import type { TestingModuleBuilder } from '@nestjs/testing';
import type { DrawnPicture } from '../src/modules/ai/clients/PictureImageClient.js';

/**
 * The owner's manual retry of a dish's picture, and the reasons a picture failed
 * (`0066`, project 006): `POST /admin/catalogue/recipes/:id/picture/retry`, the
 * `pictureReason` and `retryableAt` on the catalogue's rows, and
 * `failedByReason` / `releasedByReason` on `GET /admin/pictures`.
 *
 * The drawing, the judge and the store are the product's own stubs; nothing
 * calls a model. Everything between them is real: the guarded `UPDATE` that
 * claims the row, the audit row written in the same transaction, the cap summed
 * from `recipe_image_calls`. A retry that is accepted draws the stub file after
 * the response, so a case that accepts one waits for the row to leave
 * `drawing` before it moves on.
 *
 * Recipes are shared by every account, so the suite only touches dishes with no
 * picture row and no picture call when it started, and deletes the rows, the
 * calls and the `picture.retried` audit rows it made for them when it ends. The
 * `dishPictures` flag is a shared row: put back to what it was.
 *
 * Every row a case seeds is written and removed by the case itself, so the
 * cases do not depend on one another's order. "No free text": the stored notes
 * of the rows carry a sentinel, and it must appear in no body.
 *
 * Not covered here: `PICTURE_UNAVAILABLE` (no client configured) — the stubs
 * always are; the unit spec of `RecipeController.retryPicture` has it.
 *
 * Requires a real, seeded database — see ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

/** Draws the stub file and counts the draws, so a retry that was accepted can be seen to have drawn. */
class CountingImages extends StubPictureImageClient {
  calls = 0;

  async draw(): Promise<DrawnPicture> {
    this.calls += 1;

    return super.draw();
  }
}

type Dish = { id: string; name: string; slug: string };
type ImageRow = { attempts: number; status: string };
type Seed = {
  readonly at: Date;
  readonly attempts?: number;
  /** Stored as the row's `provenance`, as it stands. */
  readonly provenance: Record<string, unknown> | null;
  readonly status: 'drawing' | 'failed' | 'ready';
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const COOL_OFF_DAYS = 7;

describe('picture retry and failure reasons', () => {
  let app: INestApplication;
  let cappedApp: INestApplication;
  let owner: Account;
  let ordinary: Account;
  let planner: Account;
  /** Dishes with no picture row and no call when the suite started; each case that seeds a row uses its own. */
  let dishes: Dish[] = [];
  const touched = new Set<string>();
  const made: string[] = [];
  const stamp = Date.now();
  /** Text a stored note carries and no body may ever repeat. */
  const SENTINEL = `SENTINEL-${stamp}-do-not-echo`;
  let flagBefore = false;
  let images = new CountingImages();

  const server = () => httpServer(app);

  const retry = (id: string, cookie?: string, on: INestApplication = app) => {
    const call = request(httpServer(on)).post(`/${PREFIX}/admin/catalogue/recipes/${id}/picture/retry`);

    return cookie === undefined ? call : call.set('Cookie', cookie);
  };

  const get = (path: string, cookie: string = owner.cookie) => request(server()).get(`/${PREFIX}/admin/${path}`).set('Cookie', cookie);

  const dish = (index: number): Dish => {
    const found = dishes[index];

    if (!found) {
      throw new Error(`The library has only ${dishes.length} dishes without a picture row`);
    }

    touched.add(found.id);

    return found;
  };

  const seed = async (recipeId: string, { at, attempts = 3, provenance, status }: Seed): Promise<void> => {
    touched.add(recipeId);
    await sql()`delete from recipe_images where recipe_id = ${recipeId}`;
    await sql()`
      insert into recipe_images (recipe_id, status, attempts, last_attempt_at, url, provenance)
      values (${recipeId}, ${status}, ${attempts}, ${at.toISOString()}::timestamptz, ${status === 'ready' ? 'https://e2e.invalid/picture.jpg' : null}, ${provenance === null ? null : JSON.stringify(provenance)}::text::jsonb)`;
  };

  const clear = async (recipeId: string): Promise<void> => {
    await sql()`delete from recipe_image_calls where recipe_id = ${recipeId}`;
    await sql()`delete from recipe_images where recipe_id = ${recipeId}`;
  };

  const image = async (recipeId: string): Promise<ImageRow | undefined> =>
    (await sql()<ImageRow>`select attempts, status from recipe_images where recipe_id = ${recipeId}`)[0];

  /** Waits for the drawing an accepted retry scheduled to end, one way or another. */
  const settled = async (recipeId: string): Promise<ImageRow | undefined> => {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      const now = await image(recipeId);

      if (now?.status !== 'drawing') {
        return now;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`The picture of ${recipeId} was still drawing after 30 s`);
  };

  const listed = async (found: Dish): Promise<{ body: AdminRecipesView; row: AdminRecipesView['rows'][number] | undefined }> => {
    const body = (await get(`catalogue/recipes?q=${encodeURIComponent(found.name)}&size=100`).expect(200)).body as AdminRecipesView;

    return { body, row: body.rows.find(candidate => candidate.slug === found.slug) };
  };

  const picturesView = async (): Promise<{ body: AdminPicturesPeriodView; text: string }> => {
    const response: Response = await get('pictures?period=30').expect(200);

    return { body: response.body as AdminPicturesPeriodView, text: JSON.stringify(response.body) };
  };

  const countOf = (entries: readonly { n: number; reason: string }[], reason: string): number =>
    entries.find(entry => entry.reason === reason)?.n ?? 0;

  const stubbed = (builder: TestingModuleBuilder): TestingModuleBuilder =>
    builder
      .overrideProvider(PictureImageClient)
      .useValue(images)
      .overrideProvider(PictureJudgeClient)
      .useValue(new StubPictureJudgeClient())
      .overrideProvider(PictureStore)
      .useValue(new StubPictureStore());

  beforeAll(async () => {
    images = new CountingImages();
    app = await createApp(new ScriptedAiClient(POOL), builder => stubbed(builder));
    // A zero cap: the month's spend is never below it, so no picture may start.
    cappedApp = await createApp(new ScriptedAiClient([]), builder => stubbed(builder).overrideProvider(AI_PICTURE_CAP).useValue(0));

    owner = await register(app, `picture-retry-owner-${stamp}@e2e.invalid`);
    await UserController.grantAdmin(owner.email);
    owner = await enableTotp(app, owner);
    made.push(owner.cookie);

    ordinary = await register(app, `picture-retry-ordinary-${stamp}@e2e.invalid`);
    made.push(ordinary.cookie);

    // One generation, so the library holds recipes even on a database seeded without any.
    planner = await register(app, `picture-retry-planner-${stamp}@e2e.invalid`);
    made.push(planner.cookie);
    await completeOnboarding(app, planner);
    expect((await generateAndWait(app, planner)).status).toBe('succeeded');

    dishes = await sql()<Dish>`
      select r.id, r.name, r.slug
      from recipes r
      where not exists (select 1 from recipe_images i where i.recipe_id = r.id)
        and not exists (select 1 from recipe_image_calls c where c.recipe_id = r.id)
        and r.name is not null
      order by r.id
      limit 6`;

    // One per case that seeds a row and keeps it while another is read: retry (1), the list (3), a spare.
    expect(dishes.length).toBeGreaterThanOrEqual(5);

    flagBefore = await SettingsController.dishPictures();
    await SettingsController.setFlag('dishPictures', true, UNAUDITED);
  });

  afterAll(async () => {
    await SettingsController.setFlag('dishPictures', flagBefore, UNAUDITED);
    await deleteAccounts(app, made);

    for (const recipeId of touched) {
      await clear(recipeId);
      await sql()`delete from audit_logs where action = 'picture.retried' and entity_id = ${recipeId}`;
    }

    await cappedApp?.close();
    await app?.close();
  });

  describe('who may retry', () => {
    it('is a 404 for an ordinary account and for no session, and starts nothing', async () => {
      const target = dish(0);
      const audits = await auditCount('picture.retried');
      const before = images.calls;

      await retry(target.id, ordinary.cookie).expect(404);
      await retry(target.id).expect(404);
      // The same wall in front of an id that is not a recipe: nothing is looked up for a stranger.
      await retry(randomUUID(), ordinary.cookie).expect(404);
      await retry('not-a-uuid').expect(404);

      expect(await image(target.id)).toBeUndefined();
      expect(await auditCount('picture.retried')).toBe(audits);
      expect(await sql()`select 1 from recipe_image_calls where recipe_id = ${target.id}`).toHaveLength(0);
      expect(images.calls).toBe(before);
    });

    it('is also a 404 for a stranger when the picture is failed and would be retryable', async () => {
      const target = dish(0);

      await seed(target.id, { at: new Date(Date.now() - HOUR), provenance: { reason: 'call_failed' }, status: 'failed' });

      try {
        const audits = await auditCount('picture.retried');

        await retry(target.id, ordinary.cookie).expect(404);
        await retry(target.id).expect(404);

        expect(await image(target.id)).toEqual({ attempts: 3, status: 'failed' });
        expect(await auditCount('picture.retried')).toBe(audits);
      } finally {
        await clear(target.id);
      }
    });
  });

  describe('a retry the system accepts', () => {
    it('claims a failed picture inside its cool-off, answers 202 drawing, and writes one picture.retried row', async () => {
      const target = dish(0);

      // Failed an hour ago: a view would leave it alone for a week; the owner's retry ignores that.
      await seed(target.id, {
        at: new Date(Date.now() - HOUR),
        provenance: { notes: [`1:failed:${SENTINEL}`], reason: 'call_failed' },
        status: 'failed'
      });

      try {
        const audits = await auditCount('picture.retried');
        const drawn = images.calls;
        const startedAt = Date.now();
        const response: Response = await retry(target.id, owner.cookie).expect(202);

        expect(response.body).toEqual({ status: 'drawing' });
        expect(JSON.stringify(response.body)).not.toContain(SENTINEL);

        // Exactly one row, about this recipe, by the owner, about nobody.
        expect(await auditCount('picture.retried')).toBe(audits + 1);

        const row = await latestAuditRow('picture.retried');

        expect(row).toMatchObject({ action: 'picture.retried', actorId: owner.id, entity: 'recipe', entityId: target.id, subjectUserId: null });
        expect(row?.metadata ?? {}).toEqual({});

        // The drawing was scheduled after the response and ended — the stub draws its file.
        const ended = await settled(target.id);

        expect(ended).toBeDefined();
        expect(ended?.status).not.toBe('drawing');
        expect(images.calls).toBeGreaterThan(drawn);

        // Visible in the trail, newest first, under the action's own filter.
        const trail = (await get('audit?action=picture.retried&size=5').expect(200)).body as Paged<AuditLogView>;

        expect(trail.total).toBe(audits + 1);
        expect(trail.rows.length).toBeGreaterThan(0);
        expect(trail.rows.every(entry => entry.action === 'picture.retried')).toBe(true);
        expect(trail.rows[0]).toMatchObject({ action: 'picture.retried', actor: owner.email, subject: null });
        expect(new Date(trail.rows[0]?.at ?? 0).getTime()).toBeGreaterThanOrEqual(startedAt - 1000);
        expect(JSON.stringify(trail)).not.toContain(SENTINEL);
      } finally {
        await clear(target.id);
      }
    });

    it('takes a picture given back for a reason that is not the dish’s just the same', async () => {
      const target = dish(0);

      await seed(target.id, {
        at: new Date(Date.now() - HOUR),
        provenance: { reason: 'cap_reached', released: `The month’s cap is reached ${SENTINEL}` },
        status: 'failed'
      });

      try {
        const audits = await auditCount('picture.retried');

        expect((await retry(target.id, owner.cookie).expect(202)).body).toEqual({ status: 'drawing' });
        expect(await auditCount('picture.retried')).toBe(audits + 1);
        await settled(target.id);
      } finally {
        await clear(target.id);
      }
    });

    it('takes over a drawing that has been stuck for more than its fifteen minutes', async () => {
      const target = dish(0);

      await seed(target.id, { at: new Date(Date.now() - HOUR), attempts: 1, provenance: null, status: 'drawing' });

      try {
        const audits = await auditCount('picture.retried');

        expect((await retry(target.id, owner.cookie).expect(202)).body).toEqual({ status: 'drawing' });
        expect(await auditCount('picture.retried')).toBe(audits + 1);
        await settled(target.id);
      } finally {
        await clear(target.id);
      }
    });
  });

  describe('a retry the system refuses writes nothing', () => {
    /** Seeds a row (or none), retries as the owner, and proves the row and the trail are as they were. */
    const refused = async (state: Seed | null, code: string, on: INestApplication = app): Promise<void> => {
      const target = dish(0);

      if (state) {
        await seed(target.id, state);
      } else {
        await clear(target.id);
      }

      try {
        const audits = await auditCount('picture.retried');
        const before = await image(target.id);
        const response: Response = await retry(target.id, owner.cookie, on).expect(409);

        expect((response.body as { code?: string }).code).toBe(code);
        expect(JSON.stringify(response.body)).not.toContain(SENTINEL);
        expect(await image(target.id)).toEqual(before);
        expect(await auditCount('picture.retried')).toBe(audits);
      } finally {
        await clear(target.id);
      }
    };

    it('a picture being drawn is never taken over: 409 PICTURE_DRAWING', async () => {
      await refused({ at: new Date(), attempts: 1, provenance: null, status: 'drawing' }, 'PICTURE_DRAWING');
    });

    it('a picture that is ready is not retryable: 409 PICTURE_NOT_RETRYABLE', async () => {
      await refused({ at: new Date(Date.now() - DAY), attempts: 1, provenance: { notes: [SENTINEL] }, status: 'ready' }, 'PICTURE_NOT_RETRYABLE');
    });

    it('a dish with no row is not retryable either: 409 PICTURE_NOT_RETRYABLE', async () => {
      await refused(null, 'PICTURE_NOT_RETRYABLE');
    });

    it('with the dishPictures flag off: 409 PICTURE_FLAG_OFF', async () => {
      await SettingsController.setFlag('dishPictures', false, UNAUDITED);

      try {
        await refused({ at: new Date(Date.now() - HOUR), provenance: { reason: 'call_failed' }, status: 'failed' }, 'PICTURE_FLAG_OFF');
      } finally {
        await SettingsController.setFlag('dishPictures', true, UNAUDITED);
      }
    });

    it('with the month’s cap at zero: 409 PICTURE_CAP_REACHED', async () => {
      await refused({ at: new Date(Date.now() - HOUR), provenance: { reason: 'call_failed' }, status: 'failed' }, 'PICTURE_CAP_REACHED', cappedApp);
    });

    it('an id that is no recipe is a 404 for the owner, in every state of the switch', async () => {
      const audits = await auditCount('picture.retried');

      await retry(randomUUID(), owner.cookie).expect(404);
      await retry('not-a-uuid', owner.cookie).expect(404);
      await retry(randomUUID(), owner.cookie, cappedApp).expect(404);

      await SettingsController.setFlag('dishPictures', false, UNAUDITED);

      try {
        // The recipe is looked up before the switch is: an id that is nothing is a 404, not a 409.
        await retry(randomUUID(), owner.cookie).expect(404);
      } finally {
        await SettingsController.setFlag('dishPictures', true, UNAUDITED);
      }

      expect(await auditCount('picture.retried')).toBe(audits);
    });
  });

  describe('the reason and the cool-off on the catalogue', () => {
    it('a failed row from old-style notes shows its reason and retryableAt = last attempt + 7 days', async () => {
      const target = dish(1);
      const at = new Date(Date.now() - 2 * DAY);

      await seed(target.id, { at, provenance: { notes: ['1:failed:timeout', `2:rejected:extra_allergen:shrimp ${SENTINEL}`] }, status: 'failed' });

      try {
        const { body, row } = await listed(target);

        expect(row).toBeDefined();
        expect(row).toMatchObject({ picture: 'failed', pictureReason: 'judge_allergen' });
        expect(row?.retryableAt).toBe(new Date(at.getTime() + COOL_OFF_DAYS * DAY).toISOString());
        expect(JSON.stringify(body)).not.toContain(SENTINEL);
      } finally {
        await clear(target.id);
      }
    });

    it('a row written with its reason shows it; one past its cool-off has no date; a released one has a reason and no date', async () => {
      const failedNow = dish(1);
      const pastCoolOff = dish(2);
      const released = dish(3);
      const now = Date.now();

      await seed(failedNow.id, { at: new Date(now - HOUR), provenance: { notes: [SENTINEL], reason: 'payment_refused' }, status: 'failed' });
      await seed(pastCoolOff.id, {
        at: new Date(now - (COOL_OFF_DAYS + 1) * DAY),
        provenance: { notes: [`1:unkeepable:${SENTINEL}`] },
        status: 'failed'
      });
      await seed(released.id, {
        at: new Date(now - HOUR),
        provenance: { reason: 'cap_reached', released: `The month’s cap is reached ${SENTINEL}` },
        status: 'failed'
      });

      try {
        const first = await listed(failedNow);

        expect(first.row).toMatchObject({ picture: 'failed', pictureReason: 'payment_refused' });
        expect(first.row?.retryableAt).toBe(new Date(now - HOUR + COOL_OFF_DAYS * DAY).toISOString());

        const second = await listed(pastCoolOff);

        expect(second.row).toMatchObject({ picture: 'failed', pictureReason: 'no_provenance', retryableAt: null });

        // A released row reads as no picture, is claimed by the next view at once, and still says why.
        const third = await listed(released);

        expect(third.row).toMatchObject({ picture: 'none', pictureReason: 'cap_reached', retryableAt: null });

        for (const found of [first, second, third]) {
          expect(JSON.stringify(found.body)).not.toContain(SENTINEL);
        }
      } finally {
        for (const target of [failedNow, pastCoolOff, released]) {
          await clear(target.id);
        }
      }
    });

    it('a dish with no row, and one whose picture is ready or drawing, has neither', async () => {
      const target = dish(1);

      expect((await listed(target)).row).toMatchObject({ picture: 'none', pictureReason: null, retryableAt: null });

      for (const [status, expected] of [
        ['ready', 'ready'],
        ['drawing', 'drawing']
      ] as const) {
        await seed(target.id, { at: new Date(), provenance: { notes: [`1:rejected:extra_allergen:${SENTINEL}`] }, status });

        try {
          const { body, row } = await listed(target);

          expect(row).toMatchObject({ picture: expected, pictureReason: null, retryableAt: null });
          expect(JSON.stringify(body)).not.toContain(SENTINEL);
        } finally {
          await clear(target.id);
        }
      }
    });

    it('carries the reason on the picture=failed filter as well, and only closed words', async () => {
      const target = dish(1);

      await seed(target.id, { at: new Date(Date.now() - HOUR), provenance: { notes: [`1:refused:${SENTINEL}`] }, status: 'failed' });

      try {
        const body = (await get('catalogue/recipes?picture=failed&size=100').expect(200)).body as AdminRecipesView;

        expect(body.rows.length).toBeGreaterThan(0);

        for (const row of body.rows) {
          expect(row.picture).toBe('failed');
          expect(PICTURE_REASONS as readonly string[]).toContain(row.pictureReason);
        }

        expect(JSON.stringify(body)).not.toContain(SENTINEL);
      } finally {
        await clear(target.id);
      }
    });
  });

  describe('the reasons on GET /admin/pictures', () => {
    it('counts failed and given-back pictures by closed reason, each list {reason, n}, the commonest first', async () => {
      const allergen = dish(1);
      const callFailed = dish(2);
      const capped = dish(3);
      const at = new Date(Date.now() - HOUR);
      const before = (await picturesView()).body;

      await seed(allergen.id, { at, provenance: { notes: [`1:rejected:extra_allergen:shrimp ${SENTINEL}`] }, status: 'failed' });
      await seed(callFailed.id, { at, provenance: { notes: [SENTINEL], reason: 'call_failed' }, status: 'failed' });
      await seed(capped.id, { at, provenance: { reason: 'cap_reached', released: `The month’s cap is reached ${SENTINEL}` }, status: 'failed' });

      try {
        const { body: after, text } = await picturesView();

        expect(countOf(after.failedByReason, 'judge_allergen')).toBe(countOf(before.failedByReason, 'judge_allergen') + 1);
        expect(countOf(after.failedByReason, 'call_failed')).toBe(countOf(before.failedByReason, 'call_failed') + 1);
        // A row given back is counted on its own side, never among the failures.
        expect(countOf(after.failedByReason, 'cap_reached')).toBe(countOf(before.failedByReason, 'cap_reached'));
        expect(countOf(after.releasedByReason, 'cap_reached')).toBe(countOf(before.releasedByReason, 'cap_reached') + 1);

        for (const list of [after.failedByReason, after.releasedByReason]) {
          for (const entry of list) {
            expect(Object.keys(entry).sort()).toEqual(['n', 'reason']);
            expect(PICTURE_REASONS as readonly string[]).toContain(entry.reason);
            expect(entry.n).toBeGreaterThan(0);
          }

          const counts = list.map(entry => entry.n);

          expect(counts).toEqual([...counts].sort((a, b) => b - a));
          // One entry per reason.
          expect(new Set(list.map(entry => entry.reason)).size).toBe(list.length);
        }

        expect(text).not.toContain(SENTINEL);
      } finally {
        for (const target of [allergen, callFailed, capped]) {
          await clear(target.id);
        }
      }
    });

    it('does not count what ended outside the period', async () => {
      const target = dish(1);
      const before = (await picturesView()).body;

      await seed(target.id, { at: new Date(Date.now() - 60 * DAY), provenance: { reason: 'model_refused' }, status: 'failed' });

      try {
        const after = (await picturesView()).body;

        expect(countOf(after.failedByReason, 'model_refused')).toBe(countOf(before.failedByReason, 'model_refused'));
      } finally {
        await clear(target.id);
      }
    });

    it('is a 404 for an ordinary account, as before', async () => {
      await get('pictures?period=30', ordinary.cookie).expect(404);
    });
  });
});
