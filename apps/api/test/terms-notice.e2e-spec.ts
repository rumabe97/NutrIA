import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { madridDayKey, madridMidnight, shiftDay } from 'core/domain/Period';
import { NOTICE_BATCH_SIZE, NOTICE_DAILY_CAP } from 'core/entities/Notice';
import { UserController } from 'core/controllers/User';
import { database } from 'database';

import {
  createApp,
  deleteAccountByEmail,
  deleteAccounts,
  enableTotp,
  httpServer,
  PREFIX,
  register,
  ScriptedAiClient,
  setLocale,
  unconfirmAddress
} from './harness.js';
import { EmailService } from '../src/modules/email/services/Email.service.js';
import { ENV, validateEnv } from '../src/config/index.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * The change notice to every account (project 025 phase 10, `textos/06` § Z),
 * sent from the owner's console in batches — on real Postgres, the first time
 * `account_notices` (migration 0075) and its repository's SQL meet a database.
 *
 * **The candidate set is the whole `user` table**: the notice goes to every
 * confirmed account. So the suite first proves the database holds no account but
 * its own — and refuses to run otherwise — and every count it asserts is exact.
 *
 * **Mail**: SMTP is configured with addresses that go nowhere and the real
 * `EmailService`'s transporter is replaced by an outbox (as `care-badge` does), so
 * the service's own path runs — its `mail_sent` events included — and nothing
 * leaves the process. The outbox can refuse one address, every address, or wait
 * per mail (the race).
 *
 * **One sequence, in order**: the reach, the preview, the dates; then the presses —
 * a whole batch refused, the cursor reaching the accounts behind it, one address
 * refused, an account deleted between preview and send, the refused ones coming
 * back once nothing is owed after the cursor, a press with nothing owed; then the
 * cap (rows seeded on the table for today, under notice names that are not this
 * one, so they count toward the cap and toward nothing else), and two presses at
 * once (15 rounds, the notice's rows cleared on the table between rounds so each
 * round has accounts owed). Requires a real database — see ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

type Json = Record<string, unknown>;
type Sent = { readonly html: string; readonly subject: string; readonly text: string; readonly to: string };
type SendView = {
  after: string | null;
  failed: number;
  failedRecipients: { email: string }[];
  remaining: number;
  sent: number;
  skippedUnconfirmed: number;
  stoppedEarly: boolean;
};

const NOTICE = 'terms-2.4.0';
const NOT_FOUND_TEXT = JSON.stringify({ code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 });
const FROM = 'nutria@e2e.invalid';
/** The notice's subject in each language: how its mails are told from every other mail the suite's accounts cause. */
const NOTICE_SUBJECTS = ['Cambian la política de privacidad y las condiciones de NutrIA', "NutrIA's privacy policy and terms are changing"];
/** How many recipients beyond the four base accounts: enough for two batches and a tail. */
const RECIPIENTS = 52;

describe('the change notice to every account (project 025 phase 10)', () => {
  const stamp = Date.now();
  const pattern = `notice-%-${String(stamp)}@e2e.invalid`;
  const made: string[] = [];
  const outbox: Sent[] = [];
  /** Every mail the outbox was handed, accepted or not. */
  const tried: string[] = [];
  const refuse = { all: false, only: new Set<string>() };
  let delayMs = 0;
  let app: INestApplication;
  let owner: Account;
  let adminWithout: Account;
  let plain: Account;
  let unconfirmedAdmin: Account;
  /** The confirmed accounts, oldest first, as the notice orders them. */
  const confirmed: Account[] = [];
  let english: Account;
  let unconfirmed: Account;
  let started = '';
  /** Unconfirmed accounts of other suites' left on the database: never mailed, only counted. */
  let foreignUnconfirmed = 0;
  /** Notice mails the outbox was handed for an address this suite did not make: refused, and the suite fails on any. */
  const intruders: string[] = [];
  let presses = 0;

  const server = () => httpServer(app);
  const address = (label: string) => `notice-${label}-${String(stamp)}@e2e.invalid`;
  const today = () => madridDayKey(new Date());
  /** The day the campaign announces. */
  const day = () => shiftDay(today(), 5);

  async function account(label: string): Promise<Account> {
    const who = await register(app, address(label), `Persona ${label}`);

    made.push(who.cookie);

    return who;
  }

  const preview = (who: Account, body: object, query = '', notice = NOTICE) =>
    request(server()).post(`/${PREFIX}/admin/notices/${notice}/preview${query}`).set('Cookie', who.cookie).send(body);
  const send = (who: Account, body: object, notice = NOTICE) =>
    request(server()).post(`/${PREFIX}/admin/notices/${notice}/send`).set('Cookie', who.cookie).send(body);

  /** One completed press, counted for the audit. */
  async function press(body: object): Promise<SendView> {
    const response = await send(owner, body);

    expect({ status: response.status, text: response.status === 200 ? '' : response.text }).toEqual({ status: 200, text: '' });
    presses += 1;
    expect(intruders).toEqual([]);

    return response.body as SendView;
  }

  async function rows(): Promise<{ effectiveOn: string; locale: string; sentAt: string; userId: string }[]> {
    return sql()<{ effectiveOn: string; locale: string; sentAt: string; userId: string }>`
      select user_id as "userId", effective_on::text as "effectiveOn", locale, sent_at::text as "sentAt" from account_notices where notice = ${NOTICE}`;
  }

  async function auditRows(): Promise<{ actorId: string | null; entity: string; entityId: string | null; metadata: Json }[]> {
    return sql()<{ actorId: string | null; entity: string; entityId: string | null; metadata: Json }>`
      select actor_id as "actorId", entity, entity_id as "entityId", metadata from audit_logs where action = 'notice.sent' and created_at >= ${started}::timestamptz order by created_at`;
  }

  const accepted = (who: Account) => outbox.filter(mail => mail.to === who.email).length;

  /** No refusal names an address: whatever the error, nothing personal in its body. */
  function expectImpersonal(response: Response): void {
    expect(response.text).not.toContain('@');
  }

  beforeAll(async () => {
    for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'OWNER_EMAIL']) {
      expect(process.env[name] ?? '').toBe('');
    }

    // The notice goes to every confirmed account in `user`. In CI the suites run one after another in one process on
    // a fresh database the seed puts no account in, and each deletes its own in `afterAll` — so at this point there is
    // none, unless an earlier suite failed before its clean-up (which `global-teardown.ts` reports anyway). A
    // confirmed account of anybody else's would be mailed and get a row: the suite stops first, naming how many and
    // whose. An unconfirmed one is never mailed nor written for; it is only counted, so it is read here and allowed.
    const strangers = await sql()<{ email: string; verified: boolean }>`
      select email, email_verified as verified from "user" where email not like ${pattern}`;
    const confirmedStrangers = strangers.filter(row => row.verified);

    if (confirmedStrangers.length > 0) {
      const prefixes = [...new Set(confirmedStrangers.map(row => row.email.split('-')[0] ?? row.email.split('@')[0] ?? ''))].sort();

      throw new Error(
        `terms-notice would mail ${String(confirmedStrangers.length)} confirmed account(s) it did not make (prefixes: ${prefixes.join(', ')}) — an earlier suite left them`
      );
    }

    foreignUnconfirmed = strangers.length;

    const [leftRows] = await sql()<{ n: number }>`select count(*)::int as n from account_notices where notice = ${NOTICE}`;

    // A campaign already begun would fix another day and other counts.
    expect({ notices: leftRows?.n }).toEqual({ notices: 0 });

    started = (await sql()<{ now: string }>`select now()::text as now`)[0]?.now ?? '';

    const env = validateEnv({
      ...process.env,
      EMAIL_FROM: FROM,
      RATE_LIMIT_MAX: '100000',
      SMTP_HOST: 'smtp.e2e.invalid',
      SMTP_PASS: 'not-a-password',
      SMTP_USER: 'not-a-user'
    });

    app = await createApp(new ScriptedAiClient([]), builder => builder.overrideProvider(ENV).useValue(env));

    const mailer = app.get(EmailService, { strict: false }) as unknown as { transporter: unknown };

    mailer.transporter = {
      sendMail: async (message: Sent): Promise<void> => {
        // Only the notice is this suite's: a sign-up's confirmation link or a second factor's mail goes through, unrecorded.
        if (!NOTICE_SUBJECTS.includes(message.subject)) {
          return;
        }

        // Belt and braces with the check before the suite: an address of anybody else's is refused — so no row is
        // written for it — and remembered, and the suite fails on it.
        if (!message.to.startsWith('notice-') || !message.to.endsWith(`-${String(stamp)}@e2e.invalid`)) {
          intruders.push(message.to);
          throw Object.assign(new Error('550 not this suite’s'), { code: 'EENVELOPE', responseCode: 550 });
        }

        tried.push(message.to);

        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        if (refuse.all || refuse.only.has(message.to)) {
          throw Object.assign(new Error('550 refused'), { code: 'EENVELOPE', responseCode: 550 });
        }

        outbox.push(message);
      }
    };

    owner = await account('owner');
    await UserController.grantAdmin(owner.email);
    owner = await enableTotp(app, owner);
    made.push(owner.cookie);
    adminWithout = await account('admin-without');
    await UserController.grantAdmin(adminWithout.email);
    plain = await account('plain');
    unconfirmedAdmin = await account('admin-unconfirmed');
    await UserController.grantAdmin(unconfirmedAdmin.email);
    await unconfirmAddress(unconfirmedAdmin.email);
    confirmed.push(owner, adminWithout, plain);

    english = await account('r01');
    await setLocale(app, english, 'en-GB');
    confirmed.push(english);

    for (let n = 2; n <= RECIPIENTS; n += 1) {
      confirmed.push(await account(`r${String(n).padStart(2, '0')}`));
    }

    unconfirmed = await account('unconfirmed');
    await unconfirmAddress(unconfirmed.email);
  }, 600_000);

  afterAll(async () => {
    try {
      expect(intruders).toEqual([]);
      await deleteAccounts(app, made);

      for (const { email } of await sql()<{ email: string }>`select email from "user" where email like ${pattern}`) {
        await deleteAccountByEmail(app, email);
      }

      await sql()`delete from analytics_events where event = 'mail_sent' and created_at >= ${started}::timestamptz`;

      const [left] = await sql()<Json>`
        select (select count(*)::int from "user" where email like ${pattern}) as accounts,
               (select count(*)::int from account_notices) as notices`;

      expect(left).toEqual({ accounts: 0, notices: 0 });
    } finally {
      await app?.close();
    }
  }, 600_000);

  describe('who reaches it', () => {
    it('answers the owner, and is the console’s 404 to a plain account and to an admin without a second factor; an unconfirmed admin gets the global 409', async () => {
      await preview(owner, { date: day() }).expect(200);

      for (const who of [plain, adminWithout]) {
        for (const response of [await preview(who, { date: day() }), await send(who, { date: day() })]) {
          expect({ status: response.status, text: response.text }).toEqual({ status: 404, text: NOT_FOUND_TEXT });
        }
      }

      for (const response of [await preview(unconfirmedAdmin, { date: day() }), await send(unconfirmedAdmin, { date: day() })]) {
        expect({ code: (response.body as Json).code, status: response.status }).toEqual({ code: 'EMAIL_NOT_VERIFIED', status: 409 });
      }

      expect(outbox).toEqual([]);
      expect(await rows()).toEqual([]);
      expect(await auditRows()).toEqual([]);
    });

    it('is the 404 for a notice not on the list — mis-cased, another version, padded, a smuggled byte — and starts nothing', async () => {
      for (const notice of [
        'terms-2.4.1',
        'TERMS-2.4.0',
        'Terms-2.4.0',
        'terms-2.4.0%20',
        'terms-2.4.0%00',
        'terms-2.4.0%2Fx',
        'terms',
        '%20terms-2.4.0'
      ]) {
        for (const response of [await preview(owner, { date: day() }, '', notice), await send(owner, { date: day() }, notice)]) {
          expect({ notice, status: response.status, text: response.text }).toEqual({ notice, status: 404, text: NOT_FOUND_TEXT });
        }
      }

      expect(tried).toEqual([]);
      expect(await rows()).toEqual([]);
      expect(await auditRows()).toEqual([]);
    });
  });

  describe('the preview', () => {
    it('sends nothing and writes nothing, and counts every confirmed account and every unconfirmed one', async () => {
      const answer = await preview(owner, { date: day() }).expect(200);
      const body = answer.body as Json;

      expect(body).toMatchObject({ alreadySent: 0, campaignDate: null, skippedUnconfirmed: 2 + foreignUnconfirmed, toSend: confirmed.length });
      expect((body.recipients as Json).total).toBe(confirmed.length);
      expect(tried).toEqual([]);
      expect(await rows()).toEqual([]);
      expect(await auditRows()).toEqual([]);
    });

    it('lists, page by page, every confirmed account oldest first with its language — and no unconfirmed one', async () => {
      const listed: { email: string; locale: string }[] = [];

      for (let offset = 0; offset < confirmed.length; offset += 20) {
        const page = (await preview(owner, { date: day() }, `?offset=${String(offset)}&size=20`).expect(200)).body as {
          recipients: { offset: number; rows: { email: string; locale: string }[]; size: number; total: number };
        };

        expect(page.recipients).toMatchObject({ offset, size: 20, total: confirmed.length });
        listed.push(...page.recipients.rows);
      }

      expect(listed.map(row => row.email)).toEqual(confirmed.map(who => who.email));
      expect(listed.find(row => row.email === english.email)?.locale).toBe('en-GB');
      expect(listed.filter(row => row.email !== english.email).every(row => row.locale === 'es-ES')).toBe(true);
      expect(listed.map(row => row.email)).not.toContain(unconfirmed.email);
      expect(listed.map(row => row.email)).not.toContain(unconfirmedAdmin.email);
      expect(Object.keys(listed[0] ?? {}).sort()).toEqual(['email', 'locale']);

      // A hundred at most; a page past the end is empty.
      expect((await preview(owner, { date: day() }, '?size=100').expect(200)).body).toMatchObject({ recipients: { size: 100 } });

      for (const query of ['?size=101', '?size=0', '?offset=-1', '?size=abc']) {
        const refused = await preview(owner, { date: day() }, query);

        expect({ query, status: refused.status }).toEqual({ query, status: 422 });
        expectImpersonal(refused);
      }

      expect((await preview(owner, { date: day() }, `?offset=${String(confirmed.length)}`).expect(200)).body).toMatchObject({
        recipients: { rows: [] }
      });
    });

    it('writes the day as each language’s mail will', async () => {
      const body = (await preview(owner, { date: day() }).expect(200)).body as { dateAsWritten: Record<string, string> };
      const at = madridMidnight(day());

      expect(body.dateAsWritten).toEqual({
        'en-GB': new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'Europe/Madrid' }).format(at),
        'es-ES': new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'Europe/Madrid' }).format(at)
      });
      expect(body.dateAsWritten['es-ES']).toMatch(/^\d{1,2} de \p{L}+ de \d{4}$/u);
      expect(body.dateAsWritten['en-GB']).toMatch(/^\d{1,2} \p{L}+ \d{4}$/u);
    });

    it('refuses a missing or malformed day, today, a past day and one past sixty days ahead — sixty is accepted', async () => {
      for (const body of [{}, { date: '' }, { date: '2026-13-01' }, { date: '01/12/2026' }, { date: 20261201 }]) {
        const refused = await preview(owner, body);

        expect({ body, status: refused.status }).toEqual({ body, status: 422 });
      }

      for (const [date, why] of [
        [today(), 'not_after_today'],
        [shiftDay(today(), -1), 'not_after_today'],
        [shiftDay(today(), 61), 'too_far']
      ] as const) {
        for (const refused of [await preview(owner, { date }), await send(owner, { date })]) {
          expect({ date, errors: (refused.body as { fieldErrors?: Json }).fieldErrors, status: refused.status }).toEqual({
            date,
            errors: { date: [why] },
            status: 422
          });
          expectImpersonal(refused);
        }
      }

      await preview(owner, { date: shiftDay(today(), 60) }).expect(200);
      await preview(owner, { date: shiftDay(today(), 1) }).expect(200);
      expect(tried).toEqual([]);
      expect(await rows()).toEqual([]);
    });
  });

  describe('the presses', () => {
    let cursor: string | null = null;
    /** Refused in one press of the second batch, mailed on a later round. */
    let refusedOnce: Account;
    /** Deleted between the preview and the press that would have reached it. */
    let deleted: Account;

    it('a whole batch refused: nothing written, every address reported, the cursor moved past them', async () => {
      refuse.all = true;

      try {
        const answer = await press({ date: day() });

        expect(answer).toMatchObject({
          failed: NOTICE_BATCH_SIZE,
          remaining: confirmed.length,
          sent: 0,
          skippedUnconfirmed: 2 + foreignUnconfirmed,
          stoppedEarly: false
        });
        expect(answer.failedRecipients.map(row => row.email)).toEqual(confirmed.slice(0, NOTICE_BATCH_SIZE).map(who => who.email));
        expect(answer.after).toBe(confirmed[NOTICE_BATCH_SIZE - 1]?.id);
        cursor = answer.after;
      } finally {
        refuse.all = false;
      }

      expect(outbox).toEqual([]);
      expect(await rows()).toEqual([]);
      // Not yet a campaign: nothing was accepted, so any day may still be sent.
      await preview(owner, { date: shiftDay(today(), 9) }).expect(200);
    });

    it('the cursor reaches the accounts behind; one address refused is reported, written nowhere, and the press goes on', async () => {
      refusedOnce = confirmed[NOTICE_BATCH_SIZE + 4] as Account;
      refuse.only.add(refusedOnce.email);

      try {
        const answer = await press({ after: cursor, date: day() });
        const batch = confirmed.slice(NOTICE_BATCH_SIZE, 2 * NOTICE_BATCH_SIZE);

        expect(answer).toMatchObject({ failed: 1, failedRecipients: [{ email: refusedOnce.email }], sent: NOTICE_BATCH_SIZE - 1 });
        expect(answer.remaining).toBe(confirmed.length - (NOTICE_BATCH_SIZE - 1));
        expect(answer.after).toBe(batch.at(-1)?.id);
        cursor = answer.after;

        for (const who of batch) {
          expect({ mails: accepted(who), who: who.email }).toEqual({ mails: who === refusedOnce ? 0 : 1, who: who.email });
        }
      } finally {
        refuse.only.clear();
      }

      const written = await rows();

      expect(written).toHaveLength(NOTICE_BATCH_SIZE - 1);
      expect(written.map(row => row.userId)).not.toContain(refusedOnce.id);
      expect(new Set(written.map(row => row.effectiveOn))).toEqual(new Set([day()]));
      expect(new Set(written.map(row => row.locale))).toEqual(new Set(['es-ES']));
    });

    it('fixes the campaign’s day once a mail was accepted: another day is refused naming it', async () => {
      for (const refused of [await preview(owner, { date: shiftDay(today(), 9) }), await send(owner, { date: shiftDay(today(), 9) })]) {
        expect({ errors: (refused.body as { fieldErrors?: Json }).fieldErrors, status: refused.status }).toEqual({
          errors: { date: [`campaign_date:${day()}`] },
          status: 422
        });
      }

      expect((await preview(owner, { date: day() }).expect(200)).body).toMatchObject({ alreadySent: NOTICE_BATCH_SIZE - 1, campaignDate: day() });
    });

    it('skips an account deleted between the preview and the press', async () => {
      deleted = confirmed[2 * NOTICE_BATCH_SIZE + 2] as Account;

      const listed = (await preview(owner, { date: day() }, '?size=100').expect(200)).body as { recipients: { rows: { email: string }[] } };

      expect(listed.recipients.rows.map(row => row.email)).toContain(deleted.email);
      await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', deleted.cookie).expect(204);

      const tail = confirmed.slice(2 * NOTICE_BATCH_SIZE).filter(who => who !== deleted);
      const answer = await press({ after: cursor, date: day() });

      expect(answer).toMatchObject({ failed: 0, sent: tail.length });
      expect(tried).not.toContain(deleted.email);

      for (const who of tail) {
        expect(accepted(who)).toBe(1);
      }

      cursor = answer.after;
    });

    it('brings the refused back once nothing is owed after the cursor, oldest first, and mails each once', async () => {
      const first = await press({ after: cursor, date: day() });

      expect(first).toMatchObject({ failed: 0, sent: NOTICE_BATCH_SIZE });

      for (const who of confirmed.slice(0, NOTICE_BATCH_SIZE)) {
        expect(accepted(who)).toBe(1);
      }

      const second = await press({ after: first.after, date: day() });

      expect(second).toMatchObject({ failed: 0, remaining: 0, sent: 1 });
      expect(accepted(refusedOnce)).toBe(1);
    });

    it('sends every live confirmed account exactly once, in its language, with § Z’s words, its links and the day written out', async () => {
      const alive = confirmed.filter(who => who !== deleted);

      for (const who of alive) {
        expect({ mails: accepted(who), who: who.email }).toEqual({ mails: 1, who: who.email });
      }

      expect(outbox.map(mail => mail.to).sort()).toEqual(alive.map(who => who.email).sort());
      expect(tried).not.toContain(unconfirmed.email);
      expect(tried).not.toContain(unconfirmedAdmin.email);

      const at = madridMidnight(day());
      const es = outbox.find(mail => mail.to === plain.email) as Sent;
      const en = outbox.find(mail => mail.to === english.email) as Sent;
      const esDay = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'Europe/Madrid' }).format(at);
      const enDay = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'Europe/Madrid' }).format(at);

      expect(es.subject).toBe('Cambian la política de privacidad y las condiciones de NutrIA');
      expect(es.text).toContain(`A partir del ${esDay}, cualquier persona mayor de edad podrá abrir una consulta en NutrIA`);
      expect(es.text).toContain('Solo quien lleve nuestra insignia «Dietista-nutricionista colegiada/o»');
      expect(es.text).toContain('http://localhost:3000/privacidad#tu-profesional');
      expect(es.text).toContain('http://localhost:3000/condiciones');
      expect(es.text).toContain(`escríbenos a ${FROM}`);
      expect(en.subject).toBe("NutrIA's privacy policy and terms are changing");
      expect(en.text).toContain(`From ${enDay}, any adult will be able to open a practice on NutrIA`);
      expect(en.text).toContain('http://localhost:3000/en/privacidad#tu-profesional');
      expect(en.text).toContain(`write to us at ${FROM}`);

      // A row per account told, in the language its mail was written in; none for an unconfirmed address.
      const written = await rows();

      expect(written.map(row => row.userId).sort()).toEqual(alive.map(who => who.id).sort());
      expect(written.find(row => row.userId === english.id)?.locale).toBe('en-GB');
      expect(written.filter(row => row.userId !== english.id).every(row => row.locale === 'es-ES')).toBe(true);
      expect(written.every(row => row.effectiveOn === day() && !Number.isNaN(Date.parse(row.sentAt)))).toBe(true);
      expect(written.map(row => row.userId)).not.toContain(unconfirmed.id);
    });

    it('a press with nothing owed sends nothing and changes no row', async () => {
      const before = await rows();
      const mails = outbox.length;
      const answer = await press({ date: day() });

      expect(answer).toMatchObject({ after: null, failed: 0, remaining: 0, sent: 0, skippedUnconfirmed: 2 + foreignUnconfirmed });
      expect(outbox).toHaveLength(mails);
      expect(await rows()).toEqual(before);
      expect((await preview(owner, { date: day() }).expect(200)).body).toMatchObject({ alreadySent: before.length, toSend: 0 });
    });

    it('deleting a mailed account deletes its row', async () => {
      const gone = confirmed[10] as Account;

      expect((await rows()).map(row => row.userId)).toContain(gone.id);
      await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', gone.cookie).expect(204);
      expect((await rows()).map(row => row.userId)).not.toContain(gone.id);
    });

    it('writes one `notice.sent` row per completed press — counts, the day and the notice — and no address; `mail_sent` carries the kind and the outcome alone', async () => {
      const audit = await auditRows();

      expect(audit).toHaveLength(presses);

      for (const row of audit) {
        expect(row).toMatchObject({ actorId: owner.id, entity: 'notice', entityId: NOTICE });
        expect(Object.keys(row.metadata).sort()).toEqual(['date', 'failed', 'notice', 'remaining', 'sent', 'skippedUnconfirmed']);
        expect(row.metadata).toMatchObject({ date: day(), notice: NOTICE });
        expect(JSON.stringify(row)).not.toContain('@');
      }

      expect(audit.map(row => row.metadata.sent)).toEqual([
        0,
        NOTICE_BATCH_SIZE - 1,
        confirmed.length - 2 * NOTICE_BATCH_SIZE - 1,
        NOTICE_BATCH_SIZE,
        1,
        0
      ]);

      const events = await sql()<{ properties: Json; userId: string | null }>`
        select properties, user_id as "userId" from analytics_events where event = 'mail_sent' and properties ->> 'kind' = 'terms-change-notice' and created_at >= ${started}::timestamptz`;

      expect(events).toHaveLength(tried.length);

      for (const event of events) {
        expect({ keys: Object.keys(event.properties).sort(), userId: event.userId }).toEqual({ keys: ['kind', 'ok'], userId: null });
      }

      expect(events.filter(event => event.properties.ok === false)).toHaveLength(NOTICE_BATCH_SIZE + 1);
    });
  });

  describe('the shared mailbox’s day, and two presses at once', () => {
    /** The notice owed to every live account again: its rows cleared on the table (no route takes a notice back). */
    async function owedAgain(): Promise<void> {
      await sql()`delete from account_notices where notice = ${NOTICE}`;
    }

    /** Rows for today under other notice names, on one of this suite's accounts: they count toward the cap and toward nothing else. */
    async function seedToday(count: number): Promise<void> {
      await sql()`
        insert into account_notices (user_id, notice, effective_on, locale, sent_at)
        select ${plain.id}, 'cap-seed-' || n, ${day()}::date, 'es-ES', now() from generate_series(1, ${count}) as n`;
    }

    const unseed = () => sql()`delete from account_notices where notice like 'cap-seed-%'`;

    it('refuses a press once today’s cap is spent — 409 NOTICE_DAILY_CAP with the cap and Madrid’s next midnight — and mails nothing', async () => {
      await owedAgain();

      const [already] = await sql()<{
        n: number;
      }>`select count(*)::int as n from account_notices where sent_at >= ${madridMidnight(today()).toISOString()}::timestamptz`;

      await seedToday(NOTICE_DAILY_CAP - (already?.n ?? 0));

      try {
        const mails = tried.length;
        const refused = await send(owner, { date: day() });

        expect(refused.status).toBe(409);
        expect(refused.body).toEqual({
          code: 'NOTICE_DAILY_CAP',
          message: 'El aviso ya ha enviado hoy todos los correos que puede.',
          noticeCap: { cap: NOTICE_DAILY_CAP, resetsAt: madridMidnight(shiftDay(today(), 1)).toISOString() },
          statusCode: 409
        });
        expectImpersonal(refused);
        expect(tried).toHaveLength(mails);
        expect(await rows()).toEqual([]);

        // Three below the cap: a press sends exactly three.
        await sql()`delete from account_notices where notice in ('cap-seed-1', 'cap-seed-2', 'cap-seed-3')`;

        const three = await press({ date: day() });

        expect(three).toMatchObject({ failed: 0, sent: 3 });
        expect(await rows()).toHaveLength(3);
      } finally {
        await unseed();
      }
    });

    it('lets one of two presses at once run and answers the other 409 CONFLICT; no account mailed twice (15 rounds)', async () => {
      delayMs = 20;

      try {
        for (let round = 0; round < 15; round += 1) {
          await owedAgain();

          const before = outbox.length;
          const [a, b] = await Promise.all([
            send(owner, { date: day() }),
            new Promise(resolve => setTimeout(resolve, 30)).then(() => send(owner, { date: day() }))
          ]);
          const statuses = [a.status, b.status].sort();

          expect({ round, statuses }).toEqual({ round, statuses: [200, 409] });

          const loser = a.status === 409 ? a : b;
          const winner = (a.status === 200 ? a : b).body as SendView;

          expect(loser.body).toMatchObject({ code: 'CONFLICT', statusCode: 409 });
          expectImpersonal(loser);
          presses += 1;

          const round_ = outbox.slice(before).map(mail => mail.to);

          expect({ duplicates: round_.length - new Set(round_).size, round }).toEqual({ duplicates: 0, round });
          expect(round_).toHaveLength(winner.sent);
          expect(await rows()).toHaveLength(winner.sent);
        }
      } finally {
        delayMs = 0;
      }

      // The losers wrote no audit row: one per completed press, still.
      expect(await auditRows()).toHaveLength(presses);
    }, 300_000);
  });
});
