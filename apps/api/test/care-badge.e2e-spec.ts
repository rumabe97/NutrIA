import { createHash, randomBytes } from 'node:crypto';
import { inspect } from 'node:util';

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import request from 'supertest';

import { ProfessionalController } from 'core/controllers/Professional';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';
import { database } from 'database';

import { BadgeSweepService } from '../src/modules/owner-alerts/index.js';
import { EmailService } from '../src/modules/email/services/Email.service.js';
import { ENV, validateEnv } from '../src/config/index.js';
import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import {
  acceptAgreement,
  createApp,
  deleteAccountByEmail,
  deleteAccounts,
  earnBadge,
  enableTotp,
  httpServer,
  openOwnPractice,
  PREFIX,
  register,
  ScriptedAiClient
} from './harness.js';

import type { Account } from './harness.js';
import type { BadgeCodeIssuedView, BadgeQueueView, BadgeRecordView, BadgeView } from 'core/controllers/Professional';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * The badge (project 025 phase 3, `0111` §§ 2–3, PRD 025 criteria 2–5, 14–16).
 *
 * A practitioner applies with a register and a number; the owner sends a code
 * through a channel the public register lists (letter, phone, the register's
 * e-mail); the practitioner enters it; the owner confirms; the badge stands for
 * twelve months and thirty days of grace, and is withdrawn, refused or lapsed
 * with a reason. Everything a refusal can say is the guard's own 404, byte for
 * byte, and no practitioner body can name anybody but the session.
 *
 * **One application, with mail.** SMTP and `OWNER_EMAIL` are set to addresses
 * that go nowhere and the real `EmailService`'s transporter is replaced by an
 * outbox, as `owner-alerts.e2e-spec.ts` does: the e-mail channel's code, the
 * statements of reasons, the re-check reminder and the owner's alert are all
 * read from what would have been sent.
 *
 * **No route takes a clock.** Expiry, a due re-check and a lapse are reached by
 * backdating this suite's own rows — `checked_at` together with `due_at`, so the
 * `lapsed` row the sweep writes (dated `due_at + 30 days`) is newer than the
 * pass it ends. The sweep is driven through `BadgeSweepService.run()` on the
 * real clock, never a future `now`: `lapseOverdue`, `dueWithin` and `dueCounts`
 * read the whole table, and this database holds other people's passes. It is
 * not driven through `/cron/reminders`, which also runs the digest, the
 * reminders and the nightly rewrite; that the cron calls the service is
 * `Cron.controller.spec.ts`'s.
 *
 * **A practitioner with no badge** opened their own practice
 * (`POST /care/practice`, project 025 phase 6) and has no check. **A badged one**
 * earned it by the real four steps on top (`earnBadge`: apply, a code by phone,
 * enter it, the owner confirms) — the owner's grant, which wrote a bare `pass`,
 * is retired. So a badged fixture also carries its `applied` row and a used
 * code, older than the `pass`.
 *
 * The reminder watermark (`badge-reminders`) and the owner's `badges-due` claim
 * are rows of `analytics_events`. Those already there are shelved sixty days
 * back for the run and put back; every row the run makes is removed.
 *
 * Requires a real database — see ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

type Sent = { readonly html: string; readonly subject: string; readonly text: string; readonly to: string };
type Shelved = { readonly id: string; readonly createdAt: string };
type CheckRow = { channel: string | null; dueAt: string | null; kind: string; number: string | null; reason: string | null; register: string | null };

const OWNER = `badge-owner-alert-${randomBytes(3).toString('hex')}@example.invalid`;
const SHELVED_KINDS = ['badge-reminders', 'badges-due'];
const MAIL_KINDS = ['professional-badge-code', 'professional-badge-removed', 'professional-badge-lapsed', 'professional-badge-due', 'owner-alert'];
/** The guard's 404 and every refusal of the badge's: one body, one status. */
const NOT_FOUND_TEXT = JSON.stringify({ code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 });
const CODE_SHAPE = /\b[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}\b/;
const REGISTER = 'Colegio Oficial de Dietistas-Nutricionistas de la Comunidad de Madrid';

describe('the badge (project 025 phase 3)', () => {
  const stamp = Date.now();
  const made: string[] = [];
  const outbox: Sent[] = [];
  /** Every response body this suite received, to look for a code hash in. */
  const answers: string[] = [];
  /** Every log line and console line the app wrote while the suite ran. */
  const lines: string[] = [];
  /** Plain codes the console handed back or a mail carried. */
  const codes: string[] = [];
  const shelved: Shelved[] = [];
  /** Watermarks this suite wrote itself with an older date, so the cleanup by date would not find them. */
  const planted: string[] = [];
  const spies: { mockRestore(): void }[] = [];
  let app: INestApplication;
  let owner: Account;
  let ordinary: Account;
  let started = '';
  let switchWas = false;

  const server = () => httpServer(app);

  /** Every call goes through here, so every answer can be searched afterwards. */
  async function call(method: 'get' | 'post', path: string, cookie: string | null, body?: unknown): Promise<Response> {
    let req = request(server())[method](`/${PREFIX}${path}`);

    if (cookie !== null) {
      req = req.set('Cookie', cookie);
    }

    const response = body === undefined ? await req : await req.send(body as object);

    answers.push(response.text);

    return response;
  }

  const badgeOf = async (who: Account): Promise<BadgeView> => {
    const response = await call('get', '/care/practice/badge', who.cookie);

    expect(response.status).toBe(200);

    return response.body as BadgeView;
  };

  const recordOf = async (who: Account): Promise<BadgeRecordView> => {
    const response = await call('get', `/admin/professionals/${who.id}/badge`, owner.cookie);

    expect(response.status).toBe(200);

    return response.body as BadgeRecordView;
  };

  const apply = (who: Account, number: string, register = REGISTER) => call('post', '/care/practice/badge', who.cookie, { number, register });

  const issue = (who: Account, body: Record<string, unknown>) => call('post', `/admin/professionals/${who.id}/badge/code`, owner.cookie, body);

  async function issuePlain(who: Account, channel: 'phone' | 'post'): Promise<string> {
    const issued = await issue(who, { channel });

    expect(issued.status).toBe(201);

    const code = (issued.body as BadgeCodeIssuedView).code ?? '';

    expect(code).toMatch(CODE_SHAPE);
    codes.push(code);

    return code;
  }

  const enter = (who: Account, body: unknown) => call('post', '/care/practice/badge/code', who.cookie, body);
  const confirm = (who: Account) => call('post', `/admin/professionals/${who.id}/badge/confirm`, owner.cookie, {});
  const removal = (who: Account, body: Record<string, unknown>) => call('post', `/admin/professionals/${who.id}/badge/removal`, owner.cookie, body);

  async function checksOf(userId: string): Promise<readonly CheckRow[]> {
    return sql()<CheckRow>`
      select kind::text as kind, reason, channel::text as channel, number, register, due_at::text as "dueAt"
      from professional_badge_checks where user_id = ${userId} order by checked_at desc, created_at desc`;
  }

  async function codeRow(userId: string): Promise<{ attempts: number; live: boolean; used: boolean } | undefined> {
    const [row] = await sql()<{ attempts: number; live: boolean; used: boolean }>`
      select attempts, used_at is not null as used, (used_at is null and expires_at > now()) as live
      from professional_badge_codes where user_id = ${userId} order by created_at desc limit 1`;

    return row;
  }

  /** May practise, no badge: the account opened its own practice and nothing else (see the file's comment). */
  async function practitioner(label: string, name?: string): Promise<Account> {
    const who = await register(app, `badge-e2e-${label}-${String(stamp)}@e2e.invalid`, name);

    made.push(who.cookie);
    await openOwnPractice(app, who);

    return who;
  }

  /** Badged by the real path (`earnBadge`), on a practice of its own — what the retired grant's `pass` stood for. */
  async function granted(label: string): Promise<Account> {
    const who = await register(app, `badge-e2e-${label}-${String(stamp)}@e2e.invalid`);

    made.push(who.cookie);
    await openOwnPractice(app, who);
    await earnBadge(app, who, owner, `28/${String(stamp).slice(-5)}`);

    return who;
  }

  /**
   * Moves this account's latest `pass` back: checked `days + 365` ago, due `days` ago — and the `applied` rows the
   * real path wrote before it, a day further back, so the application stays older than the pass it led to (otherwise
   * it reads as a new application waiting).
   */
  async function backdatePass(userId: string, dueDaysAgo: number): Promise<void> {
    await sql()`
      update professional_badge_checks
      set checked_at = now() - make_interval(days => ${dueDaysAgo + 366}), created_at = now() - make_interval(days => ${dueDaysAgo + 366})
      where user_id = ${userId} and kind = 'applied'`;

    const moved = await sql()<{ id: string }>`
      update professional_badge_checks
      set checked_at = now() - make_interval(days => ${dueDaysAgo + 365}), due_at = now() - make_interval(days => ${dueDaysAgo}),
        created_at = now() - make_interval(days => ${dueDaysAgo + 365})
      where id = (select id from professional_badge_checks where user_id = ${userId} and kind = 'pass' order by checked_at desc limit 1)
      returning id::text as id`;

    expect(moved).toHaveLength(1);
  }

  async function until(check: () => boolean | Promise<boolean>, what: string): Promise<void> {
    const deadline = Date.now() + 15_000;

    while (Date.now() < deadline) {
      if (await check()) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    throw new Error(`Not within 15 s: ${what}`);
  }

  const mailsTo = (who: Account | string) => outbox.filter(mail => mail.to === (typeof who === 'string' ? who : who.email));

  /**
   * The badge's mails to one account. With SMTP set for the whole application, signing up sends the address's
   * confirmation through the same outbox; it is not the badge's.
   */
  const NOT_THE_BADGE = ['Confirma tu correo en NutrIA'];
  const badgeMailsTo = (who: Account) => mailsTo(who).filter(mail => !NOT_THE_BADGE.includes(mail.subject));

  /** The owner's `badges-due` claim this run made, released, so each sweep below may send its alert afresh. */
  const releaseOwnerAlert = () =>
    sql()`delete from analytics_events where event = 'owner_alerted' and properties ->> 'kind' = 'badges-due' and created_at >= ${started}`;

  const sweep = () => app.get(BadgeSweepService, { strict: false }).run();

  const setSwitch = (enabled: boolean) => SettingsController.setFlag('professional', enabled, UNAUDITED);

  beforeAll(async () => {
    for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'OWNER_EMAIL']) {
      expect(process.env[name] ?? '').toBe('');
    }

    const [clock] = await sql()<{ now: string }>`select now()::text as now`;

    started = clock?.now ?? '';

    const env = validateEnv({
      ...process.env,
      EMAIL_FROM: 'nutria@e2e.invalid',
      OWNER_EMAIL: OWNER,
      SMTP_HOST: 'smtp.e2e.invalid',
      SMTP_PASS: 'not-a-password',
      SMTP_USER: 'not-a-user'
    });

    app = await createApp(new ScriptedAiClient([]), builder => builder.overrideProvider(ENV).useValue(env));

    const mailer = app.get(EmailService, { strict: false }) as unknown as { transporter: unknown };

    mailer.transporter = {
      sendMail: (message: Sent): Promise<void> => {
        outbox.push(message);

        return Promise.resolve();
      }
    };

    const keep = (...parts: unknown[]) => {
      lines.push(parts.map(part => (typeof part === 'string' ? part : inspect(part))).join(' '));
    };

    spies.push(
      ...(['debug', 'error', 'log', 'verbose', 'warn'] as const).map(level => jest.spyOn(Logger.prototype, level).mockImplementation(keep)),
      ...(['debug', 'error', 'info', 'log', 'warn'] as const).map(level => jest.spyOn(console, level).mockImplementation(keep))
    );

    switchWas = await ProfessionalController.isOpen();
    await setSwitch(true);

    const rows = await sql()<Shelved>`
      select id::text as id, created_at::text as "createdAt" from analytics_events
      where event = 'owner_alerted' and properties ->> 'kind' = any(${SHELVED_KINDS}) and created_at > now() - interval '40 days'`;

    shelved.push(...rows);
    await sql()`update analytics_events set created_at = created_at - interval '60 days' where id::text = any(${rows.map(row => row.id)})`;

    owner = await register(app, `badge-e2e-owner-${String(stamp)}@e2e.invalid`);
    made.push(owner.cookie);
    await UserController.grantAdmin(owner.email);
    owner = await enableTotp(app, owner);
    made.push(owner.cookie);
    ordinary = await register(app, `badge-e2e-ordinary-${String(stamp)}@e2e.invalid`);
    made.push(ordinary.cookie);
  }, 180_000);

  afterAll(async () => {
    for (const spy of spies) {
      spy.mockRestore();
    }

    await setSwitch(switchWas);
    await deleteAccounts(app, made);

    const stragglers = await sql()<{ email: string }>`select email from "user" where email like ${`badge-e2e-%-${String(stamp)}@e2e.invalid`}`;

    for (const { email } of stragglers) {
      await deleteAccountByEmail(app, email);
    }

    await sql()`delete from analytics_events where event = 'owner_alerted' and properties ->> 'kind' = any(${SHELVED_KINDS}) and created_at >= ${started}`;
    await sql()`delete from analytics_events where id::text = any(${planted})`;
    await sql()`delete from analytics_events where event = 'mail_sent' and properties ->> 'kind' = any(${MAIL_KINDS}) and created_at >= ${started}`;

    for (const row of shelved) {
      await sql()`update analytics_events set created_at = ${row.createdAt} where id::text = ${row.id}`;
    }

    const [left] = await sql()<{ accounts: number; checks: number; codes: number; mails: number; marks: number }>`
      select (select count(*)::int from "user" where email like ${`badge-e2e-%-${String(stamp)}@e2e.invalid`}) as accounts,
             (select count(*)::int from professional_badge_checks c join "user" u on u.id = c.user_id where u.email like ${`badge-e2e-%-${String(stamp)}@e2e.invalid`}) as checks,
             (select count(*)::int from professional_badge_codes c join "user" u on u.id = c.user_id where u.email like ${`badge-e2e-%-${String(stamp)}@e2e.invalid`}) as codes,
             (select count(*)::int from analytics_events where event = 'owner_alerted' and properties ->> 'kind' = any(${SHELVED_KINDS}) and created_at >= ${started}) as marks,
             (select count(*)::int from analytics_events where event = 'mail_sent' and properties ->> 'kind' = any(${MAIL_KINDS}) and created_at >= ${started}) as mails`;

    expect(left).toEqual({ accounts: 0, checks: 0, codes: 0, mails: 0, marks: 0 });

    await app?.close();
  }, 180_000);

  describe('from application to badge, by each of the three channels', () => {
    for (const channel of ['post', 'phone', 'register_email'] as const) {
      it(`applies, is sent a code by ${channel}, enters it, and is badged when the owner confirms`, async () => {
        const name = `Zorbla Quintanar ${channel.replace('_', ' ')}`;
        const who = await practitioner(`flow-${channel}`, name);
        const number = `28/${String(stamp).slice(-4)}${String(channel.length)}`;
        const ownRegister = `Colegio Inventado Qxjv ${channel}`;

        expect(await badgeOf(who)).toMatchObject({ number: null, register: null, state: 'none' });

        const applied = await apply(who, number, ownRegister);

        expect(applied.status).toBe(201);
        // The declared number is not shown back, even to its author, until checked (PRD 025 criterion 5).
        expect(applied.body).toMatchObject({ number: null, register: ownRegister, state: 'applied' });

        // The owner's list carries the application with what to look up.
        const queue = (await call('get', '/admin/professionals/badges', owner.cookie)).body as BadgeQueueView;

        expect(queue.applications.find(row => row.userId === who.id)).toMatchObject({
          application: { number, register: ownRegister },
          state: 'applied'
        });

        let code: string;

        if (channel === 'register_email') {
          const to = `registro-${channel}-${String(stamp)}@e2e.invalid`;
          const issued = await issue(who, { channel, email: to, register: 'CODINMA', registerName: 'Ana Registrada Pérez' });

          expect(issued.status).toBe(201);
          // By e-mail the code never comes back to the console.
          expect(issued.body).toMatchObject({ channel, code: null, mailed: true });

          const [mail, ...more] = mailsTo(to);

          expect(more).toHaveLength(0);
          code = CODE_SHAPE.exec(mail?.text ?? '')?.[0] ?? '';
          expect(code).toMatch(CODE_SHAPE);
          codes.push(code);
          // The college and the name are the owner's, read on the register; nothing the applicant typed but the
          // number (pattern-bound) reaches a stranger's inbox — not their register, not their account's name.
          expect(mail?.text).toContain('CODINMA');
          expect(mail?.text).toContain('Ana Registrada Pérez');

          for (const typed of ['Qxjv', 'Zorbla', who.email]) {
            expect({ html: mail?.html.includes(typed), subject: mail?.subject.includes(typed), text: mail?.text.includes(typed), typed }).toEqual({
              html: false,
              subject: false,
              text: false,
              typed
            });
          }
        } else {
          code = await issuePlain(who, channel);
        }

        expect(await badgeOf(who)).toMatchObject({ codeEntered: false, number: null, state: 'code_sent' });
        // The console says a code is out, never which.
        expect((await recordOf(who)).code).toMatchObject({ channel, entered: false, live: true });

        // Typed as people type it: lower case, no dash.
        expect((await enter(who, { code: code.toLowerCase().replace('-', '') })).status).toBe(204);
        expect(await badgeOf(who)).toMatchObject({ codeEntered: true, number: null, state: 'code_sent' });

        const confirmed = await confirm(who);

        expect(confirmed.status).toBe(200);
        expect(confirmed.body).toMatchObject({ application: null, state: 'badged' });

        const badge = await badgeOf(who);
        const due = Date.parse(badge.dueAt ?? '');

        expect(badge).toMatchObject({ number, register: ownRegister, state: 'badged' });
        // Due in twelve months, give or take the calendar.
        expect(due - Date.now()).toBeGreaterThan(360 * 86_400_000);
        expect(due - Date.now()).toBeLessThan(370 * 86_400_000);
        expect((await checksOf(who.id))[0]).toMatchObject({ channel, kind: 'pass', number, register: ownRegister });
        // Already badged: applying again is the same 404 as anything refused (the re-check is the owner's).
        const again = await apply(who, number);

        expect([again.status, again.text]).toEqual([404, NOT_FOUND_TEXT]);
      });
    }
  });

  describe('a code that is not right answers exactly as one that does not exist', () => {
    let who: Account;
    const refusals: [string, number, string][] = [];

    const refused = async (label: string, body: unknown, as: Account = who) => {
      const response = await enter(as, body);

      refusals.push([label, response.status, response.text]);
    };

    beforeAll(async () => {
      who = await practitioner('codes');
      expect((await apply(who, `28/${String(stamp).slice(-5)}`)).status).toBe(201);
    });

    it('unknown, malformed, wrong, used, expired and capped are one 404, the guard’s own, byte for byte', async () => {
      // None issued yet: unknown, and every malformed shape.
      await refused('unknown', { code: 'ABCDE-FGHJK' });
      await refused('empty object', {});
      await refused('empty code', { code: '' });
      await refused('65 characters', { code: 'A'.repeat(65) });
      await refused('a number', { code: 12345 });
      await refused('an array', { code: ['ABCDE-FGHJK'] });

      // Wrong, then used.
      const first = await issuePlain(who, 'post');

      await refused('wrong', { code: 'ZZZZZ-ZZZZZ' });
      await refused('malformed against a live code', { code: 'A'.repeat(65) });
      expect((await enter(who, { code: first })).status).toBe(204);
      await refused('used', { code: first });

      // Expired: issued, then past its thirty days.
      const second = await issuePlain(who, 'phone');

      await sql()`update professional_badge_codes set expires_at = now() - interval '1 minute' where user_id = ${who.id} and used_at is null`;
      await refused('expired', { code: second });

      // Capped: five wrong tries kill it; the right one after them is refused.
      const third = await issuePlain(who, 'post');

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await refused(`wrong ${String(attempt + 1)} of 5`, { code: 'ZZZZZ-ZZZZZ' });
      }

      expect(await codeRow(who.id)).toMatchObject({ attempts: 5, used: false });
      await refused('capped', { code: third });

      // The guard's own 404, for an account that is no practitioner, and with no session.
      await refused('not a practitioner', { code: third }, ordinary);

      const anonymous = await call('post', '/care/practice/badge/code', null, { code: third });

      refusals.push(['no session', anonymous.status, anonymous.text]);

      expect(refusals.filter(([, status, text]) => status !== 404 || text !== NOT_FOUND_TEXT)).toEqual([]);
      expect(refusals.length).toBeGreaterThanOrEqual(17);
    });

    it('cannot pass the cap with wrong tries sent at once', async () => {
      const code = await issuePlain(who, 'post');

      for (let attempt = 0; attempt < 3; attempt += 1) {
        expect((await enter(who, { code: 'ZZZZZ-ZZZZZ' })).status).toBe(404);
      }

      const burst = await Promise.all(Array.from({ length: 6 }, () => enter(who, { code: 'YYYYY-YYYYY' })));

      expect(burst.map(response => response.status)).toEqual(Array.from({ length: 6 }, () => 404));
      expect(await codeRow(who.id)).toMatchObject({ attempts: 5, used: false });
      expect((await enter(who, { code })).status).toBe(404);
    });

    it('spends a right code once when it is entered twice at once', async () => {
      const code = await issuePlain(who, 'phone');
      const both = await Promise.all([enter(who, { code }), enter(who, { code })]);

      expect(both.map(response => response.status).sort()).toEqual([204, 404]);
      expect(both.find(response => response.status === 404)?.text).toBe(NOT_FOUND_TEXT);

      const [used] = await sql()<{
        n: number;
      }>`select count(*)::int as n from professional_badge_codes where user_id = ${who.id} and used_at is not null`;

      // One from the first test's "used" case, one from this.
      expect(used?.n).toBe(2);
    });
  });

  describe('what the owner may confirm', () => {
    it('refuses to confirm an application with no code entered — none issued, or one issued and not entered', async () => {
      const who = await practitioner('unentered');

      expect((await apply(who, `28/${String(stamp).slice(-5)}`)).status).toBe(201);

      const none = await confirm(who);

      expect([none.status, none.text]).toEqual([404, NOT_FOUND_TEXT]);

      await issuePlain(who, 'post');

      const refused = await confirm(who);

      expect([refused.status, refused.text]).toEqual([404, NOT_FOUND_TEXT]);
      expect((await checksOf(who.id)).map(check => check.kind)).toEqual(['applied']);
      expect((await badgeOf(who)).state).toBe('code_sent');
    });

    it('binds a code to its check: entered for one application, it confirms no other', async () => {
      const who = await practitioner('bound');

      expect((await apply(who, '28/11111')).status).toBe(201);

      const code = await issuePlain(who, 'post');

      expect((await enter(who, { code })).status).toBe(204);
      // A second application replaces the first: the code entered for the first proves nothing about it.
      expect((await apply(who, '28/22222')).status).toBe(201);

      const refused = await confirm(who);

      expect([refused.status, refused.text]).toEqual([404, NOT_FOUND_TEXT]);
      expect((await checksOf(who.id)).map(check => check.kind)).toEqual(['applied', 'applied']);
      expect(await badgeOf(who)).toMatchObject({ codeEntered: false, state: 'applied' });

      // And a code issued for the first application, not yet entered, dies with it.
      const who2 = await practitioner('bound-unentered');

      expect((await apply(who2, '28/33333')).status).toBe(201);

      const stale = await issuePlain(who2, 'phone');

      expect((await apply(who2, '28/44444')).status).toBe(201);

      const dead = await enter(who2, { code: stale });

      expect([dead.status, dead.text]).toEqual([404, NOT_FOUND_TEXT]);
    });
  });

  describe('nobody but the session', () => {
    it('takes no user and no contact from a practitioner’s body', async () => {
      const who = await practitioner('smuggler');
      const victim = await practitioner('victim');
      const smuggled = {
        channel: 'register_email',
        contact: 'smuggled-contact@evil.invalid',
        email: 'smuggled-email@evil.invalid',
        number: '28/55555',
        phone: '+34600111222',
        register: REGISTER,
        user_id: victim.id,
        userId: victim.id
      };

      expect((await call('post', '/care/practice/badge', who.cookie, smuggled)).status).toBe(201);
      expect(await checksOf(victim.id)).toEqual([]);
      expect((await badgeOf(victim)).state).toBe('none');

      const [stored] = await sql()<{ dump: string }>`
        select coalesce(string_agg(row_to_json(c)::text, ' '), '') as dump from professional_badge_checks c where user_id = ${who.id}`;

      for (const trace of ['evil.invalid', '600111222', victim.id]) {
        expect({ found: stored?.dump.includes(trace), trace }).toEqual({ found: false, trace });
      }

      // The victim applies and is sent a code; the smuggler types it with the victim's id in the body.
      expect((await apply(victim, '28/66666')).status).toBe(201);

      const code = await issuePlain(victim, 'post');
      const typed = await enter(who, { code, user_id: victim.id, userId: victim.id });

      expect([typed.status, typed.text]).toEqual([404, NOT_FOUND_TEXT]);
      // Not a wrong try against the victim's code either: it was never theirs to try.
      expect(await codeRow(victim.id)).toMatchObject({ attempts: 0, live: true, used: false });
      expect((await enter(victim, { code })).status).toBe(204);
    });

    it('shows another practitioner nothing of this one’s badge', async () => {
      const mine = await granted('mine');
      const theirs = await practitioner('theirs');
      const view = await badgeOf(theirs);

      expect(view).toMatchObject({ checkedAt: null, dueAt: null, number: null, register: null, state: 'none' });
      expect((await badgeOf(mine)).state).toBe('badged');

      // The owner's routes are not a practitioner's, for their own id or another's.
      for (const id of [mine.id, theirs.id]) {
        const read = await call('get', `/admin/professionals/${id}/badge`, theirs.cookie);

        expect([read.status, read.text]).toEqual([404, NOT_FOUND_TEXT]);
      }
    });

    it('is a 404 on every owner route to anybody but the owner', async () => {
      const subject = await practitioner('owner-routes');

      expect((await apply(subject, '28/77777')).status).toBe(201);

      const before = await checksOf(subject.id);
      const routes: readonly ['get' | 'post', string, unknown][] = [
        ['get', '/admin/professionals/badges', undefined],
        ['get', `/admin/professionals/${subject.id}/badge`, undefined],
        ['post', `/admin/professionals/${subject.id}/badge/code`, { channel: 'post' }],
        ['post', `/admin/professionals/${subject.id}/badge/confirm`, {}],
        ['post', `/admin/professionals/${subject.id}/badge/removal`, { kind: 'fail', reason: 'not_on_register', source: 'own_check' }]
      ];
      const seen: [string, string, number, string][] = [];

      for (const [who, cookie] of [
        ['ordinary', ordinary.cookie],
        ['the practitioner', subject.cookie],
        ['nobody', null]
      ] as const) {
        for (const [method, path, body] of routes) {
          const response = await call(method, path, cookie, body);

          seen.push([who, path, response.status, response.text]);
        }
      }

      expect(seen.filter(([, , status, text]) => status !== 404 || text !== NOT_FOUND_TEXT)).toEqual([]);
      expect(await checksOf(subject.id)).toEqual(before);
      expect(await codeRow(subject.id)).toBeUndefined();

      // And to the owner, an account that does not exist is the same 404.
      for (const [method, path, body] of routes.slice(1)) {
        const response = await call(method, path.replace(subject.id, 'usr-nobody'), owner.cookie, body);

        expect([path, response.status, response.text]).toEqual([path, 404, NOT_FOUND_TEXT]);
      }
    });

    it('closes every practitioner route while the `professional` switch is off', async () => {
      const who = await practitioner('switch');

      await setSwitch(false);

      try {
        for (const [method, path, body] of [
          ['get', '/care/practice/badge', undefined],
          ['post', '/care/practice/badge', { number: '28/88888', register: REGISTER }],
          ['post', '/care/practice/badge/code', { code: 'ABCDE-FGHJK' }]
        ] as const) {
          const response = await call(method, path, who.cookie, body);

          expect([path, response.status, response.text]).toEqual([path, 404, NOT_FOUND_TEXT]);
        }
      } finally {
        await setSwitch(true);
      }

      expect(await checksOf(who.id)).toEqual([]);
    });
  });

  describe('refused and withdrawn, with a reason', () => {
    it('refuses an application with a reason, mails the statement, and the practitioner’s page says why', async () => {
      const who = await practitioner('fail');

      expect((await apply(who, '28/12121')).status).toBe(201);

      const failed = await removal(who, { kind: 'fail', reason: 'not_me', source: 'notice' });

      expect(failed.status).toBe(200);
      expect(failed.body).toMatchObject({ application: null, badge: null, state: 'refused' });
      expect((await checksOf(who.id))[0]).toMatchObject({ kind: 'fail', reason: 'not_me' });
      // The decision names what the refused check named: the application's declared register and number (phase 8); the
      // top-level number and register stay the standing badge's, and none stands.
      expect(await badgeOf(who)).toMatchObject({
        decision: { dueAt: null, facts: null, kind: 'fail', number: '28/12121', reason: 'not_me', register: REGISTER },
        number: null,
        register: null,
        state: 'refused'
      });

      await until(() => badgeMailsTo(who).length > 0, 'the statement of reasons');
      expect(badgeMailsTo(who)).toHaveLength(1);

      // Nothing waits to be refused twice; a withdrawal needs a badge.
      for (const body of [
        { kind: 'fail', reason: 'not_me', source: 'notice' },
        { kind: 'withdrawn', reason: 'not_on_register', source: 'own_check' }
      ]) {
        const again = await removal(who, body);

        expect([again.status, again.text]).toEqual([404, NOT_FOUND_TEXT]);
      }

      // They may apply again.
      expect((await apply(who, '28/12121')).status).toBe(201);
    });

    it('withdraws a standing badge with the owner’s facts, and the next request reads it gone', async () => {
      const who = await granted('withdrawn');

      expect(await badgeOf(who)).toMatchObject({ state: 'badged' });

      // `other` is written out, or refused.
      expect((await removal(who, { kind: 'withdrawn', reason: 'other', source: 'own_check' })).status).toBe(422);
      expect((await badgeOf(who)).state).toBe('badged');

      const facts = 'El colegio confirma la baja el 3 de noviembre';
      const withdrawn = await removal(who, { facts, kind: 'withdrawn', reason: 'other', source: 'own_check' });

      expect(withdrawn.status).toBe(200);
      expect((await checksOf(who.id))[0]).toMatchObject({ kind: 'withdrawn', reason: `other: ${facts}` });
      expect(await badgeOf(who)).toMatchObject({
        checkedAt: null,
        // The withdrawn badge's own register and number on the decision (phase 8); none at the top level.
        decision: { dueAt: null, facts, kind: 'withdrawn', number: `28/${String(stamp).slice(-5)}`, reason: 'other', register: REGISTER },
        dueAt: null,
        number: null,
        register: null,
        state: 'withdrawn'
      });
      expect((await recordOf(who)).badge).toBeNull();

      await until(() => badgeMailsTo(who).some(mail => mail.text.includes(facts)), 'the withdrawal’s statement with its facts');
    });

    // Replaced in project 025 phase 6: the owner's grant route, which wrote a bare `pass`, is retired. A badge comes
    // only by the real path — its `pass` after the `applied` row — and the old route is the owner's 404, writing nothing.
    it('writes a `pass` only by the real path; the retired grant route is a 404 to the owner and writes no check', async () => {
      const who = await granted('grant');
      const [pass, applied, ...rest] = await checksOf(who.id);

      expect(rest).toEqual([]);
      expect(applied).toMatchObject({ kind: 'applied', number: `28/${String(stamp).slice(-5)}` });
      expect(pass).toMatchObject({ channel: 'phone', kind: 'pass', number: `28/${String(stamp).slice(-5)}` });
      expect(Date.parse(pass?.dueAt ?? '') - Date.now()).toBeGreaterThan(360 * 86_400_000);
      expect(await badgeOf(who)).toMatchObject({ number: `28/${String(stamp).slice(-5)}`, state: 'badged' });

      const bare = await practitioner('grant-retired');
      const retired = await call('post', `/admin/accounts/${bare.id}/professional`, owner.cookie, { collegiateNumber: '28/55555' });

      expect(retired.status).toBe(404);
      expect(await checksOf(bare.id)).toEqual([]);
      expect((await badgeOf(bare)).state).toBe('none');
    });
  });

  it('shows a client none of a decision: the register, the numbers and the dates stay on the practitioner’s own page', async () => {
    const who = await granted('client-view');

    await acceptAgreement(app, who);

    const pro = await enableTotp(app, who);

    made.push(pro.cookie);

    const client = await register(app, `badge-e2e-client-view-client-${String(stamp)}@e2e.invalid`);
    const later = await register(app, `badge-e2e-client-view-later-${String(stamp)}@e2e.invalid`);

    made.push(client.cookie, later.cookie);

    const tokenFor = async (to: Account): Promise<string> => {
      const before = outbox.length;

      expect((await call('post', '/care/invitations', pro.cookie, { email: to.email })).status).toBe(201);
      await until(
        () => outbox.slice(before).some(mail => mail.to === to.email && /\/invitacion\/[A-Za-z0-9_-]{43}/.test(mail.text)),
        'the invitation'
      );

      return outbox
        .slice(before)
        .filter(mail => mail.to === to.email)
        .at(-1)
        ?.text.match(/\/invitacion\/([A-Za-z0-9_-]{43})/)?.[1] as string;
    };

    const token = await tokenFor(client);
    const accepted = await call('post', `/care/invitations/${token}/accept`, client.cookie, {
      consentScope: 'plan',
      consentVersion: CARE_CONSENT_VERSION,
      sharesHealth: false
    });

    expect(accepted.status).toBe(200);

    // The badge withdrawn, then a new application under another number refused: two decisions, each naming its check.
    const facts = 'El colegio confirma la baja de la prueba';

    expect((await removal(who, { facts, kind: 'withdrawn', reason: 'other', source: 'own_check' })).status).toBe(200);
    expect((await apply(pro, '28/90909', 'Colegio de la decisión')).status).toBe(201);
    expect((await removal(who, { kind: 'fail', reason: 'not_on_register', source: 'own_check' })).status).toBe(200);

    // The second factor rotated the session: `pro` is the practitioner's live cookie.
    const own = await badgeOf(pro);

    expect(own).toMatchObject({ decision: { kind: 'fail', number: '28/90909', register: 'Colegio de la decisión' }, state: 'refused' });

    // What a client reads: their link, and a fresh invitation's detail.
    const answers = [
      (await call('get', '/care/links/me', client.cookie)).text,
      (await call('get', '/care/links/me/ended', client.cookie)).text,
      (await call('get', `/care/invitations/${await tokenFor(later)}`, later.cookie)).text
    ];

    for (const text of answers) {
      for (const needle of ['28/90909', 'Colegio de la decisión', `28/${String(stamp).slice(-5)}`, REGISTER, facts, '"decision"', '"dueAt"']) {
        expect({ hit: text.includes(needle), needle }).toEqual({ hit: false, needle });
      }
    }
  });

  describe('the lapse and the daily sweep', () => {
    const lapsedRows = async (who: Account) => (await checksOf(who.id)).filter(check => check.kind === 'lapsed');

    it('lapses by the clock with no row, and the sweep then writes one `lapsed` row with a reason and one mail — once, and nothing with the switch off', async () => {
      const who = await granted('lapse');

      await backdatePass(who.id, 31);

      const passDue = (await checksOf(who.id)).find(check => check.kind === 'pass')?.dueAt ?? '';
      // The decision of a lapse names the yearly check that fell due, and the badge's own register and number (phase 8).
      const lapseNamed = { dueAt: new Date(passDue).toISOString(), kind: 'lapsed', number: `28/${String(stamp).slice(-5)}`, register: REGISTER };

      // Lapsed on the very next request, before any sweep has run.
      expect(await badgeOf(who)).toMatchObject({ decision: lapseNamed, number: null, register: null, state: 'lapsed' });
      expect((await recordOf(who)).state).toBe('lapsed');
      expect(await lapsedRows(who)).toEqual([]);

      // Switch off: the sweep writes nothing and mails nothing.
      await setSwitch(false);

      try {
        await sweep();
      } finally {
        await setSwitch(true);
      }

      expect(await lapsedRows(who)).toEqual([]);
      expect(badgeMailsTo(who)).toEqual([]);

      await sweep();

      const [lapsed, ...more] = await lapsedRows(who);

      expect(more).toEqual([]);
      // Nobody re-checked it and no code went out: the delay is said to be ours.
      expect(lapsed).toMatchObject({ kind: 'lapsed', reason: 'our_delay' });
      await until(() => badgeMailsTo(who).length > 0, 'the lapse’s statement');
      expect(badgeMailsTo(who)).toHaveLength(1);
      expect(await badgeOf(who)).toMatchObject({ decision: { ...lapseNamed, reason: 'our_delay' }, number: null, register: null, state: 'lapsed' });

      // A second pass finds nothing to lapse.
      await sweep();
      expect(await lapsedRows(who)).toHaveLength(1);
      expect(badgeMailsTo(who)).toHaveLength(1);
    });

    it('keeps an application made between the date’s lapse and the sweep', async () => {
      const who = await granted('lapse-apply');

      await backdatePass(who.id, 35);
      expect((await badgeOf(who)).state).toBe('lapsed');
      expect((await apply(who, '28/90909')).status).toBe(201);

      const code = await issuePlain(who, 'post');

      await sweep();

      // The last `applied` is the badge's own application by the real path (phase 6), moved back with its pass.
      expect((await checksOf(who.id)).map(check => check.kind)).toEqual(['applied', 'lapsed', 'pass', 'applied']);
      expect(await badgeOf(who)).toMatchObject({ state: 'code_sent' });
      // The code issued for the application survived the sweep, and the badge follows from it.
      expect((await enter(who, { code })).status).toBe(204);
      expect((await confirm(who)).status).toBe(200);
      expect(await badgeOf(who)).toMatchObject({ number: '28/90909', state: 'badged' });
    });

    it('reminds a practitioner once when the re-check falls due — after a skipped day too, and not again on a second pass — and tells the owner counts and a link, no address', async () => {
      const who = await granted('due');

      await backdatePass(who.id, 2);
      expect(await badgeOf(who)).toMatchObject({ state: 'due' });

      // The cron last reminded three days ago: yesterday's pass never ran.
      await sql()`delete from analytics_events where event = 'owner_alerted' and properties ->> 'kind' = 'badge-reminders' and created_at >= ${started}`;

      const [mark] = await sql()<{ id: string }>`
        insert into analytics_events (event, user_id, properties, created_at)
        values ('owner_alerted', null, ${JSON.stringify({ kind: 'badge-reminders' })}::jsonb, now() - interval '3 days')
        returning id::text as id`;

      planted.push(mark?.id ?? '');
      await releaseOwnerAlert();

      const ownerBefore = mailsTo(OWNER).length;

      await sweep();
      await until(() => badgeMailsTo(who).length > 0, 'the re-check reminder');
      expect(badgeMailsTo(who)).toHaveLength(1);

      // The owner's alert: counts and the console's link, and not one address.
      const alerts = mailsTo(OWNER).slice(ownerBefore);

      expect(alerts).toHaveLength(1);

      const alert = alerts[0] as Sent;

      expect(alert.text).toContain('/admin/profesionales');
      expect(alert.subject).toMatch(/\d+ insignias/);

      for (const field of [alert.subject, alert.text, alert.html]) {
        expect(field).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      }

      // A second pass the same day: no second reminder.
      await releaseOwnerAlert();
      await sweep();
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(badgeMailsTo(who)).toHaveLength(1);
      // No lapse, no reminder row: the pass, and the application it answered (phase 6's real path).
      expect((await checksOf(who.id)).map(check => check.kind)).toEqual(['pass', 'applied']);
    });
  });

  it('never answers, mails or logs a code’s hash, nor logs a code', async () => {
    const hashes = await sql()<{ hash: string; userId: string }>`
      select c.code_hash as hash, c.user_id as "userId" from professional_badge_codes c join "user" u on u.id = c.user_id
      where u.email like ${`badge-e2e-%-${String(stamp)}@e2e.invalid`}`;

    // Every code this suite issued: three in the flows, five in the refusals, one unentered, two bound, the victim's, the lapse's —
    // and, since phase 6, one for each of the seven badges earned by the real path in `granted()`.
    expect(hashes).toHaveLength(20);
    // Sanity: the store's hash is the code's, so searching for it is searching for the right thing.
    expect(hashes.map(row => row.hash)).toContain(
      createHash('sha256')
        .update((codes[0] ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
        .digest('hex')
    );

    const mails = outbox.map(mail => `${mail.subject}\n${mail.text}\n${mail.html}`);
    const leaks: string[] = [];

    for (const { hash } of hashes) {
      for (const [where, haystack] of [
        ['answers', answers],
        ['mails', mails],
        ['logs', lines]
      ] as const) {
        if (haystack.some(text => text.includes(hash))) {
          leaks.push(`hash in ${where}`);
        }
      }
    }

    for (const code of codes) {
      if (lines.some(line => line.includes(code))) {
        leaks.push(`code ${code} in logs`);
      }
    }

    expect(leaks).toEqual([]);
    expect(answers.some(text => /codeHash|code_hash|checkedBy/.test(text))).toBe(false);
  });
});
