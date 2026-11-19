import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { BADGE_ONLY_WORDS, NEVER_WORDS, RESULT_WORDS } from 'core/domain/ProtectedWords';
import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { HEALTH_CONSENT_VERSION } from 'core/entities/Health';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';
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
  createApp,
  deleteAccountByEmail,
  deleteAccounts,
  enableTotp,
  httpServer,
  makePractitioner,
  openOwnPractice,
  PREFIX,
  register,
  ScriptedAiClient,
  unconfirmAddress
} from './harness.js';
import { BadgeSweepService } from '../src/modules/owner-alerts/index.js';
import { EmailService } from '../src/modules/email/services/index.js';
import { ENV, validateEnv } from '../src/config/index.js';
import { IllnessRuleSweepService } from '../src/modules/care/services/index.js';
import { PushService } from '../src/modules/notifications/index.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * Anyone can open a practice (project 025 phase 6, PRD 025 criteria 1, 2, 6, 7,
 * 14, 15, 18), on real Postgres.
 *
 * - **Opening**: `POST /care/practice` by the session's account alone. Every
 *   refusal — the switch off, an unconfirmed address, an account the owner has
 *   not opened, no birth date on record and none given, under 18 — is the
 *   same 404, byte for byte, and writes nothing; each case ends by removing its
 *   one cause and getting the 200, so a fixture broken in some other way cannot
 *   pass as a refusal. A body's birth date is used only when none is on record,
 *   and never overwrites one; every other key is ignored. (A suspension, a close
 *   and a closed practice as refusals are `care-restriction.e2e-spec.ts`'s.)
 * - **The free seats**: `practiceClients` (ten, read from what is in force),
 *   active and paused links and live invitations all counted; the eleventh
 *   invitation is 409 `PRACTICE_FULL` naming ten; two invitations fired
 *   together at the last seat never both get it.
 * - **The profile**: every listed word in each free-text field, with and
 *   without the badge; the title caught glued or cut; honest words passing;
 *   queued on a create and a text change and not on the price or the hours;
 *   requeued when a badge carrying a badge-only word goes (withdrawn, lapsed).
 *   The owner's queue, seen, hidden with § X's statement, and no admin answer
 *   naming a client.
 * - **The name** (titles only): refused at the invitation, the client's page,
 *   acceptance and decline a 404 like an expired invitation's when it may not be
 *   shown now; `professionalName: null` at every read where it may not be
 *   shown; the § Y mail's no-name variant; the client's trail keeps the name.
 *
 * Every mail is caught at `EmailService.send` and every push at
 * `PushService.send`; nothing leaves the process. The API's own per-account
 * limiter is raised for this app alone: the words case sends several hundred
 * saves from one account, which is the case, not abuse. The sweeps are global
 * on the database this runs on, so every assertion is about this suite's own
 * accounts. Requires a real database — see ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

type Json = Record<string, unknown>;

/** Every refusal of `POST /care/practice`, and the guard's 404: one body. */
const NOT_FOUND_TEXT = JSON.stringify({ code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 });

/** Words a mail to the practitioner about their profile or practice must not carry: health. */
const HEALTH_WORDS = ['salud', 'enferm', 'condici', 'medica', 'embaraz', 'lactan', 'alerg', 'diagn', 'peso', 'hipotiroid'];

/** A client's own name, distinctive enough that any answer carrying it is a hit. */
const CLIENT_NAME = 'Ximena Quiroga';

/** One profile body: the whole profile, every time. */
function profileBody(overrides: Json = {}): Json {
  return { displayName: 'Ana Pérez', hours: null, priceCents: null, priceUnit: null, studies: null, ...overrides };
}

/** A birth date this many years and one day ago, as `YYYY-MM-DD` — the day after an anniversary. */
function yearsAgo(years: number): string {
  const day = new Date();

  day.setUTCFullYear(day.getUTCFullYear() - years);
  day.setUTCDate(day.getUTCDate() + 1);

  return day.toISOString().slice(0, 10);
}

describe('anyone can open a practice (project 025 phase 6)', () => {
  const stamp = Date.now();
  const cronSecret = randomBytes(24).toString('hex');
  const made: string[] = [];
  const sent: OutgoingEmail[] = [];
  const pushes: unknown[] = [];
  /** Every answer an admin route gave in this suite, searched afterwards for a client. */
  const adminAnswers: string[] = [];
  let app: INestApplication;
  let owner: Account;
  let switchWas = false;
  let started = '';

  const server = () => httpServer(app);
  const address = (label: string) => `open-${label}-${String(stamp)}@e2e.invalid`;

  /** Named `Persona <label>` unless the case is about the name: a name a mail carries must carry no word it may not. */
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

  /** A practitioner the way an account becomes one; `badged` by the badge's four real steps. */
  async function practitioner(label: string, badged = false, name?: string): Promise<Account> {
    const who = await account(label, name);

    await makePractitioner(app, who, badged ? { badgedBy: owner } : {});

    return withTotp(who);
  }

  const open = (who: Account, body: object = {}) => request(server()).post(`/${PREFIX}/care/practice`).set('Cookie', who.cookie).send(body);

  async function admin(method: 'get' | 'post', path: string, body?: object): Promise<Response> {
    let req = request(server())[method](`/${PREFIX}/admin${path}`).set('Cookie', owner.cookie);

    if (body !== undefined) {
      req = req.send(body);
    }

    const response = await req;

    adminAnswers.push(response.text);

    return response;
  }

  async function settle(): Promise<void> {
    // Mails are background tasks: give them the time they would take.
    await new Promise(resolve => setTimeout(resolve, 750));
  }

  /** Everything opening could write for one account, read straight from the tables. */
  async function footprint(userId: string): Promise<Json> {
    const [row] = await sql()<Json>`
      select (select count(*)::int from professionals where user_id = ${userId}) as practices,
             (select birth_date::text from profiles where user_id = ${userId}) as "birthDate",
             (select count(*)::int from profiles where user_id = ${userId}) as profiles,
             (select count(*)::int from practice_restrictions where user_id = ${userId}) as restrictions,
             (select count(*)::int from professional_badge_checks where user_id = ${userId}) as checks,
             (select count(*)::int from audit_logs where subject_user_id = ${userId}) as audit`;

    return row ?? {};
  }

  async function practiceRow(userId: string): Promise<Json | undefined> {
    const [row] = await sql()<Json>`
      select practice_open as "practiceOpen", included_clients as "includedClients", agreement_version as "agreementVersion", granted_at::text as "grantedAt"
      from professionals where user_id = ${userId}`;

    return row;
  }

  /** The 404 every refusal gives, and nothing written. */
  async function expectRefused(who: Account, body: object): Promise<void> {
    const before = await footprint(who.id);
    const refused = await open(who, body);

    expect({ status: refused.status, text: refused.text }).toEqual({ status: 404, text: NOT_FOUND_TEXT });
    expect(await footprint(who.id)).toEqual(before);
  }

  // --- Links --------------------------------------------------------------------

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
  const accept = (client: Account, token: string, body: object = answer('full', false)) =>
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

  const practicePage = async (who: Account): Promise<Json> =>
    (await request(server()).get(`/${PREFIX}/care/practice`).set('Cookie', who.cookie).expect(200)).body as Json;

  async function openSeats(professionalId: string): Promise<number> {
    const [row] = await sql()<{ n: number }>`
      select (select count(*)::int from care_links where professional_id = ${professionalId} and status in ('active', 'paused'))
           + (select count(*)::int from care_invitations where professional_id = ${professionalId} and expires_at > now()) as n`;

    return row?.n ?? -1;
  }

  // --- The profile ------------------------------------------------------------------

  const saveProfile = (who: Account, body: Json) => request(server()).put(`/${PREFIX}/care/practice/profile`).set('Cookie', who.cookie).send(body);
  const readProfile = (who: Account) => request(server()).get(`/${PREFIX}/care/practice/profile`).set('Cookie', who.cookie);

  async function profileRow(userId: string): Promise<Json | undefined> {
    const [row] = await sql()<Json>`
      select display_name as "displayName", studies, queued_at is not null as queued, hidden_at is not null as hidden, updated_at::text as "updatedAt"
      from professional_profiles where user_id = ${userId}`;

    return row;
  }

  async function queuedIds(): Promise<string[]> {
    const queue = await admin('get', '/professionals/queue');

    expect(queue.status).toBe(200);

    return (queue.body as { profiles: { userId: string }[] }).profiles.map(profile => profile.userId);
  }

  beforeAll(async () => {
    for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'OWNER_EMAIL']) {
      expect(process.env[name] ?? '').toBe('');
    }

    started = (await sql()<{ now: string }>`select now()::text as now`)[0]?.now ?? '';
    app = await createApp(new ScriptedAiClient([]), builder =>
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

    owner = await account('owner');
    await UserController.grantAdmin(owner.email);
    owner = await withTotp(owner);
    switchWas = await ProfessionalController.isOpen();
    await SettingsController.setFlag('professional', true, UNAUDITED);
  }, 120_000);

  afterAll(async () => {
    try {
      jest.restoreAllMocks();
      await SettingsController.setFlag('professional', switchWas, UNAUDITED);
      await deleteAccounts(app, made);

      const pattern = `open-%-${String(stamp)}@e2e.invalid`;
      const stragglers = await sql()<{ email: string }>`select email from "user" where email like ${pattern}`;

      for (const { email } of stragglers) {
        await deleteAccountByEmail(app, email);
      }

      await sql()`delete from care_invitations where email like ${pattern}`;
      await sql()`delete from analytics_events where event in ('cron_run', 'owner_alerted') and created_at >= ${started}`;

      const [left] = await sql()<Json>`
        select (select count(*)::int from "user" where email like ${pattern}) as accounts,
               (select count(*)::int from care_invitations where email like ${pattern}) as invitations,
               (select count(*)::int from care_access_log where professional_name like ${`%${String(stamp)}%`}) as trail,
               (select count(*)::int from professional_badge_checks c where not exists (select 1 from "user" u where u.id = c.user_id)) as checks,
               (select count(*)::int from professional_badge_codes c where not exists (select 1 from "user" u where u.id = c.user_id)) as codes,
               (select count(*)::int from professional_profiles p where not exists (select 1 from "user" u where u.id = p.user_id)) as profiles,
               (select count(*)::int from practice_restrictions r where not exists (select 1 from "user" u where u.id = r.user_id)) as restrictions`;

      expect(left).toEqual({ accounts: 0, checks: 0, codes: 0, invitations: 0, profiles: 0, restrictions: 0, trail: 0 });
    } finally {
      await app?.close();
    }
  }, 300_000);

  // --- Opening --------------------------------------------------------------------

  describe('opening a practice', () => {
    it('with the switch off is the 404 and writes nothing; switched on, the same request opens a free practice', async () => {
      const who = await account('switch');

      await SettingsController.setFlag('professional', false, UNAUDITED);

      try {
        await expectRefused(who, { birthDate: ADULT_BIRTH_DATE });
      } finally {
        await SettingsController.setFlag('professional', true, UNAUDITED);
      }

      const opened = await open(who, { birthDate: ADULT_BIRTH_DATE });

      expect(opened.status).toBe(200);
      expect(opened.body).toMatchObject({
        activeClients: 0,
        agreementRequired: true,
        agreementVersion: PROFESSIONAL_AGREEMENT_VERSION,
        open: false,
        pendingInvitations: 0,
        restriction: null,
        seats: 10
      });
      // Nothing paid, no agreement, no badge: the row is the account's own, with the defaults.
      expect(await practiceRow(who.id)).toMatchObject({ agreementVersion: null, includedClients: 0, practiceOpen: false });
      // The body's birth date is kept on the account, as the screen says it will be.
      expect((await footprint(who.id)).birthDate).toBe(ADULT_BIRTH_DATE);
      expect(await auditRowsAboutSubject(who.id)).toEqual([]);
    });

    it('for an unconfirmed address is the 404 and writes nothing; confirmed, it opens', async () => {
      const who = await account('unconfirmed');

      await unconfirmAddress(who.email);
      await expectRefused(who, { birthDate: ADULT_BIRTH_DATE });
      await UserController.confirmAddress(who.email);
      await open(who, { birthDate: ADULT_BIRTH_DATE }).expect(200);
    });

    it('for an account the owner has not opened is the 404 and writes nothing; opened, it opens', async () => {
      const who = await account('unopened');

      // No route takes an opening back: the state of an account still waiting for the owner, on the table.
      await sql()`update "user" set activated_at = null where id = ${who.id}`;
      await expectRefused(who, { birthDate: ADULT_BIRTH_DATE });
      await UserController.activate({ email: who.email }, UNAUDITED);
      await open(who, { birthDate: ADULT_BIRTH_DATE }).expect(200);
    });

    it('with no birth date on record and none given is the 404 and writes nothing; given, it opens', async () => {
      const who = await account('no-birth');

      await expectRefused(who, {});
      await expectRefused(who, { birthDate: undefined });
      await open(who, { birthDate: ADULT_BIRTH_DATE }).expect(200);
    });

    it('under eighteen is the 404 and writes nothing — the day before the birthday too; eighteen, it opens', async () => {
      const who = await account('minor');

      await expectRefused(who, { birthDate: yearsAgo(17) });
      await expectRefused(who, { birthDate: yearsAgo(18) });
      await open(who, { birthDate: yearsAgo(19) }).expect(200);
    });

    it('takes the birth date on record over the body, and never overwrites it', async () => {
      const who = await account('on-record');

      await request(server())
        .patch(`/${PREFIX}/onboarding`)
        .set('Cookie', who.cookie)
        .send({ data: { birthDate: '1994-03-11', country: 'ES', displayName: 'Test', sex: 'female' }, step: 'about-you' })
        .expect(200);

      // A minor's date in the body changes nothing: the adult date on record decides, and stays.
      await open(who, { birthDate: yearsAgo(16) }).expect(200);
      expect((await footprint(who.id)).birthDate).toBe('1994-03-11');
    });

    it('with a minor’s date on record is the 404 whatever the body says; corrected on record, it opens', async () => {
      const who = await account('minor-record');

      // No route stores a minor's birth date (onboarding refuses one): a profile from before that rule, on the table.
      await sql()`
        insert into profiles (user_id, birth_date) values (${who.id}, ${yearsAgo(15)}::date)
        on conflict (user_id) do update set birth_date = excluded.birth_date`;
      await expectRefused(who, { birthDate: ADULT_BIRTH_DATE });
      expect((await footprint(who.id)).birthDate).toBe(yearsAgo(15));

      await request(server())
        .patch(`/${PREFIX}/onboarding`)
        .set('Cookie', who.cookie)
        .send({ data: { birthDate: '1990-07-01', country: 'ES', displayName: 'Test', sex: 'male' }, step: 'about-you' })
        .expect(200);
      await open(who, {}).expect(200);
    });

    it('refuses a malformed birth date as 422, and writes nothing', async () => {
      const who = await account('malformed');
      const before = await footprint(who.id);

      for (const birthDate of ['14/05/1988', '1988-13-40', 19880514, 'mañana']) {
        await open(who, { birthDate }).expect(422);
      }

      expect(await footprint(who.id)).toEqual(before);
    });

    it('ignores every other key of the body: no badge, no paid practice, no seats, no other account (criterion 2)', async () => {
      const who = await account('smuggler');
      const other = await account('smuggled');
      const opened = await open(who, {
        agreementVersion: PROFESSIONAL_AGREEMENT_VERSION,
        badge: { number: '28/99999', state: 'badged' },
        birthDate: ADULT_BIRTH_DATE,
        collegiateNumber: '28/99999',
        grantedBy: owner.id,
        includedClients: 99,
        practiceOpen: true,
        professionalVerified: true,
        userId: other.id
      });

      expect(opened.status).toBe(200);
      expect(opened.body).toMatchObject({ agreementRequired: true, includedClients: 0, open: false, seats: 10 });
      expect(await practiceRow(who.id)).toMatchObject({ agreementVersion: null, includedClients: 0, practiceOpen: false });
      expect(await footprint(who.id)).toMatchObject({ checks: 0, practices: 1 });
      expect(await footprint(other.id)).toMatchObject({ checks: 0, practices: 0 });

      const badge = await request(server()).get(`/${PREFIX}/care/practice/badge`).set('Cookie', who.cookie).expect(200);

      expect(badge.body).toMatchObject({ number: null, state: 'none' });

      // Opening again answers the practice as it stands and writes nothing.
      const before = await practiceRow(who.id);

      await open(who, { birthDate: yearsAgo(30), includedClients: 50, practiceOpen: true }).expect(200);
      expect(await practiceRow(who.id)).toEqual(before);
      expect((await footprint(who.id)).birthDate).toBe(ADULT_BIRTH_DATE);
    });

    it('makes nobody a practitioner but the account itself: the retired grant is a 404 to the owner, and no sign-up or account body opens one', async () => {
      const target = await account('not-granted');

      expect((await admin('post', `/accounts/${target.id}/professional`, { collegiateNumber: '28/12345' })).status).toBe(404);
      await request(server()).delete(`/${PREFIX}/admin/accounts/${target.id}/professional`).set('Cookie', owner.cookie).expect(404);

      // The account's own updates carry no practice either.
      await request(server())
        .post(`/${PREFIX}/auth/update-user`)
        .set('Cookie', target.cookie)
        .send({ includedClients: 9, practiceOpen: true, professional: true, role: 'professional' });
      await request(server()).patch(`/${PREFIX}/profile`).set('Cookie', target.cookie).send({ practiceOpen: true, professional: true });

      expect(await footprint(target.id)).toMatchObject({ checks: 0, practices: 0 });
      await request(server()).get(`/${PREFIX}/care/practice`).set('Cookie', target.cookie).expect(404);
    });
  });

  // --- Whether the account may open one, and the number it would hold (phase 8) -----------

  describe('whether an account may open a practice, and the seats it would hold', () => {
    const me = async (who: Account): Promise<Json> =>
      (await request(server()).get(`/${PREFIX}/users/me`).set('Cookie', who.cookie).expect(200)).body as Json;
    const opening = (who: Account, query = '') => request(server()).get(`/${PREFIX}/care/practice/opening${query}`).set('Cookie', who.cookie);
    /** The account's own resolved number: a free account's, from what is in force now. */
    const freeSeats = async (): Promise<number> => (await SettingsController.allowances()).effective.free.practiceClients;

    async function expectNoOpening(who: Account): Promise<void> {
      const refused = await opening(who);

      expect({ status: refused.status, text: refused.text }).toEqual({ status: 404, text: NOT_FOUND_TEXT });
    }

    it('says yes to an ordinary account with the switch on, and no with it off — the number following the same rule', async () => {
      const who = await account('can-ordinary');

      expect(await me(who)).toMatchObject({ canOpenPractice: true, professional: false });
      expect((await opening(who).expect(200)).body).toEqual({ seats: await freeSeats() });

      await SettingsController.setFlag('professional', false, UNAUDITED);

      try {
        expect(await me(who)).toMatchObject({ canOpenPractice: false, professional: false });
        await expectNoOpening(who);
      } finally {
        await SettingsController.setFlag('professional', true, UNAUDITED);
      }
    });

    it('says no to a practitioner, a suspended one and a closed one; yes again once the close is lifted', async () => {
      const who = await practitioner('can-practitioner');

      expect(await me(who)).toMatchObject({ canOpenPractice: false, professional: true });
      await expectNoOpening(who);

      await admin('post', `/professionals/${who.id}/suspension`, { facts: 'Hechos de la prueba.', source: 'own_review' });
      expect(await me(who)).toMatchObject({ canOpenPractice: false, professional: true });
      await expectNoOpening(who);
      expect((await admin('post', `/professionals/${who.id}/lift`, {})).status).toBe(200);

      // Closed by the owner and the sweep: no practice, the restriction standing.
      await closePracticeNow(app, owner, who.id);
      expect(await me(who)).toMatchObject({ canOpenPractice: false, professional: false });
      await expectNoOpening(who);

      expect((await admin('post', `/professionals/${who.id}/lift`, {})).status).toBe(200);
      expect(await me(who)).toMatchObject({ canOpenPractice: true, professional: false });
      expect((await opening(who).expect(200)).body).toEqual({ seats: await freeSeats() });
    });

    it('says yes to an unconfirmed account — the form names the same number — while opening itself stays the 404', async () => {
      const confirmed = await account('can-confirmed');
      const unconfirmed = await account('can-unconfirmed');

      await unconfirmAddress(unconfirmed.email);
      expect(await me(unconfirmed)).toMatchObject({ canOpenPractice: true });

      const [a, b] = [await opening(unconfirmed), await opening(confirmed)];

      expect({ status: a.status, text: a.text }).toEqual({ status: b.status, text: b.text });
      expect(a.status).toBe(200);
      await expectRefused(unconfirmed, { birthDate: ADULT_BIRTH_DATE });
    });

    it('follows the number the owner sets, and no query names another account', async () => {
      const who = await account('can-number');
      const other = await practitioner('can-number-other');
      const before = await freeSeats();

      await SettingsController.setAllowance({ name: 'practiceClients', tier: 'free', value: 7 }, UNAUDITED);

      try {
        expect((await opening(who).expect(200)).body).toEqual({ seats: 7 });

        for (const query of [`?userId=${other.id}`, `?id=${other.id}`, `?user=${owner.id}`]) {
          expect({ body: (await opening(who, query)).body as unknown, query }).toEqual({ body: { seats: 7 }, query });
        }

        // The practitioner's own answer is the 404 whatever the query names.
        const refused = await opening(other, `?userId=${who.id}`);

        expect({ status: refused.status, text: refused.text }).toEqual({ status: 404, text: NOT_FOUND_TEXT });
      } finally {
        await SettingsController.setAllowance({ name: 'practiceClients', tier: 'free', value: before }, UNAUDITED);
      }

      expect((await opening(who).expect(200)).body).toEqual({ seats: before });
    });
  });

  // --- The free seats ---------------------------------------------------------------

  describe('the free practice’s seats', () => {
    let seats = 0;
    let pro: Account;
    let active: Account;
    let paused: Account;
    let pausedLink = '';

    beforeAll(async () => {
      // Read, never assumed (`0097`): the number in force is what the route enforces. Ten on both tiers as shipped.
      const allowances = await SettingsController.allowances();

      seats = allowances.effective.free.practiceClients;
      expect({ free: seats, premium: allowances.effective.premium.practiceClients }).toEqual({ free: 10, premium: 10 });

      pro = await practitioner('seats-pro');
      active = await account('seats-active');
      paused = await account('seats-paused');
    }, 120_000);

    it('takes every acceptance as active on a practice nobody pays for', async () => {
      const linkId = await link(pro, active, 'plan');
      const [row] = await sql()<{ status: string }>`select status::text as status from care_links where id = ${linkId}`;

      expect(row?.status).toBe('active');
      // The client's own route answers 200 and the practitioner reaches them: a free practice works.
      await myLink(active).expect(200);
      await request(server()).get(`/${PREFIX}/care/clients/${linkId}`).set('Cookie', pro.cookie).expect(200);

      pausedLink = await link(pro, paused, 'plan');
      // No route pauses a link since this phase; a link a 004 lapse left paused stays so: on the table.
      await sql()`update care_links set status = 'paused' where id = ${pausedLink}`;
    });

    it('counts active and paused links and live invitations, and refuses the eleventh as PRACTICE_FULL naming ten', async () => {
      for (let n = 1; n <= seats - 2; n += 1) {
        await inviting(pro, address(`seat-${n}`)).expect(201);
      }

      expect(await openSeats(pro.id)).toBe(seats);
      expect(await practicePage(pro)).toMatchObject({ activeClients: 2, open: false, pendingInvitations: seats - 2, seats });

      const mails = sent.length;
      const refused = await inviting(pro, address('seat-eleventh'));

      expect(refused.status).toBe(409);
      expect(refused.body).toMatchObject({ code: 'PRACTICE_FULL', practice: { includedClients: 10 }, statusCode: 409 });
      expect(await openSeats(pro.id)).toBe(seats);

      const [none] = await sql()<{ n: number }>`select count(*)::int as n from care_invitations where email = ${address('seat-eleventh')}`;

      expect(none?.n).toBe(0);
      await settle();
      expect(sent.slice(mails).filter(mail => mail.to === address('seat-eleventh'))).toEqual([]);

      // Re-inviting an address already invited is the same seat, not another one.
      await inviting(pro, address('seat-1')).expect(201);
      expect(await openSeats(pro.id)).toBe(seats);
    });

    it('frees the seat a paused link held once it ends', async () => {
      await request(server()).delete(`/${PREFIX}/care/links/${pausedLink}`).set('Cookie', paused.cookie).expect(204);
      await inviting(pro, address('seat-freed')).expect(201);
      await inviting(pro, address('seat-twelfth')).expect(409);
      expect(await openSeats(pro.id)).toBe(seats);
    });

    it('gives the last seat to one of two invitations fired together, every round', async () => {
      const racer = await practitioner('seats-racer');
      const outcomes: string[] = [];

      for (let n = 1; n <= seats - 1; n += 1) {
        await inviting(racer, address(`race-seat-${n}`)).expect(201);
      }

      for (let round = 0; round < 8; round += 1) {
        const left = address(`race-left-${round}`);
        const right = address(`race-right-${round}`);
        const [a, b] = await Promise.all([inviting(racer, left), inviting(racer, right)]);

        outcomes.push(`${a.status}/${b.status}`);
        expect([a.status, b.status].sort()).toEqual([201, 409]);
        expect(await openSeats(racer.id)).toBe(seats);

        // Back to one seat free for the next round. No route takes an invitation back: on the table.
        await sql()`delete from care_invitations where professional_id = ${racer.id} and email = any(${[left, right]})`;
      }

      // Which side won is the race's to decide; that one always lost is the claim.
      expect(outcomes).toHaveLength(8);
    });
  });

  // --- The profile ------------------------------------------------------------------

  describe('the profile', () => {
    let plain: Account;
    let badged: Account;
    let client: Account;

    beforeAll(async () => {
      plain = await practitioner('profile-plain');
      badged = await practitioner('profile-badged', true);
      client = await account('profile-client', CLIENT_NAME);
      await link(plain, client, 'plan');
    }, 180_000);

    it('is null before it is written, and a malformed one is refused with nothing written', async () => {
      const none = await readProfile(plain).expect(200);

      expect(none.text === '' || none.text === 'null').toBe(true);

      const day = [{ from: '09:00', to: '10:00' }];
      const malformed: Json[] = [
        profileBody({ studies: 'Grado <b>en</b> algo' }),
        profileBody({ studies: 'Texto con un control \u0001 dentro' }),
        profileBody({ displayName: 'Ana\nPérez' }),
        profileBody({ displayName: '' }),
        profileBody({ displayName: 'A'.repeat(81) }),
        profileBody({ studies: 'x'.repeat(2001) }),
        profileBody({ hours: [Array.from({ length: 7 }, (_, n) => ({ from: `0${n}:00`, to: `0${n}:30` })), [], [], [], [], [], []] }),
        profileBody({ hours: [day, day, day, day, day, day] }),
        profileBody({ hours: [[{ from: '10:00', to: '09:00' }], [], [], [], [], [], []] }),
        profileBody({ priceCents: 4000 }),
        profileBody({ priceUnit: 'consultation' }),
        profileBody({ priceCents: -1, priceUnit: 'consultation' })
      ];

      for (const body of malformed) {
        expect({ body, status: (await saveProfile(plain, body)).status }).toEqual({ body, status: 422 });
      }

      expect(await profileRow(plain.id)).toBeUndefined();
    });

    it('takes six opening ranges a day, line breaks and tabs in the studies, and is queued on its creation', async () => {
      const six = Array.from({ length: 6 }, (_, n) => ({ from: `1${n}:00`, to: `1${n}:30` }));
      const saved = await saveProfile(plain, profileBody({ hours: [six, [], [], [], [], [], []], studies: 'Curso de cocina.\n\tSegundo año.' }));

      expect(saved.status).toBe(200);
      expect(saved.body).toMatchObject({
        displayName: 'Ana Pérez',
        hidden: null,
        review: 'queued',
        studies: 'Curso de cocina.\n\tSegundo año.',
        withheld: []
      });
      expect(await queuedIds()).toContain(plain.id);
    });

    it('lets the owner mark it seen — not approved — once; the price and the hours do not queue it again, a text does', async () => {
      const seen = await admin('post', `/professionals/${plain.id}/profile/seen`, {});

      expect(seen.status).toBe(200);
      expect(seen.body).toMatchObject({ badged: false, review: 'seen', userId: plain.id });
      expect(await queuedIds()).not.toContain(plain.id);

      const rows = await auditRowsAboutSubject(plain.id);

      expect(rows.filter(row => row.action === 'professional.profile_seen').map(row => ({ actorId: row.actorId, metadata: row.metadata }))).toEqual([
        { actorId: owner.id, metadata: {} }
      ]);

      // Seen twice: nothing is on the queue to see, and nothing is written.
      const audit = (await auditRowsAboutSubject(plain.id)).length;

      expect((await admin('post', `/professionals/${plain.id}/profile/seen`, {})).status).toBe(404);
      expect(await auditRowsAboutSubject(plain.id)).toHaveLength(audit);

      // The same words, a price and hours: not queued.
      const priced = await saveProfile(
        plain,
        profileBody({
          hours: [[{ from: '09:00', to: '13:00' }], [], [], [], [], [], []],
          priceCents: 4500,
          priceUnit: 'consultation',
          studies: 'Curso de cocina.\n\tSegundo año.'
        })
      );

      expect(priced.body).toMatchObject({ priceCents: 4500, review: 'seen' });
      expect(await queuedIds()).not.toContain(plain.id);

      // A text changed: back on the queue.
      const edited = await saveProfile(plain, profileBody({ priceCents: 4500, priceUnit: 'consultation', studies: 'Curso de cocina, tercer año.' }));

      expect(edited.body).toMatchObject({ review: 'queued' });
      expect(await queuedIds()).toContain(plain.id);
      await admin('post', `/professionals/${plain.id}/profile/seen`, {});

      const renamed = await saveProfile(
        plain,
        profileBody({ displayName: 'Ana P.', priceCents: 4500, priceUnit: 'consultation', studies: 'Curso de cocina, tercer año.' })
      );

      expect(renamed.body).toMatchObject({ review: 'queued' });
    });

    /** Every listed word, as the table writes it, in a sentence of its own: `[list, word]`. */
    const LISTED: readonly (readonly ['badge_only' | 'never' | 'result', string])[] = [
      ...RESULT_WORDS.map(word => ['result', word] as const),
      ['result', '10 kg'] as const,
      ['result', '100 %'] as const,
      ...NEVER_WORDS.map(word => ['never', word] as const),
      ...BADGE_ONLY_WORDS.map(word => ['badge_only', word] as const)
    ];

    /** Each listed word in each free-text field, its answer as `field list status`. */
    async function judged(who: Account, field: 'displayName' | 'studies'): Promise<string[]> {
      const misses: string[] = [];

      for (const [list, word] of LISTED) {
        const body = profileBody({ [field]: field === 'displayName' ? `Ana ${word}` : `Formación: ${word}, y más.` });
        const before = await profileRow(who.id);
        const response = await saveProfile(who, body);
        const errors = (response.body as { fieldErrors?: Record<string, string[]> }).fieldErrors;
        const allowed = list === 'badge_only' && who === badged;

        if (allowed) {
          if (response.status !== 200) {
            misses.push(`${field} ${list} «${word}»: ${response.status}`);
          }

          continue;
        }

        const hit = errors?.[field]?.[0] ?? '';

        if (response.status !== 422 || !hit.startsWith(`${list}:`) || Object.keys(errors ?? {}).length !== 1) {
          misses.push(`${field} ${list} «${word}»: ${response.status} ${JSON.stringify(errors)}`);
        }

        // Refused: nothing written, not even the queue.
        const after = await profileRow(who.id);

        if (JSON.stringify(after) !== JSON.stringify(before)) {
          misses.push(`${field} ${list} «${word}»: written`);
        }
      }

      return misses;
    }

    it.each(['displayName', 'studies'] as const)(
      'refuses every listed word in %s without the badge, naming the field and the list, and writes nothing',
      async field => {
        expect(await judged(plain, field)).toEqual([]);
      }
    );

    it.each(['displayName', 'studies'] as const)('with the badge allows the badge-only words in %s, and still refuses the others', async field => {
      expect(await judged(badged, field)).toEqual([]);
    });

    it('names every refused field at once, on whichever list each falls, and writes nothing', async () => {
      const before = await profileRow(plain.id);
      const both = await saveProfile(plain, profileBody({ displayName: 'Ana Dietista', studies: 'Consulta clínica para pacientes' }));

      expect(both.status).toBe(422);
      expect(Object.keys((both.body as { fieldErrors: Json }).fieldErrors).sort()).toEqual(['displayName', 'studies']);
      expect(both.body).toMatchObject({
        fieldErrors: { displayName: ['badge_only:dietista'], studies: [expect.stringMatching(/^badge_only:/) as unknown as string] }
      });
      expect(await profileRow(plain.id)).toEqual(before);

      // Badged: each field refused on a different list, both named.
      const badgedBefore = await profileRow(badged.id);
      const lists = await saveProfile(badged, profileBody({ displayName: 'Dra. Ana Gil', studies: 'Resultados garantizados en un mes.' }));

      expect(lists.status).toBe(422);
      expect((lists.body as { fieldErrors: Json }).fieldErrors).toEqual({ displayName: ['never:dra'], studies: ['result:garantizados'] });
      expect(await profileRow(badged.id)).toEqual(badgedBefore);
    });

    it('catches a title glued or cut, and lets honest words through', async () => {
      for (const displayName of [
        'Ana dietistanutricionista',
        'Ana dieti sta',
        'Ana die-tista',
        'Ana dietis­ta',
        'Ana nutricio nista',
        'Ana DietistaNutricionista'
      ]) {
        const refused = await saveProfile(plain, profileBody({ displayName }));
        const errors = JSON.stringify((refused.body as Json).fieldErrors ?? null);

        expect({ displayName, errors, status: refused.status }).toEqual({
          displayName,
          errors: expect.stringMatching(/^\{"displayName":\["badge_only:(dietista|nutricionista)"\]\}$/) as unknown as string,
          status: 422
        });
      }

      for (const studies of ['Nutrición deportiva', 'Dietética y cocina', 'Dieta mediterránea', 'Asesora nutricional', 'Cocina nutricional']) {
        expect({ status: (await saveProfile(plain, profileBody({ studies }))).status, studies }).toEqual({ status: 200, studies });
      }
    });

    it('requeues a profile carrying a badge-only word when the owner withdraws the badge, and only such a profile', async () => {
      const titled = await practitioner('profile-titled', true);
      const untitled = await practitioner('profile-untitled', true);

      await saveProfile(titled, profileBody({ displayName: 'Laura, dietista-nutricionista' })).expect(200);
      await saveProfile(untitled, profileBody({ displayName: 'Laura Gil' })).expect(200);

      for (const who of [titled, untitled]) {
        await admin('post', `/professionals/${who.id}/profile/seen`, {});

        const withdrawn = await admin('post', `/professionals/${who.id}/badge/removal`, {
          facts: 'El registro no lo confirma.',
          kind: 'withdrawn',
          reason: 'other',
          source: 'own_check'
        });

        expect(withdrawn.status).toBe(200);
      }

      const mine = await readProfile(titled).expect(200);

      expect(mine.body).toMatchObject({ review: 'queued', withheld: [{ field: 'displayName', list: 'badge_only', word: 'dietista' }] });
      expect((await readProfile(untitled).expect(200)).body).toMatchObject({ review: 'seen', withheld: [] });

      const queued = await queuedIds();

      expect(queued).toContain(titled.id);
      expect(queued).not.toContain(untitled.id);
    });

    it('requeues a profile carrying a badge-only word when the badge lapses in the daily sweep', async () => {
      const lapsing = await practitioner('profile-lapsing', true);

      await saveProfile(lapsing, profileBody({ studies: 'Nutricionista por la universidad.' })).expect(200);
      await admin('post', `/professionals/${lapsing.id}/profile/seen`, {});
      expect((await readProfile(lapsing).expect(200)).body).toMatchObject({ review: 'seen' });

      // No route takes a clock: the pass moved back past its due date and the thirty days' grace — the application with it, so it is not read as one waiting.
      await sql()`
        update professional_badge_checks set checked_at = now() - interval '397 days', created_at = now() - interval '397 days'
        where user_id = ${lapsing.id} and kind = 'applied'`;
      await sql()`
        update professional_badge_checks
        set checked_at = now() - interval '396 days', due_at = now() - interval '31 days', created_at = now() - interval '396 days'
        where user_id = ${lapsing.id} and kind = 'pass'`;
      await app.get(BadgeSweepService, { strict: false }).run();

      const [lapsed] = await sql()<{
        n: number;
      }>`select count(*)::int as n from professional_badge_checks where user_id = ${lapsing.id} and kind = 'lapsed'`;

      expect(lapsed?.n).toBe(1);
      expect((await readProfile(lapsing).expect(200)).body).toMatchObject({ review: 'queued', withheld: [{ field: 'studies', list: 'badge_only' }] });
      expect(await queuedIds()).toContain(lapsing.id);
    });

    it('lets the owner hide it — refusing is the same act — with § X’s statement to the practitioner alone, the owner’s words as inert text', async () => {
      await saveProfile(plain, profileBody({ displayName: 'Ana Pérez', studies: 'Curso de cocina.' })).expect(200);

      const before = (await auditRowsAboutSubject(plain.id)).length;
      const mails = sent.length;
      const facts = 'Dice "experta" & más {closeDate} {word} {reason}\nsegunda línea';

      // Refused before anything is written or mailed: no reason; a word reason without its word; markup in the facts; an unknown reason.
      for (const body of [
        {},
        { reasons: ['badge_word'] },
        { facts: 'Hechos con <b>marcas</b>', reasons: ['promises'] },
        { reasons: ['unknown'] },
        { reasons: ['promises', 'promises'] }
      ]) {
        expect((await admin('post', `/professionals/${plain.id}/profile/hide`, body)).status).toBe(422);
      }

      expect(await auditRowsAboutSubject(plain.id)).toHaveLength(before);
      expect((await profileRow(plain.id))?.hidden).toBe(false);

      const hidden = await admin('post', `/professionals/${plain.id}/profile/hide`, {
        afterNotice: true,
        facts,
        reasons: ['promises', 'badge_word'],
        word: 'dietista'
      });

      expect(hidden.status).toBe(200);
      expect(hidden.body).toMatchObject({
        hidden: { afterNotice: true, facts, reasons: ['promises', 'badge_word'], word: 'dietista' },
        userId: plain.id
      });
      expect(await queuedIds()).not.toContain(plain.id);
      expect((await readProfile(plain).expect(200)).body).toMatchObject({ hidden: { afterNotice: true, word: 'dietista' } });

      const rows = (await auditRowsAboutSubject(plain.id)).filter(row => row.action === 'professional.profile_hidden');

      // The closed words alone: never the quoted word or the owner's facts.
      expect(rows.map(row => ({ actorId: row.actorId, metadata: row.metadata }))).toEqual([
        { actorId: owner.id, metadata: { afterNotice: true, reasons: ['promises', 'badge_word'] } }
      ]);

      await settle();

      const out = sent.slice(mails);

      expect(out.map(mail => ({ kind: mail.kind, to: mail.to }))).toEqual([{ kind: 'professional-profile-hidden', to: plain.email }]);

      const mail = out[0] as OutgoingEmail;

      expect(mail.subject).toBe('Hemos ocultado tu perfil de NutrIA');
      expect(mail.text).toContain('Hemos ocultado tu perfil.');
      // The table's order, not the body's: the badge word first, then the promise.
      expect(mail.text).toContain('Usa una palabra que el acuerdo no permite sin la insignia: «dietista». Promete resultados.');
      expect(mail.text).toContain('después de un aviso que nos llegó');
      // The owner's words as they were typed, line break folded, nothing filled into their braces, nothing marked up.
      expect(mail.text).toContain('Dice "experta" & más {closeDate} {word} {reason} segunda línea.');
      expect(mail.html).toContain('{closeDate} {word} {reason}');
      expect(mail.html).toContain('&amp; más');
      expect(mail.html).not.toContain('& más');
      expect(`${mail.subject} ${mail.text}`.toLowerCase()).not.toContain(CLIENT_NAME.toLowerCase());

      for (const word of HEALTH_WORDS) {
        expect({ hit: `${mail.subject} ${mail.text}`.toLowerCase().includes(word), word }).toEqual({ hit: false, word });
      }

      // Hiding an account with no profile, or no account, is the 404 and writes nothing.
      const stranger = await account('profile-stranger');

      for (const id of [stranger.id, 'usr-nobody']) {
        expect((await admin('post', `/professionals/${id}/profile/hide`, { reasons: ['advertising'] })).status).toBe(404);
      }

      expect(await auditRowsAboutSubject(stranger.id)).toEqual([]);

      // An edit returns it to the queue, still hidden until the owner looks again; seen, it is shown.
      const edited = await saveProfile(plain, profileBody({ displayName: 'Ana Pérez', studies: 'Curso de cocina, sin promesas.' }));

      expect(edited.body).toMatchObject({ hidden: { word: 'dietista' }, review: 'queued' });
      expect((await admin('post', `/professionals/${plain.id}/profile/seen`, {})).body).toMatchObject({ hidden: null, review: 'seen' });
    });

    it('names no client in any answer the owner received, and the profile routes are 404 to an account with no practice', async () => {
      await admin('get', '/professionals');
      await admin('get', '/professionals/badges');
      await admin('get', `/professionals/${plain.id}/badge`);
      await admin('get', '/professionals/queue');

      const everything = adminAnswers.join('\n');

      for (const needle of [client.email, client.id, CLIENT_NAME]) {
        expect({ hit: everything.includes(needle), needle }).toEqual({ hit: false, needle });
      }

      for (const call of [readProfile(client), saveProfile(client, profileBody())]) {
        const refused = await call;

        expect({ status: refused.status, text: refused.text }).toEqual({ status: 404, text: NOT_FOUND_TEXT });
      }

      expect(await profileRow(client.id)).toBeUndefined();
    });
  });

  // --- The name ---------------------------------------------------------------------

  describe('the practitioner’s name, judged for titles only', () => {
    /** Opens a practice by hand: `makePractitioner` refuses a titled name without a badge on purpose, and this case is the title. */
    async function titledWithoutBadge(label: string, name: string): Promise<Account> {
      const who = await account(label, name);

      await openOwnPractice(app, who);
      await acceptAgreement(app, who);

      return withTotp(who);
    }

    /** Badged first, then titled: the badge is earned under a plain name, as any account would. */
    async function titledWithBadge(label: string, name: string): Promise<Account> {
      const who = await practitioner(label, true);

      await rename(who, name);

      return who;
    }

    async function rename(who: Account, name: string): Promise<void> {
      await request(server()).post(`/${PREFIX}/auth/update-user`).set('Cookie', who.cookie).send({ name }).expect(200);

      const [row] = await sql()<{ name: string }>`select name from "user" where id = ${who.id}`;

      expect(row?.name).toBe(name);
    }

    it('refuses an invitation under a title the account may not use — 422 naming the name — and writes and mails nothing', async () => {
      const unbadged = await titledWithoutBadge('name-dietista', 'Laura Dietista');
      const doctor = await titledWithBadge('name-dra', 'Dra. Ana Gil');
      const mails = sent.length;

      for (const [who, hit] of [
        [unbadged, 'badge_only:dietista'],
        [doctor, 'never:dra']
      ] as const) {
        const refused = await inviting(who, address(`name-invitee-${hit.replace(/[^a-z]/g, '')}`));

        expect(refused.status).toBe(422);
        expect(refused.body).toMatchObject({ code: 'INVALID_INPUT', fieldErrors: { name: [hit] } });

        const [row] = await sql()<{ n: number }>`select count(*)::int as n from care_invitations where professional_id = ${who.id}`;

        expect(row?.n).toBe(0);
      }

      await settle();
      expect(sent.slice(mails)).toEqual([]);
    });

    it('judges titles alone: «José Asegurado» invites, and the § A bis mail names no title', async () => {
      const surname = await practitioner('name-asegurado', false, 'José Asegurado');
      const invitee = await account('name-asegurado-invitee');
      const before = sent.length;

      await inviting(surname, invitee.email).expect(201);

      const token = await tokenMailedTo(invitee.email, before);
      const mail = sent.slice(before).find(message => message.kind === 'care-invitation') as OutgoingEmail;

      expect(token).toHaveLength(43);
      expect(mail.subject).toBe('José Asegurado te ha invitado a NutrIA');
      expect(mail.text).toContain('José Asegurado te ha invitado a que te haga el plan de comidas en NutrIA.');
      expect(mail.text).toContain('Si aceptas, podrá hacerte el plan y ajustarlo contigo.');

      for (const word of ['dietista', 'nutricionista', 'paciente', 'consulta', 'colegiad']) {
        expect({ hit: mail.text.toLowerCase().includes(word), word }).toEqual({ hit: false, word });
      }

      await page(invitee, token).expect(200);
    });

    it('answers the client’s page, acceptance and decline exactly as an expired invitation once the name may not be shown, and the decline still deletes', async () => {
      const renamed = await practitioner('name-renamed', false, 'Marta Ruiz');
      const invitee = await account('name-renamed-invitee');
      const expired = await account('name-expired-invitee');
      const token = await invite(renamed, invitee);
      const stale = await invite(renamed, expired);

      // No route moves an invitation's clock: the reference is an invitation past its fourteen days.
      await sql()`update care_invitations set expires_at = now() - interval '1 minute' where email = ${expired.email.toLowerCase()}`;
      await rename(renamed, 'Marta Ruiz, dietista');

      const references = { accept: await accept(expired, stale), decline: await decline(expired, stale), page: await page(expired, stale) };
      const answers = { accept: await accept(invitee, token), page: await page(invitee, token) };

      for (const name of ['accept', 'page'] as const) {
        expect({ name, status: answers[name].status, text: answers[name].text }).toEqual({ name, status: 404, text: references[name].text });
      }

      const declined = await decline(invitee, token);

      expect({ status: declined.status, text: declined.text }).toEqual({ status: 404, text: references.decline.text });

      const [left] = await sql()<{ n: number }>`select count(*)::int as n from care_invitations where email = ${invitee.email.toLowerCase()}`;

      expect(left?.n).toBe(0);
      expect(await sql()`select id from care_links where client_id = ${invitee.id}`).toEqual([]);
    });

    it('shows a badge-only title while the badge stands and null once it goes — the link, the 409, the health answer and the ended link — and the trail keeps the name', async () => {
      const titled = await titledWithBadge('name-laura', 'Laura Dietista');
      const client = await account('name-laura-client');
      const other = await practitioner('name-laura-other', false, 'Elena Soto');
      const linkId = await link(titled, client, 'full');

      expect((await myLink(client).expect(200)).body).toMatchObject({ professionalName: 'Laura Dietista', professionalVerified: true });
      // The practitioner reads the client: the trail keeps the name as it was.
      await request(server()).get(`/${PREFIX}/care/clients/${linkId}`).set('Cookie', titled.cookie).expect(200);

      const withdrawn = await admin('post', `/professionals/${titled.id}/badge/removal`, {
        facts: 'El registro no lo confirma.',
        kind: 'withdrawn',
        reason: 'other',
        source: 'own_check'
      });

      expect(withdrawn.status).toBe(200);
      expect((await myLink(client).expect(200)).body).toMatchObject({ professionalName: null, professionalVerified: false });

      // Another practitioner's invitation: the link in the way is named as it may be shown now.
      const exists = await accept(client, await invite(other, client));

      expect(exists.status).toBe(409);
      expect(exists.body).toMatchObject({ code: 'CARE_LINK_EXISTS', link: { professionalName: null } });

      // A condition declared while linked to an un-badged practitioner ends the link (the illness rule): named as null.
      const declared = await request(server())
        .put(`/${PREFIX}/health-data`)
        .set('Cookie', client.cookie)
        .send({
          conditions: [{ conditionKey: 'hypothyroidism', label: 'Hipotiroidismo' }],
          consentVersion: HEALTH_CONSENT_VERSION,
          medications: [],
          supplements: []
        });

      expect(declared.status).toBe(200);
      expect(declared.body).toMatchObject({ linkEnded: { professionalName: null } });
      expect((await request(server()).get(`/${PREFIX}/care/links/me/ended`).set('Cookie', client.cookie).expect(200)).body).toMatchObject({
        professionalName: null,
        reason: 'declared'
      });

      const trail = await request(server()).get(`/${PREFIX}/care/access-log`).set('Cookie', client.cookie).expect(200);

      expect(trail.text).toContain('Laura Dietista');
    });

    it('never shows «Dra.»: null on the link, the re-consent and the health line, whatever the badge', async () => {
      const doctor = await practitioner('name-gil', true, 'Ana Gil');
      const client = await account('name-gil-client');

      await link(doctor, client, 'plan');
      expect((await myLink(client).expect(200)).body).toMatchObject({ professionalName: 'Ana Gil', reconsentOffered: true });
      await rename(doctor, 'Dra. Ana Gil');
      expect((await myLink(client).expect(200)).body).toMatchObject({ professionalName: null, professionalVerified: true });

      const widened = await request(server())
        .post(`/${PREFIX}/care/links/me/consent`)
        .set('Cookie', client.cookie)
        .send({ consentVersion: CARE_CONSENT_VERSION });

      expect(widened.status).toBe(200);
      expect(widened.body).toMatchObject({ consentScope: 'full', professionalName: null });

      const health = await request(server()).patch(`/${PREFIX}/care/links/me`).set('Cookie', client.cookie).send({ sharesHealth: true });

      expect(health.status).toBe(200);
      expect(health.body).toMatchObject({ professionalName: null, sharesHealth: true });
    });

    it('mails § Y’s no-name variant when the sweep ends a link to a practitioner whose title the badge no longer allows', async () => {
      const titled = await titledWithBadge('name-pilar', 'Pilar Dietista');
      const client = await account('name-pilar-client');

      await link(titled, client, 'full', true);
      await request(server())
        .put(`/${PREFIX}/health-data`)
        .set('Cookie', client.cookie)
        .send({
          conditions: [{ conditionKey: 'hypothyroidism', label: 'Hipotiroidismo' }],
          consentVersion: HEALTH_CONSENT_VERSION,
          medications: [],
          supplements: []
        })
        .expect(200);
      await admin('post', `/professionals/${titled.id}/badge/removal`, {
        facts: 'El registro no lo confirma.',
        kind: 'withdrawn',
        reason: 'other',
        source: 'own_check'
      });

      const mails = sent.length;

      await app.get(IllnessRuleSweepService, { strict: false }).run();
      await settle();

      const ended = sent.slice(mails).filter(mail => mail.to === client.email.toLowerCase());

      expect(ended.map(mail => mail.kind)).toEqual(['care-link-ended-by-rule']);
      expect(ended[0]?.subject).toBe('Tu enlace con tu profesional en NutrIA ha terminado');
      expect(`${ended[0]?.text} ${ended[0]?.html}`).not.toMatch(/Pilar|Dietista/i);
      expect((await request(server()).get(`/${PREFIX}/care/links/me/ended`).set('Cookie', client.cookie).expect(200)).body).toMatchObject({
        professionalName: null,
        reason: 'badge_lost'
      });
    });
  });
});
