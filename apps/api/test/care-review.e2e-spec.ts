import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { UserController } from 'core/controllers/User';
import { database } from 'database';

import {
  completeOnboarding,
  createApp,
  dish,
  generateAndWait,
  httpServer,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient,
  scriptedName,
  SEEDED
} from './harness.js';
import { EmailService } from '../src/modules/email/services/index.js';

import type { Account, JobResult } from './harness.js';
import type { CareLinkView } from 'core/controllers/Care';
import type { CheckInStatusView } from 'core/controllers/CheckIn';
import type { JobView, MealDetailView, PlanSummaryView, PlanView, ShoppingListView } from 'core/controllers/Plan';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * Review before publishing (`0060`, project 004 Phase 5; PRD criterion 8).
 *
 * A linked client whose link has review on — the default — gets a new plan
 * that waits in `pending_review`: the professional reads it, swaps its meals,
 * regenerates it and publishes it; the client sees none of it — not the plan,
 * the list, the history, a fetch by id, a day, a meal or the check-in — and
 * keeps living the plan they had until the professional publishes, when the
 * two change places in one step. With review off, or with no active link,
 * generation is today's, which the rest of the suite proves unchanged.
 *
 * Every professional route takes a link id and is one 404 for any denial;
 * each call that is answered leaves exactly one `review` row in the client's
 * trail, and a refused one leaves none. Counted on `care_access_log` itself,
 * as a difference around each call.
 *
 * The switch is on for the suite and off again in `afterAll`, as in
 * `care.e2e-spec.ts`. Requires a real database — see ./README.md.
 */
const NOBODYS_LINK = '00000000-0000-4000-8000-000000000000';

/** The breakfasts of `POOL` all carry gluten (bread, oats); these do not, so a gluten allergy can still fill a fortnight. */
const GLUTEN_FREE_BREAKFASTS = [
  dish('Yogur con fruta', ['breakfast'], [{ grams: 250, slug: SEEDED.yogur }]),
  dish('Huevos revueltos', ['breakfast'], [{ grams: 160, slug: SEEDED.huevo }]),
  dish(
    'Yogur con huevo',
    ['breakfast'],
    [
      { grams: 150, slug: SEEDED.yogur },
      { grams: 100, slug: SEEDED.huevo }
    ]
  ),
  dish(
    'Huevos con tomate',
    ['breakfast'],
    [
      { grams: 120, slug: SEEDED.huevo },
      { grams: 120, slug: SEEDED.tomate }
    ]
  ),
  dish('Yogur solo', ['breakfast'], [{ grams: 300, slug: SEEDED.yogur }])
];
/** The dishes of `POOL` made with bread or oats: the model proposes them to a gluten allergy on every call. */
const WITH_GLUTEN = new Set(['Avena con yogur', 'Tostada con huevo', 'Yogur con avena', 'Huevos con pan', 'Avena sola']);

type Tables = <Row>(strings: TemplateStringsArray, ...values: readonly (number | string)[]) => Promise<Row[]>;

/** Parameterised reads on the tables themselves, as in `care.e2e-spec.ts`. */
function tables(): Tables {
  return (database() as unknown as { readonly $client: Tables }).$client;
}

describe('care review', () => {
  let app: INestApplication;
  let stamp: number;
  let owner: Account;
  let proA: Account;
  let proB: Account;
  /** Has a plan of their own before the link, and asks for the next one with review on. */
  let lived: Account;
  /** Allergic to gluten, no plan: the professional makes their first. */
  let fresh: Account;
  /** Review switched off by the professional. */
  let unreviewed: Account;
  /** A paused link: review is on, but only an active link holds a plan back. */
  let paused: Account;
  /** A link the client ended. */
  let ended: Account;
  /** B's one client. */
  let theirs: Account;
  const links: Record<string, string> = {};
  /** Every session this suite opened, so `afterAll` can delete each account it made. */
  const made: string[] = [];
  const sent: OutgoingEmail[] = [];

  function server() {
    return httpServer(app);
  }

  function address(name: string): string {
    return `review-${name}-${stamp}@e2e.invalid`;
  }

  async function account(name: string): Promise<Account> {
    const created = await register(app, address(name));

    made.push(created.cookie);

    return created;
  }

  function nameOf(who: Account): string {
    return who.email.split('@')[0] ?? '';
  }

  async function setSwitch(enabled: boolean): Promise<void> {
    await request(server()).patch(`/${PREFIX}/admin/settings`).set('Cookie', owner.cookie).send({ enabled, flag: 'professional' }).expect(200);
  }

  async function grant(who: Account): Promise<void> {
    await request(server())
      .post(`/${PREFIX}/admin/accounts/${who.id}/professional`)
      .set('Cookie', owner.cookie)
      .send({ collegiateNumber: `28/${String(stamp).slice(-6)}` })
      .expect(201);
  }

  /** The token in the newest mail to `to`, waiting for the background task that sends it. */
  async function tokenMailedTo(to: string, after: number): Promise<string> {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const mail = sent
        .slice(after)
        .filter(message => message.to === to.toLowerCase())
        .at(-1);
      const token = mail?.text.match(/\/invitacion\/([A-Za-z0-9_-]{43})/)?.[1];

      if (token) {
        return token;
      }

      await new Promise(resolve => {
        setTimeout(resolve, 50);
      });
    }

    throw new Error('No invitation mail arrived');
  }

  /** Links `client` to `professional` through the routes, as the two people do. */
  async function link(professional: Account, client: Account): Promise<string> {
    const before = sent.length;

    await request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', professional.cookie).send({ email: client.email }).expect(201);

    const token = await tokenMailedTo(client.email, before);
    const accepted: Response = await request(server())
      .post(`/${PREFIX}/care/invitations/${token}/accept`)
      .set('Cookie', client.cookie)
      .send({ consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })
      .expect(200);

    return (accepted.body as CareLinkView).id;
  }

  /** A null answer arrives as an empty body, which supertest may hand over as `{}`, `''` or null. */
  function planOrNull(response: Response): PlanView | null {
    const body = response.body as '' | Partial<PlanView> | null;

    return body && typeof body === 'object' && 'id' in body ? (body as PlanView) : null;
  }

  // --- The professional's routes, each one call -------------------------------

  function clientPath(linkId: string, rest = ''): string {
    return `/${PREFIX}/care/clients/${linkId}${rest}`;
  }

  function pendingOf(professional: Account, linkId: string) {
    return request(server()).get(clientPath(linkId, '/plan/pending')).set('Cookie', professional.cookie);
  }

  async function pending(professional: Account, linkId: string): Promise<PlanView | null> {
    return planOrNull(await pendingOf(professional, linkId).expect(200));
  }

  function generateFor(professional: Account, linkId: string) {
    return request(server()).post(clientPath(linkId, '/plan/generate')).set('Cookie', professional.cookie);
  }

  function jobOf(professional: Account, linkId: string, jobId: string) {
    return request(server())
      .get(clientPath(linkId, `/plan/jobs/${jobId}`))
      .set('Cookie', professional.cookie);
  }

  function swapFor(professional: Account, linkId: string, mealId: string) {
    return request(server())
      .post(clientPath(linkId, `/plan/meals/${mealId}/swap`))
      .set('Cookie', professional.cookie)
      .send({});
  }

  function publishFor(professional: Account, linkId: string) {
    return request(server()).post(clientPath(linkId, '/plan/publish')).set('Cookie', professional.cookie);
  }

  function setReview(professional: Account, linkId: string, reviewBeforePublish: boolean) {
    return request(server()).patch(clientPath(linkId)).set('Cookie', professional.cookie).send({ reviewBeforePublish });
  }

  /** Starts a generation through the link and polls the professional's job route until it ends. */
  async function generateForAndWait(professional: Account, linkId: string): Promise<JobView> {
    const started: Response = await generateFor(professional, linkId).expect(201);
    const jobId = (started.body as JobView).id;
    const deadline = Date.now() + 60_000;

    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 250));

      const polled: Response = await jobOf(professional, linkId, jobId).expect(200);
      const job = polled.body as JobView;

      if (job.status === 'succeeded' || job.status === 'failed') {
        return job;
      }
    }

    throw new Error('Generation did not finish within the timeout');
  }

  // --- The client's side -------------------------------------------------------

  async function activeOf(who: Account): Promise<PlanView | null> {
    return planOrNull(await request(server()).get(`/${PREFIX}/meal-plans/active`).set('Cookie', who.cookie).expect(200));
  }

  function shoppingListOf(who: Account) {
    return request(server()).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', who.cookie);
  }

  async function historyOf(who: Account): Promise<readonly PlanSummaryView[]> {
    const response: Response = await request(server()).get(`/${PREFIX}/meal-plans`).set('Cookie', who.cookie).expect(200);

    return response.body as PlanSummaryView[];
  }

  async function checkInOf(who: Account): Promise<CheckInStatusView> {
    const response: Response = await request(server()).get(`/${PREFIX}/check-ins/status`).set('Cookie', who.cookie).expect(200);

    return response.body as CheckInStatusView;
  }

  /** Every read of one plan a client has: the plan, a day, a meal. */
  async function expectHiddenFrom(who: Account, plan: PlanView): Promise<void> {
    const mealId = plan.days[0]?.meals[0]?.id ?? '';

    await request(server()).get(`/${PREFIX}/meal-plans/${plan.id}`).set('Cookie', who.cookie).expect(404);
    await request(server()).get(`/${PREFIX}/meal-plans/${plan.id}/days/0`).set('Cookie', who.cookie).expect(404);
    await request(server()).get(`/${PREFIX}/meal-plans/meals/${mealId}`).set('Cookie', who.cookie).expect(404);
    await request(server()).post(`/${PREFIX}/meal-plans/meals/${mealId}/swap`).set('Cookie', who.cookie).send({}).expect(404);
    expect((await historyOf(who)).map(row => row.id)).not.toContain(plan.id);
    expect((await activeOf(who))?.id).not.toBe(plan.id);
    expect((await checkInOf(who)).plan?.id).not.toBe(plan.id);
  }

  // --- The tables --------------------------------------------------------------

  async function reviewRows(clientId: string): Promise<{ action: string }[]> {
    return tables()<{ action: string }>`
      select action::text as action from care_access_log where user_id = ${clientId} and kind = 'review' order by created_at, id`;
  }

  /** The review rows one call wrote: the call runs between two counts. */
  async function rowsWrittenBy(clientId: string, call: () => Promise<unknown>): Promise<string[]> {
    const before = (await reviewRows(clientId)).length;

    await call();

    return (await reviewRows(clientId)).slice(before).map(row => row.action);
  }

  async function allTrailRows(clientId: string): Promise<number> {
    return (await tables()<{ id: string }>`select id from care_access_log where user_id = ${clientId}`).length;
  }

  async function planRows(userId: string): Promise<{ id: string; status: string }[]> {
    return tables()<{ id: string; status: string }>`select id, status::text as status from meal_plans where user_id = ${userId} order by version`;
  }

  async function stageOf(professional: Account, linkId: string): Promise<{ reviewBeforePublish: boolean; stage: string | null } | undefined> {
    const response: Response = await request(server()).get(`/${PREFIX}/care/clients`).set('Cookie', professional.cookie).expect(200);

    return (response.body as { clients: { linkId: string; reviewBeforePublish: boolean; stage: string | null }[] }).clients.find(
      row => row.linkId === linkId
    );
  }

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient([...POOL, ...GLUTEN_FREE_BREAKFASTS]));
    stamp = Date.now();

    // On the prototype, so whichever instance a module was handed is the one caught. Nothing is sent.
    jest.spyOn(EmailService.prototype, 'send').mockImplementation(async message => {
      sent.push(message);

      return true;
    });

    owner = await account('owner');
    proA = await account('pro-a');
    proB = await account('pro-b');
    await UserController.grantAdmin(owner.email);
    await setSwitch(true);
    await grant(proA);
    await grant(proB);

    lived = await account('lived');
    fresh = await account('fresh');
    unreviewed = await account('unreviewed');
    paused = await account('paused');
    ended = await account('ended');
    theirs = await account('theirs');

    const allergens: Response = await request(server()).get(`/${PREFIX}/safety/allergens`).expect(200);
    const glutenId = (allergens.body as readonly { id: string; key: string }[]).find(allergen => allergen.key === 'gluten')?.id ?? '';

    expect(glutenId).not.toBe('');

    await completeOnboarding(app, lived);
    await completeOnboarding(app, fresh, [glutenId], [], true);
    await completeOnboarding(app, unreviewed);
    await completeOnboarding(app, paused);
    await completeOnboarding(app, ended);
    await completeOnboarding(app, theirs);

    // Before any link: today's generation, the plan this client is living when the next one is asked for.
    await expect(generateAndWait(app, lived)).resolves.toMatchObject({ status: 'succeeded' });

    links.lived = await link(proA, lived);
    links.fresh = await link(proA, fresh);
    links.unreviewed = await link(proA, unreviewed);
    links.paused = await link(proA, paused);
    links.ended = await link(proA, ended);
    links.theirs = await link(proB, theirs);

    await tables()`update care_links set status = 'paused' where id = ${links.paused}`;
    await request(server()).delete(`/${PREFIX}/care/links/${links.ended}`).set('Cookie', ended.cookie).expect(204);
  });

  afterAll(async () => {
    try {
      if (owner) {
        await setSwitch(false);
      }

      for (const cookie of made) {
        await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', cookie);
      }

      if (stamp) {
        const suffix = `%-${stamp}@e2e.invalid`;
        const accounts = await tables()<{ id: string }>`select id from "user" where email like ${suffix}`;
        const invitations = await tables()<{ id: string }>`select id from care_invitations where email like ${suffix}`;
        const trail = await tables()<{ id: string }>`select id from care_access_log where professional_name like ${`review-%-${stamp}`}`;

        if (accounts.length > 0 || invitations.length > 0 || trail.length > 0) {
          throw new Error(
            `care-review left ${accounts.length} account(s), ${invitations.length} invitation(s) and ${trail.length} trail row(s) behind`
          );
        }
      }
    } finally {
      jest.restoreAllMocks();
      await app?.close();
    }
  });

  describe('a client who asks for their next plan', () => {
    let first: PlanView;
    let next: PlanView;
    let job: JobResult;

    beforeAll(async () => {
      first = (await activeOf(lived)) as PlanView;
      expect(first).not.toBeNull();
    });

    it('has review on by default, and nothing pending before they ask', async () => {
      expect(await stageOf(proA, links.lived)).toMatchObject({ reviewBeforePublish: true, stage: 'plan_under_way' });
      await expect(rowsWrittenBy(lived.id, async () => expect(await pending(proA, links.lived)).toBeNull())).resolves.toEqual(['read']);
    });

    it('gets a plan that waits for the professional, and no plan id to go to', async () => {
      job = await generateAndWait(app, lived);

      expect(job.status).toBe('succeeded');
      expect(job.planId).toBeNull();

      // One waiting, the one they live still active: nothing completed it.
      const rows = await planRows(lived.id);

      expect(rows.filter(row => row.status === 'pending_review')).toHaveLength(1);
      expect(rows.filter(row => row.status === 'active').map(row => row.id)).toEqual([first.id]);
    });

    it('is present for the professional, as the plan it is', async () => {
      const read = await pending(proA, links.lived);

      expect(read).not.toBeNull();
      next = read as PlanView;
      expect(next.id).not.toBe(first.id);
      expect(next.status).toBe('pending_review');
      expect(next.days).toHaveLength(14);
      expect((await planRows(lived.id)).find(row => row.status === 'pending_review')?.id).toBe(next.id);
      expect(await stageOf(proA, links.lived)).toMatchObject({ stage: 'plan_awaiting_review' });
    });

    it('is invisible to the client by every read, while the plan they live stays theirs to use', async () => {
      expect((await activeOf(lived))?.id).toBe(first.id);

      const list: Response = await shoppingListOf(lived).expect(200);

      expect((list.body as ShoppingListView).planId).toBe(first.id);
      expect((await checkInOf(lived)).plan?.id).toBe(first.id);
      await expectHiddenFrom(lived, next);

      // The plan under way still takes a swap, and its list is rebuilt, not the waiting one's.
      const target = first.days[1]?.meals[0]?.id ?? '';

      await request(server()).post(`/${PREFIX}/meal-plans/meals/${target}/swap`).set('Cookie', lived.cookie).send({}).expect(201);
      expect((await activeOf(lived))?.id).toBe(first.id);
    });

    it('lets the professional swap a meal of the waiting plan, and only of that one', async () => {
      const target = next.days[2]?.meals[0];
      let swapped: MealDetailView | undefined;

      await expect(
        rowsWrittenBy(lived.id, async () => {
          const response: Response = await swapFor(proA, links.lived, target?.id ?? '').expect(201);

          swapped = response.body as MealDetailView;
        })
      ).resolves.toEqual(['write']);
      expect(swapped).toMatchObject({ id: target?.id, planId: next.id, slot: target?.slot });
      expect((await pending(proA, links.lived))?.days[2]?.meals.find(meal => meal.id === target?.id)?.name).not.toBe(target?.name);

      // A meal of the plan the client lives is not the professional's to change.
      const lived0 = first.days[3]?.meals[0]?.id ?? '';

      await expect(rowsWrittenBy(lived.id, () => swapFor(proA, links.lived, lived0).expect(404))).resolves.toEqual([]);
    });

    it('publishes in one step: the waiting plan active, the old one completed', async () => {
      let published: PlanView | undefined;

      await expect(
        rowsWrittenBy(lived.id, async () => {
          const response: Response = await publishFor(proA, links.lived).expect(201);

          published = response.body as PlanView;
        })
      ).resolves.toEqual(['write']);
      expect(published).toMatchObject({ id: next.id, status: 'active' });

      const rows = await planRows(lived.id);

      expect(rows.filter(row => row.status === 'active').map(row => row.id)).toEqual([next.id]);
      expect(rows.filter(row => row.status === 'pending_review')).toEqual([]);
      expect(rows.find(row => row.id === first.id)?.status).toBe('completed');

      // The client now lives the new one, by every read, and the old one is history.
      expect((await activeOf(lived))?.id).toBe(next.id);

      const list: Response = await shoppingListOf(lived).expect(200);

      expect((list.body as ShoppingListView).planId).toBe(next.id);
      expect((await checkInOf(lived)).plan?.id).toBe(next.id);
      expect((await historyOf(lived)).map(row => row.id)).toEqual(expect.arrayContaining([first.id, next.id]));

      const old: Response = await request(server()).get(`/${PREFIX}/meal-plans/${first.id}`).set('Cookie', lived.cookie).expect(200);

      expect((old.body as PlanView).status).toBe('completed');
      await request(server()).get(`/${PREFIX}/meal-plans/${next.id}/days/0`).set('Cookie', lived.cookie).expect(200);
      expect(await stageOf(proA, links.lived)).toMatchObject({ stage: 'plan_under_way' });
    });

    it('has nothing left to publish, and a refused publish writes nothing', async () => {
      await expect(rowsWrittenBy(lived.id, async () => expect(await pending(proA, links.lived)).toBeNull())).resolves.toEqual(['read']);
      await expect(rowsWrittenBy(lived.id, () => publishFor(proA, links.lived).expect(404))).resolves.toEqual([]);
    });

    it('shows the client who did it, by name, in their trail', async () => {
      const response: Response = await request(server()).get(`/${PREFIX}/care/access-log`).set('Cookie', lived.cookie).expect(200);
      const entries = (response.body as { entries: { action: string; kind: string; professionalName: string }[] }).entries;
      const review = entries.filter(entry => entry.kind === 'review');

      expect(review.length).toBe((await reviewRows(lived.id)).length);
      expect(new Set(review.map(entry => entry.professionalName))).toEqual(new Set([nameOf(proA)]));
      expect(new Set(review.map(entry => entry.action))).toEqual(new Set(['read', 'write']));
    });
  });

  describe('a client with no plan, the professional making the first', () => {
    let firstDraft: PlanView;

    it('generates through the link, into review, with every poll a read', async () => {
      const before = (await reviewRows(fresh.id)).length;
      const job = await generateForAndWait(proA, links.fresh);

      expect(job.status).toBe('succeeded');

      // The generate is the one write; every poll of the job route is one read.
      const written = (await reviewRows(fresh.id)).slice(before).map(row => row.action);

      expect(written[0]).toBe('write');
      expect(written.slice(1).every(action => action === 'read')).toBe(true);
      expect(written.length).toBeGreaterThan(1);

      firstDraft = (await pending(proA, links.fresh)) as PlanView;
      expect(firstDraft).toMatchObject({ status: 'pending_review' });
      expect(await stageOf(proA, links.fresh)).toMatchObject({ stage: 'plan_awaiting_review' });
    });

    it('kept the client’s allergy: the model proposed bread and oats, none reached the plan', () => {
      const served = firstDraft.days.flatMap(day => day.meals.map(meal => scriptedName(meal.name)));

      expect(served.length).toBeGreaterThan(0);
      expect(served.filter(name => WITH_GLUTEN.has(name))).toEqual([]);
    });

    it('is not the client’s: no plan, no list, no history, no check-in', async () => {
      expect(await activeOf(fresh)).toBeNull();
      await shoppingListOf(fresh).expect(404);
      expect(await historyOf(fresh)).toEqual([]);
      expect((await checkInOf(fresh)).plan).toBeNull();
      await expectHiddenFrom(fresh, firstDraft);
    });

    it('regenerates, replacing the waiting plan', async () => {
      const job = await generateForAndWait(proA, links.fresh);

      expect(job.status).toBe('succeeded');

      const replacement = (await pending(proA, links.fresh)) as PlanView;

      expect(replacement.id).not.toBe(firstDraft.id);

      const rows = await planRows(fresh.id);

      expect(rows.filter(row => row.status === 'pending_review').map(row => row.id)).toEqual([replacement.id]);
      expect(rows.find(row => row.id === firstDraft.id)?.status ?? 'gone').not.toBe('pending_review');
      expect(rows.filter(row => row.status === 'active')).toEqual([]);

      await publishFor(proA, links.fresh).expect(201);
      expect((await activeOf(fresh))?.id).toBe(replacement.id);
    });
  });

  describe('with review off, or no active link', () => {
    it('lets the professional switch review off, one write', async () => {
      await expect(rowsWrittenBy(unreviewed.id, () => setReview(proA, links.unreviewed, false).expect(200))).resolves.toEqual(['write']);
      expect(await stageOf(proA, links.unreviewed)).toMatchObject({ reviewBeforePublish: false });
    });

    it('gives a client with review off their plan at once, as today', async () => {
      const job = await generateAndWait(app, unreviewed);

      expect(job).toMatchObject({ planId: expect.any(String), status: 'succeeded' });
      expect((await activeOf(unreviewed))?.id).toBe(job.planId);
      expect((await planRows(unreviewed.id)).map(row => row.status)).toEqual(['active']);
      expect(await pending(proA, links.unreviewed)).toBeNull();
    });

    it('gives a client whose link is paused their plan at once', async () => {
      const job = await generateAndWait(app, paused);

      expect(job).toMatchObject({ planId: expect.any(String), status: 'succeeded' });
      expect((await activeOf(paused))?.id).toBe(job.planId);
      expect((await planRows(paused.id)).map(row => row.status)).toEqual(['active']);
    });
  });

  describe('every other caller', () => {
    /** Every professional route, on one link, with ids that would otherwise answer. */
    function everyRoute(caller: Account, linkId: string) {
      return [
        () => pendingOf(caller, linkId),
        () => generateFor(caller, linkId),
        () => jobOf(caller, linkId, ids.jobId),
        () => swapFor(caller, linkId, ids.mealId),
        () => publishFor(caller, linkId),
        () => setReview(caller, linkId, false)
      ];
    }

    /** A job and a meal of the plan waiting for `unreviewed`: what every refused call below names. */
    let ids: { jobId: string; mealId: string };

    beforeAll(async () => {
      // Review back on, and the client asks for a redo: a plan waits, so every route has something to answer with.
      await setReview(proA, links.unreviewed, true).expect(200);
      expect((await generateAndWait(app, unreviewed)).status).toBe('succeeded');

      const waiting = (await pending(proA, links.unreviewed)) as PlanView;
      const [job] = await tables()<{ id: string }>`
        select id from plan_generation_jobs where user_id = ${unreviewed.id} order by created_at desc limit 1`;

      ids = { jobId: job?.id ?? '', mealId: waiting.days[0]?.meals[0]?.id ?? '' };
    });

    async function expectNothingMoved(run: () => Promise<void>): Promise<void> {
      const before = { plans: await planRows(unreviewed.id), trail: await allTrailRows(unreviewed.id) };

      await run();

      expect(await allTrailRows(unreviewed.id)).toBe(before.trail);
      expect(await planRows(unreviewed.id)).toEqual(before.plans);
    }

    it('is one 404 for another professional, and writes nothing', async () => {
      await expectNothingMoved(async () => {
        for (const call of everyRoute(proB, links.unreviewed)) {
          expect((await call()).status).toBe(404);
        }
      });
    });

    it('is one 404 for another professional naming the job or the meal through their own link', async () => {
      const before = await allTrailRows(theirs.id);

      await expectNothingMoved(async () => {
        await jobOf(proB, links.theirs, ids.jobId).expect(404);
        await swapFor(proB, links.theirs, ids.mealId).expect(404);
        await publishFor(proB, links.theirs).expect(404);
      });
      expect(await allTrailRows(theirs.id)).toBe(before);
      expect(await activeOf(theirs)).toBeNull();
    });

    it('is one 404 on an ended link, a paused one, an unknown id and a non-id, and writes nothing', async () => {
      const before = { ended: await allTrailRows(ended.id), paused: await allTrailRows(paused.id) };

      for (const linkId of [links.ended, links.paused, NOBODYS_LINK, 'not-a-link']) {
        for (const call of everyRoute(proA, linkId)) {
          expect((await call()).status).toBe(404);
        }
      }

      expect(await allTrailRows(ended.id)).toBe(before.ended);
      expect(await allTrailRows(paused.id)).toBe(before.paused);
      expect((await planRows(paused.id)).map(row => row.status)).toEqual(['active']);
    });

    it('is the door’s 404 for the client, for no session, and with the switch off', async () => {
      await expectNothingMoved(async () => {
        for (const call of everyRoute(unreviewed, links.unreviewed)) {
          expect((await call()).status).toBe(404);
        }

        await request(server()).get(clientPath(links.unreviewed, '/plan/pending')).expect(404);
        await request(server()).post(clientPath(links.unreviewed, '/plan/publish')).expect(404);

        await setSwitch(false);

        try {
          for (const call of everyRoute(proA, links.unreviewed)) {
            expect((await call()).status).toBe(404);
          }
        } finally {
          await setSwitch(true);
        }
      });

      // Still waiting, still the professional's alone.
      expect(await pending(proA, links.unreviewed)).toMatchObject({ status: 'pending_review' });
      expect((await activeOf(unreviewed))?.status).toBe('active');
    });
  });
});
