import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { addDays } from 'core/domain/Vacation';
import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { HEALTH_CONSENT_VERSION } from 'core/entities/Health';
import { PlanJobController } from 'core/controllers/Plan';
import { ProfessionalController } from 'core/controllers/Professional';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';
import { database } from 'database';

import {
  acceptAgreement,
  completeOnboarding,
  createApp,
  deleteAccountByEmail,
  deleteAccounts,
  dish,
  enableTotp,
  endFortnight,
  generateAndWait,
  httpServer,
  openPractice,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient,
  SEEDED
} from './harness.js';
import { CheckInSubmittedService, PushService } from '../src/modules/notifications/index.js';
import { EmailService } from '../src/modules/email/services/index.js';

import type { Account } from './harness.js';
import type { CareLinkView } from 'core/controllers/Care';
import type { JobView, PlanView } from 'core/controllers/Plan';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * The narrower view (project 025 phase 4, `0111` §§ 4–5, PRD 025 criteria 9–15).
 *
 * A link opens `full` only while its practitioner holds the badge **and** the
 * client consented to the badged list (`care_links.consent_scope`); otherwise
 * it opens `plan`: the plans that practitioner made through that link, and
 * nothing else, by any route. Three practitioners walk every route under the
 * care module that takes a link id, plus the roster:
 *
 * - **U**, un-badged from the start (a `professionals` row written on the
 *   table, as `care-badge.e2e-spec.ts` makes one), on a link whose consent is
 *   the default `full` — the harder case: the consent would allow everything,
 *   the missing badge alone narrows it;
 * - **B**, badged, on a link whose consent is `plan` (set on the table: the
 *   consent per tier that writes it is phase 5's);
 * - **F**, badged and `full`, read first in full — the reference, what every
 *   route carried before this phase — and then withdrawn by the owner: the very
 *   next request narrows.
 *
 * Each client is built so that a leak would show: a plan from before the link,
 * a plan left waiting by an earlier practitioner's link, a condition and a
 * medication under the health line, a gluten allergy, an event with a name,
 * and (F's) targets a practitioner set. Every answer a narrowed practitioner
 * receives is kept and searched for each of them.
 *
 * Every denial is compared byte for byte with the same route's answer for a
 * link — or a job, or a meal — that does not exist. A check-in's notice to the
 * practitioner is caught at its one door (`CheckInSubmittedService.notify`,
 * and `PushService.send` behind it), with F's full-scope check-in as the
 * control that the spy sees one when there is one.
 *
 * The race (`PlanRepository.createPlanAtomically` → `isAskingLink`): a
 * practitioner's generation is held at its save (`PlanJobController.persist`)
 * while the client ends that link and accepts U's; the plan saved carries no
 * link, and U cannot see it.
 *
 * Requires a real database — see ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

type Json = Record<string, unknown>;

const NOBODYS_LINK = '00000000-0000-4000-8000-000000000000';
const NOBODYS_ID = '00000000-0000-4000-8000-0000000000aa';
const MEDICATION = 'Levotiroxina de alcance';
const CONDITION_LABEL = 'Hipotiroidismo';
const EVENT_NAME = 'Boda de Ximénez';

/* The exact keys of every answer a `plan` scope receives (PRD 025 criterion 9). */
const PAGE_KEYS = ['client', 'plan', 'plans'];
const CLIENT_KEYS = ['linkId', 'name', 'reviewBeforePublish', 'sharesHealth', 'since', 'status'];
const ROSTER_KEYS = ['clients', 'invitations'];
const ROSTER_ROW_KEYS = [...CLIENT_KEYS, 'stage'].sort();
const PLAN_KEYS = ['days', 'endDate', 'id', 'startDate', 'status'];
const DAY_KEYS = ['date', 'dayIndex', 'meals', 'totals'];
const MEAL_KEYS = [
  'accompaniments',
  'carbsG',
  'cookMinutes',
  'difficulty',
  'fatG',
  'fiberG',
  'id',
  'illustrationPath',
  'ingredients',
  'kcal',
  'name',
  'prepMinutes',
  'proteinG',
  'recipeId',
  'servings',
  'slot'
];
const MEAL_DETAIL_KEYS = [
  'accompaniments',
  'carbsG',
  'cookMinutes',
  'cuisine',
  'date',
  'dayIndex',
  'difficulty',
  'equipment',
  'fatG',
  'fiberG',
  'id',
  'illustrationPath',
  'ingredients',
  'kcal',
  'name',
  'pictureStatus',
  'planEndDate',
  'planId',
  'planStatus',
  'prepMinutes',
  'proteinG',
  'recipeId',
  'servings',
  'slot',
  'steps'
];
const SUMMARY_KEYS = ['endDate', 'id', 'locked', 'replaced', 'startDate', 'status'];
const JOB_KEYS = ['error', 'errorDetail', 'id', 'pendingReview', 'planId', 'status', 'step'];

/**
 * Keys no `plan`-scope answer may carry at any depth. `errorDetail` is the one
 * exception the walk allows, as null (see `forbiddenKeys`).
 */
const FORBIDDEN = new Set([
  'adherence',
  'allergens',
  'checkIn',
  'checkIns',
  'conditions',
  'errorDetail',
  'fortnights',
  'health',
  'intolerances',
  'loadedFor',
  'medications',
  'pantry',
  'progress',
  'strategy',
  'suggestedKcal',
  'supplements',
  'targets',
  'verdict',
  'version',
  'weight',
  'weightKg',
  'weights'
]);

/** Every forbidden key anywhere in the body, by path. `errorDetail: null` is allowed: the key is the job's shape, the value names nothing. */
function forbiddenKeys(body: unknown, path = '$'): string[] {
  if (Array.isArray(body)) {
    return body.flatMap((item, index) => forbiddenKeys(item, `${path}[${index}]`));
  }

  if (body === null || typeof body !== 'object') {
    return [];
  }

  return Object.entries(body as Json).flatMap(([key, value]) => {
    const here = `${path}.${key}`;
    const own = FORBIDDEN.has(key) && !(key === 'errorDetail' && value === null) ? [here] : [];

    return [...own, ...forbiddenKeys(value, here)];
  });
}

function sorted(body: unknown): string[] {
  return Object.keys(body as object).sort();
}

function expectPlanOnly(plan: unknown): void {
  expect(sorted(plan)).toEqual(PLAN_KEYS);

  for (const day of (plan as { days: unknown[] }).days) {
    expect(sorted(day)).toEqual(DAY_KEYS);

    for (const meal of (day as { meals: unknown[] }).meals) {
      expect(sorted(meal)).toEqual(MEAL_KEYS);
    }
  }

  expect(forbiddenKeys(plan)).toEqual([]);
}

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
  )
];

/** What one client was given before the practitioner under test could see them. */
type Before = {
  readonly earlierJobId: string | null;
  /** A plan left waiting by an earlier practitioner's link, and its job — absent for F's client, whose full read replaced it. */
  readonly earlierPlanId: string | null;
  readonly ownJobId: string;
  /** Their own plan, made before any link, and its job. */
  readonly ownPlanId: string;
};

type Walk = {
  /** Every answer the practitioner received during the walk. */
  readonly answers: string[];
  before: Before;
  client: Account;
  readonly label: string;
  linkId: string;
  /** A link of another practitioner's, with a client of their own. */
  otherLinkId: string;
  pro: Account;
  /** The plan whose fortnight is under way when the walk generates: ended first, so a generation is allowed at all. */
  runningPlanId: string;
  /** The stage the roster must show before the walk generates, from this link's plans alone. */
  stageBefore: string;
  /** Plans made through this link before the walk began (F's, under full). */
  throughLink: string[];
};

describe('care scope: the narrower view (project 025 phase 4)', () => {
  const stamp = Date.now();
  const made: string[] = [];
  const sent: OutgoingEmail[] = [];
  /** `CheckInSubmittedService.notify` and `PushService.send`, as called. */
  const notices: { readonly to: string }[] = [];
  const pushes: unknown[] = [];
  let app: INestApplication;
  let owner: Account;
  let switchWas = false;
  let glutenId = '';
  let glutenNames: string[] = [];
  /** Held by the race: `PlanJobController.persist` waits on it for the race's client alone. */
  let gate: { readonly client: string; readonly open: Promise<void>; reached: boolean } | null = null;

  /** Badged, full: every client's earlier practitioner, and the race's first. */
  let earlier: Account;
  /** Un-badged from the start. */
  let unbadged: Account;
  /** Badged, on a `plan` link. */
  let badgedPlan: Account;
  /** Badged and full, then withdrawn. */
  let withdrawn: Account;

  const server = () => httpServer(app);
  const address = (label: string) => `scope-${label}-${String(stamp)}@e2e.invalid`;

  async function account(label: string): Promise<Account> {
    const who = await register(app, address(label));

    made.push(who.cookie);

    return who;
  }

  /** TOTP on rotates the session: the cookie it answers is the one to use (PLAN 011 phase 6). */
  async function withTotp(who: Account): Promise<Account> {
    const enabled = await enableTotp(app, who);

    made.push(enabled.cookie);

    return enabled;
  }

  /** May practise, practice open, agreement accepted — and no badge check at all. */
  async function unbadgedPractitioner(label: string): Promise<Account> {
    const who = await account(label);

    await sql()`insert into professionals (user_id) values (${who.id})`;
    await acceptAgreement(app, who);
    await openPractice(who.id);

    return withTotp(who);
  }

  /** The owner's grant route, which writes a `pass` (phase 3, step 7): badged. */
  async function grantBadge(who: Account): Promise<void> {
    await request(server())
      .post(`/${PREFIX}/admin/accounts/${who.id}/professional`)
      .set('Cookie', owner.cookie)
      .send({ collegiateNumber: `28/${String(stamp).slice(-5)}` })
      .expect(201);
  }

  async function badgedPractitioner(label: string): Promise<Account> {
    const who = await account(label);

    await grantBadge(who);
    await acceptAgreement(app, who);
    await openPractice(who.id);

    return withTotp(who);
  }

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

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    throw new Error('No invitation mail arrived');
  }

  async function link(professional: Account, client: Account, sharesHealth = true): Promise<string> {
    const before = sent.length;

    await request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', professional.cookie).send({ email: client.email }).expect(201);

    const token = await tokenMailedTo(client.email, before);
    const accepted: Response = await request(server())
      .post(`/${PREFIX}/care/invitations/${token}/accept`)
      .set('Cookie', client.cookie)
      .send({ consentVersion: CARE_CONSENT_VERSION, sharesHealth });

    expect(accepted.status).toBe(200);

    return (accepted.body as CareLinkView).id;
  }

  const endLink = (client: Account, linkId: string) =>
    request(server()).delete(`/${PREFIX}/care/links/${linkId}`).set('Cookie', client.cookie).expect(204);

  const setScope = (linkId: string, scope: 'full' | 'plan') => sql()`update care_links set consent_scope = ${scope} where id = ${linkId}`;

  // --- The practitioner's routes, each one call, each answer kept -------------

  type Method = 'delete' | 'get' | 'patch' | 'post';

  async function call(who: Account, method: Method, path: string, body?: object, keep?: string[]): Promise<Response> {
    let req = request(server())[method](`/${PREFIX}${path}`).set('Cookie', who.cookie);

    if (body !== undefined) {
      req = req.send(body);
    }

    const response = await req;

    keep?.push(response.text);

    return response;
  }

  /** Every route under the care module that takes a link id, as the practitioner calls it (the controllers, enumerated). */
  function routes(linkId: string, ids: { readonly jobId: string; readonly mealId: string }) {
    return {
      end: ['delete', `/care/links/${linkId}`, undefined],
      generate: ['post', `/care/clients/${linkId}/plan/generate`, undefined],
      job: ['get', `/care/clients/${linkId}/plan/jobs/${ids.jobId}`, undefined],
      overview: ['get', `/care/clients/${linkId}`, undefined],
      pending: ['get', `/care/clients/${linkId}/plan/pending`, undefined],
      publish: ['post', `/care/clients/${linkId}/plan/publish`, undefined],
      review: ['patch', `/care/clients/${linkId}`, { reviewBeforePublish: true }],
      swap: ['post', `/care/clients/${linkId}/plan/meals/${ids.mealId}/swap`, {}],
      targets: ['patch', `/care/clients/${linkId}/targets`, { kcal: 1700 }]
    } as const satisfies Record<string, readonly [Method, string, object | undefined]>;
  }

  function expectSameDenial(got: Response, reference: Response, what: string): void {
    expect({ status: got.status, text: got.text, what }).toEqual({ status: reference.status, text: reference.text, what });
    expect(got.status).toBe(404);
  }

  /** The client's trail, as stored, by kind. */
  async function trailKinds(clientId: string, linkId: string, since: string): Promise<string[]> {
    const rows = await sql()<{ kind: string }>`
      select kind::text as kind from care_access_log where user_id = ${clientId} and link_id = ${linkId} and created_at >= ${since}::timestamptz`;

    return rows.map(row => row.kind);
  }

  async function planRow(planId: string): Promise<{ careLinkId: string | null; status: string } | undefined> {
    const [row] = await sql()<{ careLinkId: string | null; status: string }>`
      select care_link_id as "careLinkId", status::text as status from meal_plans where id = ${planId}`;

    return row;
  }

  async function overrideRow(userId: string): Promise<Json | undefined> {
    const [row] = await sql()<Json>`select * from target_overrides where user_id = ${userId}`;

    return row;
  }

  async function aMealOf(planId: string): Promise<string> {
    const [row] = await sql()<{ id: string }>`
      select m.id from meals m join plan_days d on d.id = m.plan_day_id
      where d.plan_id = ${planId} and m.slot in ('lunch', 'dinner') order by d.day_index desc, m.slot limit 1`;

    if (!row) {
      throw new Error(`No meal in plan ${planId}`);
    }

    return row.id;
  }

  async function latestJobOf(userId: string): Promise<{ id: string; planId: string | null; status: string }> {
    const [row] = await sql()<{ id: string; planId: string | null; status: string }>`
      select id, plan_id as "planId", status::text as status from plan_generation_jobs where user_id = ${userId} order by created_at desc limit 1`;

    if (!row) {
      throw new Error('No job');
    }

    return row;
  }

  async function activePlanOf(who: Account): Promise<PlanView | null> {
    const response = await request(server()).get(`/${PREFIX}/meal-plans/active`).set('Cookie', who.cookie).expect(200);
    const body = response.body as '' | Partial<PlanView> | null;

    return body && typeof body === 'object' && 'id' in body ? (body as PlanView) : null;
  }

  async function settle(): Promise<void> {
    // The notice is a background task (`BackgroundTaskService`): give it the time it would take.
    await new Promise(resolve => setTimeout(resolve, 750));
  }

  /**
   * A client with something to leak: onboarded with a gluten allergy, a
   * condition and a medication under the health consent, an event with a name,
   * their own plan before any link, then a plan left waiting by `earlier`'s
   * link, which they then end.
   */
  async function clientWithAPast(label: string, withEarlierPending = true): Promise<{ before: Before; client: Account }> {
    const client = await account(label);

    await completeOnboarding(app, client, [glutenId], [], true);
    await request(server())
      .put(`/${PREFIX}/health-data`)
      .set('Cookie', client.cookie)
      .send({
        conditions: [{ conditionKey: 'hypothyroidism', label: CONDITION_LABEL }],
        consentVersion: HEALTH_CONSENT_VERSION,
        medications: [{ name: MEDICATION }],
        supplements: []
      })
      .expect(200);
    await request(server())
      .post(`/${PREFIX}/events`)
      .set('Cookie', client.cookie)
      .send({ carbs: 'up', daysBefore: 2, fat: 'down', name: EVENT_NAME, on: addDays(new Date().toISOString().slice(0, 10), 5), protein: 'same' })
      .expect(201);

    await expect(generateAndWait(app, client)).resolves.toMatchObject({ status: 'succeeded' });

    const own = (await activePlanOf(client)) as PlanView;
    const ownJob = await latestJobOf(client.id);

    if (!withEarlierPending) {
      return { before: { earlierJobId: null, earlierPlanId: null, ownJobId: ownJob.id, ownPlanId: own.id }, client };
    }

    const earlierLink = await link(earlier, client);

    // The client asks for their next plan with review on: it waits for `earlier`, stamped with that link.
    await expect(generateAndWait(app, client)).resolves.toMatchObject({ planId: null, status: 'succeeded' });

    const earlierJob = await latestJobOf(client.id);
    const [waiting] = await sql()<{ id: string; careLinkId: string | null }>`
      select id, care_link_id as "careLinkId" from meal_plans where user_id = ${client.id} and status = 'pending_review'`;

    expect(waiting?.careLinkId).toBe(earlierLink);
    await endLink(client, earlierLink);

    return { before: { earlierJobId: earlierJob.id, earlierPlanId: waiting?.id ?? null, ownJobId: ownJob.id, ownPlanId: own.id }, client };
  }

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient([...POOL, ...GLUTEN_FREE_BREAKFASTS]));

    jest.spyOn(EmailService.prototype, 'send').mockImplementation(async message => {
      sent.push(message);

      return Promise.resolve(true);
    });
    jest.spyOn(CheckInSubmittedService.prototype, 'notify').mockImplementation(async professional => {
      notices.push({ to: professional.id });

      return Promise.resolve();
    });
    jest.spyOn(PushService.prototype, 'send').mockImplementation(async (...args: unknown[]) => {
      pushes.push(args);

      return Promise.resolve(0 as never);
    });

    const persist = PlanJobController.persist.bind(PlanJobController);

    jest.spyOn(PlanJobController, 'persist').mockImplementation(async (userId, draft, byProfessional) => {
      const held = gate;

      if (held !== null && held.client === userId) {
        held.reached = true;
        await held.open;
      }

      return persist(userId, draft, byProfessional);
    });

    owner = await account('owner');
    await UserController.grantAdmin(owner.email);
    owner = await withTotp(owner);
    switchWas = await ProfessionalController.isOpen();
    await SettingsController.setFlag('professional', true, UNAUDITED);

    const allergens: Response = await request(server()).get(`/${PREFIX}/safety/allergens`).expect(200);
    const gluten = (allergens.body as readonly Json[]).find(allergen => allergen.key === 'gluten');

    glutenId = String(gluten?.id ?? '');
    glutenNames = Object.entries(gluten ?? {})
      .filter(([key, value]) => key !== 'id' && typeof value === 'string' && value.length > 3)
      .map(([, value]) => String(value));
    expect(glutenId).not.toBe('');

    earlier = await badgedPractitioner('earlier');
    unbadged = await unbadgedPractitioner('unbadged');
    badgedPlan = await badgedPractitioner('badged-plan');
    withdrawn = await badgedPractitioner('withdrawn');
  }, 300_000);

  afterAll(async () => {
    try {
      jest.restoreAllMocks();
      await SettingsController.setFlag('professional', switchWas, UNAUDITED);
      await deleteAccounts(app, made);

      const stragglers = await sql()<{ email: string }>`select email from "user" where email like ${`scope-%-${String(stamp)}@e2e.invalid`}`;

      for (const { email } of stragglers) {
        await deleteAccountByEmail(app, email);
      }

      const [left] = await sql()<{ accounts: number; checks: number; invitations: number; trail: number }>`
        select (select count(*)::int from "user" where email like ${`scope-%-${String(stamp)}@e2e.invalid`}) as accounts,
               (select count(*)::int from care_invitations where email like ${`scope-%-${String(stamp)}@e2e.invalid`}) as invitations,
               (select count(*)::int from care_access_log where professional_name like ${`scope-%-${String(stamp)}`}) as trail,
               (select count(*)::int from professional_badge_checks c where not exists (select 1 from "user" u where u.id = c.user_id)) as checks`;

      expect(left).toEqual({ accounts: 0, checks: 0, invitations: 0, trail: 0 });
    } finally {
      await app?.close();
    }
  });

  /**
   * The walk every narrowed practitioner takes, as `it`s in order over one
   * shared state. `ctx()` is read when each case runs, after the `beforeAll`
   * of the practitioner's own block has filled it.
   */
  function narrowWalk(ctx: () => Walk): void {
    let reference: Record<'job' | 'link' | 'meal' | 'targets', Response>;
    let generatedPlanId = '';
    let generatedJobId = '';
    /** The database's clock when the walk began: the trail rows the walk wrote are the ones after it. */
    let walkStarted = '';

    const r = () => routes(ctx().linkId, { jobId: NOBODYS_ID, mealId: NOBODYS_ID });

    it('answers every refusal the way it answers a link, a job or a meal that does not exist', async () => {
      const { linkId, pro } = ctx();
      const nobody = routes(NOBODYS_LINK, { jobId: NOBODYS_ID, mealId: NOBODYS_ID });

      walkStarted = (await sql()<{ now: string }>`select now()::text as now`)[0]?.now ?? '';
      reference = {
        job: await call(pro, 'get', routes(linkId, { jobId: NOBODYS_ID, mealId: NOBODYS_ID }).job[1]),
        link: await call(pro, 'get', nobody.overview[1]),
        meal: await call(pro, 'post', r().swap[1], {}),
        targets: await call(pro, 'patch', nobody.targets[1], nobody.targets[2])
      };

      expect(reference.link.status).toBe(404);
      expect(reference.job.status).toBe(404);
      expect(reference.meal.status).toBe(404);
      expect(reference.targets.text).toBe(reference.link.text);
    });

    it('lists the client with the exact keys, `sharesHealth` false, and a stage read from this link’s plans alone', async () => {
      const { answers, client, linkId, pro, stageBefore } = ctx();
      const listed = await call(pro, 'get', '/care/clients', undefined, answers);

      expect(listed.status).toBe(200);
      expect(sorted(listed.body)).toEqual(ROSTER_KEYS);

      const rows = (listed.body as { clients: Json[] }).clients;

      for (const row of rows) {
        expect(sorted(row)).toEqual(ROSTER_ROW_KEYS);
        expect(row.stage).not.toBe('check_in_due');
      }

      expect(rows.find(row => row.linkId === linkId)).toMatchObject({ name: client.email.split('@')[0], sharesHealth: false, stage: stageBefore });
      expect(forbiddenKeys(listed.body)).toEqual([]);
    });

    it('shows the page with `client`, `plan` and `plans` only — nothing from before the link, nothing of an earlier link', async () => {
      const { answers, before, linkId, pro, throughLink } = ctx();
      const page = await call(pro, 'get', r().overview[1], undefined, answers);

      expect(page.status).toBe(200);
      expect(sorted(page.body)).toEqual(PAGE_KEYS);

      const body = page.body as { client: Json; plan: Json | null; plans: Json[] };

      expect(sorted(body.client)).toEqual(CLIENT_KEYS);
      expect(body.client).toMatchObject({ linkId, sharesHealth: false, status: 'active' });

      for (const summary of body.plans) {
        expect(sorted(summary)).toEqual(SUMMARY_KEYS);
      }

      const shown = [...(body.plan ? [String(body.plan.id)] : []), ...body.plans.map(summary => String(summary.id))];

      expect(shown).not.toContain(before.ownPlanId);

      if (before.earlierPlanId) {
        expect(shown).not.toContain(before.earlierPlanId);
      }

      // Every plan shown carries this link; every plan carrying it that the client has lived is shown.
      for (const id of shown) {
        expect((await planRow(id))?.careLinkId).toBe(linkId);
      }

      expect(body.plans.map(summary => summary.id).sort()).toEqual([...throughLink].sort());

      if (body.plan) {
        expectPlanOnly(body.plan);
      }

      expect(forbiddenKeys(page.body)).toEqual([]);
    });

    it('refuses the targets write as “no such client”, writes nothing, and leaves no `targets`, `progress` or `health` row', async () => {
      const { answers, client, linkId, pro } = ctx();
      const before = await overrideRow(client.id);
      const refused = await call(pro, 'patch', r().targets[1], r().targets[2], answers);

      expectSameDenial(refused, reference.targets, 'targets write');
      expect(await overrideRow(client.id)).toEqual(before);

      const kinds = await trailKinds(client.id, linkId, walkStarted);

      expect(kinds.filter(kind => ['health', 'progress', 'targets'].includes(kind))).toEqual([]);
    });

    it('answers the review setting with the link alone, `sharesHealth` false', async () => {
      const { answers, pro } = ctx();
      const set = await call(pro, 'patch', r().review[1], r().review[2], answers);

      expect(set.status).toBe(200);
      expect(sorted(set.body)).toEqual(CLIENT_KEYS);
      expect(set.body).toMatchObject({ reviewBeforePublish: true, sharesHealth: false });
    });

    it('cannot reach a plan from before the link, or one an earlier link left waiting: by job, by meal, by pending, by publish', async () => {
      const { answers, before, linkId, pro } = ctx();

      for (const [what, jobId] of [
        ['own job before the link', before.ownJobId],
        ['earlier link’s job', before.earlierJobId]
      ] as const) {
        if (jobId) {
          expectSameDenial(await call(pro, 'get', routes(linkId, { jobId, mealId: NOBODYS_ID }).job[1], undefined, answers), reference.job, what);
        }
      }

      for (const [what, planId] of [
        ['a meal of the plan before the link', before.ownPlanId],
        ['a meal of the earlier link’s waiting plan', before.earlierPlanId]
      ] as const) {
        if (planId) {
          const mealId = await aMealOf(planId);

          expectSameDenial(await call(pro, 'post', routes(linkId, { jobId: NOBODYS_ID, mealId }).swap[1], {}, answers), reference.meal, what);
        }
      }

      const pending = await call(pro, 'get', r().pending[1], undefined, answers);

      expect(pending.status).toBe(200);
      expect(pending.body === null || pending.text === '' || Object.keys(pending.body as object).length === 0).toBe(true);

      const published = await call(pro, 'post', r().publish[1], undefined, answers);

      expect(published.status).toBe(404);
      expect(published.body).toEqual({ code: 'NOT_FOUND', message: 'Plan not found', statusCode: 404 });

      if (before.earlierPlanId) {
        // Still waiting, untouched, for nobody: the refusal published nothing.
        expect(await planRow(before.earlierPlanId)).toMatchObject({ status: 'pending_review' });
      }
    });

    it('generates through the link — every poll plan-only — and the plan waits stamped with this link', async () => {
      const { answers, before, linkId, pro, runningPlanId } = ctx();

      await endFortnight(runningPlanId);

      const started = await call(pro, 'post', r().generate[1], undefined, answers);

      expect(started.status).toBe(201);
      expect(sorted(started.body)).toEqual(JOB_KEYS);
      expect((started.body as JobView).errorDetail).toBeNull();
      generatedJobId = (started.body as JobView).id;

      const deadline = Date.now() + 60_000;
      let job: JobView | undefined;

      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 250));

        const polled = await call(pro, 'get', routes(linkId, { jobId: generatedJobId, mealId: NOBODYS_ID }).job[1], undefined, answers);

        expect(polled.status).toBe(200);
        expect(sorted(polled.body)).toEqual(JOB_KEYS);
        expect((polled.body as JobView).errorDetail).toBeNull();
        job = polled.body as JobView;

        if (job.status === 'succeeded' || job.status === 'failed') {
          break;
        }
      }

      expect(job).toMatchObject({ pendingReview: true, status: 'succeeded' });
      generatedPlanId = job?.planId ?? '';
      expect(await planRow(generatedPlanId)).toEqual({ careLinkId: linkId, status: 'pending_review' });

      if (before.earlierPlanId) {
        // It replaced what an earlier link left waiting: one waiting plan per client.
        expect(await planRow(before.earlierPlanId)).toBeUndefined();
      }
    });

    it('reads the waiting plan plan-only, swaps a meal of it without `status` or `verdict`, and publishes it stamped with this link', async () => {
      const { answers, linkId, pro } = ctx();
      const pending = await call(pro, 'get', r().pending[1], undefined, answers);

      expect(pending.status).toBe(200);
      expect((pending.body as Json).id).toBe(generatedPlanId);
      expectPlanOnly(pending.body);

      const mealId = await aMealOf(generatedPlanId);
      const swapped = await call(pro, 'post', routes(linkId, { jobId: NOBODYS_ID, mealId }).swap[1], {}, answers);

      expect(swapped.status).toBe(201);
      expect(sorted(swapped.body)).toEqual(MEAL_DETAIL_KEYS);
      expect(forbiddenKeys(swapped.body)).toEqual([]);

      const published = await call(pro, 'post', r().publish[1], undefined, answers);

      expect(published.status).toBe(200);
      expect((published.body as Json).id).toBe(generatedPlanId);
      expectPlanOnly(published.body);
      expect(await planRow(generatedPlanId)).toEqual({ careLinkId: linkId, status: 'active' });
    });

    it('then shows that plan on the page and in the history, and the roster says it is under way', async () => {
      const { answers, before, client, linkId, pro, throughLink } = ctx();
      const page = await call(pro, 'get', r().overview[1], undefined, answers);
      const body = page.body as { plan: Json | null; plans: Json[] };

      expect(sorted(page.body)).toEqual(PAGE_KEYS);
      expect(body.plan?.id).toBe(generatedPlanId);
      expectPlanOnly(body.plan);
      expect(body.plans.map(summary => summary.id).sort()).toEqual([...throughLink, generatedPlanId].sort());
      expect(body.plans.map(summary => summary.id)).not.toContain(before.ownPlanId);

      const listed = await call(pro, 'get', '/care/clients', undefined, answers);

      expect((listed.body as { clients: Json[] }).clients.find(row => row.linkId === linkId)).toMatchObject({ stage: 'plan_under_way' });
      // Their own read is untouched: the same plan, with everything a client sees of it.
      const own = (await activePlanOf(client)) as PlanView;

      expect(own.id).toBe(generatedPlanId);
      expect(own).toHaveProperty('strategy');
      expect(own).toHaveProperty('version');
      expect(own.days.every(day => 'targets' in day && 'loadedFor' in day)).toBe(true);
      expect(own.days.flatMap(day => day.meals).every(meal => 'status' in meal)).toBe(true);
    });

    it('answers another practitioner’s link id on every route exactly as a link that does not exist', async () => {
      const { answers, otherLinkId, pro } = ctx();
      const theirs = routes(otherLinkId, { jobId: NOBODYS_ID, mealId: NOBODYS_ID });
      const nobody = routes(NOBODYS_LINK, { jobId: NOBODYS_ID, mealId: NOBODYS_ID });

      // `generate` spends one of three an hour, and `end` is the client's door: the generate case is one call, the end case none.
      for (const name of ['overview', 'targets', 'review', 'pending', 'generate', 'job', 'swap', 'publish'] as const) {
        const [method, path, body] = theirs[name];
        const [, nobodyPath, nobodyBody] = nobody[name];
        const got = await call(pro, method, path, body, answers);
        const expected = name === 'generate' ? reference.link : await call(pro, method, nobodyPath, nobodyBody);

        expectSameDenial(got, expected, `another practitioner’s link: ${name}`);
      }
    });

    it('leaves the client’s own routes as they were', async () => {
      const { before, client } = ctx();
      const history = await request(server()).get(`/${PREFIX}/meal-plans`).set('Cookie', client.cookie).expect(200);

      expect((history.body as Json[]).map(summary => summary.id)).toContain(before.ownPlanId);
      expect(sorted((history.body as Json[])[0])).toContain('version');

      const profile = await request(server()).get(`/${PREFIX}/profile`).set('Cookie', client.cookie).expect(200);

      expect(profile.body).toHaveProperty('targets');
      await request(server()).get(`/${PREFIX}/health-data`).set('Cookie', client.cookie).expect(200);
      await request(server()).get(`/${PREFIX}/check-ins/status`).set('Cookie', client.cookie).expect(200);
      await request(server()).get(`/${PREFIX}/care/links/me`).set('Cookie', client.cookie).expect(200);
    });

    it('names no event, condition, medication or allergen in any answer it gave the practitioner', async () => {
      const { answers, client, linkId } = ctx();
      /*
       * The client's own words, searched everywhere. The allergen's names are
       * searched outside a dish's own words (`name`, and a step's `text` and
       * `cue`): a dish of the shared library may be «Espaguetis sin gluten»,
       * with «Pasta sin gluten» in it and a step to cook it, which is the plan
       * the practitioner is entitled to read — not the client's declaration.
       */
      const own = [EVENT_NAME, 'Ximénez', MEDICATION, CONDITION_LABEL, 'hypothyroidism'];
      const declared = ['gluten', ...glutenNames];
      const unnamed = answers.map(text => text.replace(/"(cue|name|text)":"(?:[^"\\]|\\.)*"/g, '"$1":""'));

      expect(answers.length).toBeGreaterThan(10);

      for (const [word, haystack] of [...own.map(word => [word, answers] as const), ...declared.map(word => [word, unnamed] as const)]) {
        const needle = word.toLowerCase();
        // Each hit with the text around it, so a failure says where the word was.
        const hits = haystack.flatMap(text => {
          const at = text.toLowerCase().indexOf(needle);

          return at === -1 ? [] : [text.slice(Math.max(0, at - 120), at + needle.length + 60)];
        });

        expect({ hits, word }).toEqual({ hits: [], word });
      }

      // And the whole walk read or wrote nothing outside the plans.
      const kinds = await trailKinds(client.id, linkId, walkStarted);

      expect([...new Set(kinds)].sort()).toEqual(expect.arrayContaining(['overview', 'review']));
      expect(kinds.filter(kind => !['list', 'overview', 'plan', 'review'].includes(kind))).toEqual([]);
    });
  }

  /** A client's check-in, and what it set off. */
  async function checkIn(client: Account, planId: string): Promise<{ notices: string[]; pushes: number; targets: unknown }> {
    const before = { notices: notices.length, pushes: pushes.length };
    const response = await request(server())
      .post(`/${PREFIX}/check-ins`)
      .set('Cookie', client.cookie)
      .send({ difficulty: 'ok', hunger: 'hungry', planId, satisfaction: 4, weightKg: 71 })
      .expect(201);

    await settle();

    return {
      notices: notices.slice(before.notices).map(notice => notice.to),
      pushes: pushes.length - before.pushes,
      targets: (response.body as { targets: unknown }).targets
    };
  }

  // --- (1) Un-badged from the start ------------------------------------------

  describe('U: a practitioner without a badge, on a link whose consent is `full`', () => {
    const walk = { answers: [] as string[], label: 'unbadged' } as Walk;

    beforeAll(async () => {
      const { before, client } = await clientWithAPast('client-u');

      walk.pro = unbadged;
      walk.client = client;
      walk.before = before;
      walk.linkId = await link(unbadged, client);
      walk.runningPlanId = before.ownPlanId;
      // Under full it would read `plan_awaiting_review`: a plan waits — but not one made through this link.
      walk.stageBefore = 'awaiting_plan';
      walk.throughLink = [];

      // Another practitioner's link, with a client of their own.
      const theirs = await account('client-u-other');

      await completeOnboarding(app, theirs);
      walk.otherLinkId = await link(earlier, theirs, false);

      expect(
        (await sql()<{ consentScope: string }>`select consent_scope::text as "consentScope" from care_links where id = ${walk.linkId}`)[0]
      ).toEqual({ consentScope: 'full' });
    }, 300_000);

    it('sends the practitioner no notice of a check-in, by mail or push, and the client’s own nudge runs', async () => {
      const result = await checkIn(walk.client, walk.before.ownPlanId);

      expect(result.notices).toEqual([]);
      expect(result.pushes).toBe(0);
      expect(result.targets).toMatchObject({ fromKcal: expect.any(Number), toKcal: expect.any(Number) });
    });

    narrowWalk(() => walk);

    it('a badge gained on a link whose consent is `plan` widens nothing; consent to the badged list is what widens it', async () => {
      await setScope(walk.linkId, 'plan');
      await grantBadge(unbadged);

      const narrow = await call(unbadged, 'get', `/care/clients/${walk.linkId}`, undefined, walk.answers);

      expect(narrow.status).toBe(200);
      expect(sorted(narrow.body)).toEqual(PAGE_KEYS);
      expect(forbiddenKeys(narrow.body)).toEqual([]);
      await expect(call(unbadged, 'patch', `/care/clients/${walk.linkId}/targets`, { kcal: 1700 })).resolves.toMatchObject({ status: 404 });

      // The control: the same badge, the client's consent `full` — the page widens, so the narrow read above was the consent's doing.
      await setScope(walk.linkId, 'full');

      const wide = await call(unbadged, 'get', `/care/clients/${walk.linkId}`);

      expect(sorted(wide.body)).toEqual(['client', 'health', 'plan', 'plans', 'progress', 'targets']);
      await setScope(walk.linkId, 'plan');
    });
  });

  // --- (2) Badged, on a `plan` link ------------------------------------------

  describe('B: a badged practitioner on a link whose consent is `plan`', () => {
    const walk = { answers: [] as string[], label: 'badged-plan' } as Walk;

    beforeAll(async () => {
      const { before, client } = await clientWithAPast('client-b');

      walk.pro = badgedPlan;
      walk.client = client;
      walk.before = before;
      walk.linkId = await link(badgedPlan, client);
      await setScope(walk.linkId, 'plan');
      walk.runningPlanId = before.ownPlanId;
      walk.stageBefore = 'awaiting_plan';
      walk.throughLink = [];
      walk.otherLinkId = await sql()<{
        id: string;
      }>`select id from care_links where professional_id = ${earlier.id} and status = 'active' limit 1`.then(rows => rows[0]?.id ?? '');
      expect(walk.otherLinkId).not.toBe('');
    }, 300_000);

    it('sends the practitioner no notice of a check-in, by mail or push, and the client’s own nudge runs', async () => {
      const result = await checkIn(walk.client, walk.before.ownPlanId);

      expect(result.notices).toEqual([]);
      expect(result.pushes).toBe(0);
      expect(result.targets).toMatchObject({ fromKcal: expect.any(Number), toKcal: expect.any(Number) });
    });

    narrowWalk(() => walk);
  });

  // --- (3) Badged and full, then withdrawn -----------------------------------

  describe('F: a badged practitioner on a `full` link, whose badge the owner withdraws', () => {
    const walk = { answers: [] as string[], label: 'withdrawn' } as Walk;
    let fullPlanId = '';

    beforeAll(async () => {
      const { before, client } = await clientWithAPast('client-f', false);

      walk.pro = withdrawn;
      walk.client = client;
      walk.before = before;
      walk.linkId = await link(withdrawn, client);
      walk.stageBefore = 'plan_under_way';
      walk.otherLinkId = await sql()<{
        id: string;
      }>`select id from care_links where professional_id = ${unbadged.id} and status = 'active' limit 1`.then(rows => rows[0]?.id ?? '');
      expect(walk.otherLinkId).not.toBe('');
    }, 300_000);

    it('under full, reads what it read before this phase: progress, targets and health on the page, strategy, day targets and meal status on the plan', async () => {
      const page = await call(withdrawn, 'get', `/care/clients/${walk.linkId}`);

      expect(page.status).toBe(200);
      expect(sorted(page.body)).toEqual(['client', 'health', 'plan', 'plans', 'progress', 'targets']);
      expect((page.body as { client: Json }).client).toMatchObject({ sharesHealth: true });
      expect(page.text).toContain(MEDICATION);
      // The plan before the link is on the full page: under full the link is no filter.
      expect((page.body as { plan: Json }).plan.id).toBe(walk.before.ownPlanId);
      expect(sorted((page.body as { plan: Json }).plan)).toEqual(['days', 'endDate', 'id', 'startDate', 'status', 'strategy', 'version']);

      const day = ((page.body as { plan: { days: Json[] } }).plan.days[0] ?? {}) as Json;

      expect(sorted(day)).toEqual(['date', 'dayIndex', 'loadedFor', 'meals', 'targets', 'totals']);
      expect(((day.meals as Json[])[0] ?? {}) as Json).toHaveProperty('status');
      expect(page.text).toContain(EVENT_NAME);

      // Targets set by F, a check-in under full: F is told, and the nudge is F's to give, not the client's.
      await call(withdrawn, 'patch', `/care/clients/${walk.linkId}/targets`, { kcal: 1800 }).then(response => expect(response.status).toBe(200));

      const result = await checkIn(walk.client, walk.before.ownPlanId);

      expect(result.notices).toEqual([withdrawn.id]);
      expect(result.targets).toBeNull();
    });

    it('under full, generates and publishes a plan, which carries this link', async () => {
      await endFortnight(walk.before.ownPlanId);

      const started = await call(withdrawn, 'post', `/care/clients/${walk.linkId}/plan/generate`);

      expect(started.status).toBe(201);
      expect(sorted(started.body)).toEqual(JOB_KEYS);

      const jobId = (started.body as JobView).id;
      const deadline = Date.now() + 60_000;
      let job: JobView | undefined;

      while (Date.now() < deadline && job?.status !== 'succeeded' && job?.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 250));
        job = (await call(withdrawn, 'get', `/care/clients/${walk.linkId}/plan/jobs/${jobId}`)).body as JobView;
      }

      expect(job).toMatchObject({ status: 'succeeded' });
      fullPlanId = job?.planId ?? '';

      const pending = await call(withdrawn, 'get', `/care/clients/${walk.linkId}/plan/pending`);

      expect(sorted(pending.body)).toEqual(['days', 'endDate', 'id', 'startDate', 'status', 'strategy', 'version']);

      const published = await call(withdrawn, 'post', `/care/clients/${walk.linkId}/plan/publish`);

      expect(published.status).toBe(200);
      expect(await planRow(fullPlanId)).toEqual({ careLinkId: walk.linkId, status: 'active' });

      // Its fortnight over and unanswered: under full, the roster says a check-in is due.
      await endFortnight(fullPlanId);

      const listed = await call(withdrawn, 'get', '/care/clients');

      expect((listed.body as { clients: Json[] }).clients.find(row => row.linkId === walk.linkId)).toMatchObject({
        sharesHealth: true,
        stage: 'check_in_due'
      });
    });

    it('narrows on the very next request once the badge is withdrawn', async () => {
      const removal = await request(server())
        .post(`/${PREFIX}/admin/professionals/${withdrawn.id}/badge/removal`)
        .set('Cookie', owner.cookie)
        .send({ facts: 'La consulta del registro no lo encuentra.', kind: 'withdrawn', reason: 'other', source: 'own_check' });

      expect(removal.status).toBe(200);

      const page = await call(withdrawn, 'get', `/care/clients/${walk.linkId}`, undefined, walk.answers);

      expect(page.status).toBe(200);
      expect(sorted(page.body)).toEqual(PAGE_KEYS);
      expect((page.body as { plan: Json }).plan.id).toBe(fullPlanId);
      expect(forbiddenKeys(page.body)).toEqual([]);

      walk.runningPlanId = fullPlanId;
      walk.throughLink = [fullPlanId];
    });

    it('sends no notice of the next check-in, and the client’s own nudge runs though F set their targets', async () => {
      const result = await checkIn(walk.client, fullPlanId);

      expect(result.notices).toEqual([]);
      expect(result.pushes).toBe(0);
      expect(result.targets).toMatchObject({ fromKcal: expect.any(Number), toKcal: expect.any(Number) });
    });

    narrowWalk(() => walk);
  });

  // --- The race ----------------------------------------------------------------

  describe('a generation in flight while the client changes practitioner', () => {
    it('saves a plan that carries no link, which the new, narrow practitioner cannot see', async () => {
      const client = await account('client-race');

      await completeOnboarding(app, client);

      const first = await link(earlier, client, false);
      let open: () => void = () => undefined;

      gate = {
        client: client.id,
        open: new Promise<void>(resolve => {
          open = resolve;
        }),
        reached: false
      };

      try {
        const started = await call(earlier, 'post', `/care/clients/${first}/plan/generate`);

        expect(started.status).toBe(201);

        const jobId = (started.body as JobView).id;
        const deadline = Date.now() + 60_000;

        while (!gate.reached && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        expect(gate.reached).toBe(true);

        // Held at the save: the client ends that link and takes U's.
        await endLink(client, first);

        const second = await link(unbadged, client, false);

        // U holds a badge since the case above; the client consented to the plan list alone, so U reads `plan`.
        await setScope(second, 'plan');

        open();

        const finished = Date.now() + 30_000;
        let job = await latestJobOf(client.id);

        while (job.status !== 'succeeded' && job.status !== 'failed' && Date.now() < finished) {
          await new Promise(resolve => setTimeout(resolve, 250));
          job = await latestJobOf(client.id);
        }

        expect(job).toMatchObject({ id: jobId, status: 'succeeded' });

        const plans = await sql()<{ id: string; careLinkId: string | null; status: string }>`
          select id, care_link_id as "careLinkId", status::text as status from meal_plans where user_id = ${client.id}`;

        expect(plans).toHaveLength(1);
        expect(plans[0]).toMatchObject({ careLinkId: null, status: 'active' });

        const page = await call(unbadged, 'get', `/care/clients/${second}`);

        expect(sorted(page.body)).toEqual(PAGE_KEYS);
        expect(page.body).toMatchObject({ plan: null, plans: [] });

        const job404 = await call(unbadged, 'get', `/care/clients/${second}/plan/jobs/${jobId}`);
        const unknown = await call(unbadged, 'get', `/care/clients/${second}/plan/jobs/${NOBODYS_ID}`);

        expectSameDenial(job404, unknown, 'the job from before the link');

        const listed = await call(unbadged, 'get', '/care/clients');

        expect((listed.body as { clients: Json[] }).clients.find(row => row.linkId === second)).toMatchObject({ stage: 'awaiting_plan' });
      } finally {
        open();
        gate = null;
      }
    }, 120_000);
  });
});
