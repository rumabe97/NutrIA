import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { CARE_CONSENT_VERSION, CARE_HEALTH_SHARED, CARE_SHARED, CARE_SHARED_PLAN } from 'core/entities/Care';
import { CareController } from 'core/controllers/Care';
import { HEALTH_CONSENT_VERSION } from 'core/entities/Health';
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
  enableTotp,
  httpServer,
  openPractice,
  PREFIX,
  register,
  ScriptedAiClient
} from './harness.js';
import { ENV, validateEnv } from '../src/config/index.js';
import { EmailService } from '../src/modules/email/services/index.js';
import { IllnessRuleSweepService } from '../src/modules/care/services/index.js';
import { PushService } from '../src/modules/notifications/index.js';

import type { Account } from './harness.js';
import type { BadgeCodeIssuedView } from 'core/controllers/Professional';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * Consent per tier, and the illness rule (project 025 phase 5, `0111` §§ 4 and
 * 8, PRD 025 criteria 10, 11, 12, 22 and 25), on real Postgres.
 *
 * - **The acceptance matrix**: the stored `consent_scope` is `full` only when
 *   the body says `full` and the badge stands at that moment; `plan` otherwise,
 *   the health line off, and no error. The body must say which list was read.
 *   The invitation's detail shows the list of the inviter's tier.
 * - **A refused acceptance**: a client with a condition (pregnancy and
 *   breastfeeding included, a free-text one included) or a medication on
 *   record cannot accept an un-badged practitioner — one 409 that names
 *   nothing, nothing written, the invitation still open, nobody told; a
 *   supplement alone is not on record.
 * - **A declaration**: saving a condition or a medication while linked to an
 *   un-badged practitioner ends that link — `active` or `paused` — as
 *   `declared`, clears the practitioner's mark on the targets, and reads to the
 *   practitioner exactly as a link the client ended.
 * - **The daily sweep** in `/cron/reminders`: links of practitioners with no
 *   standing badge end (`badge_lost`) over a record — the client alone mailed —
 *   and narrow otherwise.
 * - **Narrowing and regaining**: a badge that stops standing narrows the stored
 *   consent — at once for the owner's withdrawal, and before a pass recorded
 *   while none stood — and only the client's own re-consent widens it again.
 * - **Concurrency**: the declaration against the acceptance, the withdrawal
 *   against an acceptance and a re-consent, the sweep against the withdrawal.
 *
 * The suite captures every mail at `EmailService.send` and every push at
 * `PushService.send`; nothing leaves the process. The sweep is global on the
 * database this runs on, so every assertion is about this suite's own
 * accounts. Requires a real database — see ./README.md.
 */

type Sql = (<Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>) & {
  begin<T>(fn: (tx: <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>) => Promise<T>): Promise<T>;
};

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

type Json = Record<string, unknown>;

type Record_ = {
  readonly conditions?: readonly { readonly conditionKey?: string; readonly label: string }[];
  readonly medications?: readonly { readonly name: string }[];
  readonly supplements?: readonly { readonly kind?: string; readonly name: string; readonly proteinGPerServing?: number }[];
};

const CONDITION_LABEL = 'Hipotiroidismo de alcance';
const MEDICATION = 'Levotiroxina de alcance';
const SUPPLEMENT = 'Colágeno de alcance';

/** Every shape that puts something on record (`onRecord`), and the one that does not. */
const ON_RECORD: Readonly<Record<string, Record_>> = {
  breastfeeding: { conditions: [{ conditionKey: 'breastfeeding', label: 'Lactancia' }] },
  'condition (free text)': { conditions: [{ label: 'Una cosa que solo yo nombro' }] },
  'condition (listed)': { conditions: [{ conditionKey: 'hypothyroidism', label: CONDITION_LABEL }] },
  'medication alone': { medications: [{ name: MEDICATION }], supplements: [{ kind: 'other', name: SUPPLEMENT }] },
  pregnancy: { conditions: [{ conditionKey: 'pregnancy', label: 'Embarazo' }] }
};
const SUPPLEMENT_ONLY: Record_ = { supplements: [{ kind: 'other', name: SUPPLEMENT }] };
const NOTHING: Record_ = {};
const A_CONDITION: Record_ = ON_RECORD['condition (listed)'] as Record_;

const ILLNESS_RULE_BODY = { code: 'CARE_ILLNESS_RULE', message: 'No puedes aceptar esta invitación.', statusCode: 409 };
const LINK_NOT_FOUND = { code: 'NOT_FOUND', message: 'Link not found', statusCode: 404 };
const RULE_MAIL = 'care-link-ended-by-rule';

/** Words a mail about an ended link must not carry: health, and the badge (`textos/06` § Y). */
const NOT_IN_THE_MAIL = [
  'salud',
  'health',
  'enferm',
  'illness',
  'condici',
  'condition',
  'medica',
  'embaraz',
  'pregnan',
  'lactan',
  'breastfe',
  'insignia',
  'badge',
  'distintivo',
  'verific',
  'colegiad',
  'alcance',
  'hipotiroid'
];

type Stored = {
  readonly consentedAt: string;
  readonly consentScope: string;
  readonly consentVersion: string;
  readonly endedBy: string | null;
  readonly narrowedAt: string | null;
  readonly scopeConsentedAt: string | null;
  readonly scopeConsentVersion: string | null;
  readonly sharesHealth: boolean;
  readonly status: string;
};

describe('the illness rule and consent per tier (project 025 phase 5)', () => {
  const stamp = Date.now();
  const cronSecret = randomBytes(24).toString('hex');
  const made: string[] = [];
  const sent: OutgoingEmail[] = [];
  const pushes: unknown[] = [];
  let app: INestApplication;
  let owner: Account;
  let switchWas = false;
  let started = '';

  const server = () => httpServer(app);
  const address = (label: string) => `illness-${label}-${String(stamp)}@e2e.invalid`;

  // --- Accounts ------------------------------------------------------------------

  /** Named `Persona <label>`: a name that goes into a mail must carry no word the mail may not. */
  async function account(label: string): Promise<Account> {
    const who = await register(app, address(label), `Persona ${label}`);

    made.push(who.cookie);

    return who;
  }

  async function withTotp(who: Account): Promise<Account> {
    const enabled = await enableTotp(app, who);

    made.push(enabled.cookie);

    return enabled;
  }

  async function grant(who: Account): Promise<void> {
    await request(server())
      .post(`/${PREFIX}/admin/accounts/${who.id}/professional`)
      .set('Cookie', owner.cookie)
      .send({ collegiateNumber: `28/${String(stamp).slice(-5)}` })
      .expect(201);
  }

  /** May practise, practice open, agreement accepted, no badge check at all (as `care-badge.e2e-spec.ts` makes one). */
  async function unbadgedPractitioner(label: string): Promise<Account> {
    const who = await account(label);

    await sql()`insert into professionals (user_id) values (${who.id})`;
    await acceptAgreement(app, who);
    await openPractice(who.id, 100);

    return withTotp(who);
  }

  /** Badged through the owner's grant route, which writes a `pass`. */
  async function badgedPractitioner(label: string): Promise<Account> {
    const who = await account(label);

    await grant(who);
    await acceptAgreement(app, who);
    await openPractice(who.id, 100);

    return withTotp(who);
  }

  const withdraw = (who: Account) =>
    request(server())
      .post(`/${PREFIX}/admin/professionals/${who.id}/badge/removal`)
      .set('Cookie', owner.cookie)
      .send({ facts: 'La consulta del registro no lo encuentra.', kind: 'withdrawn', reason: 'other', source: 'own_check' });

  /** Moves the latest `pass` back: checked `days + 365` ago, due `days` ago — past thirty days of grace, lapsed by the clock with no row. */
  async function backdatePass(userId: string, dueDaysAgo: number): Promise<void> {
    const moved = await sql()<{ id: string }>`
      update professional_badge_checks
      set checked_at = now() - make_interval(days => ${dueDaysAgo + 365}), due_at = now() - make_interval(days => ${dueDaysAgo}),
        created_at = now() - make_interval(days => ${dueDaysAgo + 365})
      where id = (select id from professional_badge_checks where user_id = ${userId} and kind = 'pass' order by checked_at desc limit 1)
      returning id::text as id`;

    expect(moved).toHaveLength(1);
  }

  /** The practitioner's badge as their own page reads it. */
  async function badgeState(who: Account): Promise<string> {
    const response = await request(server()).get(`/${PREFIX}/care/practice/badge`).set('Cookie', who.cookie).expect(200);

    return String((response.body as Json).state);
  }

  /** Applies, is sent a code by phone, enters it: what the owner's confirmation needs. */
  async function applyWithCode(who: Account): Promise<void> {
    await request(server())
      .post(`/${PREFIX}/care/practice/badge`)
      .set('Cookie', who.cookie)
      .send({ number: `28/${String(stamp).slice(-5)}`, register: 'Colegio Oficial de Dietistas-Nutricionistas de Madrid' })
      .expect(201);

    const issued = await request(server())
      .post(`/${PREFIX}/admin/professionals/${who.id}/badge/code`)
      .set('Cookie', owner.cookie)
      .send({ channel: 'phone' })
      .expect(201);

    await request(server())
      .post(`/${PREFIX}/care/practice/badge/code`)
      .set('Cookie', who.cookie)
      .send({ code: (issued.body as BadgeCodeIssuedView).code })
      .expect(204);
  }

  const confirm = (who: Account) =>
    request(server()).post(`/${PREFIX}/admin/professionals/${who.id}/badge/confirm`).set('Cookie', owner.cookie).send({});

  // --- Links ---------------------------------------------------------------------

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

  async function invite(professional: Account, client: Account): Promise<string> {
    const before = sent.length;

    await request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', professional.cookie).send({ email: client.email }).expect(201);

    return tokenMailedTo(client.email, before);
  }

  const accept = (client: Account, token: string, body: object) =>
    request(server()).post(`/${PREFIX}/care/invitations/${token}/accept`).set('Cookie', client.cookie).send(body);

  const answer = (consentScope: 'full' | 'plan', sharesHealth: boolean) => ({ consentScope, consentVersion: CARE_CONSENT_VERSION, sharesHealth });

  async function link(professional: Account, client: Account, consentScope: 'full' | 'plan' = 'full', sharesHealth = true): Promise<string> {
    const accepted = await accept(client, await invite(professional, client), answer(consentScope, sharesHealth));

    expect(accepted.status).toBe(200);

    return String((accepted.body as Json).id);
  }

  const declare = (client: Account, record: Record_) =>
    request(server())
      .put(`/${PREFIX}/health-data`)
      .set('Cookie', client.cookie)
      .send({
        conditions: record.conditions ?? [],
        consentVersion: HEALTH_CONSENT_VERSION,
        medications: record.medications ?? [],
        supplements: record.supplements ?? []
      });

  const roster = (professional: Account) => request(server()).get(`/${PREFIX}/care/clients`).set('Cookie', professional.cookie);
  const myLink = (client: Account) => request(server()).get(`/${PREFIX}/care/links/me`).set('Cookie', client.cookie);
  const endedOf = (who: Account) => request(server()).get(`/${PREFIX}/care/links/me/ended`).set('Cookie', who.cookie);
  const reconsent = (client: Account, consentVersion: string = CARE_CONSENT_VERSION) =>
    request(server()).post(`/${PREFIX}/care/links/me/consent`).set('Cookie', client.cookie).send({ consentVersion });
  const setSharesHealth = (client: Account, sharesHealth: boolean) =>
    request(server()).patch(`/${PREFIX}/care/links/me`).set('Cookie', client.cookie).send({ sharesHealth });
  const endLink = (client: Account, linkId: string) =>
    request(server()).delete(`/${PREFIX}/care/links/${linkId}`).set('Cookie', client.cookie).expect(204);

  async function stored(linkId: string): Promise<Stored> {
    const [row] = await sql()<Stored>`
      select status::text as status, ended_by::text as "endedBy", consent_scope::text as "consentScope", shares_health as "sharesHealth",
             narrowed_at::text as "narrowedAt", consented_at::text as "consentedAt", consent_version as "consentVersion",
             scope_consented_at::text as "scopeConsentedAt", scope_consent_version as "scopeConsentVersion"
      from care_links where id = ${linkId}`;

    if (!row) {
      throw new Error(`No link ${linkId}`);
    }

    return row;
  }

  async function openLinksOf(clientId: string): Promise<{ id: string; consentScope: string; professionalId: string }[]> {
    return sql()<{ id: string; consentScope: string; professionalId: string }>`
      select id::text as id, professional_id as "professionalId", consent_scope::text as "consentScope"
      from care_links where client_id = ${clientId} and status in ('active', 'paused')`;
  }

  async function invitationRow(email: string): Promise<{ id: string; expiresAt: string } | undefined> {
    const [row] = await sql()<{ id: string; expiresAt: string }>`
      select id::text as id, expires_at::text as "expiresAt" from care_invitations where email = ${email.toLowerCase()}`;

    return row;
  }

  async function markOf(clientId: string): Promise<string | null | undefined> {
    const [row] = await sql()<{ setBy: string | null }>`select set_by_professional_id as "setBy" from target_overrides where user_id = ${clientId}`;

    return row?.setBy;
  }

  async function settle(): Promise<void> {
    // Mails and pushes are background tasks: give them the time they would take.
    await new Promise(resolve => setTimeout(resolve, 750));
  }

  const cron = () => request(server()).get(`/${PREFIX}/cron/reminders`).set('Authorization', `Bearer ${cronSecret}`);
  const sweep = () => app.get(IllnessRuleSweepService, { strict: false }).run();

  beforeAll(async () => {
    for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'OWNER_EMAIL']) {
      expect(process.env[name] ?? '').toBe('');
    }

    started = (await sql()<{ now: string }>`select now()::text as now`)[0]?.now ?? '';
    app = await createApp(new ScriptedAiClient([]), builder =>
      builder.overrideProvider(ENV).useValue(validateEnv({ ...process.env, CRON_SECRET: cronSecret }))
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

      const pattern = `illness-%-${String(stamp)}@e2e.invalid`;
      const stragglers = await sql()<{ email: string }>`select email from "user" where email like ${pattern}`;

      for (const { email } of stragglers) {
        await deleteAccountByEmail(app, email);
      }

      // The cron's own record of its runs, this suite's alone.
      await sql()`delete from analytics_events where event = 'cron_run' and properties ->> 'job' = 'reminders' and created_at >= ${started}`;
      // The badge's pass in that run claims its day for the reminders (`owner_alerted`, `badge-reminders`): this run's claim alone.
      await sql()`delete from analytics_events where event = 'owner_alerted' and created_at >= ${started}`;

      const [left] = await sql()<Json>`
        select (select count(*)::int from "user" where email like ${pattern}) as accounts,
               (select count(*)::int from care_invitations where email like ${pattern}) as invitations,
               (select count(*)::int from care_access_log where professional_name like ${'Persona %'} and created_at >= ${started}) as trail,
               (select count(*)::int from professional_badge_checks c where not exists (select 1 from "user" u where u.id = c.user_id)) as checks,
               (select count(*)::int from professional_badge_codes c where not exists (select 1 from "user" u where u.id = c.user_id)) as codes,
               (select count(*)::int from analytics_events where event in ('mail_sent', 'owner_alerted', 'cron_run') and created_at >= ${started}) as events`;

      expect(left).toEqual({ accounts: 0, checks: 0, codes: 0, events: 0, invitations: 0, trail: 0 });
    } finally {
      await app?.close();
    }
  }, 180_000);

  // --- (e) What accepting stores --------------------------------------------------

  describe('accepting records the list of the tier, and the health line only under it', () => {
    let badged: Account;
    let unbadged: Account;

    beforeAll(async () => {
      badged = await badgedPractitioner('e-pro-b');
      unbadged = await unbadgedPractitioner('e-pro-u');
    }, 120_000);

    it('shows the invitation with the list of the inviter’s tier: the health line and the checked number only with the badge', async () => {
      const client = await account('e-reader');
      const fromBadged = await invite(badged, client);
      const fromUnbadged = await invite(unbadged, client);

      const wide = await request(server()).get(`/${PREFIX}/care/invitations/${fromBadged}`).set('Cookie', client.cookie).expect(200);

      expect(wide.body).toMatchObject({
        badge: { checkedAt: expect.any(String), collegiateNumber: `28/${String(stamp).slice(-5)}` },
        collegiateNumber: `28/${String(stamp).slice(-5)}`,
        healthShares: [...CARE_HEALTH_SHARED],
        scope: 'full',
        shares: [...CARE_SHARED],
        sharesPlan: []
      });

      const narrow = await request(server()).get(`/${PREFIX}/care/invitations/${fromUnbadged}`).set('Cookie', client.cookie).expect(200);

      expect(narrow.body).toEqual({
        badge: null,
        collegiateNumber: '',
        consentVersion: CARE_CONSENT_VERSION,
        expiresAt: expect.any(String),
        healthShares: [],
        professionalName: 'Persona e-pro-u',
        scope: 'plan',
        shares: [],
        sharesPlan: [...CARE_SHARED_PLAN]
      });
    });

    it('stores `full` only for `full` under a standing badge; `plan` for `plan`, and for `full` with no badge — without an error', async () => {
      const cases = [
        { asked: 'full', pro: badged, scope: 'full', sharesHealth: true },
        { asked: 'plan', pro: badged, scope: 'plan', sharesHealth: false },
        { asked: 'full', pro: unbadged, scope: 'plan', sharesHealth: false }
      ] as const;

      for (const [index, { asked, pro, scope, sharesHealth }] of cases.entries()) {
        const client = await account(`e-matrix-${String(index)}`);
        const accepted = await accept(client, await invite(pro, client), answer(asked, true));

        expect({ asked, status: accepted.status }).toEqual({ asked, status: 200 });
        expect(accepted.body).toMatchObject({ consentScope: scope, scope, sharesHealth });
        expect(await stored(String((accepted.body as Json).id))).toMatchObject({
          consentScope: scope,
          narrowedAt: null,
          scopeConsentedAt: null,
          scopeConsentVersion: null,
          sharesHealth
        });

        if (scope === 'plan') {
          expect(accepted.body).toMatchObject({ shares: [], sharesPlan: [...CARE_SHARED_PLAN] });
        }
      }
    });

    it('refuses an answer that does not say which list was read, and writes nothing', async () => {
      const client = await account('e-unsaid');
      const token = await invite(badged, client);

      for (const body of [
        { consentVersion: CARE_CONSENT_VERSION, sharesHealth: false },
        { consentScope: null, consentVersion: CARE_CONSENT_VERSION, sharesHealth: false },
        { consentScope: 'everything', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false }
      ]) {
        expect((await accept(client, token, body)).status).toBe(422);
      }

      expect(await openLinksOf(client.id)).toEqual([]);
      expect(await invitationRow(client.email)).toBeDefined();
    });

    it('turns the health line on only under `full`; off always works', async () => {
      // Under `plan`, with the badge standing.
      const planClient = await account('e-health-plan');

      await link(badged, planClient, 'plan', false);

      const refused = await setSharesHealth(planClient, true);

      expect([refused.status, refused.body]).toEqual([404, LINK_NOT_FOUND]);
      expect((await setSharesHealth(planClient, false)).status).toBe(200);

      // Under `full`, with the badge gone by the clock and no sweep yet: the stored consent is `full`, the badge is not.
      const lapsing = await badgedPractitioner('e-pro-lapsing');
      const fullClient = await account('e-health-full');
      const linkId = await link(lapsing, fullClient, 'full', false);

      await backdatePass(lapsing.id, 31);
      expect(await stored(linkId)).toMatchObject({ consentScope: 'full', sharesHealth: false });

      const noBadge = await setSharesHealth(fullClient, true);

      expect([noBadge.status, noBadge.text]).toEqual([404, refused.text]);
      expect(await stored(linkId)).toMatchObject({ consentScope: 'full', sharesHealth: false });

      const off = await setSharesHealth(fullClient, false);

      expect(off.status).toBe(200);
      expect(off.body).toMatchObject({ consentScope: 'full', professionalVerified: false, scope: 'plan', shares: [], sharesHealth: false });
    });

    it('answers every refused re-consent with one 404, byte for byte, and writes nothing', async () => {
      const stranger = await account('e-stranger');
      const fullClient = await account('e-already-full');
      const unbadgedClient = await account('e-plan-unbadged');
      const planClient = await account('e-plan-badged');
      const fullLink = await link(badged, fullClient, 'full', false);
      const unbadgedLink = await link(unbadged, unbadgedClient, 'full', false);
      const planLink = await link(badged, planClient, 'plan', false);
      const before = await Promise.all([fullLink, unbadgedLink, planLink].map(stored));
      const refusals: [string, Response][] = [
        ['no link', await reconsent(stranger)],
        ['already full', await reconsent(fullClient)],
        ['no badge', await reconsent(unbadgedClient)]
      ];

      await SettingsController.setFlag('professional', false, UNAUDITED);

      try {
        refusals.push(['switch off', await reconsent(planClient)]);
      } finally {
        await SettingsController.setFlag('professional', true, UNAUDITED);
      }

      for (const [what, response] of refusals) {
        expect({ status: response.status, text: response.text, what }).toEqual({ status: 404, text: JSON.stringify(LINK_NOT_FOUND), what });
      }

      expect(await Promise.all([fullLink, unbadgedLink, planLink].map(stored))).toEqual(before);
      // An old version is refused before anything is read.
      expect((await reconsent(planClient, '0.0.1')).status).toBe(422);
      // The same plan link, switch on: it widens — so the switch alone refused it above.
      expect((await reconsent(planClient)).status).toBe(200);
    });
  });

  // --- (a) A refused acceptance -----------------------------------------------------

  describe('an acceptance refused under the illness rule', () => {
    let pro: Account;
    let bystander: Account;

    beforeAll(async () => {
      pro = await unbadgedPractitioner('a-pro');
      bystander = await account('a-bystander');
      await declare(bystander, SUPPLEMENT_ONLY).expect(200);
      await link(pro, bystander, 'plan', false);
    }, 120_000);

    it('refuses every shape of a record with one 409 naming nothing, keeps the invitation, tells nobody — and a supplement alone is accepted', async () => {
      const client = await account('a-client');
      const token = await invite(pro, client);
      const invitation = await invitationRow(client.email);
      const rosterBefore = await roster(pro).expect(200);
      const detailBefore = await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', client.cookie).expect(200);

      expect((rosterBefore.body as { invitations: unknown[] }).invitations).toHaveLength(1);

      await settle();

      const mails = sent.length;
      const pushed = pushes.length;

      for (const [shape, record] of Object.entries(ON_RECORD)) {
        await declare(client, record).expect(200);

        const refused = await accept(client, token, answer('plan', false));

        expect({ body: refused.body as unknown, shape, status: refused.status }).toEqual({ body: ILLNESS_RULE_BODY, shape, status: 409 });
        expect(await openLinksOf(client.id)).toEqual([]);
        expect(await invitationRow(client.email)).toEqual(invitation);
      }

      // The `full` answer is refused the same way: the rule is about the inviter's badge, not the list asked for.
      expect((await accept(client, token, answer('full', true))).body).toEqual(ILLNESS_RULE_BODY);

      await settle();
      expect(sent.length).toBe(mails);
      expect(pushes.length).toBe(pushed);

      // The practitioner sees an invitation still unanswered, byte for byte, and the client still reads it.
      const rosterAfter = await roster(pro).expect(200);

      expect(rosterAfter.text).toBe(rosterBefore.text);
      expect((await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', client.cookie).expect(200)).text).toBe(
        detailBefore.text
      );
      expectNothing(await endedOf(client));

      // A supplement is not on record: the same invitation, still open, is accepted.
      await declare(client, SUPPLEMENT_ONLY).expect(200);

      const accepted = await accept(client, token, answer('plan', false));

      expect(accepted.status).toBe(200);
      expect(accepted.body).toMatchObject({ consentScope: 'plan', scope: 'plan', sharesHealth: false, status: 'active' });
      expect(await invitationRow(client.email)).toBeUndefined();
    });

    it('accepts once the record is withdrawn, and a client with no health section at all', async () => {
      const withdrawing = await account('a-withdrawing');
      const token = await invite(pro, withdrawing);

      await declare(withdrawing, { medications: [{ name: MEDICATION }] }).expect(200);
      expect((await accept(withdrawing, token, answer('plan', false))).status).toBe(409);
      await request(server()).delete(`/${PREFIX}/health-data`).set('Cookie', withdrawing.cookie).expect(200);
      expect((await accept(withdrawing, token, answer('plan', false))).status).toBe(200);

      const blank = await account('a-blank');

      expect((await accept(blank, await invite(pro, blank), answer('plan', false))).status).toBe(200);
    });

    it('lets a client with a record accept a badged practitioner, as before', async () => {
      const badged = await badgedPractitioner('a-pro-b');
      const client = await account('a-recorded');

      await declare(client, A_CONDITION).expect(200);

      const accepted = await accept(client, await invite(badged, client), answer('full', true));

      expect(accepted.status).toBe(200);
      expect(accepted.body).toMatchObject({ consentScope: 'full', scope: 'full', sharesHealth: true });
    });
  });

  // --- (b) A declaration ends the link ------------------------------------------------

  describe('a declaration while linked to a practitioner without the badge', () => {
    let pro: Account;
    let bystander: Account;
    let declaring: Account;
    let control: Account;
    const links: Record<'bystander' | 'control' | 'declaring', string> = { bystander: '', control: '', declaring: '' };

    beforeAll(async () => {
      pro = await unbadgedPractitioner('b-pro');
      bystander = await account('b-bystander');
      declaring = await account('b-declaring');
      control = await account('b-control');
      links.bystander = await link(pro, bystander, 'plan', false);
      links.declaring = await link(pro, declaring, 'plan', false);
      links.control = await link(pro, control, 'plan', false);
    }, 120_000);

    it('ends it as `declared`, answers the name, and reads to the practitioner exactly as a link the client ended', async () => {
      const practice = async () => (await request(server()).get(`/${PREFIX}/care/practice`).set('Cookie', pro.cookie).expect(200)).body as Json;
      const before = await roster(pro).expect(200);
      const practiceBefore = await practice();

      await settle();

      const mails = sent.length;
      const pushed = pushes.length;
      const saved = await declare(declaring, A_CONDITION).expect(200);

      expect((saved.body as Json).linkEnded).toEqual({ professionalName: 'Persona b-pro' });
      expect((saved.body as { conditions: unknown[] }).conditions).toHaveLength(1);
      expect(await stored(links.declaring)).toMatchObject({ endedBy: 'declared', status: 'ended' });
      expectNothing(await myLink(declaring));

      const afterRule = await roster(pro).expect(200);
      const practiceAfterRule = await practice();

      const without = (body: string, linkId: string) => {
        const parsed = JSON.parse(body) as { clients: Json[]; invitations: unknown[] };

        return JSON.stringify({ ...parsed, clients: parsed.clients.filter(row => row.linkId !== linkId) });
      };

      // The rule's ending: the row gone, nothing else changed.
      expect(afterRule.text).toBe(without(before.text, links.declaring));

      // The control: the client ends their own link.
      await endLink(control, links.control);

      const afterClient = await roster(pro).expect(200);
      const practiceAfterClient = await practice();

      expect(afterClient.text).toBe(without(afterRule.text, links.control));

      // The practice page moved the same way both times.
      for (const key of Object.keys(practiceBefore)) {
        const [a, b, c] = [practiceBefore[key], practiceAfterRule[key], practiceAfterClient[key]];

        if (typeof a === 'number' && typeof b === 'number' && typeof c === 'number') {
          expect({ key, step: b - a }).toEqual({ key, step: c - b });
        } else {
          expect({ key, value: b }).toEqual({ key, value: c });
        }
      }

      // Each ended link answers the practitioner the same 404, byte for byte.
      const ruleEnded = await request(server()).get(`/${PREFIX}/care/clients/${links.declaring}`).set('Cookie', pro.cookie);
      const clientEnded = await request(server()).get(`/${PREFIX}/care/clients/${links.control}`).set('Cookie', pro.cookie);

      expect([ruleEnded.status, ruleEnded.text]).toEqual([404, clientEnded.text]);

      // Nothing sent by either ending: the screen of the person saving tells them, and the practitioner is told nothing.
      await settle();
      expect(sent.slice(mails)).toEqual([]);
      expect(pushes.length).toBe(pushed);

      // Why it ended is the client's to read, and nobody else's.
      const ended = await endedOf(declaring).expect(200);

      expect(ended.body).toEqual({ endedAt: expect.any(String), professionalName: 'Persona b-pro', reason: 'declared' });
      expectNothing(await endedOf(pro));
      expectNothing(await endedOf(control));
      expectNothing(await endedOf(bystander));
    });

    it('leaves the bystander’s link, and a later save with the record still there finds nothing to end', async () => {
      expect(await stored(links.bystander)).toMatchObject({ status: 'active' });

      const again = await declare(declaring, { ...A_CONDITION, medications: [{ name: MEDICATION }] }).expect(200);

      expect((again.body as Json).linkEnded).toBeNull();
    });

    it('ends a paused link too', async () => {
      const paused = await account('b-paused');
      const linkId = await link(pro, paused, 'plan', false);

      // A practice not paid for leaves its links paused (`0061`): written on the table, as `care.e2e-spec.ts` does.
      await sql()`update care_links set status = 'paused' where id = ${linkId}`;

      const saved = await declare(paused, { medications: [{ name: MEDICATION }] }).expect(200);

      expect((saved.body as Json).linkEnded).toEqual({ professionalName: 'Persona b-pro' });
      expect(await stored(linkId)).toMatchObject({ endedBy: 'declared', status: 'ended' });
    });

    it('does not end on a supplement alone', async () => {
      const saved = await declare(bystander, { supplements: [{ kind: 'protein', name: 'Proteína de alcance', proteinGPerServing: 20 }] }).expect(200);

      expect((saved.body as Json).linkEnded).toBeNull();
      expect(await stored(links.bystander)).toMatchObject({ status: 'active' });
    });

    it('clears the targets’ mark of a practitioner who set them under a badge since withdrawn', async () => {
      const former = await badgedPractitioner('b-pro-former');
      const client = await account('b-marked');

      // Targets are a profile's: onboarded, so there are targets to set.
      await completeOnboarding(app, client);
      const linkId = await link(former, client, 'full', true);

      await request(server()).patch(`/${PREFIX}/care/clients/${linkId}/targets`).set('Cookie', former.cookie).send({ kcal: 1800 }).expect(200);
      expect(await markOf(client.id)).toBe(former.id);
      expect((await withdraw(former)).status).toBe(200);
      // The withdrawal narrows; it does not end (the sweep's to do, or the declaration's).
      expect(await stored(linkId)).toMatchObject({ consentScope: 'plan', status: 'active' });

      const saved = await declare(client, A_CONDITION).expect(200);

      expect((saved.body as Json).linkEnded).toEqual({ professionalName: 'Persona b-pro-former' });
      expect(await stored(linkId)).toMatchObject({ endedBy: 'declared', status: 'ended' });
      expect(await markOf(client.id)).toBeNull();
    });

    it('changes nothing under a badged practitioner', async () => {
      const badged = await badgedPractitioner('b-pro-b');
      const client = await account('b-badged-client');
      const linkId = await link(badged, client, 'full', true);
      const before = await stored(linkId);
      const saved = await declare(client, A_CONDITION).expect(200);

      expect((saved.body as Json).linkEnded).toBeNull();
      expect(await stored(linkId)).toEqual(before);
      expectNothing(await endedOf(client));
    });
  });

  // --- (d) Narrowing, and what widens again ------------------------------------------

  describe('a badge that stops standing narrows the stored consent; only the client widens it again', () => {
    it('narrows at once on the owner’s withdrawal; a badge granted again and renewed widens nothing; the client’s re-consent does', async () => {
      const pro = await badgedPractitioner('d-pro-w');
      const client = await account('d-client-w');
      const planClient = await account('d-client-w-plan');
      const linkId = await link(pro, client, 'full', true);
      const planLink = await link(pro, planClient, 'plan', false);
      const accepted = await stored(linkId);

      expect(accepted).toMatchObject({ consentScope: 'full', narrowedAt: null, sharesHealth: true });
      expect((await withdraw(pro)).status).toBe(200);

      const narrowed = await stored(linkId);

      expect(narrowed).toMatchObject({ consentScope: 'plan', sharesHealth: false, status: 'active' });
      expect(narrowed.narrowedAt).not.toBeNull();
      // A link already `plan` with the line off is not touched, and gets no mark.
      expect(await stored(planLink)).toMatchObject({ consentScope: 'plan', narrowedAt: null });

      await grant(pro);
      expect(await stored(linkId)).toEqual(narrowed);
      expect((await confirm(pro)).status).toBe(200);
      expect(await stored(linkId)).toEqual(narrowed);
      expect((await myLink(client)).body).toMatchObject({ consentScope: 'plan', professionalVerified: true, reconsentOffered: true, scope: 'plan' });

      const widened = await reconsent(client).expect(200);

      expect(widened.body).toMatchObject({ consentScope: 'full', reconsentOffered: false, scope: 'full', sharesHealth: false });

      const after = await stored(linkId);

      expect(after).toMatchObject({
        consentedAt: accepted.consentedAt,
        consentScope: 'full',
        consentVersion: accepted.consentVersion,
        narrowedAt: narrowed.narrowedAt,
        scopeConsentVersion: CARE_CONSENT_VERSION,
        sharesHealth: false
      });
      expect(after.scopeConsentedAt).not.toBeNull();
    });

    it('a renewal under a standing badge leaves a `full` link `full`, the line on, and no mark', async () => {
      const pro = await badgedPractitioner('d-pro-r');
      const client = await account('d-client-r');
      const linkId = await link(pro, client, 'full', true);

      expect((await confirm(pro)).status).toBe(200);
      expect(await stored(linkId)).toMatchObject({ consentScope: 'full', narrowedAt: null, sharesHealth: true });
    });

    for (const route of ['confirm', 'grant', 'fail-then-confirm'] as const) {
      it(`narrows before a pass recorded while no badge stood — lapsed by the clock, no sweep, then ${route}`, async () => {
        const pro = await badgedPractitioner(`d-pro-${route}`);
        const client = await account(`d-client-${route}`);
        const linkId = await link(pro, client, 'full', true);

        await backdatePass(pro.id, 31);
        expect(await badgeState(pro)).toBe('lapsed');

        if (route === 'fail-then-confirm') {
          // A renewal application the owner refuses; then another, granted.
          await applyWithCode(pro);

          const failed = await request(server())
            .post(`/${PREFIX}/admin/professionals/${pro.id}/badge/removal`)
            .set('Cookie', owner.cookie)
            .send({ facts: 'El número no consta.', kind: 'fail', reason: 'other', source: 'own_check' });

          expect(failed.status).toBe(200);
          expect(await badgeState(pro)).not.toBe('badged');
        }

        // Up to the pass, the stored consent is still the one given under the badge: what narrows it below is the pass.
        expect(await stored(linkId)).toMatchObject({ consentScope: 'full', narrowedAt: null, sharesHealth: true });

        if (route === 'grant') {
          await grant(pro);
        } else {
          await applyWithCode(pro);
          expect((await confirm(pro)).status).toBe(200);
        }

        expect(await badgeState(pro)).toBe('badged');

        const after = await stored(linkId);

        expect(after).toMatchObject({ consentScope: 'plan', sharesHealth: false, status: 'active' });
        expect(after.narrowedAt).not.toBeNull();
        expect((await myLink(client)).body).toMatchObject({ reconsentOffered: true, scope: 'plan' });
      });
    }
  });

  // --- (g) The health consent's version ----------------------------------------------

  describe('the health consent names the rule', () => {
    it('reads a consent stored under 1.1.0 as not current, and a save at 1.2.0 as current', async () => {
      expect(HEALTH_CONSENT_VERSION).toBe('1.2.0');

      const client = await account('g-client');

      await declare(client, SUPPLEMENT_ONLY).expect(200);
      await sql()`update health_data_consents set version = '1.1.0' where user_id = ${client.id}`;
      expect((await request(server()).get(`/${PREFIX}/health-data`).set('Cookie', client.cookie).expect(200)).body).toMatchObject({
        consentIsCurrent: false
      });

      const stale = await request(server())
        .put(`/${PREFIX}/health-data`)
        .set('Cookie', client.cookie)
        .send({ conditions: [], consentVersion: '1.1.0', medications: [], supplements: [] });

      expect(stale.status).toBe(422);

      const saved = await declare(client, SUPPLEMENT_ONLY).expect(200);

      expect(saved.body).toMatchObject({ consentIsCurrent: true, linkEnded: null });
    });
  });

  // --- (c) The daily sweep -----------------------------------------------------------

  describe('the daily sweep in /cron/reminders', () => {
    let lapsing: Account;
    let withdrawn: Account;
    /** Lapses the same way and has no client: what the practitioner is sent anyway. */
    let controlPro: Account;
    const clients: Record<'condition' | 'medicationPaused' | 'none' | 'withdrawnNone' | 'withdrawnRecord', Account> = {} as never;
    const links: Record<keyof typeof clients, string> = {} as never;
    let mailsBefore = 0;

    beforeAll(async () => {
      lapsing = await badgedPractitioner('c-pro-l');
      withdrawn = await badgedPractitioner('c-pro-w');
      controlPro = await badgedPractitioner('c-pro-control');

      for (const label of Object.keys({
        condition: 0,
        medicationPaused: 0,
        none: 0,
        withdrawnNone: 0,
        withdrawnRecord: 0
      }) as (keyof typeof clients)[]) {
        clients[label] = await account(`c-${label.toLowerCase()}`);
      }

      await completeOnboarding(app, clients.condition);
      await declare(clients.condition, A_CONDITION).expect(200);
      await declare(clients.medicationPaused, { medications: [{ name: MEDICATION }] }).expect(200);
      await declare(clients.none, SUPPLEMENT_ONLY).expect(200);
      await declare(clients.withdrawnRecord, A_CONDITION).expect(200);

      links.condition = await link(lapsing, clients.condition, 'full', true);
      links.medicationPaused = await link(lapsing, clients.medicationPaused, 'full', true);
      links.none = await link(lapsing, clients.none, 'full', true);
      links.withdrawnRecord = await link(withdrawn, clients.withdrawnRecord, 'full', true);
      links.withdrawnNone = await link(withdrawn, clients.withdrawnNone, 'full', false);
      await sql()`update care_links set status = 'paused' where id = ${links.medicationPaused}`;

      await request(server())
        .patch(`/${PREFIX}/care/clients/${links.condition}/targets`)
        .set('Cookie', lapsing.cookie)
        .send({ kcal: 1750 })
        .expect(200);
      expect(await markOf(clients.condition.id)).toBe(lapsing.id);

      await backdatePass(lapsing.id, 31);
      await backdatePass(controlPro.id, 31);
      expect((await withdraw(withdrawn)).status).toBe(200);
    }, 180_000);

    it('ends the links over a record as `badge_lost`, mails their clients alone, and narrows the others', async () => {
      // Nothing has run yet: the clock lapse left every stored consent as it was given.
      for (const key of ['condition', 'medicationPaused', 'none'] as const) {
        expect(await stored(links[key])).toMatchObject({ consentScope: 'full', narrowedAt: null, sharesHealth: true });
      }

      // The withdrawal narrowed its links at once, and ended none.
      expect(await stored(links.withdrawnRecord)).toMatchObject({ consentScope: 'plan', status: 'active' });

      const narrowedAtWithdrawal = await stored(links.withdrawnNone);

      await settle();
      mailsBefore = sent.length;
      await cron().expect(200);
      await settle();

      expect(await stored(links.condition)).toMatchObject({ endedBy: 'badge_lost', status: 'ended' });
      expect(await stored(links.medicationPaused)).toMatchObject({ endedBy: 'badge_lost', status: 'ended' });
      expect(await stored(links.withdrawnRecord)).toMatchObject({ endedBy: 'badge_lost', status: 'ended' });
      expect(await markOf(clients.condition.id)).toBeNull();

      const narrowed = await stored(links.none);

      expect(narrowed).toMatchObject({ consentScope: 'plan', endedBy: null, sharesHealth: false, status: 'active' });
      expect(narrowed.narrowedAt).not.toBeNull();
      // Already narrowed by the withdrawal: the sweep finds nothing more to do there.
      expect(await stored(links.withdrawnNone)).toEqual(narrowedAtWithdrawal);

      const mine = sent.slice(mailsBefore);
      const ruleMails = mine.filter(mail => mail.kind === RULE_MAIL);

      expect(ruleMails.map(mail => mail.to).sort()).toEqual(
        [clients.condition, clients.medicationPaused, clients.withdrawnRecord].map(client => client.email.toLowerCase()).sort()
      );

      for (const mail of ruleMails) {
        const whole = `${mail.subject}\n${mail.text}\n${mail.html}`.toLowerCase();

        expect(whole).toContain('persona c-pro-');

        for (const word of NOT_IN_THE_MAIL) {
          expect({ found: whole.includes(word), to: mail.to, word }).toEqual({ found: false, to: mail.to, word });
        }
      }

      // Nobody else mailed under the rule; a practitioner who lost the badge is sent what one with no client is.
      for (const who of [clients.none, clients.withdrawnNone]) {
        expect(mine.filter(mail => mail.to === who.email.toLowerCase())).toEqual([]);
      }

      const kindsTo = (who: Account) => mine.filter(mail => mail.to === who.email.toLowerCase()).map(mail => mail.kind);

      process.stdout.write(`[illness-rule sweep] mailed to the lapsed practitioner: ${JSON.stringify(kindsTo(lapsing))}\n`);
      expect(kindsTo(lapsing)).toEqual(kindsTo(controlPro));
      expect(kindsTo(withdrawn)).toEqual([]);
    });

    it('tells the client why, on their profile; nobody else', async () => {
      expect((await endedOf(clients.condition).expect(200)).body).toEqual({
        endedAt: expect.any(String),
        professionalName: 'Persona c-pro-l',
        reason: 'badge_lost'
      });
      expect((await endedOf(clients.withdrawnRecord).expect(200)).body).toMatchObject({ professionalName: 'Persona c-pro-w', reason: 'badge_lost' });

      for (const who of [clients.none, lapsing, withdrawn]) {
        expectNothing(await endedOf(who));
      }

      // The client with nothing on record keeps the link, narrowed, with nothing on offer while no badge stands.
      expect((await myLink(clients.none).expect(200)).body).toMatchObject({
        consentScope: 'plan',
        professionalVerified: false,
        reconsentOffered: false,
        scope: 'plan',
        sharesHealth: false,
        status: 'active'
      });
    });

    it('does nothing on a second run', async () => {
      const before = await Promise.all(Object.values(links).map(stored));
      const mails = sent.length;

      await sweep();
      await settle();

      expect(await Promise.all(Object.values(links).map(stored))).toEqual(before);
      expect(sent.slice(mails).filter(mail => mail.kind === RULE_MAIL)).toEqual([]);
    });
  });

  // --- (f) Concurrency ----------------------------------------------------------------

  describe('concurrency, on real Postgres', () => {
    const ROUNDS = 15;

    it('an acceptance and a declaration sent together never leave an open link to an un-badged practitioner over a record', async () => {
      const pro = await unbadgedPractitioner('f-pro-decl');
      const client = await account('f-client-decl');
      const outcomes: string[] = [];

      for (let round = 0; round < ROUNDS; round++) {
        await declare(client, NOTHING).expect(200);

        const token = await invite(pro, client);
        const [accepted, saved] = await Promise.all([accept(client, token, answer('plan', false)), declare(client, A_CONDITION)]);

        expect(saved.status).toBe(200);
        expect([200, 409]).toContain(accepted.status);
        expect(await openLinksOf(client.id)).toEqual([]);
        outcomes.push(accepted.status === 200 ? `accepted, then ended: ${String((saved.body as Json).linkEnded !== null)}` : 'refused');
      }

      // Which won is the scheduler's; the outcome above held either way.
      process.stdout.write(`[illness-rule race] acceptance vs declaration: ${JSON.stringify(tally(outcomes))}\n`);
    }, 180_000);

    it('a withdrawal sent with an acceptance never leaves a `full` link without a standing badge', async () => {
      const pro = await badgedPractitioner('f-pro-wa');
      const client = await account('f-client-wa');
      const outcomes: string[] = [];
      const violations: number[] = [];

      for (let round = 0; round < ROUNDS; round++) {
        if ((await badgeState(pro)) !== 'badged') {
          await grant(pro);
        }

        const token = await invite(pro, client);
        const [accepted, removed] = await Promise.all([accept(client, token, answer('full', true)), withdraw(pro)]);

        expect(removed.status).toBe(200);
        expect(accepted.status).toBe(200);

        const [open] = await openLinksOf(client.id);

        outcomes.push(`answered ${String((accepted.body as Json).consentScope)}, stored ${String(open?.consentScope)}`);

        if (open?.consentScope !== 'plan') {
          violations.push(round);
        }

        if (open) {
          await endLink(client, open.id);
        }
      }

      process.stdout.write(`[illness-rule race] withdrawal vs acceptance: ${JSON.stringify(tally(outcomes))}\n`);
      // Every round: the badge withdrawn, so no link of this practitioner may be stored `full`.
      expect({ rounds: ROUNDS, violations }).toEqual({ rounds: ROUNDS, violations: [] });
    }, 180_000);

    it('a withdrawal sent with a re-consent never leaves a `full` link without a standing badge', async () => {
      const pro = await badgedPractitioner('f-pro-wr');
      const client = await account('f-client-wr');
      const linkId = await link(pro, client, 'plan', false);
      const outcomes: string[] = [];
      const violations: number[] = [];

      for (let round = 0; round < ROUNDS; round++) {
        if ((await badgeState(pro)) !== 'badged') {
          await grant(pro);
        }

        expect(await stored(linkId)).toMatchObject({ consentScope: 'plan' });

        const [widened, removed] = await Promise.all([reconsent(client), withdraw(pro)]);

        expect(removed.status).toBe(200);
        expect([200, 404]).toContain(widened.status);

        const after = await stored(linkId);

        outcomes.push(`re-consent ${String(widened.status)}, stored ${after.consentScope}`);
        expect(after.status).toBe('active');

        if (after.consentScope !== 'plan') {
          violations.push(round);
        }
      }

      process.stdout.write(`[illness-rule race] withdrawal vs re-consent: ${JSON.stringify(tally(outcomes))}\n`);
      expect({ rounds: ROUNDS, violations }).toEqual({ rounds: ROUNDS, violations: [] });
    }, 180_000);

    /**
     * The window the rounds above can only stumble on, held open: the owner's
     * withdrawal is stopped inside its own transaction — its `withdrawn` row
     * written, not committed — by a lock this suite holds on another of the
     * practitioner's `full` links (any transaction holding that row does the
     * same: the client's own `PATCH /care/links/me` holds it `FOR UPDATE`).
     * An acceptance, and a re-consent, are sent inside that window and given two
     * seconds: a contender that finishes in it has raced the withdrawal; one
     * that waits for the withdrawal (as a fix that serialises them would make
     * it) finishes after the release. Either way, once both have committed, no
     * link of that practitioner may be stored `full`.
     */
    for (const contender of ['acceptance', 're-consent'] as const) {
      it(`${contender === 'acceptance' ? 'an' : 'a'} ${contender} completed while a withdrawal waits inside its transaction does not leave a \`full\` link once it commits`, async () => {
        const pro = await badgedPractitioner(`f-pro-held-${contender === 'acceptance' ? 'a' : 'r'}`);
        const holder = await account(`f-holder-${contender === 'acceptance' ? 'a' : 'r'}`);
        const client = await account(`f-client-held-${contender === 'acceptance' ? 'a' : 'r'}`);
        const held = await link(pro, holder, 'full', true);
        const planLink = contender === 're-consent' ? await link(pro, client, 'plan', false) : null;
        const token = contender === 'acceptance' ? await invite(pro, client) : null;
        let release: () => void = () => undefined;
        const released = new Promise<void>(resolve => {
          release = resolve;
        });
        let locked: () => void = () => undefined;
        const isLocked = new Promise<void>(resolve => {
          locked = resolve;
        });
        const holding = sql().begin(async tx => {
          await tx`select id from care_links where id = ${held} for update`;
          locked();
          await released;
        });

        try {
          await isLocked;

          const removal = withdraw(pro).then(response => response);

          // Wait until the withdrawal is blocked on the held row, its own row written.
          const deadline = Date.now() + 10_000;
          let waiting = 0;

          while (Date.now() < deadline && waiting === 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
            waiting =
              (
                await sql()<{ n: number }>`
                  select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and query ilike ${'%update "care_links"%'}`
              )[0]?.n ?? 0;
          }

          expect(waiting).toBe(1);

          const contending = (contender === 'acceptance' ? accept(client, token as string, answer('full', true)) : reconsent(client)).then(
            response => response
          );
          const inWindow = await Promise.race([
            contending.then(() => true),
            new Promise<boolean>(resolve => setTimeout(() => resolve(false), 2_000))
          ]);

          release();

          const [removed, contended] = await Promise.all([removal, contending]);

          expect(removed.status).toBe(200);
          expect(await badgeState(pro)).toBe('withdrawn');
          // What the contender was answered, and when, for the report; the stored rows are the assertion.
          process.stdout.write(
            `[illness-rule held] ${contender} ${inWindow ? 'finished inside the window' : 'waited for the withdrawal'}: ${String(contended.status)} ${JSON.stringify((contended.body as Json).consentScope)}\n`
          );
          expect(await stored(held)).toMatchObject({ consentScope: 'plan' });

          const open = await sql()<{ client: string; consentScope: string }>`
            select client_id as client, consent_scope::text as "consentScope" from care_links
            where professional_id = ${pro.id} and status in ('active', 'paused')`;

          expect(open.filter(row => row.consentScope !== 'plan')).toEqual([]);

          if (planLink) {
            expect(await stored(planLink)).toMatchObject({ status: 'active' });
          }
        } finally {
          release();
          await holding;
        }
      }, 120_000);
    }

    it('the sweep sent with an owner’s withdrawal: at most a deadlock, and the end state right after one retry', async () => {
      const pro = await badgedPractitioner('f-pro-sw');
      const recorded = await account('f-client-sw-r');
      const plain = await account('f-client-sw-n');
      const outcomes: string[] = [];

      await declare(recorded, A_CONDITION).expect(200);

      const plainLink = await link(pro, plain, 'full', true);

      for (let round = 0; round < ROUNDS; round++) {
        if ((await badgeState(pro)) !== 'badged') {
          await grant(pro);
        }

        const recordedLink = await link(pro, recorded, 'full', true);

        if ((await stored(plainLink)).consentScope !== 'full') {
          await reconsent(plain).expect(200);
        }

        // Spread over the rounds, so the sweep starts at a different point of the withdrawal each time.
        const jitter = new Promise(resolve => setTimeout(resolve, (round % 8) * 4));
        const [swept, removed] = await Promise.all([
          jitter
            .then(async () => CareController.sweepBadgeLoss())
            .then(
              result => ({ ended: result.ended.some(row => row.clientId === recorded.id), error: null }),
              (error: unknown) => ({ ended: false, error })
            ),
          withdraw(pro)
        ]);
        const failures = [
          swept.error ? describeError(swept.error) : null,
          removed.status === 200 ? null : `withdrawal ${String(removed.status)}`
        ].filter((failure): failure is string => failure !== null);

        // One of the two may lose a deadlock; nothing else may fail.
        expect(failures.length).toBeLessThanOrEqual(1);

        for (const failure of failures) {
          expect(failure).toMatch(/deadlock|40P01|withdrawal 500/i);
        }

        if (removed.status !== 200) {
          expect((await withdraw(pro)).status).toBe(200);
        }

        outcomes.push(failures.length > 0 ? `retried: ${failures.join(', ')}` : swept.ended ? 'sweep ended it at once' : 'sweep ran first');

        // The retry: the next sweep.
        await CareController.sweepBadgeLoss();

        expect(await stored(recordedLink)).toMatchObject({ endedBy: 'badge_lost', status: 'ended' });
        expect(await stored(plainLink)).toMatchObject({ consentScope: 'plan', sharesHealth: false, status: 'active' });
      }

      process.stdout.write(`[illness-rule race] sweep vs withdrawal: ${JSON.stringify(tally(outcomes))}\n`);
    }, 240_000);

    /**
     * The withdrawal takes the badge's lock and then the practitioner's link
     * rows; turning the health line off, a declaration and the sweep take rows
     * and no badge lock. All four at once, fifteen times: no deadlock but the
     * sweep's (tolerated, as above), every route answers, and nothing is stored
     * `full` afterwards. A withdrawal racing a declaration may leave the
     * declaring client's link open, `plan`, over the record — accepted by the
     * lead: the next sweep ends it (`badge_lost`), and that is what is asserted.
     */
    it('a withdrawal, a health line turned off, a declaration and the sweep at once: no deadlock but the sweep’s, nothing `full`, and the next sweep ends what the declaration did not', async () => {
      const pro = await badgedPractitioner('f-pro-mix');
      const sharing = await account('f-client-mix-s');
      const declaring = await account('f-client-mix-d');
      const sharingLink = await link(pro, sharing, 'full', true);
      const outcomes: string[] = [];

      for (let round = 0; round < ROUNDS; round++) {
        if ((await badgeState(pro)) !== 'badged') {
          await grant(pro);
        }

        if ((await stored(sharingLink)).consentScope !== 'full') {
          await reconsent(sharing).expect(200);
        }

        await setSharesHealth(sharing, true).expect(200);
        await declare(declaring, NOTHING).expect(200);

        const declaringLink = await link(pro, declaring, 'full', true);
        const jitter = (round % 5) * 3;
        const [removed, off, saved, swept] = await Promise.all([
          withdraw(pro),
          setSharesHealth(sharing, false),
          new Promise(resolve => setTimeout(resolve, jitter)).then(async () => declare(declaring, A_CONDITION)),
          new Promise(resolve => setTimeout(resolve, 2 * jitter)).then(async () =>
            CareController.sweepBadgeLoss().then(
              () => null,
              (error: unknown) => error
            )
          )
        ]);

        expect({ off: off.status, removed: removed.status, saved: saved.status }).toEqual({ off: 200, removed: 200, saved: 200 });

        if (swept !== null) {
          expect(describeError(swept)).toMatch(/deadlock|40P01/i);
        }

        // Straight after: nothing of this practitioner stored `full`, the line off.
        const open = await sql()<{ consentScope: string; sharesHealth: boolean }>`
          select consent_scope::text as "consentScope", shares_health as "sharesHealth" from care_links
          where professional_id = ${pro.id} and status in ('active', 'paused')`;

        expect(open.filter(row => row.consentScope !== 'plan' || row.sharesHealth)).toEqual([]);

        const declaredNow = await stored(declaringLink);

        outcomes.push(
          `${swept === null ? '' : 'sweep deadlocked, '}declaring link ${declaredNow.status === 'ended' ? `ended ${String(declaredNow.endedBy)}` : `left ${declaredNow.consentScope}`}`
        );

        // The residual the lead accepted: an open `plan` link over a record. The next sweep ends it.
        await CareController.sweepBadgeLoss();

        const after = await stored(declaringLink);

        expect(after.status).toBe('ended');
        expect(['declared', 'badge_lost']).toContain(after.endedBy);

        if (declaredNow.status !== 'ended') {
          expect(after.endedBy).toBe('badge_lost');
        }

        expect(await stored(sharingLink)).toMatchObject({ consentScope: 'plan', sharesHealth: false, status: 'active' });
      }

      process.stdout.write(`[illness-rule race] withdrawal + line off + declaration + sweep: ${JSON.stringify(tally(outcomes))}\n`);
    }, 300_000);
  });
});

function tally(outcomes: readonly string[]): Record<string, number> {
  return outcomes.reduce<Record<string, number>>((counts, outcome) => ({ ...counts, [outcome]: (counts[outcome] ?? 0) + 1 }), {});
}

function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;

  while (current instanceof Error) {
    parts.push(`${current.name}: ${current.message} ${String((current as { code?: unknown }).code ?? '')}`);
    current = (current as { cause?: unknown }).cause;
  }

  return parts.join(' <- ') || String(error);
}

/** A route that answers null: Nest sends it as an empty 200. */
function expectNothing(response: Response): void {
  expect({ status: response.status, text: response.text === 'null' ? '' : response.text }).toEqual({ status: 200, text: '' });
}
