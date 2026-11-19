import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { HEALTH_CONSENT_VERSION } from 'core/entities/Health';
import { ProfessionalController } from 'core/controllers/Professional';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';
import { database } from 'database';

import {
  acceptAgreement,
  ADULT_BIRTH_DATE,
  auditRowsAboutSubject,
  closePracticeNow,
  completeOnboarding,
  createApp,
  deleteAccountByEmail,
  deleteAccounts,
  enableTotp,
  generateAndWait,
  httpServer,
  makePractitioner,
  moveCloseDue,
  openOwnPractice,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient,
  unconfirmAddress
} from './harness.js';
import { CheckInSubmittedService, PushService } from '../src/modules/notifications/index.js';
import { EmailService } from '../src/modules/email/services/index.js';
import { ENV, validateEnv } from '../src/config/index.js';
import { PracticeCloseSweepService } from '../src/modules/care/services/index.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * Suspension, close and lift (project 025 phase 6, PRD 025 scope 16 and
 * criterion 24 as amended 2026-11-19), on real Postgres.
 *
 * - **Suspension** is immediate: every care route that takes a link id, the
 *   roster and the invitation answer the suspended practitioner exactly what
 *   they answer an account with no practice; the practice's own page, the
 *   agreement, the badge and the profile still answer, the page carrying what
 *   stands. The client's link view is unchanged; the invitation's page,
 *   acceptance and decline are 404 (the decline still deletes); no check-in
 *   notice goes; a client's next plan publishes directly and a plan already
 *   waiting is replaced at no cost. Lifting restores everything, and undoes
 *   nothing the suspension let happen.
 * - **Close**: the practice works for its thirty days; on the day it is closed
 *   before the sweep has run; the sweep in `/cron/reminders` ends its links as
 *   the practitioner ending them, withdraws a badge, requeues a titled profile,
 *   deletes the practice and its invitations, and leaves the restriction; no
 *   illness-rule mail follows, though the client has a condition on record. A
 *   lift reopens an empty practice. A close lifted between the sweep's list and
 *   its write is not carried out.
 * - **The four statements** (`textos/06` § W bis): to the practitioner alone,
 *   the approved words, no health word, no client, the owner's facts inert.
 * - **Every refusal writes nothing**: twice, of nothing, of nobody, and an
 *   ordinary or unconfirmed account at the owner's routes.
 * - **Races**, fifteen rounds each: suspension against an acceptance, a
 *   re-consent and the health line; the close's sweep against an acceptance and
 *   against a lift; opening against a suspension.
 *
 * Every mail is caught at `EmailService.send`, every push at `PushService.send`
 * and every check-in notice at `CheckInSubmittedService.notify`. The API's own
 * per-account limiter is raised for this app alone (the races are hundreds of
 * requests from a handful of accounts). The close sweep and the cron are
 * global on the database this runs on: every assertion is about this suite's
 * own accounts. Requires a real database — see ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

type Json = Record<string, unknown>;

const NOT_FOUND_TEXT = JSON.stringify({ code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 });
const UNKNOWN_TOKEN = 'A'.repeat(43);
const CLIENT_NAME = 'Ximena Quiroga';
/** Health words: no statement of reasons to a practitioner carries one. */
const HEALTH_WORDS = ['salud', 'enferm', 'condici', 'medica', 'embaraz', 'lactan', 'alerg', 'diagn', 'peso', 'hipotiroid'];
/** The owner's facts, with what a template could mistake for its own: braces naming its placeholders, an ampersand, quotes, a line break. */
const FACTS = 'Publicó "resultados" & precios {closeDate} {reason} {source} {facts}\nsegunda línea';
const FACTS_TEXT = 'Publicó "resultados" & precios {closeDate} {reason} {source} {facts} segunda línea';

describe('suspension, close and lift (project 025 phase 6)', () => {
  const stamp = Date.now();
  const cronSecret = randomBytes(24).toString('hex');
  const made: string[] = [];
  const sent: OutgoingEmail[] = [];
  const pushes: unknown[] = [];
  /** `CheckInSubmittedService.notify`, as called: the practitioner it would tell. */
  const notices: string[] = [];
  let app: INestApplication;
  let owner: Account;
  /** An account with no practice: what every refused route answers it is the reference. */
  let ordinary: Account;
  let switchWas = false;
  let started = '';

  const server = () => httpServer(app);
  const address = (label: string) => `restrict-${label}-${String(stamp)}@e2e.invalid`;

  async function account(label: string, name = `Persona ${label}`): Promise<Account> {
    const who = await register(app, address(label), name);

    made.push(who.cookie);

    return who;
  }

  async function withTotp(who: Account): Promise<Account> {
    const enabled = await enableTotp(app, who);

    made.push(enabled.cookie);

    return enabled;
  }

  async function practitioner(label: string, badged = false): Promise<Account> {
    const who = await account(label);

    await makePractitioner(app, who, badged ? { badgedBy: owner } : {});

    return withTotp(who);
  }

  async function settle(): Promise<void> {
    // Mails and notices are background tasks: give them the time they would take.
    await new Promise(resolve => setTimeout(resolve, 750));
  }

  // --- The owner's acts ---------------------------------------------------------------

  const ownerPost = (path: string, body: object) =>
    request(server()).post(`/${PREFIX}/admin/professionals${path}`).set('Cookie', owner.cookie).send(body);
  const suspend = (who: Account | string, body: object = { clause: 9, facts: FACTS, source: 'own_review' }) =>
    ownerPost(`/${typeof who === 'string' ? who : who.id}/suspension`, body);
  const close = (who: Account | string, body: object = { facts: FACTS, source: 'notice' }) =>
    ownerPost(`/${typeof who === 'string' ? who : who.id}/close`, body);
  const lift = (who: Account | string, body: object = {}) => ownerPost(`/${typeof who === 'string' ? who : who.id}/lift`, body);
  const sweep = () => app.get(PracticeCloseSweepService, { strict: false }).run();
  const cron = () => request(server()).get(`/${PREFIX}/cron/reminders`).set('Authorization', `Bearer ${cronSecret}`);

  async function restrictions(userId: string): Promise<string[]> {
    const rows = await sql()<{
      kind: string;
    }>`select kind::text as kind from practice_restrictions where user_id = ${userId} order by acted_at, created_at`;

    return rows.map(row => row.kind);
  }

  async function practises(userId: string): Promise<boolean> {
    const [row] = await sql()<{ n: number }>`select count(*)::int as n from professionals where user_id = ${userId}`;

    return row?.n === 1;
  }

  /** What an owner's act could write about one account: restrictions, audit rows, mails to it. */
  async function footprint(who: Account): Promise<Json> {
    return {
      audit: (await auditRowsAboutSubject(who.id)).length,
      mails: sent.filter(mail => mail.to === who.email.toLowerCase()).length,
      practises: await practises(who.id),
      restrictions: await restrictions(who.id)
    };
  }

  async function expectNothingWritten(who: Account, act: () => PromiseLike<Response>, status = 404): Promise<void> {
    const before = await footprint(who);
    const refused = await act();

    expect(refused.status).toBe(status);
    await settle();
    expect(await footprint(who)).toEqual(before);
  }

  /** The audit rows about one account for one action, as actor and metadata. */
  async function audited(who: Account, action: string): Promise<{ actorId: string | null; metadata: unknown }[]> {
    return (await auditRowsAboutSubject(who.id)).filter(row => row.action === action).map(row => ({ actorId: row.actorId, metadata: row.metadata }));
  }

  // --- Links ----------------------------------------------------------------------

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

  const inviting = (professional: Account, email: string) =>
    request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', professional.cookie).send({ email });

  async function invite(professional: Account, client: Account): Promise<string> {
    const before = sent.length;

    await inviting(professional, client.email).expect(201);

    return tokenMailedTo(client.email, before);
  }

  const answer = (consentScope: 'full' | 'plan', sharesHealth: boolean) => ({ consentScope, consentVersion: CARE_CONSENT_VERSION, sharesHealth });
  const accept = (client: Account, token: string, body: object = answer('plan', false)) =>
    request(server()).post(`/${PREFIX}/care/invitations/${token}/accept`).set('Cookie', client.cookie).send(body);
  const page = (client: Account, token: string) => request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', client.cookie);
  const decline = (client: Account, token: string) =>
    request(server()).post(`/${PREFIX}/care/invitations/${token}/decline`).set('Cookie', client.cookie).send({});

  async function link(professional: Account, client: Account, consentScope: 'full' | 'plan' = 'full', sharesHealth = false): Promise<string> {
    const accepted = await accept(client, await invite(professional, client), answer(consentScope, sharesHealth));

    expect(accepted.status).toBe(200);

    return String((accepted.body as Json).id);
  }

  const myLink = (client: Account) => request(server()).get(`/${PREFIX}/care/links/me`).set('Cookie', client.cookie);
  const endAsClient = (client: Account, linkId: string) => request(server()).delete(`/${PREFIX}/care/links/${linkId}`).set('Cookie', client.cookie);
  const roster = (who: Account) => request(server()).get(`/${PREFIX}/care/clients`).set('Cookie', who.cookie);
  const overview = (who: Account, linkId: string) => request(server()).get(`/${PREFIX}/care/clients/${linkId}`).set('Cookie', who.cookie);

  async function linkRow(linkId: string): Promise<{ endedBy: string | null; status: string } | undefined> {
    const [row] = await sql()<{
      endedBy: string | null;
      status: string;
    }>`select status::text as status, ended_by::text as "endedBy" from care_links where id = ${linkId}`;

    return row;
  }

  async function openLinks(clientId: string, professionalId: string): Promise<number> {
    const [row] = await sql()<{ n: number }>`
      select count(*)::int as n from care_links where client_id = ${clientId} and professional_id = ${professionalId} and status in ('active', 'paused')`;

    return row?.n ?? -1;
  }

  const practicePage = (who: Account) => request(server()).get(`/${PREFIX}/care/practice`).set('Cookie', who.cookie);

  /** Every route under the care module a practitioner calls with a link id, as `care-scope` enumerates them, and the roster and the invitation. */
  function clientRoutes(linkId: string, ids: { readonly jobId: string; readonly mealId: string }) {
    return {
      generate: ['post', `/care/clients/${linkId}/plan/generate`, undefined],
      invite: ['post', '/care/invitations', { email: address('walk-invitee') }],
      job: ['get', `/care/clients/${linkId}/plan/jobs/${ids.jobId}`, undefined],
      overview: ['get', `/care/clients/${linkId}`, undefined],
      pending: ['get', `/care/clients/${linkId}/plan/pending`, undefined],
      publish: ['post', `/care/clients/${linkId}/plan/publish`, undefined],
      review: ['patch', `/care/clients/${linkId}`, { reviewBeforePublish: false }],
      roster: ['get', '/care/clients', undefined],
      swap: ['post', `/care/clients/${linkId}/plan/meals/${ids.mealId}/swap`, {}],
      targets: ['patch', `/care/clients/${linkId}/targets`, { kcal: 1700 }]
    } as const satisfies Record<string, readonly ['get' | 'patch' | 'post', string, object | undefined]>;
  }

  async function call(who: Account, [method, path, body]: readonly ['get' | 'patch' | 'post', string, object | undefined]): Promise<Response> {
    const req = request(server())[method](`/${PREFIX}${path}`).set('Cookie', who.cookie);

    return body === undefined ? req : req.send(body);
  }

  /** Every client route answers `who` exactly what it answers an account with no practice. */
  async function expectShut(who: Account, linkId: string, ids: { readonly jobId: string; readonly mealId: string }): Promise<void> {
    for (const [name, route] of Object.entries(clientRoutes(linkId, ids))) {
      const got = await call(who, route);
      const reference = await call(ordinary, route);

      expect({ name, status: got.status, text: got.text }).toEqual({ name, status: 404, text: reference.text });
    }
  }

  async function planRows(userId: string): Promise<{ id: string; status: string }[]> {
    return sql()<{
      id: string;
      status: string;
    }>`select id::text as id, status::text as status from meal_plans where user_id = ${userId} order by version`;
  }

  async function allowancesOf(who: Account): Promise<{ allowed: boolean; limit: number; used: number }> {
    const response = await request(server()).get(`/${PREFIX}/meal-plans/allowances`).set('Cookie', who.cookie).expect(200);

    return (response.body as { planRedo: { allowed: boolean; limit: number; used: number } }).planRedo;
  }

  const declare = (client: Account) =>
    request(server())
      .put(`/${PREFIX}/health-data`)
      .set('Cookie', client.cookie)
      .send({
        conditions: [{ conditionKey: 'hypothyroidism', label: 'Hipotiroidismo' }],
        consentVersion: HEALTH_CONSENT_VERSION,
        medications: [],
        supplements: []
      });

  /** One statement of reasons, as the practitioner receives it. */
  function expectStatement(mail: OutgoingEmail | undefined, to: Account, kind: string, subject: RegExp | string): OutgoingEmail {
    expect(mail).toBeDefined();

    const got = mail as OutgoingEmail;

    expect({ kind: got.kind, to: got.to }).toEqual({ kind, to: to.email.toLowerCase() });
    expect(got.subject).toMatch(subject);

    const all = `${got.subject}\n${got.text}\n${got.html}`.toLowerCase();

    for (const needle of [...HEALTH_WORDS, CLIENT_NAME.toLowerCase()]) {
      expect({ hit: all.includes(needle), needle }).toEqual({ hit: false, needle });
    }

    return got;
  }

  /** The owner's facts arrived as typed: nothing filled into their braces, the line break folded, nothing marked up. */
  function expectInertFacts(mail: OutgoingEmail): void {
    expect(mail.text).toContain(FACTS_TEXT);
    expect(mail.html).toContain('{closeDate} {reason} {source} {facts}');
    expect(mail.html).toContain('&amp; precios');
    expect(mail.html).not.toContain('& precios');
  }

  const mailsTo = (who: Account, after: number) => sent.slice(after).filter(mail => mail.to === who.email.toLowerCase());

  beforeAll(async () => {
    for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'OWNER_EMAIL']) {
      expect(process.env[name] ?? '').toBe('');
    }

    started = (await sql()<{ now: string }>`select now()::text as now`)[0]?.now ?? '';
    app = await createApp(new ScriptedAiClient(POOL), builder =>
      builder.overrideProvider(ENV).useValue(validateEnv({ ...process.env, CRON_SECRET: cronSecret, RATE_LIMIT_MAX: '100000' }))
    );

    jest.spyOn(EmailService.prototype, 'send').mockImplementation(async message => {
      sent.push(message);

      return Promise.resolve(true);
    });
    jest.spyOn(PushService.prototype, 'send').mockImplementation(async (...args: unknown[]) => {
      pushes.push(args);

      return Promise.resolve(0 as never);
    });
    jest.spyOn(CheckInSubmittedService.prototype, 'notify').mockImplementation(async professional => {
      notices.push(professional.id);

      return Promise.resolve();
    });

    owner = await account('owner');
    await UserController.grantAdmin(owner.email);
    owner = await withTotp(owner);
    ordinary = await account('ordinary');
    switchWas = await ProfessionalController.isOpen();
    await SettingsController.setFlag('professional', true, UNAUDITED);
  }, 120_000);

  afterAll(async () => {
    try {
      jest.restoreAllMocks();
      await SettingsController.setFlag('professional', switchWas, UNAUDITED);
      await deleteAccounts(app, made);

      const pattern = `restrict-%-${String(stamp)}@e2e.invalid`;
      const stragglers = await sql()<{ email: string }>`select email from "user" where email like ${pattern}`;

      for (const { email } of stragglers) {
        await deleteAccountByEmail(app, email);
      }

      await sql()`delete from care_invitations where email like ${pattern}`;
      // The cron's own record of its runs, and the claims its passes made, this run's alone.
      await sql()`delete from analytics_events where event in ('cron_run', 'owner_alerted') and created_at >= ${started}`;

      const [left] = await sql()<Json>`
        select (select count(*)::int from "user" where email like ${pattern}) as accounts,
               (select count(*)::int from care_invitations where email like ${pattern}) as invitations,
               (select count(*)::int from care_access_log where professional_name like ${'Persona %'} and created_at >= ${started}) as trail,
               (select count(*)::int from professional_badge_checks c where not exists (select 1 from "user" u where u.id = c.user_id)) as checks,
               (select count(*)::int from professional_profiles p where not exists (select 1 from "user" u where u.id = p.user_id)) as profiles,
               (select count(*)::int from practice_restrictions r where not exists (select 1 from "user" u where u.id = r.user_id)) as restrictions`;

      expect(left).toEqual({ accounts: 0, checks: 0, invitations: 0, profiles: 0, restrictions: 0, trail: 0 });
    } finally {
      await app?.close();
    }
  }, 300_000);

  // --- Suspension ---------------------------------------------------------------------

  describe('a suspension', () => {
    let pro: Account;
    /** Linked `full`, living a plan, a second plan waiting for the practitioner's review. */
    let waiting: Account;
    let waitingLink = '';
    let waitingPlan = '';
    let ids = { jobId: '', mealId: '' };
    /** Invited, not yet answered. */
    let invitee: Account;
    let inviteToken = '';
    let linkViewBefore: Json = {};

    beforeAll(async () => {
      pro = await practitioner('susp-pro', true);

      // The control for the check-in notice: a client of the same practitioner checks in before the suspension.
      const checker = await account('susp-checker');

      await completeOnboarding(app, checker);

      const checkerPlan = await generateAndWait(app, checker);

      await link(pro, checker, 'full');
      await request(server())
        .post(`/${PREFIX}/check-ins`)
        .set('Cookie', checker.cookie)
        .send({ difficulty: 'ok', hunger: 'hungry', planId: checkerPlan.planId, satisfaction: 4, weightKg: 71 })
        .expect(201);
      await settle();
      expect(notices).toEqual([pro.id]);

      waiting = await account('susp-client', CLIENT_NAME);
      await completeOnboarding(app, waiting);
      expect((await generateAndWait(app, waiting)).status).toBe('succeeded');
      waitingLink = await link(pro, waiting, 'full');
      // Review is on by default: the client's next plan waits for the practitioner, one of their fortnight's redos.
      expect(await generateAndWait(app, waiting)).toMatchObject({ planId: null, status: 'succeeded' });
      waitingPlan = (await planRows(waiting.id)).find(row => row.status === 'pending_review')?.id ?? '';
      expect(waitingPlan).not.toBe('');
      expect(await allowancesOf(waiting)).toMatchObject({ limit: 1, used: 1 });

      const [job] = await sql()<{
        id: string;
      }>`select id::text as id from plan_generation_jobs where user_id = ${waiting.id} order by created_at desc limit 1`;
      const [meal] = await sql()<{ id: string }>`
        select m.id::text as id from meals m join plan_days d on d.id = m.plan_day_id where d.plan_id = ${waitingPlan} and m.slot = 'lunch' limit 1`;

      ids = { jobId: job?.id ?? '', mealId: meal?.id ?? '' };
      invitee = await account('susp-invitee');
      inviteToken = await invite(pro, invitee);

      // Before: every door open.
      await overview(pro, waitingLink).expect(200);
      await roster(pro).expect(200);
      await request(server()).get(`/${PREFIX}/care/clients/${waitingLink}/plan/pending`).set('Cookie', pro.cookie).expect(200);
      linkViewBefore = (await myLink(waiting).expect(200)).body as Json;
    }, 300_000);

    it('is the owner’s act, immediate, with § W bis.1 mailed to the practitioner alone and an audit row of closed words', async () => {
      const mails = sent.length;
      const suspended = await suspend(pro);

      expect(suspended.status).toBe(200);
      expect(suspended.body).toEqual({
        restriction: {
          closing: null,
          suspended: { since: expect.any(String), statement: { authority: null, clause: 9, facts: FACTS, source: 'own_review' } }
        },
        userId: pro.id
      });
      expect(await audited(pro, 'professional.suspended')).toEqual([{ actorId: owner.id, metadata: { source: 'own_review' } }]);

      await settle();

      const out = sent.slice(mails);

      expect(out).toHaveLength(1);

      const mail = expectStatement(out[0], pro, 'professional-suspended', 'Hemos suspendido tu cuenta como profesional en NutrIA');

      expect(mail.text).toContain('Desde hoy tu cuenta está suspendida como profesional');
      expect(mail.text).toContain('Es lo que dice el § 13 del acuerdo del profesional que aceptaste, en relación con su § 9.');
      expect(mail.text).toContain('Lo hemos decidido nosotros, por nuestra propia revisión.');
      expectInertFacts(mail);
    });

    it('shuts every client route, the roster and the invitation with the answer an account with no practice gets', async () => {
      await expectShut(pro, waitingLink, ids);
    });

    it('keeps the practice’s own page — saying what stands — the agreement, the badge and the profile', async () => {
      const own = await practicePage(pro).expect(200);

      expect(own.body).toMatchObject({ restriction: { closing: null, suspended: { statement: { facts: FACTS, source: 'own_review' } } } });
      await acceptAgreement(app, pro);
      expect((await request(server()).get(`/${PREFIX}/care/practice/badge`).set('Cookie', pro.cookie).expect(200)).body).toMatchObject({
        state: 'badged'
      });
      await request(server())
        .put(`/${PREFIX}/care/practice/profile`)
        .set('Cookie', pro.cookie)
        .send({ displayName: 'Persona suspendida', hours: null, priceCents: null, priceUnit: null, studies: null })
        .expect(200);
      await request(server()).get(`/${PREFIX}/care/practice/profile`).set('Cookie', pro.cookie).expect(200);
    });

    it('cannot be opened again while it stands, and writes nothing', async () => {
      await expectNothingWritten(pro, () =>
        request(server()).post(`/${PREFIX}/care/practice`).set('Cookie', pro.cookie).send({ birthDate: ADULT_BIRTH_DATE })
      );

      const refused = await request(server()).post(`/${PREFIX}/care/practice`).set('Cookie', pro.cookie).send({});

      expect(refused.text).toBe(NOT_FOUND_TEXT);
    });

    it('leaves the client’s own link view exactly as it was', async () => {
      expect((await myLink(waiting).expect(200)).body).toEqual(linkViewBefore);
    });

    it('answers the invitation’s page and acceptance as an unknown one, and a decline as one too — while deleting it', async () => {
      const unknown = {
        accept: await accept(invitee, UNKNOWN_TOKEN),
        decline: await decline(invitee, UNKNOWN_TOKEN),
        page: await page(invitee, UNKNOWN_TOKEN)
      };

      const got = { accept: await accept(invitee, inviteToken), page: await page(invitee, inviteToken) };

      for (const name of ['accept', 'page'] as const) {
        expect({ name, status: got[name].status, text: got[name].text }).toEqual({ name, status: 404, text: unknown[name].text });
      }

      expect(await openLinks(invitee.id, pro.id)).toBe(0);

      const declined = await decline(invitee, inviteToken);

      expect({ status: declined.status, text: declined.text }).toEqual({ status: 404, text: unknown.decline.text });

      const [left] = await sql()<{ n: number }>`select count(*)::int as n from care_invitations where email = ${invitee.email.toLowerCase()}`;

      expect(left?.n).toBe(0);
    });

    it('tells the practitioner of no check-in', async () => {
      const [plan] = await planRows(waiting.id).then(rows => rows.filter(row => row.status === 'active'));

      await request(server())
        .post(`/${PREFIX}/check-ins`)
        .set('Cookie', waiting.cookie)
        .send({ difficulty: 'ok', hunger: 'hungry', planId: plan?.id, satisfaction: 4, weightKg: 71 })
        .expect(201);
      await settle();
      expect(notices).toEqual([pro.id]);
    });

    it('publishes the client’s next plan directly, replacing the plan that waited at no cost', async () => {
      // The waiting plan no longer counts: its review cannot happen.
      expect(await allowancesOf(waiting)).toMatchObject({ allowed: true, used: 0 });

      const job = await generateAndWait(app, waiting);

      expect(job).toMatchObject({ planId: expect.any(String), status: 'succeeded' });

      const rows = await planRows(waiting.id);

      expect(rows.map(row => row.id)).not.toContain(waitingPlan);
      expect(rows.filter(row => row.status === 'pending_review')).toEqual([]);
      expect(rows.filter(row => row.status === 'active').map(row => row.id)).toEqual([job.planId]);
      // The free tier's one redo, spent once: the replaced plan was not charged.
      expect(await allowancesOf(waiting)).toMatchObject({ used: 1 });

      const [stamped] = await sql()<{ careLinkId: string | null }>`select care_link_id as "careLinkId" from meal_plans where id = ${job.planId}`;

      expect(stamped?.careLinkId).toBeNull();
    });

    it('cannot be suspended twice, and writes nothing', async () => {
      await expectNothingWritten(pro, () => suspend(pro));
    });

    it('is listed on the owner’s page with what stands', async () => {
      const list = await request(server()).get(`/${PREFIX}/admin/professionals`).set('Cookie', owner.cookie).expect(200);
      const row =
        (list.body as { professionals?: Json[] } & Json[]).length === undefined
          ? undefined
          : (list.body as Json[]).find(entry => entry.userId === pro.id);
      const rows = Array.isArray(list.body) ? (list.body as Json[]) : ((list.body as { professionals: Json[] }).professionals ?? []);

      expect(row ?? rows.find(entry => entry.userId === pro.id)).toMatchObject({
        practising: true,
        restriction: { closing: null, suspended: expect.any(Object) }
      });
      expect(list.text).not.toContain(waiting.email);
      expect(list.text).not.toContain(CLIENT_NAME);
    });

    it('lifts with § W bis.2 mailed, restores every door, and undoes nothing the suspension let happen', async () => {
      const mails = sent.length;
      const published = (await planRows(waiting.id)).find(row => row.status === 'active')?.id;
      const lifted = await lift(pro, { facts: 'no hemos encontrado nada que lo sostenga.' });

      expect(lifted.status).toBe(200);
      expect(lifted.body).toEqual({ restriction: null, userId: pro.id });
      expect(await audited(pro, 'professional.restriction_lifted')).toEqual([{ actorId: owner.id, metadata: { close: false, suspension: true } }]);
      await settle();

      const out = mailsTo(pro, mails);

      expect(out).toHaveLength(1);

      const mail = expectStatement(out[0], pro, 'professional-suspension-lifted', 'Hemos levantado la suspensión de tu cuenta como profesional');

      expect(mail.text).toBe('Desde hoy puedes volver a abrir tu consulta en NutrIA. Lo hemos revisado y no hemos encontrado nada que lo sostenga.');

      await overview(pro, waitingLink).expect(200);
      await roster(pro).expect(200);
      // Opening again answers the practice as it stands; nothing is written.
      await request(server()).post(`/${PREFIX}/care/practice`).set('Cookie', pro.cookie).send({}).expect(200);

      // Nothing retroactive: the plan published while it stood is still the one lived, nothing waits.
      const rows = await planRows(waiting.id);

      expect(rows.filter(row => row.status === 'active').map(row => row.id)).toEqual([published]);
      expect(rows.filter(row => row.status === 'pending_review')).toEqual([]);
      expect(await linkRow(waitingLink)).toEqual({ endedBy: null, status: 'active' });
    });

    it('cannot be lifted when nothing stands, and writes nothing', async () => {
      await expectNothingWritten(pro, () => lift(pro));
    });

    it('cannot let a suspended practitioner end a client’s link either', async () => {
      const ender = await practitioner('susp-ender');
      const client = await account('susp-ender-client');
      const linkId = await link(ender, client, 'plan');
      const reference = await endAsClient(ordinary, linkId);

      await suspend(ender).expect(200);

      const ended = await request(server()).delete(`/${PREFIX}/care/links/${linkId}`).set('Cookie', ender.cookie);

      expect({ status: ended.status, text: ended.text }).toEqual({ status: 404, text: reference.text });
      expect(await linkRow(linkId)).toEqual({ endedBy: null, status: 'active' });

      // The client's own ending is theirs whatever stands against the practitioner.
      await endAsClient(client, linkId).expect(204);
      expect(await linkRow(linkId)).toEqual({ endedBy: 'client', status: 'ended' });
      await lift(ender).expect(200);
    });
  });

  // --- Close --------------------------------------------------------------------------

  describe('a close', () => {
    let pro: Account;
    /** Linked `full` with the health line, a condition on record: the illness rule would end the link if the badge simply went. */
    let ill: Account;
    let illLink = '';
    let invitee: Account;
    let inviteToken = '';
    let decidedAt = 0;

    beforeAll(async () => {
      pro = await practitioner('close-pro', true);
      await request(server())
        .put(`/${PREFIX}/care/practice/profile`)
        .set('Cookie', pro.cookie)
        .send({ displayName: 'Lucía, dietista', hours: null, priceCents: null, priceUnit: null, studies: null })
        .expect(200);
      await ownerPost(`/${pro.id}/profile/seen`, {}).expect(200);

      ill = await account('close-client', CLIENT_NAME);
      await declare(ill).expect(200);
      illLink = await link(pro, ill, 'full', true);
      invitee = await account('close-invitee');
      inviteToken = await invite(pro, invitee);
    }, 180_000);

    it('is the owner’s act with thirty days’ notice, § W bis.3 mailed at once to the practitioner alone', async () => {
      const mails = sent.length;

      decidedAt = Date.now();

      const closing = await close(pro);

      expect(closing.status).toBe(200);
      expect(closing.body).toMatchObject({
        restriction: { closing: { closed: false, statement: { authority: null, clause: null, facts: FACTS, source: 'notice' } }, suspended: null },
        userId: pro.id
      });

      const closesAt = Date.parse(String(((closing.body as Json).restriction as { closing: { closesAt: string } }).closing.closesAt));

      expect(Math.abs(closesAt - decidedAt - 30 * 86_400_000)).toBeLessThan(60_000);
      expect(await audited(pro, 'professional.closing')).toEqual([{ actorId: owner.id, metadata: { source: 'notice' } }]);
      await settle();

      const out = sent.slice(mails);

      expect(out).toHaveLength(1);

      const mail = expectStatement(out[0], pro, 'professional-closing', /^Vamos a cerrar tu consulta en NutrIA el \d{1,2} de \p{L}+ de \d{4}$/u);

      expect(mail.text).toContain('cerraremos definitivamente tu consulta');
      expect(mail.text).not.toContain('es decir, suspendida');
      expect(mail.text).toContain('Lo hemos revisado tras un aviso que nos llegó.');
      expectInertFacts(mail);
    });

    it('cannot be closed twice, and writes nothing', async () => {
      await expectNothingWritten(pro, () => close(pro));
    });

    it('works as before for its thirty days — but cannot be opened again', async () => {
      await overview(pro, illLink).expect(200);
      await roster(pro).expect(200);
      await inviting(pro, address('close-window-invitee')).expect(201);
      await page(invitee, inviteToken).expect(200);
      await expectNothingWritten(pro, () => request(server()).post(`/${PREFIX}/care/practice`).set('Cookie', pro.cookie).send({}));

      // Before its day the practitioner still ends a link of their own.
      const leaving = await account('close-window-client');
      const leavingLink = await link(pro, leaving, 'plan');

      await request(server()).delete(`/${PREFIX}/care/links/${leavingLink}`).set('Cookie', pro.cookie).expect(204);
      expect(await linkRow(leavingLink)).toEqual({ endedBy: 'professional', status: 'ended' });
    });

    it('is closed on its day before the sweep has run: no client route, the page saying so', async () => {
      await moveCloseDue(pro.id);
      expect(await practises(pro.id)).toBe(true);
      await expectShut(pro, illLink, { jobId: '00000000-0000-4000-8000-000000000000', mealId: '00000000-0000-4000-8000-000000000000' });
      expect((await practicePage(pro).expect(200)).body).toMatchObject({ restriction: { closing: { closed: true } } });
      await page(invitee, inviteToken).expect(404);

      // On its day the practitioner can no longer end a link either: the answer an account with no practice gets.
      const reference = await endAsClient(ordinary, illLink);
      const ended = await request(server()).delete(`/${PREFIX}/care/links/${illLink}`).set('Cookie', pro.cookie);

      expect({ status: ended.status, text: ended.text }).toEqual({ status: 404, text: reference.text });
      expect(await linkRow(illLink)).toEqual({ endedBy: null, status: 'active' });
    });

    it('is carried out by the daily cron: links ended by the practitioner, badge withdrawn, titled profile requeued, practice and invitations gone, the restriction left', async () => {
      const mails = sent.length;

      await cron().expect(200);
      await settle();

      expect(await practises(pro.id)).toBe(false);
      expect(await linkRow(illLink)).toEqual({ endedBy: 'professional', status: 'ended' });

      const [check] = await sql()<{ kind: string; reason: string | null }>`
        select kind::text as kind, reason from professional_badge_checks where user_id = ${pro.id} order by checked_at desc, created_at desc limit 1`;

      expect(check).toEqual({ kind: 'withdrawn', reason: `other: ${FACTS}` });

      const [profile] = await sql()<{ queued: boolean }>`select queued_at is not null as queued from professional_profiles where user_id = ${pro.id}`;

      expect(profile?.queued).toBe(true);

      const [invitations] = await sql()<{ n: number }>`select count(*)::int as n from care_invitations where professional_id = ${pro.id}`;

      expect(invitations?.n).toBe(0);
      expect(await restrictions(pro.id)).toEqual(['closing']);
      expect(await audited(pro, 'professional.closed')).toEqual([{ actorId: null, metadata: {} }]);

      // Nobody is mailed on the day: not the practitioner, and not the client — no illness-rule mail, though the client has a condition on record.
      expect(mailsTo(pro, mails)).toEqual([]);
      expect(mailsTo(ill, mails)).toEqual([]);
      expect((await request(server()).get(`/${PREFIX}/care/links/me/ended`).set('Cookie', ill.cookie).expect(200)).text).toMatch(/^(|null)$/);
    });

    it('leaves the account closed: every door and the opening a 404, nothing written; listed for the owner with no practice', async () => {
      const refused = await practicePage(pro);

      expect({ status: refused.status, text: refused.text }).toEqual({ status: 404, text: NOT_FOUND_TEXT });
      await expectNothingWritten(pro, () =>
        request(server()).post(`/${PREFIX}/care/practice`).set('Cookie', pro.cookie).send({ birthDate: ADULT_BIRTH_DATE })
      );
      await expectNothingWritten(pro, () => suspend(pro));

      const list = await request(server())
        .get(`/${PREFIX}/admin/professionals?q=${encodeURIComponent(pro.email)}`)
        .set('Cookie', owner.cookie)
        .expect(200);
      const rows = Array.isArray(list.body) ? (list.body as Json[]) : ((list.body as { professionals: Json[] }).professionals ?? []);

      expect(rows.find(row => row.userId === pro.id)).toMatchObject({
        grantedAt: null,
        practising: false,
        restriction: { closing: { closed: true }, suspended: null }
      });
      expect(list.text).not.toContain(ill.email);
    });

    it('frees the client to accept another practitioner', async () => {
      const other = await practitioner('close-other', true);
      const accepted = await accept(ill, await invite(other, ill), answer('full', true));

      expect(accepted.status).toBe(200);
      expect(await openLinks(ill.id, other.id)).toBe(1);
    });

    it('lifted after it was carried out: § W bis.4 «after», and the account opens an empty practice', async () => {
      const mails = sent.length;
      const lifted = await lift(pro, { facts: 'el aviso no se confirmó.' });

      expect(lifted.status).toBe(200);
      expect(lifted.body).toEqual({ restriction: null, userId: pro.id });
      expect(await audited(pro, 'professional.restriction_lifted')).toEqual([{ actorId: owner.id, metadata: { close: true, suspension: false } }]);
      await settle();

      const out = mailsTo(pro, mails);

      expect(out).toHaveLength(1);

      const mail = expectStatement(out[0], pro, 'professional-close-withdrawn', 'Puedes volver a abrir tu consulta en NutrIA');

      expect(mail.text).toContain('Hemos revocado el cierre de tu consulta del');
      expect(mail.text).toContain('Lo hemos revisado y el aviso no se confirmó.');

      const opened = await request(server()).post(`/${PREFIX}/care/practice`).set('Cookie', pro.cookie).send({});

      expect(opened.status).toBe(200);
      expect(opened.body).toMatchObject({ activeClients: 0, agreementRequired: true, pendingInvitations: 0, restriction: null, seats: 10 });
      expect((await request(server()).get(`/${PREFIX}/care/practice/badge`).set('Cookie', pro.cookie).expect(200)).body).not.toMatchObject({
        state: 'badged'
      });
      expect(await audited(pro, 'professional.restriction_lifted')).toHaveLength(1);
      await expectNothingWritten(pro, () => lift(pro));
    });
  });

  describe('a close the owner takes back', () => {
    it('suspended and closing at once: the notice says so, and one lift ends both with § W bis.4 «before» and its suffix', async () => {
      const pro = await practitioner('both-pro');
      const mails = sent.length;

      await suspend(pro).expect(200);

      const closing = await close(pro, {
        authority: 'la Agencia Española de Protección de Datos',
        facts: 'Lo pide la autoridad.',
        source: 'authority'
      });

      expect(closing.status).toBe(200);
      expect(closing.body).toMatchObject({ restriction: { closing: { closed: false }, suspended: { since: expect.any(String) } } });
      await settle();

      const notice = mailsTo(pro, mails).find(mail => mail.kind === 'professional-closing');

      expect(notice?.text).toContain('Hasta esa fecha sigue como está, es decir, suspendida.');
      expect(notice?.text).toContain('Nos lo exige la Agencia Española de Protección de Datos.');

      const before = sent.length;

      await lift(pro).expect(200);
      expect(await audited(pro, 'professional.restriction_lifted')).toEqual([{ actorId: owner.id, metadata: { close: true, suspension: true } }]);
      await settle();

      const out = mailsTo(pro, before);

      expect(out.map(mail => mail.kind)).toEqual(['professional-close-withdrawn']);
      expect(out[0]?.subject).toBe('No vamos a cerrar tu consulta en NutrIA');
      expect(out[0]?.text).toContain('Tu consulta sigue abierta, y también hemos levantado la suspensión.');
      expect(await practises(pro.id)).toBe(true);
      await roster(pro).expect(200);
    });

    /*
     * The window held open as phase 5 held the withdrawal: this suite takes the practitioner's badge lock
     * (`pg_advisory_xact_lock(hashtext('professional_badge'), hashtext(userId))`, the first lock every writer of a
     * practitioner's rows takes) and starts the sweep. The sweep makes its list without the lock, then waits on it
     * for this practice's transaction. While it waits, the lift is written under the same lock — the row the lift
     * route writes, written by hand, because the route itself would queue behind the sweep for that lock, which is
     * the other interleaving (the races below cover it). Then the lock goes, and the sweep decides on what stands.
     */
    it('is not carried out when lifted between the sweep’s list and its write', async () => {
      const pro = await practitioner('held-pro');
      const client = await account('held-client');
      const linkId = await link(pro, client, 'plan');

      await close(pro).expect(200);
      await moveCloseDue(pro.id);

      let swept: Promise<void> | null = null;

      await (sql() as unknown as { begin<T>(fn: (tx: Sql) => Promise<T>): Promise<T> }).begin(async tx => {
        await tx`select pg_advisory_xact_lock(hashtext('professional_badge'), hashtext(${pro.id}))`;
        swept = sweep();

        // The sweep has its list and waits on this lock for its write.
        const deadline = Date.now() + 15_000;
        let waiting = 0;

        while (waiting === 0 && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 50));
          waiting = (await sql()<{ n: number }>`select count(*)::int as n from pg_locks where locktype = 'advisory' and not granted`)[0]?.n ?? 0;
        }

        expect(waiting).toBe(1);
        await tx`insert into practice_restrictions (user_id, kind, acted_by, acted_at) values (${pro.id}, 'lifted', ${owner.id}, clock_timestamp())`;
      });
      await swept;

      expect(await practises(pro.id)).toBe(true);
      expect(await linkRow(linkId)).toEqual({ endedBy: null, status: 'active' });
      expect(await audited(pro, 'professional.closed')).toEqual([]);
      expect(await restrictions(pro.id)).toEqual(['closing', 'lifted']);
      await overview(pro, linkId).expect(200);
      // Nothing stands: the route agrees.
      await expectNothingWritten(pro, () => lift(pro));
    });
  });

  // --- Refusals ------------------------------------------------------------------------

  describe('the owner’s routes refuse', () => {
    it('an account with no practice, and nobody: suspend and close are 404 and write nothing', async () => {
      const nobody = await account('refuse-nobody');

      await expectNothingWritten(nobody, () => suspend(nobody));
      await expectNothingWritten(nobody, () => close(nobody));
      await expectNothingWritten(nobody, () => lift(nobody));

      for (const act of [suspend, close, lift]) {
        expect((await act('usr-nobody')).status).toBe(404);
      }
    });

    it('a malformed statement as 422, writing nothing: no facts, markup in them, an authority not the source, a source unknown', async () => {
      const pro = await practitioner('refuse-malformed');

      for (const body of [
        { source: 'own_review' },
        { facts: 'Con <b>marcas</b>', source: 'own_review' },
        { authority: 'Alguien', facts: 'Hechos.', source: 'own_review' },
        { facts: 'Hechos.', source: 'authority' },
        { facts: 'Hechos.', source: 'rumour' },
        { clause: 15, facts: 'Hechos.', source: 'own_review' }
      ]) {
        await expectNothingWritten(pro, () => suspend(pro, body), 422);
        await expectNothingWritten(pro, () => close(pro, body), 422);
      }

      await expectNothingWritten(pro, () => lift(pro, { facts: 'Con <script>' }), 422);
    });

    it('an ordinary account (404) and an unconfirmed one (the global 409), writing nothing', async () => {
      const pro = await practitioner('refuse-target');
      const plain = await account('refuse-plain');
      const unconfirmed = await account('refuse-unconfirmed');

      await unconfirmAddress(unconfirmed.email);

      const routes = [
        ['post', `/admin/professionals/${pro.id}/suspension`, { facts: 'Hechos.', source: 'own_review' }],
        ['post', `/admin/professionals/${pro.id}/close`, { facts: 'Hechos.', source: 'own_review' }],
        ['post', `/admin/professionals/${pro.id}/lift`, {}],
        ['post', `/admin/professionals/${pro.id}/profile/seen`, {}],
        ['post', `/admin/professionals/${pro.id}/profile/hide`, { reasons: ['advertising'] }],
        ['get', '/admin/professionals/queue', undefined],
        ['get', '/admin/professionals', undefined]
      ] as const;

      for (const route of routes) {
        await expectNothingWritten(pro, () => call(plain, route), 404);

        const refused = await call(unconfirmed, route);

        expect({ code: (refused.body as Json).code, route: route[1], status: refused.status }).toEqual({
          code: 'EMAIL_NOT_VERIFIED',
          route: route[1],
          status: 409
        });
      }

      expect(await footprint(pro)).toMatchObject({ practises: true, restrictions: [] });
    });
  });

  // --- Races ---------------------------------------------------------------------------

  describe('races, fifteen rounds each', () => {
    const ROUNDS = 15;
    /**
     * Starts `act` `ms` later. A sweep called in the process is a few milliseconds ahead of a request that has to
     * cross the HTTP stack, so with both fired at the same instant one side won every round; staggering the start
     * by a few milliseconds a round lets each side reach the lock first in some rounds.
     */
    const after = <T>(ms: number, act: () => PromiseLike<T>): Promise<T> => new Promise<void>(resolve => setTimeout(resolve, ms)).then(act);

    /** The roster's own limit is ten a minute per account, so each race asks it once, at the end, while the suspension stands. */
    const shutRoster = async (who: Account) => {
      await suspend(who).expect(200);
      expect((await roster(who)).text).toBe(NOT_FOUND_TEXT);
      await lift(who).expect(200);
    };

    it('a suspension against an acceptance: afterwards the practitioner reaches nothing', async () => {
      const pro = await practitioner('race-accept-pro');
      const client = await account('race-accept-client');
      const split = { accepted: 0, refused: 0 };

      for (let round = 0; round < ROUNDS; round += 1) {
        const token = await invite(pro, client);
        const [suspended, accepted] = await Promise.all([after((round % 5) * 3, () => suspend(pro)), accept(client, token)]);

        expect(suspended.status).toBe(200);
        expect([200, 404]).toContain(accepted.status);

        const references = { overview: await overview(ordinary, String((accepted.body as Json).id ?? UNKNOWN_TOKEN)) };

        if (accepted.status === 200) {
          split.accepted += 1;

          const linkId = String((accepted.body as Json).id);

          expect((await overview(pro, linkId)).text).toBe(references.overview.text);
          await endAsClient(client, linkId).expect(204);
        } else {
          split.refused += 1;
          expect(await openLinks(client.id, pro.id)).toBe(0);
          expect((await practicePage(pro).expect(200)).body).toMatchObject({ restriction: { suspended: expect.any(Object) } });
        }

        await lift(pro).expect(200);
      }

      expect(split.accepted + split.refused).toBe(ROUNDS);
      await shutRoster(pro);
      process.stdout.write(`[race] suspension vs acceptance: ${JSON.stringify(split)}\n`);
    }, 600_000);

    it('a suspension against the practitioner ending a link: never a link ended by a practitioner suspended first', async () => {
      const pro = await practitioner('race-end-pro');
      const client = await account('race-end-client');
      const split: Record<string, number> = {};

      for (let round = 0; round < ROUNDS; round += 1) {
        const linkId = await link(pro, client, 'plan');
        const [suspended, ended] = await Promise.all([
          after((round % 5) * 3, () => suspend(pro)),
          request(server()).delete(`/${PREFIX}/care/links/${linkId}`).set('Cookie', pro.cookie)
        ]);

        expect(suspended.status).toBe(200);
        expect([204, 404]).toContain(ended.status);
        split[String(ended.status)] = (split[String(ended.status)] ?? 0) + 1;

        const [order] = await sql()<{ endedBy: string | null; endedFirst: boolean | null; status: string }>`
          select l.status::text as status, l.ended_by::text as "endedBy",
                 l.ended_at < (select max(r.acted_at) from practice_restrictions r where r.user_id = ${pro.id} and r.kind = 'suspended') as "endedFirst"
          from care_links l where l.id = ${linkId}`;

        if (ended.status === 204) {
          // Ended, so it was decided before the suspension was written.
          expect(order).toEqual({ endedBy: 'professional', endedFirst: true, status: 'ended' });
        } else {
          expect(order).toEqual({ endedBy: null, endedFirst: null, status: 'active' });
          await endAsClient(client, linkId).expect(204);
        }

        await lift(pro).expect(200);
      }

      process.stdout.write(`[race] suspension vs practitioner's ending: ${JSON.stringify(split)}\n`);
    }, 600_000);

    it('a suspension against a re-consent to the badged list: afterwards the practitioner reaches nothing', async () => {
      const pro = await practitioner('race-reconsent-pro', true);
      const client = await account('race-reconsent-client');
      const split: Record<string, number> = {};
      let linkId = await link(pro, client, 'plan');

      for (let round = 0; round < ROUNDS; round += 1) {
        const [suspended, widened] = await Promise.all([
          suspend(pro),
          request(server()).post(`/${PREFIX}/care/links/me/consent`).set('Cookie', client.cookie).send({ consentVersion: CARE_CONSENT_VERSION })
        ]);

        expect(suspended.status).toBe(200);
        split[String(widened.status)] = (split[String(widened.status)] ?? 0) + 1;
        expect((await overview(pro, linkId)).text).toBe((await overview(ordinary, linkId)).text);
        expect((await practicePage(pro).expect(200)).body).toMatchObject({ restriction: { suspended: expect.any(Object) } });

        // Back to a `plan` link for the next round, by the routes: ended, invited again, accepted on the plan-only list.
        await endAsClient(client, linkId).expect(204);
        await lift(pro).expect(200);
        linkId = await link(pro, client, 'plan');
      }

      await shutRoster(pro);

      process.stdout.write(`[race] suspension vs re-consent: ${JSON.stringify(split)}\n`);
    }, 600_000);

    it('a suspension against the client turning the health line on: afterwards the practitioner reaches nothing', async () => {
      const pro = await practitioner('race-health-pro', true);
      const client = await account('race-health-client');
      const linkId = await link(pro, client, 'full', false);
      const split: Record<string, number> = {};

      for (let round = 0; round < ROUNDS; round += 1) {
        const [suspended, shared] = await Promise.all([
          suspend(pro),
          request(server()).patch(`/${PREFIX}/care/links/me`).set('Cookie', client.cookie).send({ sharesHealth: true })
        ]);

        expect(suspended.status).toBe(200);
        split[String(shared.status)] = (split[String(shared.status)] ?? 0) + 1;
        expect((await overview(pro, linkId)).text).toBe((await overview(ordinary, linkId)).text);
        expect((await practicePage(pro).expect(200)).body).toMatchObject({ restriction: { suspended: expect.any(Object) } });

        await request(server()).patch(`/${PREFIX}/care/links/me`).set('Cookie', client.cookie).send({ sharesHealth: false }).expect(200);
        await lift(pro).expect(200);
      }

      await shutRoster(pro);
      process.stdout.write(`[race] suspension vs health line: ${JSON.stringify(split)}\n`);
    }, 600_000);

    it('the close’s sweep against an acceptance: never an open link to a practice that no longer exists', async () => {
      const pro = await practitioner('race-sweep-accept-pro');
      const client = await account('race-sweep-accept-client');
      const split: Record<string, number> = {};

      for (let round = 0; round < ROUNDS; round += 1) {
        const token = await invite(pro, client);

        await close(pro).expect(200);
        await moveCloseDue(pro.id);

        const [, accepted] = await Promise.all([after((round % 5) * 4, sweep), accept(client, token)]);

        split[String(accepted.status)] = (split[String(accepted.status)] ?? 0) + 1;
        expect(await practises(pro.id)).toBe(false);
        expect(await openLinks(client.id, pro.id)).toBe(0);

        // Opened again for the next round: lifted, the account's own opening, the agreement again.
        await lift(pro).expect(200);
        await openOwnPractice(app, pro);
        await acceptAgreement(app, pro);
      }

      process.stdout.write(`[race] close sweep vs acceptance: ${JSON.stringify(split)}\n`);
    }, 600_000);

    it('the close’s sweep against a lift: the lift’s statement always tells what really happened', async () => {
      const pro = await practitioner('race-sweep-lift-pro');
      const client = await account('race-sweep-lift-client');
      const split = { carriedOut: 0, notCarriedOut: 0 };
      let linkId = await link(pro, client, 'plan');

      for (let round = 0; round < ROUNDS; round += 1) {
        await close(pro).expect(200);
        await moveCloseDue(pro.id);

        const mails = sent.length;
        const [, lifted] = await Promise.all([after((round % 5) * 4, sweep), lift(pro)]);

        expect(lifted.status).toBe(200);
        await settle();

        const statement = mailsTo(pro, mails).filter(mail => mail.kind === 'professional-close-withdrawn');

        expect(statement).toHaveLength(1);

        const gone = !(await practises(pro.id));

        expect({ gone, subject: statement[0]?.subject }).toEqual({
          gone,
          subject: gone ? 'Puedes volver a abrir tu consulta en NutrIA' : 'No vamos a cerrar tu consulta en NutrIA'
        });
        expect(await linkRow(linkId)).toEqual(gone ? { endedBy: 'professional', status: 'ended' } : { endedBy: null, status: 'active' });
        expect(await restrictions(pro.id).then(kinds => kinds.at(-1))).toBe('lifted');

        if (gone) {
          split.carriedOut += 1;
          await openOwnPractice(app, pro);
          await acceptAgreement(app, pro);
          linkId = await link(pro, client, 'plan');
        } else {
          split.notCarriedOut += 1;
        }
      }

      process.stdout.write(`[race] close sweep vs lift: ${JSON.stringify(split)}\n`);
    }, 600_000);

    it('opening against a suspension: a suspension written always stands over the practice it found', async () => {
      const who = await account('race-open');
      const split = { openedFirst: 0, suspensionRefused: 0 };

      for (let round = 0; round < ROUNDS; round += 1) {
        const before = (await restrictions(who.id)).length;
        const [opened, suspended] = await Promise.all([
          request(server()).post(`/${PREFIX}/care/practice`).set('Cookie', who.cookie).send({ birthDate: ADULT_BIRTH_DATE }),
          after((round % 5) * 6, () => suspend(who))
        ]);

        expect(opened.status).toBe(200);
        expect([200, 404]).toContain(suspended.status);
        expect(await practises(who.id)).toBe(true);

        if (suspended.status === 200) {
          split.openedFirst += 1;
          expect((await practicePage(who).expect(200)).body).toMatchObject({ restriction: { suspended: expect.any(Object) } });
          await lift(who).expect(200);
        } else {
          split.suspensionRefused += 1;
          expect(await restrictions(who.id)).toHaveLength(before);
          expect((await practicePage(who).expect(200)).body).toMatchObject({ restriction: null });
        }

        // No practice again for the next round: closed by the owner and the sweep, then lifted.
        await closePracticeNow(app, owner, who.id);
        await lift(who).expect(200);
      }

      process.stdout.write(`[race] opening vs suspension: ${JSON.stringify(split)}\n`);
    }, 600_000);
  });
});
