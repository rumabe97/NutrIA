import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { HEALTH_CONSENT_VERSION } from 'core/entities/Health';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';
import { ProfessionalController } from 'core/controllers/Professional';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';
import { database } from 'database';

import {
  completeOnboarding,
  createApp,
  deleteAccountByEmail,
  deleteAccounts,
  enableTotp,
  generateAndWait,
  httpServer,
  makePractitioner,
  moveCloseDue,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient
} from './harness.js';
import { CheckInSubmittedService, PushService } from '../src/modules/notifications/index.js';
import { EmailService } from '../src/modules/email/services/index.js';
import { ENV, validateEnv } from '../src/config/index.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * The walk (project 025 phase 7, PRD 025 criteria 9, 10, 13–15, 17): every
 * route a practitioner could try against a client, as every kind of account,
 * on real Postgres.
 *
 * **The routes are not typed here, they are read from the booted
 * application** — the Express router's own stack, after Nest has mounted every
 * controller — and filtered to everything under `/care` and every route of the
 * modules that hold a client's data (plans, jobs, meals, shopping lists,
 * check-ins, health data, progress, the profile, events, vacations, fixed
 * meals). Each must have a row in `TABLE` saying what it answers to each kind
 * of account, and every row must name a route that exists: a route added
 * without a row, or removed with its row left, fails the first case by name.
 *
 * **The kinds**: an un-badged practitioner on a `plan` link; a badged one on
 * `plan`; a badged one on `full` with the health line; a suspended one; one
 * whose close has come but whom the sweep has not reached; an ordinary account
 * and another practitioner, both holding the un-badged link's client's ids; and
 * that client themselves. Every id a route takes is the client's own — the plan,
 * the job and a meal from **before the link**, a shopping item, an event — so a
 * route that answered one would be a leak, and every 404 is about the id, not a
 * malformed one.
 *
 * Every answer is checked: the status the table gives, or for `own` (a route
 * that answers about the caller alone) that it carries nothing of the client —
 * their id, address, name, declared words, or any of their plan, job, meal or
 * item ids. Every answer an un-badged or `plan`-scope practitioner receives from
 * `/care` is also searched for the keys the narrower view may never carry
 * (`care-scope`'s list, with what phases 5–6 added).
 *
 * **No model reads what this project adds** (criterion 16/17's end-to-end half):
 * every prompt the scripted model was sent while profiles, badges, restrictions
 * and titled names stood is searched for each of them.
 *
 * Mail, pushes and check-in notices are caught in the process. The roster's own
 * limit (ten a minute) is why each kind asks it once. Requires a real database —
 * see ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

type Json = Record<string, unknown>;

const KINDS = ['unbadged', 'badgedPlan', 'badgedFull', 'suspended', 'closingDue', 'ordinary', 'otherPractitioner', 'client'] as const;

type Kind = (typeof KINDS)[number];

/** A status the route must answer; `own` — it answers about the caller and carries nothing of the client; or why it is not walked here. */
type Expect = 'own' | `skip: ${string}` | number;

type Method = 'delete' | 'get' | 'patch' | 'post' | 'put';

type Row = { readonly body?: Json; readonly expect: Readonly<Record<Kind, Expect>>; readonly query?: string };

/** Which modules hold a client's data, or are the care workspace: their every route is in the walk. */
/**
 * Every first path segment the application mounts is in exactly one of these two lists, and the first case fails by
 * name on a segment in neither or a listed one no longer mounted: a new module is mounted only once somebody has
 * decided whether a practitioner could reach a client through it.
 *
 * **Walked**: the care workspace, and every module that holds a person's own data — each route a row of `TABLE`.
 */
const WALKED_SEGMENTS = [
  'assistant',
  'care',
  'check-ins',
  'events',
  'fixed-meals',
  'health-data',
  'meal-plans',
  'notifications',
  'onboarding',
  'pantry',
  'profile',
  'progress',
  'recipes',
  'safety',
  'shopping-lists',
  'vacations'
] as const;

/** **Not walked**, each with why no practitioner reaches a client's data through it. */
const UNWALKED_SEGMENTS: Readonly<Record<string, string>> = {
  admin: 'the owner’s console: `@Roles(admin)` on every controller, a 404 to anybody else (admin, care-restriction prove it)',
  auth: 'sign-in, sign-up and the session itself: the caller’s own account, no id of anybody else’s',
  billing: 'the caller’s own subscription and Stripe’s signed webhook; no route takes another account’s id',
  cron: 'the daily jobs, behind `CronSecretGuard` — a bearer secret no session carries',
  'csp-report': 'the browser’s CSP reports: write-only, read by nobody through the API',
  feedback: 'the caller sends feedback; one write, no read, no id',
  health: 'the service’s own liveness and readiness: no account data at all',
  settings: 'the public flags and sign-in providers: the same answer for everybody',
  users: '`/users/me` and its deletion: the session’s own account alone'
};

const SCOPE = new RegExp(`^/(${WALKED_SEGMENTS.join('|')})(/|$)`);

/** Keys no answer about a client may carry under the plan-only view (`care-scope`, plus phases 5–6). */
const FORBIDDEN = new Set([
  'adherence',
  'allergens',
  'checkIn',
  'checkIns',
  'conditions',
  'fortnights',
  'health',
  'healthShares',
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
  'weight',
  'weightKg',
  'weights'
]);

function forbiddenKeys(body: unknown, path = '$'): string[] {
  if (Array.isArray(body)) {
    return body.flatMap((item, index) => forbiddenKeys(item, `${path}[${index}]`));
  }

  if (body === null || typeof body !== 'object') {
    return [];
  }

  return Object.entries(body as Json).flatMap(([key, value]) => [
    ...(FORBIDDEN.has(key) ? [`${path}.${key}`] : []),
    ...forbiddenKeys(value, `${path}.${key}`)
  ]);
}

/** The same answer for every kind: a status, `own`, or a skip. */
function all(expect: Expect): Readonly<Record<Kind, Expect>> {
  return Object.fromEntries(KINDS.map(kind => [kind, expect])) as Record<Kind, Expect>;
}

/** A route behind the practitioner's door: `practising` for the three practising kinds, 404 for every other. */
function practising(answer: Expect, overrides: Partial<Record<Kind, Expect>> = {}): Readonly<Record<Kind, Expect>> {
  return { ...all(404), badgedFull: answer, badgedPlan: answer, unbadged: answer, ...overrides };
}

/** A route about the session's own data: everybody `own`, the client's own answer said apart. */
function own(client: Expect = 'own'): Readonly<Record<Kind, Expect>> {
  return { ...all('own'), client };
}

/** A route that takes one of the client's ids: a 404 for everybody but the client. */
function theirs(client: Expect): Readonly<Record<Kind, Expect>> {
  return { ...all(404), client };
}

const CLIENT_SKIP = 'skip: changes the client’s own data; the client’s own suites own it';
const SUPPLEMENT = 'Colágeno de paseo';
const EVENT_NAME = 'Boda de Quintanilla';
const PANTRY_LABEL = 'Altramuces de paseo';
const CONVERSATION_TITLE = 'Conversación de Villarrubia';
const PROFILE_WORDS = 'Perfil Zarzalejo de paseo';
const RESTRICTION_FACTS = 'Hechos de Valdepeñuelas para la prueba.';
const BADGE_NUMBER = '28/77123';

/**
 * Every route in scope, by `METHOD /path` as the router mounts it (without the global prefix), and what each kind
 * of account must get. The `body` is sent as it is; ids in the path are the walker's (`:linkId` the kind's link,
 * every other id the client's own, from before the link).
 */
const TABLE: Readonly<Record<string, Row>> = {
  'DELETE /assistant/conversations/:id': { expect: theirs(CLIENT_SKIP) },
  'DELETE /assistant/messages/:id': { expect: theirs(CLIENT_SKIP) },
  'DELETE /care/links/:linkId': {
    expect: {
      ...all(404),
      badgedFull: 'skip: ending the walk’s own link; care and care-restriction prove it',
      badgedPlan: 'skip: ending the walk’s own link; care and care-restriction prove it',
      client: 'skip: ending the walk’s own link; care and care-restriction prove it',
      unbadged: 'skip: ending the walk’s own link; care and care-restriction prove it'
    }
  },
  'DELETE /events/:id': { expect: theirs(CLIENT_SKIP) },
  'DELETE /fixed-meals/:id': { expect: theirs(CLIENT_SKIP) },
  'DELETE /health-data': { expect: own(CLIENT_SKIP) },
  'DELETE /notifications/push': { expect: own(CLIENT_SKIP) },
  'DELETE /pantry': { expect: own(CLIENT_SKIP) },
  'DELETE /pantry/:id': { expect: theirs(CLIENT_SKIP) },
  'DELETE /profile/consent': { expect: { ...all('skip: withdraws a consent; profile-consent owns it') } },
  'DELETE /vacations/:id': { expect: theirs(CLIENT_SKIP) },
  'GET /assistant/conversations': { expect: own() },
  // The client's own conversation, by its id: ownership by session (`ownedConversation`), the 404 for anybody else.
  'GET /assistant/conversations/:id': { expect: theirs('own') },
  'GET /assistant/conversations/export': { expect: own() },
  'GET /assistant/standing': { expect: own() },
  'GET /care/access-log': { expect: own(200) },
  'GET /care/clients': { expect: practising(200, { otherPractitioner: 'skip: the roster allows ten a minute; badgedPlan already asked it' }) },
  'GET /care/clients/:linkId': { expect: practising(200) },
  // The client's own job, from before the link: 404 under the plan-only view (PRD 025 criterion 9); the badged `full`
  // view reads the client's plans, their own included.
  'GET /care/clients/:linkId/plan/jobs/:jobId': { expect: { ...all(404), badgedFull: 200 } },
  // Nothing waits: no plan was made through any link here — an empty answer to the practitioner, the door's 404 to the rest.
  'GET /care/clients/:linkId/plan/pending': { expect: practising(200) },
  'GET /care/invitations/:token': { expect: theirs(200) },
  'GET /care/links/me': { expect: own(200) },
  'GET /care/links/me/ended': { expect: own(200) },
  'GET /care/practice': { expect: practising(200, { closingDue: 200, otherPractitioner: 200, suspended: 200 }) },
  'GET /care/practice/badge': { expect: practising(200, { closingDue: 200, otherPractitioner: 200, suspended: 200 }) },
  'GET /care/practice/profile': { expect: practising(200, { closingDue: 200, otherPractitioner: 200, suspended: 200 }) },
  'GET /check-ins/status': { expect: own(200) },
  'GET /events': { expect: own(200) },
  'GET /fixed-meals': { expect: own(200) },
  // With its query: without one the route answers 500, not 422 (reported; not this walk's subject).
  'GET /fixed-meals/fixable': { expect: own(), query: '?weekday=1&slot=lunch' },
  'GET /fixed-meals/honourability': { expect: own() },
  'GET /health-data': { expect: own(200) },
  'GET /meal-plans': { expect: own(200) },
  'GET /meal-plans/:id': { expect: theirs(200) },
  'GET /meal-plans/:id/days/:dayIndex': { expect: theirs(200) },
  'GET /meal-plans/active': { expect: own(200) },
  'GET /meal-plans/allowances': { expect: own(200) },
  'GET /meal-plans/jobs/:id': { expect: theirs(200) },
  'GET /meal-plans/meals/:id': { expect: theirs(200) },
  'GET /meal-plans/scheduled': { expect: own() },
  'GET /meal-plans/scheduled/shopping-list': { expect: own() },
  'GET /notifications/push': { expect: own() },
  'GET /notifications/settings': { expect: own() },
  'GET /onboarding': { expect: own(200) },
  'GET /pantry': { expect: own(200) },
  'GET /profile': { expect: own(200) },
  'GET /profile/consent': { expect: own(200) },
  'GET /progress/summary': { expect: own(200) },
  'GET /progress/weight': { expect: own(200) },
  // A library recipe is shared by everybody: the client's plan's recipe id is nobody's secret, and the answer is about the dish.
  'GET /recipes/:id/picture-status': { expect: all('own') },
  'GET /safety/allergens': { expect: own(200) },
  'GET /safety/restrictions': { expect: own(200) },
  'GET /shopping-lists/active': { expect: own(200) },
  'GET /vacations': { expect: own(200) },
  'PATCH /care/clients/:linkId': { body: { reviewBeforePublish: true }, expect: practising(200) },
  // The targets are the badged `full` view's alone (PRD 025 criterion 9).
  'PATCH /care/clients/:linkId/targets': { body: { kcal: 1800 }, expect: practising(404, { badgedFull: 200 }) },
  'PATCH /care/links/me': { body: { sharesHealth: true }, expect: own('skip: the health line on an un-badged link is care-illness-rule’s') },
  'PATCH /meal-plans/meals/:id/status': { body: { status: 'completed' }, expect: theirs(CLIENT_SKIP) },
  'PATCH /notifications/settings': { body: {}, expect: own(CLIENT_SKIP) },
  'PATCH /onboarding': { body: {}, expect: own(CLIENT_SKIP) },
  'PATCH /profile': { body: {}, expect: own(CLIENT_SKIP) },
  'PATCH /profile/goal': { body: {}, expect: own(CLIENT_SKIP) },
  'PATCH /profile/preferences': { body: {}, expect: own(CLIENT_SKIP) },
  'PATCH /profile/targets': { body: {}, expect: own(CLIENT_SKIP) },
  'PATCH /profile/tour': { body: {}, expect: own(CLIENT_SKIP) },
  'PATCH /shopping-lists/items/:id': { body: { checked: true }, expect: theirs(CLIENT_SKIP) },
  'POST /assistant/messages': { body: {}, expect: all('skip: calls the assistant’s model; assistant owns it, and its ownership is by session') },
  // The client lives a plan whose fortnight is running: no practitioner makes one over it, and nothing is written.
  'POST /care/clients/:linkId/plan/generate': { expect: all(404) },
  // A meal of the client's own plan: the swap acts on the plan waiting for review alone, and none waits.
  'POST /care/clients/:linkId/plan/meals/:mealId/swap': { body: {}, expect: all(404) },
  'POST /care/clients/:linkId/plan/publish': { expect: all(404) },
  'POST /care/invitations': {
    body: { email: 'walk-invitee@e2e.invalid' },
    expect: practising(201, { otherPractitioner: 'skip: the same practitioner as badgedPlan' })
  },
  'POST /care/invitations/:token/accept': {
    body: { consentScope: 'plan', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false },
    // The client already has a link: the 409 that names it.
    expect: theirs(409)
  },
  'POST /care/invitations/:token/decline': { body: {}, expect: theirs(204) },
  'POST /care/links/me/consent': { body: { consentVersion: CARE_CONSENT_VERSION }, expect: own() },
  'POST /care/practice': {
    body: {},
    expect: {
      ...practising(200, { closingDue: 404, otherPractitioner: 200, suspended: 404 }),
      client: 'skip: would open a practice; care-practice-open proves who may',
      ordinary: 'skip: would open a practice; care-practice-open proves who may'
    }
  },
  'POST /care/practice/agreement': {
    body: { version: PROFESSIONAL_AGREEMENT_VERSION },
    expect: practising(204, { closingDue: 204, otherPractitioner: 204, suspended: 204 })
  },
  'POST /care/practice/badge': {
    body: { number: '28/55555', register: 'Colegio de la prueba' },
    // A standing badge refuses another application; the others apply — their own row, nothing of a client.
    expect: practising(201, { badgedFull: 404, badgedPlan: 404, closingDue: 201, otherPractitioner: 404, suspended: 201 })
  },
  'POST /care/practice/badge/code': { body: { code: 'AAAAA-AAAAA' }, expect: all(404) },
  'POST /check-ins': { body: {}, expect: own(CLIENT_SKIP) },
  'POST /events': { body: {}, expect: own(CLIENT_SKIP) },
  'POST /fixed-meals': { body: {}, expect: own(CLIENT_SKIP) },
  'POST /fixed-meals/consequence': { body: {}, expect: own(CLIENT_SKIP) },
  'POST /fixed-meals/not-offered': { body: {}, expect: own(CLIENT_SKIP) },
  'POST /fixed-meals/request': { body: {}, expect: own(CLIENT_SKIP) },
  'POST /meal-plans/generate': { expect: own(CLIENT_SKIP) },
  'POST /meal-plans/meals/:id/swap': { body: {}, expect: theirs(CLIENT_SKIP) },
  'POST /onboarding/complete': { expect: own(CLIENT_SKIP) },
  'POST /pantry': { body: {}, expect: own(CLIENT_SKIP) },
  'POST /pantry/catalogue': { body: {}, expect: own() },
  'POST /progress/weight': { body: {}, expect: own(CLIENT_SKIP) },
  'POST /vacations': { body: {}, expect: own(CLIENT_SKIP) },
  'PUT /care/practice/profile': {
    body: { displayName: PROFILE_WORDS, hours: null, priceCents: null, priceUnit: null, studies: null },
    expect: practising(200, { closingDue: 200, otherPractitioner: 200, suspended: 200 })
  },
  'PUT /health-data': { body: {}, expect: own(CLIENT_SKIP) },
  'PUT /notifications/push': { body: {}, expect: own(CLIENT_SKIP) },
  'PUT /profile/consent': { body: {}, expect: own(CLIENT_SKIP) },
  // The caller's own verdict on a shared dish; the body is refused anyway.
  'PUT /recipes/:id/verdict': { body: {}, expect: all('own') },
  'PUT /safety/restrictions': { body: {}, expect: own(CLIENT_SKIP) }
};

/** What one kind walks with: its session, the link it holds (or the client's, for those with none), and the client's ids. */
type Walker = { readonly account: Account; readonly ids: Ids; readonly linkId: string };

type Ids = {
  readonly client: Account;
  readonly conversationId: string;
  readonly eventId: string;
  readonly itemId: string;
  readonly jobId: string;
  readonly mealId: string;
  readonly messageId: string;
  readonly pantryItemId: string;
  readonly planId: string;
  readonly recipeId: string;
  readonly token: string;
};

describe('the walk: every route, as every kind of account (project 025 phase 7)', () => {
  const stamp = Date.now();
  const made: string[] = [];
  const sent: OutgoingEmail[] = [];
  const ai = new ScriptedAiClient(POOL);
  let app: INestApplication;
  let owner: Account;
  let switchWas = false;
  let routes: readonly string[] = [];
  /** Every first path segment the application mounts. */
  let segments: readonly string[] = [];
  const walkers = {} as Record<Kind, Walker>;
  /** Practitioners' names, for the model's prompts. */
  const practitionerNames: string[] = [];

  const server = () => httpServer(app);
  const address = (label: string) => `walk-${label}-${String(stamp)}@e2e.invalid`;

  async function account(label: string, name = `Persona ${label}`): Promise<Account> {
    const who = await register(app, address(label), name);

    made.push(who.cookie);

    return who;
  }

  async function practitioner(label: string, badged: boolean, name: string): Promise<Account> {
    const who = await account(label, name);

    await makePractitioner(app, who, badged ? { badgedBy: owner, number: BADGE_NUMBER } : {});
    practitionerNames.push(name);

    const enabled = await enableTotp(app, who);

    made.push(enabled.cookie);
    // Onboarded like anybody: without it every plan route answers 409 ONBOARDING_INCOMPLETE before it asks whose the id is,
    // and the walk's 404s by id would never be reached.
    await completeOnboarding(app, enabled);

    return enabled;
  }

  async function tokenMailedTo(to: string, after: number): Promise<string> {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const token = sent
        .slice(after)
        .filter(message => message.to === to.toLowerCase())
        .at(-1)
        ?.text.match(/\/invitacion\/([A-Za-z0-9_-]{43})/)?.[1];

      if (token) {
        return token;
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    throw new Error('No invitation mail arrived');
  }

  async function invite(professional: Account, client: Account): Promise<string> {
    const before = sent.length;

    await request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', professional.cookie).send({ email: client.email }).expect(201);

    return tokenMailedTo(client.email, before);
  }

  async function link(professional: Account, client: Account, consentScope: 'full' | 'plan', sharesHealth: boolean): Promise<string> {
    const accepted = await request(server())
      .post(`/${PREFIX}/care/invitations/${await invite(professional, client)}/accept`)
      .set('Cookie', client.cookie)
      .send({ consentScope, consentVersion: CARE_CONSENT_VERSION, sharesHealth });

    expect(accepted.status).toBe(200);

    return String((accepted.body as Json).id);
  }

  /** A client with a past: onboarded, a supplement declared, an event named, their own plan — all before any link. */
  async function clientWithAPast(label: string): Promise<Omit<Ids, 'token'>> {
    const client = await account(label);

    await completeOnboarding(app, client);
    await request(server())
      .put(`/${PREFIX}/health-data`)
      .set('Cookie', client.cookie)
      .send({ conditions: [], consentVersion: HEALTH_CONSENT_VERSION, medications: [], supplements: [{ kind: 'other', name: SUPPLEMENT }] })
      .expect(200);

    const on = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const event = await request(server())
      .post(`/${PREFIX}/events`)
      .set('Cookie', client.cookie)
      .send({ carbs: 'up', daysBefore: 2, fat: 'down', name: EVENT_NAME, on, protein: 'same' })
      .expect(201);
    const job = await generateAndWait(app, client);

    expect(job.status).toBe('succeeded');

    await request(server()).post(`/${PREFIX}/pantry`).set('Cookie', client.cookie).send({ label: PANTRY_LABEL }).expect(201);
    const [pantryRow] = await sql()<{ id: string }>`select id::text as id from pantry_items where user_id = ${client.id} limit 1`;

    expect(pantryRow?.id).toMatch(/^[0-9a-f-]{36}$/);
    // No route makes a conversation without the assistant's model: the client's own conversation and one turn, on the
    // table. What is walked is whose it is, which the rows say (`user_id`).
    const [conversation] = await sql()<{
      id: string;
    }>`insert into ai_conversations (user_id, title) values (${client.id}, ${CONVERSATION_TITLE}) returning id::text as id`;
    const [message] = await sql()<{ id: string }>`
      insert into ai_messages (conversation_id, role, content) values (${conversation?.id ?? ''}, 'user', ${CONVERSATION_TITLE}) returning id::text as id`;
    const [meal] = await sql()<{ id: string; recipeId: string }>`
      select m.id::text as id, m.recipe_id::text as "recipeId" from meals m join plan_days d on d.id = m.plan_day_id where d.plan_id = ${job.planId} and m.slot = 'lunch' limit 1`;
    const [jobRow] = await sql()<{
      id: string;
    }>`select id::text as id from plan_generation_jobs where user_id = ${client.id} order by created_at desc limit 1`;
    const list = await request(server()).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', client.cookie).expect(200);
    const item = (list.body as { items: { id: string }[] }).items[0];

    return {
      client,
      conversationId: conversation?.id ?? '',
      eventId: String((event.body as Json).id),
      itemId: item?.id ?? '',
      jobId: jobRow?.id ?? '',
      mealId: meal?.id ?? '',
      messageId: message?.id ?? '',
      pantryItemId: pantryRow?.id ?? '',
      planId: String(job.planId),
      recipeId: meal?.recipeId ?? ''
    };
  }

  /** The path with the walker's ids in it. */
  function pathOf(template: string, walker: Walker): string {
    const ids = walker.ids;
    const byParam: Record<string, string> = { dayIndex: '1', jobId: ids.jobId, linkId: walker.linkId, mealId: ids.mealId, token: ids.token };

    return template.replace(/:(\w+)/g, (_whole, name: string) => {
      if (name === 'id') {
        if (template.startsWith('/meal-plans/meals/')) {
          return ids.mealId;
        }

        if (template.startsWith('/meal-plans/jobs/')) {
          return ids.jobId;
        }

        if (template.startsWith('/meal-plans/')) {
          return ids.planId;
        }

        if (template.startsWith('/shopping-lists/')) {
          return ids.itemId;
        }

        if (template.startsWith('/assistant/conversations/')) {
          return ids.conversationId;
        }

        if (template.startsWith('/assistant/messages/')) {
          return ids.messageId;
        }

        if (template.startsWith('/pantry/')) {
          return ids.pantryItemId;
        }

        if (template.startsWith('/recipes/')) {
          return ids.recipeId;
        }

        if (template.startsWith('/events/')) {
          return ids.eventId;
        }

        // A vacation or a fixed meal the client never made: the id is somebody's, never the caller's.
        return '00000000-0000-4000-8000-0000000000aa';
      }

      return byParam[name] ?? `:${name}`;
    });
  }

  /** What of the client an answer must not carry when it is not the client's own. */
  function clientMarkers(ids: Ids): string[] {
    return [
      ids.client.id,
      ids.client.email,
      `Persona ${
        ids.client.email
          .split('@')[0]
          ?.replace(/^walk-/, '')
          .replace(/-\d+$/, '') ?? ''
      }`,
      SUPPLEMENT,
      EVENT_NAME,
      PANTRY_LABEL,
      CONVERSATION_TITLE,
      ids.conversationId,
      ids.messageId,
      ids.pantryItemId,
      ids.planId,
      ids.jobId,
      ids.mealId,
      ids.itemId,
      ids.eventId
    ].filter(marker => marker.length > 8);
  }

  beforeAll(async () => {
    for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'OWNER_EMAIL']) {
      expect(process.env[name] ?? '').toBe('');
    }

    app = await createApp(ai, builder => builder.overrideProvider(ENV).useValue(validateEnv({ ...process.env, RATE_LIMIT_MAX: '100000' })));
    jest.spyOn(EmailService.prototype, 'send').mockImplementation(async message => {
      sent.push(message);

      return Promise.resolve(true);
    });
    jest.spyOn(PushService.prototype, 'send').mockImplementation(async () => Promise.resolve(0 as never));
    jest.spyOn(CheckInSubmittedService.prototype, 'notify').mockImplementation(async () => Promise.resolve());

    // The routes as mounted: the Express router's own stack, after Nest has registered every controller.
    const instance = app.getHttpAdapter().getInstance() as { router?: { stack: unknown[] } };
    const prefix = `/${PREFIX}`;

    const mounted = (instance.router?.stack ?? []).flatMap(layer => {
      const route = (layer as { route?: { methods: Record<string, boolean>; path: string } }).route;

      return route ? Object.keys(route.methods).map(method => ({ method: method.toUpperCase(), path: route.path.replace(prefix, '') })) : [];
    });

    segments = [...new Set(mounted.map(route => route.path.split('/')[1] ?? ''))].sort();
    routes = mounted.filter(route => route.method !== 'HEAD' && SCOPE.test(route.path)).map(route => `${route.method} ${route.path}`);

    owner = await account('owner');
    await UserController.grantAdmin(owner.email);
    owner = await enableTotp(app, owner);
    made.push(owner.cookie);
    switchWas = await ProfessionalController.isOpen();
    await SettingsController.setFlag('professional', true, UNAUDITED);
  }, 120_000);

  afterAll(async () => {
    try {
      jest.restoreAllMocks();
      await SettingsController.setFlag('professional', switchWas, UNAUDITED);
      await deleteAccounts(app, made);

      const pattern = `walk-%-${String(stamp)}@e2e.invalid`;

      for (const { email } of await sql()<{ email: string }>`select email from "user" where email like ${pattern}`) {
        await deleteAccountByEmail(app, email);
      }

      await sql()`delete from care_invitations where email = 'walk-invitee@e2e.invalid' or email like ${pattern}`;

      const [left] = await sql()<Json>`
        select (select count(*)::int from "user" where email like ${pattern}) as accounts,
               (select count(*)::int from care_invitations where email = 'walk-invitee@e2e.invalid' or email like ${pattern}) as invitations,
               (select count(*)::int from practice_restrictions r where not exists (select 1 from "user" u where u.id = r.user_id)) as restrictions`;

      expect(left).toEqual({ accounts: 0, invitations: 0, restrictions: 0 });
    } finally {
      await app?.close();
    }
  }, 300_000);

  it('decides every mounted first segment: walked, or not walked with a reason — and lists none that is gone', () => {
    const walked: readonly string[] = WALKED_SEGMENTS;
    const unwalked = Object.keys(UNWALKED_SEGMENTS);
    const undecided = segments.filter(segment => !walked.includes(segment) && !unwalked.includes(segment));
    const both = walked.filter(segment => unwalked.includes(segment));
    const gone = [...walked, ...unwalked].filter(segment => !segments.includes(segment));

    expect({ both, gone, undecided }).toEqual({ both: [], gone: [], undecided: [] });
  });

  it('has a row for every route in scope the application mounts, and no row for a route it does not', () => {
    const rows = Object.keys(TABLE);
    const unwalked = routes.filter(route => !rows.includes(route));
    const gone = rows.filter(row => !routes.includes(row));

    // The message names each: a new route needs a row saying what every kind of account gets; a removed one, its row deleted.
    expect({ gone, unwalked }).toEqual({ gone: [], unwalked: [] });
    expect(routes.length).toBeGreaterThan(60);
  });

  describe('walked', () => {
    beforeAll(async () => {
      const unbadged = await practitioner('unbadged', false, 'Rosa Ubeda');
      const badgedPlan = await practitioner('badged-plan', true, 'Berta Plaza');
      const badgedFull = await practitioner('badged-full', true, 'Fermina Llorente');
      const suspended = await practitioner('suspended', false, 'Sara Sanz');
      const closing = await practitioner('closing', false, 'Clara Cuesta');
      const ordinary = await account('ordinary');

      await completeOnboarding(app, ordinary);

      const ofUnbadged = await clientWithAPast('client-u');
      const ofPlan = await clientWithAPast('client-b');
      const ofFull = await clientWithAPast('client-f');
      const ofSuspended = await clientWithAPast('client-s');
      const ofClosing = await clientWithAPast('client-c');

      const links = {
        badgedFull: await link(badgedFull, ofFull.client, 'full', true),
        badgedPlan: await link(badgedPlan, ofPlan.client, 'plan', false),
        closingDue: await link(closing, ofClosing.client, 'plan', false),
        suspended: await link(suspended, ofSuspended.client, 'plan', false),
        unbadged: await link(unbadged, ofUnbadged.client, 'full', true)
      };

      // Something for a model never to read: a profile, a suspension's facts, a close's facts.
      for (const who of [unbadged, badgedPlan, suspended]) {
        await request(server())
          .put(`/${PREFIX}/care/practice/profile`)
          .set('Cookie', who.cookie)
          .send({ displayName: PROFILE_WORDS, hours: null, priceCents: null, priceUnit: null, studies: PROFILE_WORDS })
          .expect(200);
      }

      await request(server())
        .post(`/${PREFIX}/admin/professionals/${suspended.id}/suspension`)
        .set('Cookie', owner.cookie)
        .send({ facts: RESTRICTION_FACTS, source: 'own_review' })
        .expect(200);
      await request(server())
        .post(`/${PREFIX}/admin/professionals/${closing.id}/close`)
        .set('Cookie', owner.cookie)
        .send({ facts: RESTRICTION_FACTS, source: 'own_review' })
        .expect(200);
      // The close's day has come; the sweep has not run.
      await moveCloseDue(closing.id);

      // An invitation addressed to the un-badged link's client, live, from another practitioner: the token every kind tries.
      const token = await invite(badgedPlan, ofUnbadged.client);
      const withToken = (ids: Omit<Ids, 'token'>): Ids => ({ ...ids, token });

      walkers.unbadged = { account: unbadged, ids: withToken(ofUnbadged), linkId: links.unbadged };
      walkers.badgedPlan = { account: badgedPlan, ids: withToken(ofPlan), linkId: links.badgedPlan };
      walkers.badgedFull = { account: badgedFull, ids: withToken(ofFull), linkId: links.badgedFull };
      walkers.suspended = { account: suspended, ids: withToken(ofSuspended), linkId: links.suspended };
      walkers.closingDue = { account: closing, ids: withToken(ofClosing), linkId: links.closingDue };
      walkers.ordinary = { account: ordinary, ids: withToken(ofUnbadged), linkId: links.unbadged };
      walkers.otherPractitioner = { account: badgedPlan, ids: withToken(ofUnbadged), linkId: links.unbadged };
      walkers.client = { account: ofUnbadged.client, ids: withToken(ofUnbadged), linkId: links.unbadged };

      // The client asked for `full` and the health line from an un-badged practitioner: stored `plan`, the line off.
      const [stored] = await sql()<{ consentScope: string; sharesHealth: boolean }>`
        select consent_scope::text as "consentScope", shares_health as "sharesHealth" from care_links where id = ${links.unbadged}`;

      expect(stored).toEqual({ consentScope: 'plan', sharesHealth: false });
    }, 600_000);

    it.each(KINDS.map(kind => [kind]))(
      'as %s, every route answers what the table says',
      async kind => {
        const walker = walkers[kind];
        const misses: string[] = [];

        for (const [route, row] of Object.entries(TABLE)) {
          const expected = row.expect[kind];

          if (typeof expected === 'string' && expected.startsWith('skip')) {
            continue;
          }

          const [method, template] = route.split(' ') as [string, string];
          const path = pathOf(template, walker);
          let req = request(server())
            [method.toLowerCase() as Method](`/${PREFIX}${path}${row.query ?? ''}`)
            .set('Cookie', walker.account.cookie);

          if (row.body !== undefined) {
            req = req.send(row.body);
          }

          const response: Response = await req;

          if (response.status >= 500) {
            misses.push(`${route}: ${response.status}`);
            continue;
          }

          if (typeof expected === 'number' && response.status !== expected) {
            misses.push(`${route}: ${response.status}, the table says ${expected} — ${response.text.slice(0, 160)}`);
          }

          // Nothing of the client, unless it is the client's own answer or the practitioner's view of their own link.
          const aboutTheClient =
            kind === 'client' ||
            (route.startsWith('GET /care/clients') && typeof expected === 'number' && expected < 300) ||
            route === 'PATCH /care/clients/:linkId' ||
            route === 'PATCH /care/clients/:linkId/targets' ||
            (kind === 'badgedFull' && route === 'GET /care/clients/:linkId/plan/jobs/:jobId');

          if (!aboutTheClient) {
            // An id the caller put in the path may be echoed back by a refusal; it is the caller's own input, not a leak.
            for (const marker of clientMarkers(walker.ids).filter(id => !path.includes(id))) {
              if (response.text.includes(marker)) {
                misses.push(`${route}: carries «${marker}»`);
              }
            }
          }

          // The narrower view: no answer to an un-badged or plan-scope practitioner carries a forbidden key or a declared word.
          if ((kind === 'unbadged' || kind === 'badgedPlan') && path.startsWith('/care/clients')) {
            for (const key of forbiddenKeys(response.body)) {
              misses.push(`${route}: carries ${key}`);
            }

            for (const word of [SUPPLEMENT, EVENT_NAME]) {
              if (response.text.includes(word)) {
                misses.push(`${route}: carries «${word}»`);
              }
            }
          }
        }

        expect(misses).toEqual([]);
      },
      300_000
    );

    it('never sent a model a profile, a badge record, a restriction’s facts or a practitioner’s name', async () => {
      // A generation while all of it stands: the client of the badged `full` practitioner asks for their next plan.
      expect((await generateAndWait(app, walkers.badgedFull.ids.client)).status).toBe('succeeded');
      expect(ai.prompts.length).toBeGreaterThan(0);

      const prompts = ai.prompts.join('\n');

      for (const needle of [PROFILE_WORDS, RESTRICTION_FACTS, BADGE_NUMBER, 'Colegio Oficial', ...practitionerNames]) {
        expect({ hit: prompts.includes(needle), needle }).toEqual({ hit: false, needle });
      }
    }, 180_000);
  });
});
