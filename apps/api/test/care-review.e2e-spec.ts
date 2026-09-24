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

import type { Account } from './harness.js';
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
  /*
   * Four professionals, because generating is limited to three calls an hour per
   * professional account (a global guard, counted before the door answers), and
   * the refusals below call it on every link they try.
   */
  let proA: Account;
  let proB: Account;
  /** Makes `fresh`'s first plan and regenerates it. */
  let proC: Account;
  /** Sent the paused and the ended link. */
  let proD: Account;
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
  /** Linked before finishing onboarding. */
  let unready: Account;
  /** Sent the link whose grant is taken back under a waiting plan. */
  let proE: Account;
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
    await request(server())
      .get(`/${PREFIX}/meal-plans/${plan.id}/days/${plan.days[0]?.dayIndex ?? 1}`)
      .set('Cookie', who.cookie)
      .expect(404);
    await request(server()).get(`/${PREFIX}/meal-plans/meals/${mealId}`).set('Cookie', who.cookie).expect(404);
    await request(server()).post(`/${PREFIX}/meal-plans/meals/${mealId}/swap`).set('Cookie', who.cookie).send({}).expect(404);
    await request(server()).patch(`/${PREFIX}/meal-plans/meals/${mealId}/status`).set('Cookie', who.cookie).send({ status: 'completed' }).expect(404);
    expect((await historyOf(who)).map(row => row.id)).not.toContain(plan.id);
    expect((await progressOf(who)).fortnights.map(row => row.planId)).not.toContain(plan.id);

    // The waiting plan's list has rows; ticking one is the same 404, and leaves it as it was.
    const [item] = await tables()<{ id: string; checked: boolean }>`
      select i.id, i.checked from shopping_list_items i join shopping_lists l on l.id = i.list_id where l.plan_id = ${plan.id} limit 1`;

    expect(item).toBeDefined();
    await request(server())
      .patch(`/${PREFIX}/shopping-lists/items/${item?.id ?? ''}`)
      .set('Cookie', who.cookie)
      .send({ checked: !item?.checked })
      .expect(404);

    const [after] = await tables()<{ checked: boolean }>`select checked from shopping_list_items where id = ${item?.id ?? ''}`;

    expect(after?.checked).toBe(item?.checked);
    expect((await activeOf(who))?.id).not.toBe(plan.id);
    expect((await checkInOf(who)).plan?.id).not.toBe(plan.id);
  }

  async function progressOf(who: Account): Promise<{ fortnights: readonly { planId: string }[] }> {
    const response: Response = await request(server()).get(`/${PREFIX}/progress/summary`).set('Cookie', who.cookie).expect(200);

    return response.body as { fortnights: { planId: string }[] };
  }

  async function allowancesOf(who: Account): Promise<{ planRedo: { allowed: boolean; kind: string; used: number } }> {
    const response: Response = await request(server()).get(`/${PREFIX}/meal-plans/allowances`).set('Cookie', who.cookie).expect(200);

    return response.body as { planRedo: { allowed: boolean; kind: string; used: number } };
  }

  /** The client's own poll of a job, as the progress screen reads it. */
  async function clientJob(who: Account, jobId: string): Promise<JobView & { pendingReview: boolean }> {
    const response: Response = await request(server()).get(`/${PREFIX}/meal-plans/jobs/${jobId}`).set('Cookie', who.cookie).expect(200);

    return response.body as JobView & { pendingReview: boolean };
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

  async function latestJob(who: Account): Promise<{ id: string }> {
    const [job] = await tables()<{ id: string }>`
      select id from plan_generation_jobs where user_id = ${who.id} order by created_at desc limit 1`;

    return job ?? { id: '' };
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
    proC = await account('pro-c');
    proD = await account('pro-d');
    proE = await account('pro-e');
    await UserController.grantAdmin(owner.email);
    await setSwitch(true);
    await grant(proA);
    await grant(proB);
    await grant(proC);
    await grant(proD);
    await grant(proE);

    lived = await account('lived');
    fresh = await account('fresh');
    unreviewed = await account('unreviewed');
    paused = await account('paused');
    ended = await account('ended');
    theirs = await account('theirs');
    unready = await account('unready');

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
    links.fresh = await link(proC, fresh);
    links.unreviewed = await link(proA, unreviewed);
    links.paused = await link(proD, paused);
    links.ended = await link(proD, ended);
    links.theirs = await link(proB, theirs);
    links.unready = await link(proD, unready);

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
    /** The client's own job answer, re-read after the professional publishes. */
    let clientJobId: string;

    beforeAll(async () => {
      first = (await activeOf(lived)) as PlanView;
      expect(first).not.toBeNull();
    });

    it('has review on by default, and nothing pending before they ask', async () => {
      expect(await stageOf(proA, links.lived)).toMatchObject({ reviewBeforePublish: true, stage: 'plan_under_way' });
      await expect(rowsWrittenBy(lived.id, async () => expect(await pending(proA, links.lived)).toBeNull())).resolves.toEqual(['read']);
    });

    it('gets a plan that waits for the professional, and no plan id to go to', async () => {
      await expect(generateAndWait(app, lived)).resolves.toMatchObject({ planId: null, status: 'succeeded' });

      // The poll's own answer, read again: finished, and with the professional rather than a plan to open.
      clientJobId = (await latestJob(lived)).id;
      expect(await clientJob(lived, clientJobId)).toMatchObject({ pendingReview: true, planId: null, status: 'succeeded' });

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

      // The same job, through the link: the professional is given the plan to open.
      const polled: Response = await jobOf(proA, links.lived, clientJobId).expect(200);

      expect(polled.body).toMatchObject({ pendingReview: true, planId: next.id, status: 'succeeded' });
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
      expect(swapped).toMatchObject({ id: target?.id, planId: next.id, planStatus: 'pending_review', slot: target?.slot });
      expect((await pending(proA, links.lived))?.days[2]?.meals.find(meal => meal.id === target?.id)?.name).not.toBe(target?.name);

      // A meal of the plan the client lives is not the professional's to change.
      const lived0 = first.days[3]?.meals[0]?.id ?? '';

      await expect(rowsWrittenBy(lived.id, () => swapFor(proA, links.lived, lived0).expect(404))).resolves.toEqual([]);
    });

    it('refuses the professional a second redo of a free client’s fortnight, and writes nothing', async () => {
      // The client's own generation spent the fortnight's one redo; a waiting plan is the fortnight under way.
      await expect(
        rowsWrittenBy(lived.id, async () => {
          const refused: Response = await generateFor(proA, links.lived).expect(429);

          expect((refused.body as { code: string }).code).toBe('QUOTA_EXCEEDED');
        })
      ).resolves.toEqual([]);
      expect((await pending(proA, links.lived))?.id).toBe(next.id);
    });

    it('keeps the check-in on the plan being lived, not the one waiting', async () => {
      // The fortnight being lived ended yesterday, unanswered: it is due, whatever waits behind it.
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      await tables()`update meal_plans set end_date = ${yesterday} where id = ${first.id}`;

      expect(await checkInOf(lived)).toMatchObject({ due: true, plan: { id: first.id } });
      // The professional's list names the waiting plan first; nothing on it says the check-in moved to it.
      expect(await stageOf(proA, links.lived)).toMatchObject({ stage: 'plan_awaiting_review' });
    });

    it('publishes in one step: the waiting plan active, the old one completed', async () => {
      let published: PlanView | undefined;

      await expect(
        rowsWrittenBy(lived.id, async () => {
          const response: Response = await publishFor(proA, links.lived).expect(200);

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
      // The new fortnight is the one read now, and it has not ended.
      expect(await checkInOf(lived)).toMatchObject({ due: false, plan: { id: next.id } });
      expect((await historyOf(lived)).map(row => row.id)).toEqual(expect.arrayContaining([first.id, next.id]));

      const old: Response = await request(server()).get(`/${PREFIX}/meal-plans/${first.id}`).set('Cookie', lived.cookie).expect(200);

      expect((old.body as PlanView).status).toBe('completed');
      await request(server())
        .get(`/${PREFIX}/meal-plans/${next.id}/days/${next.days[0]?.dayIndex ?? 1}`)
        .set('Cookie', lived.cookie)
        .expect(200);
      expect(await stageOf(proA, links.lived)).toMatchObject({ stage: 'plan_under_way' });

      // The client's job now leads to the plan.
      expect(await clientJob(lived, clientJobId)).toMatchObject({ pendingReview: false, planId: next.id, status: 'succeeded' });
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
      const job = await generateForAndWait(proC, links.fresh);

      expect(job.status).toBe('succeeded');

      // The generate is the one write; every poll of the job route is one read.
      const written = (await reviewRows(fresh.id)).slice(before).map(row => row.action);

      expect(written[0]).toBe('write');
      expect(written.slice(1).every(action => action === 'read')).toBe(true);
      expect(written.length).toBeGreaterThan(1);

      firstDraft = (await pending(proC, links.fresh)) as PlanView;
      expect(firstDraft).toMatchObject({ status: 'pending_review' });
      expect(await stageOf(proC, links.fresh)).toMatchObject({ stage: 'plan_awaiting_review' });
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
      const job = await generateForAndWait(proC, links.fresh);

      expect(job.status).toBe('succeeded');

      const replacement = (await pending(proC, links.fresh)) as PlanView;

      expect(replacement.id).not.toBe(firstDraft.id);

      const rows = await planRows(fresh.id);

      expect(rows.filter(row => row.status === 'pending_review').map(row => row.id)).toEqual([replacement.id]);
      expect(rows.map(row => row.id)).not.toContain(firstDraft.id);
      expect(rows.filter(row => row.status === 'active')).toEqual([]);

      await publishFor(proC, links.fresh).expect(200);
      expect((await activeOf(fresh))?.id).toBe(replacement.id);
    });

    it('refuses the professional a new plan over the one being lived, with review on, and writes nothing', async () => {
      const plans = await planRows(fresh.id);

      await expect(rowsWrittenBy(fresh.id, () => generateFor(proC, links.fresh).expect(404))).resolves.toEqual([]);
      expect(await planRows(fresh.id)).toEqual(plans);
    });
  });

  describe('with review off, or no active link', () => {
    it('lets the professional switch review off, one write', async () => {
      let answer: unknown;

      await expect(
        rowsWrittenBy(unreviewed.id, async () => {
          answer = (await setReview(proA, links.unreviewed, false).expect(200)).body;
        })
      ).resolves.toEqual(['write']);
      expect(answer).toEqual({
        linkId: links.unreviewed,
        name: nameOf(unreviewed),
        reviewBeforePublish: false,
        sharesHealth: false,
        since: expect.any(String),
        status: 'active'
      });
      // A value that is not a yes or a no is refused, and writes nothing.
      await expect(
        rowsWrittenBy(unreviewed.id, () =>
          request(server()).patch(clientPath(links.unreviewed)).set('Cookie', proA.cookie).send({ reviewBeforePublish: 'no' }).expect(422)
        )
      ).resolves.toEqual([]);

      // The client's consent is not the professional's to widen: another field in the body changes nothing.
      await request(server())
        .patch(clientPath(links.unreviewed))
        .set('Cookie', proA.cookie)
        .send({ reviewBeforePublish: false, sharesHealth: true })
        .expect(200);

      const [row] = await tables()<{ sharesHealth: boolean }>`select shares_health as "sharesHealth" from care_links where id = ${links.unreviewed}`;

      expect(row?.sharesHealth).toBe(false);
      expect(await stageOf(proA, links.unreviewed)).toMatchObject({ reviewBeforePublish: false });
    });

    it('gives a client with review off their plan at once, as today', async () => {
      const job = await generateAndWait(app, unreviewed);

      expect(job).toMatchObject({ planId: expect.any(String), status: 'succeeded' });
      expect((await activeOf(unreviewed))?.id).toBe(job.planId);
      expect((await planRows(unreviewed.id)).map(row => row.status)).toEqual(['active']);
      expect(await pending(proA, links.unreviewed)).toBeNull();
    });

    it('refuses the professional a new plan over the one being lived, with review off, and writes nothing', async () => {
      const plans = await planRows(unreviewed.id);

      await expect(rowsWrittenBy(unreviewed.id, () => generateFor(proA, links.unreviewed).expect(404))).resolves.toEqual([]);
      expect(await planRows(unreviewed.id)).toEqual(plans);
    });

    it("fails the professional's job for a client still onboarding, and makes no plan", async () => {
      // Not refused at the door (the lead's call, 2026-09-24): the job starts and the pipeline fails it.
      const job = await generateForAndWait(proD, links.unready);

      expect(job).toMatchObject({ error: 'GENERATION_ONBOARDING_INCOMPLETE', planId: null, status: 'failed' });
      expect(await planRows(unready.id)).toEqual([]);
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
      ids = { jobId: (await latestJob(unreviewed)).id, mealId: waiting.days[0]?.meals[0]?.id ?? '' };
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
      const written: string[][] = [];

      await expectNothingMoved(async () => {
        written.push(await rowsWrittenBy(theirs.id, () => jobOf(proB, links.theirs, ids.jobId).expect(404)));
        written.push(await rowsWrittenBy(theirs.id, () => swapFor(proB, links.theirs, ids.mealId).expect(404)));
        written.push(await rowsWrittenBy(theirs.id, () => publishFor(proB, links.theirs).expect(404)));
      });
      // A read's row is written before the read (`0059`): B did look, through their own link, at their own client. The refused writes wrote nothing.
      expect(written).toEqual([['read'], [], []]);
      expect(await activeOf(theirs)).toBeNull();
    });

    it('is one 404 on an ended link, a paused one, an unknown id and a non-id, and writes nothing', async () => {
      const before = { ended: await allTrailRows(ended.id), paused: await allTrailRows(paused.id) };

      const tries: [Account, string][] = [
        [proD, links.ended],
        [proD, links.paused],
        [proB, NOBODYS_LINK],
        [proB, 'not-a-link']
      ];

      for (const [professional, linkId] of tries) {
        for (const call of everyRoute(professional, linkId)) {
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

  /*
   * A waiting plan whose review can no longer happen (owner, 2026-09-24): the
   * link ended, paused, or the professional's grant taken back. It stops
   * counting against the client — their next generation is neither refused nor
   * charged for it, and replaces it. On the free tier a charged redo would be
   * the second of one, a 429, so a success is the proof.
   */
  describe('a waiting plan stranded', () => {
    type Stranded = { readonly client: Account; readonly first: string; readonly waiting: string; readonly waitingJob: string };

    const cases: Record<'ended' | 'paused' | 'revoked', Stranded | undefined> = { ended: undefined, paused: undefined, revoked: undefined };

    /** A client living a plan who asks for the next one, which waits for `professional`. */
    async function waitingFor(professional: Account, name: string): Promise<Stranded & { readonly linkId: string }> {
      const client = await account(name);

      await completeOnboarding(app, client);
      expect((await generateAndWait(app, client)).status).toBe('succeeded');

      const first = (await activeOf(client))?.id ?? '';
      const linkId = await link(professional, client);

      expect(await generateAndWait(app, client)).toMatchObject({ planId: null, status: 'succeeded' });

      const waiting = (await planRows(client.id)).find(row => row.status === 'pending_review')?.id ?? '';

      expect(waiting).not.toBe('');
      // Waiting, it is the fortnight's one redo.
      expect((await allowancesOf(client)).planRedo).toMatchObject({ allowed: false, used: 1 });

      return { client, first, linkId, waiting, waitingJob: (await latestJob(client)).id };
    }

    beforeAll(async () => {
      const ended = await waitingFor(proD, 'stranded-ended');
      const paused = await waitingFor(proD, 'stranded-paused');
      const revoked = await waitingFor(proE, 'stranded-revoked');

      await request(server()).delete(`/${PREFIX}/care/links/${ended.linkId}`).set('Cookie', ended.client.cookie).expect(204);
      await tables()`update care_links set status = 'paused' where id = ${paused.linkId}`;
      await request(server()).delete(`/${PREFIX}/admin/accounts/${proE.id}/professional`).set('Cookie', owner.cookie).expect(204);

      cases.ended = ended;
      cases.paused = paused;
      cases.revoked = revoked;
    });

    it.each(['ended', 'paused', 'revoked'] as const)('with the link %s, costs the client nothing and is replaced by their next plan', async name => {
      const stranded = cases[name] as Stranded;

      // No longer counted: the fortnight's redo is there again.
      expect((await allowancesOf(stranded.client)).planRedo).toMatchObject({ allowed: true, used: 0 });

      const job = await generateAndWait(app, stranded.client);

      expect(job).toMatchObject({ planId: expect.any(String), status: 'succeeded' });
      expect(await clientJob(stranded.client, (await latestJob(stranded.client)).id)).toMatchObject({ pendingReview: false, planId: job.planId });

      // The waiting plan is gone, its job points nowhere, the new plan is the one lived, the old one is history.
      const rows = await planRows(stranded.client.id);

      expect(rows.map(row => row.id)).not.toContain(stranded.waiting);
      expect(rows.filter(row => row.status === 'pending_review')).toEqual([]);
      expect(rows.filter(row => row.status === 'active').map(row => row.id)).toEqual([job.planId]);
      expect(rows.find(row => row.id === stranded.first)?.status).toBe('completed');
      expect(await clientJob(stranded.client, stranded.waitingJob)).toMatchObject({ pendingReview: false, planId: null });
      expect((await activeOf(stranded.client))?.id).toBe(job.planId);
      expect((await allowancesOf(stranded.client)).planRedo).toMatchObject({ used: 1 });
    });
  });
});
