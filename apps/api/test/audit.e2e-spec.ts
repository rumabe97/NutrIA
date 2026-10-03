import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { UserController } from 'core/controllers/User';

import { activationToken } from '../src/modules/auth/services/ActivationLink.js';

import {
  auditCount,
  auditRowById,
  auditRowsAboutSubject,
  auditRowsWithIpHash,
  createApp,
  deleteAccountByEmail,
  deleteAccounts,
  enableTotp,
  httpServer,
  latestAuditRow,
  PREFIX,
  register,
  ScriptedAiClient
} from './harness.js';

import type { Account } from './harness.js';
import type { AccountView, Paged } from 'core/controllers/User';
import type { AuditLogView } from 'core/controllers/Audit';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * Ajustes › Registro de acciones (`0071`): every admin mutation, and the
 * automatic activation, leaves exactly one row — the same transaction as the
 * action itself — naming who did it, what it was about, and nothing else.
 *
 * `latestAuditRow` and `auditCount` (`./harness.js`) read the table directly:
 * `AuditLogView` (`GET /admin/audit`) deliberately never exposes `entityId` or
 * `ipHash`, so the metadata each write is supposed to carry can only be
 * checked against the row itself. The read contract — the envelope, a row's
 * keys, filtering and paging — is checked separately, through the route.
 *
 * Requires a real database — see ./README.md.
 */
const PASSWORD = 'correct-horse-battery-staple-9';

describe('audit: one row per admin mutation, and the trail that reads them back', () => {
  let app: INestApplication;
  let owner: Account;
  let ordinary: Account;
  const stamp = Date.now();
  const made: string[] = [];
  const byEmail: string[] = [];

  const admin = (path: string, cookie?: string) => {
    const call = request(httpServer(app)).get(`/${PREFIX}/admin/${path}`);

    return cookie === undefined ? call : call.set('Cookie', cookie);
  };

  /** The id an account signed up with, read back through the owner's own table. */
  async function idOf(email: string): Promise<string> {
    const page: Response = await admin(`accounts?q=${encodeURIComponent(email)}`, owner.cookie).expect(200);
    const row = (page.body as Paged<AccountView>).rows.find(account => account.email === email);

    if (!row) {
      throw new Error(`No account signed up for ${email}`);
    }

    return row.id;
  }

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient([]));
    owner = await register(app, `audit-owner-${stamp}@e2e.invalid`);
    await UserController.grantAdmin(owner.email);
    owner = await enableTotp(app, owner);
    made.push(owner.cookie);

    ordinary = await register(app, `audit-user-${stamp}@e2e.invalid`);
    made.push(ordinary.cookie);
  });

  afterAll(async () => {
    await deleteAccounts(app, made);

    for (const email of byEmail) {
      await deleteAccountByEmail(app, email);
    }

    await app?.close();
  });

  it('writes account.activated {via: console} for the console button, naming the owner as actor', async () => {
    const email = `audit-console-${stamp}@e2e.invalid`;

    byEmail.push(email);
    await request(httpServer(app)).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Console', password: PASSWORD }).expect(200);

    const id = await idOf(email);
    const before = await auditCount('account.activated');

    const opened: Response = await request(httpServer(app)).post(`/${PREFIX}/admin/accounts/${id}/activate`).set('Cookie', owner.cookie).expect(201);

    expect(opened.body).toMatchObject({ email });
    await expect(auditCount('account.activated')).resolves.toBe(before + 1);

    const row = await latestAuditRow('account.activated');

    expect(row).toMatchObject({ actorId: owner.id, entity: 'user', entityId: null, ipHash: null, metadata: { via: 'console' }, subjectUserId: id });
  });

  it('writes account.activated {via: mail_link} for the owner-mail button, with no actor', async () => {
    const email = `audit-link-${stamp}@e2e.invalid`;

    byEmail.push(email);
    await request(httpServer(app)).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Link', password: PASSWORD }).expect(200);

    const id = await idOf(email);
    const token = activationToken(id, process.env.BETTER_AUTH_SECRET ?? '');
    const before = await auditCount('account.activated');

    await request(httpServer(app)).get(`/${PREFIX}/admin/activate`).query({ token }).expect(302);

    await expect(auditCount('account.activated')).resolves.toBe(before + 1);

    const row = await latestAuditRow('account.activated');

    expect(row).toMatchObject({ actorId: null, entity: 'user', entityId: null, ipHash: null, metadata: { via: 'mail_link' }, subjectUserId: id });
  });

  /**
   * The one case that goes through Better Auth's real verification route
   * rather than the harness's direct `activate()` — that helper calls
   * `UserController` straight, which writes no row by design (see
   * `README.md` § Accounts have two locks). With no SMTP configured and
   * `NODE_ENV=test`, `VerificationMail.ts` logs the verification url instead
   * of mailing it; the test reads it back off `console.info` rather than
   * standing up a mailbox.
   */
  it('writes account.activated {via: automatic} on email confirmation, with no actor, when the switch is on', async () => {
    const email = `audit-auto-${stamp}@e2e.invalid`;
    const read: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/settings`).set('Cookie', owner.cookie).expect(200);
    const original = (read.body as { flags: { automaticActivation: boolean } }).flags.automaticActivation;
    const setFlag = (enabled: boolean) =>
      request(httpServer(app))
        .patch(`/${PREFIX}/admin/settings`)
        .set('Cookie', owner.cookie)
        .send({ enabled, flag: 'automaticActivation' })
        .expect(200);

    byEmail.push(email);
    await setFlag(true);

    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    try {
      await request(httpServer(app)).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Auto', password: PASSWORD }).expect(200);

      const id = await idOf(email);
      const loggedLine = () => spy.mock.calls.find(call => typeof call[0] === 'string' && call[0].includes(`verification url for ${id}:`));
      // Better Auth sends the mail as a background task (`BackgroundTaskService`, project 011), so the line may be
      // written after the sign-up has answered: waited for, within a bound, rather than read once.
      const deadline = Date.now() + 5_000;

      while (!loggedLine() && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const logged = loggedLine();

      if (!logged) {
        throw new Error('No verification url was logged for the new account within 5 s');
      }

      const url = new URL(String(logged[0]).split(': ').slice(1).join(': ').trim());
      const before = await auditCount('account.activated');

      // A callbackURL travels with the mailed link, so a successful verification
      // redirects to it rather than answering JSON — the hook still ran first.
      await request(httpServer(app)).get(`${url.pathname}${url.search}`).expect(302);

      await expect(auditCount('account.activated')).resolves.toBe(before + 1);

      const row = await latestAuditRow('account.activated');

      expect(row).toMatchObject({ actorId: null, entity: 'user', entityId: null, ipHash: null, metadata: { via: 'automatic' }, subjectUserId: id });
    } finally {
      spy.mockRestore();
      await setFlag(original);
    }
  });

  it('writes account.tier_changed {from, to}, naming the owner as actor', async () => {
    const target = await register(app, `audit-tier-${stamp}@e2e.invalid`);

    made.push(target.cookie);

    const before = await auditCount('account.tier_changed');

    await request(httpServer(app))
      .patch(`/${PREFIX}/admin/accounts/${target.id}/tier`)
      .set('Cookie', owner.cookie)
      .send({ tier: 'premium' })
      .expect(200);

    await expect(auditCount('account.tier_changed')).resolves.toBe(before + 1);

    const row = await latestAuditRow('account.tier_changed');

    expect(row).toMatchObject({
      actorId: owner.id,
      entity: 'user',
      entityId: null,
      ipHash: null,
      metadata: { from: 'free', to: 'premium' },
      subjectUserId: target.id
    });
  });

  it('writes professional.granted and professional.revoked, each naming the owner and the account', async () => {
    const target = await register(app, `audit-pro-${stamp}@e2e.invalid`);

    made.push(target.cookie);

    const beforeGrant = await auditCount('professional.granted');

    await request(httpServer(app))
      .post(`/${PREFIX}/admin/accounts/${target.id}/professional`)
      .set('Cookie', owner.cookie)
      .send({ collegiateNumber: `28/${stamp.toString().slice(-6)}` })
      .expect(201);

    await expect(auditCount('professional.granted')).resolves.toBe(beforeGrant + 1);

    const granted = await latestAuditRow('professional.granted');

    expect(granted).toMatchObject({
      actorId: owner.id,
      entity: 'professional',
      entityId: null,
      ipHash: null,
      metadata: {},
      subjectUserId: target.id
    });

    const beforeRevoke = await auditCount('professional.revoked');

    await request(httpServer(app)).delete(`/${PREFIX}/admin/accounts/${target.id}/professional`).set('Cookie', owner.cookie).expect(204);

    await expect(auditCount('professional.revoked')).resolves.toBe(beforeRevoke + 1);

    const revoked = await latestAuditRow('professional.revoked');

    expect(revoked).toMatchObject({
      actorId: owner.id,
      entity: 'professional',
      entityId: null,
      ipHash: null,
      metadata: {},
      subjectUserId: target.id
    });
  });

  it('writes feedback.handled and feedback.reopened, naming the message and no subject', async () => {
    const sender = await register(app, `audit-feedback-${stamp}@e2e.invalid`);

    made.push(sender.cookie);

    const message = `audit-${stamp} needs an answer`;

    await request(httpServer(app)).post(`/${PREFIX}/feedback`).set('Cookie', sender.cookie).send({ kind: 'idea', message }).expect(204);

    const inbox: Response = await admin(`feedback?q=${encodeURIComponent(String(stamp))}`, owner.cookie).expect(200);
    const found = (inbox.body as Paged<{ id: string; message: string }>).rows.find(row => row.message === message);

    if (!found) {
      throw new Error('The submitted message never reached the inbox');
    }

    const beforeHandled = await auditCount('feedback.handled');

    await request(httpServer(app)).patch(`/${PREFIX}/admin/feedback/${found.id}`).set('Cookie', owner.cookie).send({ handled: true }).expect(204);

    await expect(auditCount('feedback.handled')).resolves.toBe(beforeHandled + 1);

    const handled = await latestAuditRow('feedback.handled');

    expect(handled).toMatchObject({ actorId: owner.id, entity: 'feedback', entityId: found.id, ipHash: null, metadata: {}, subjectUserId: null });

    const beforeReopened = await auditCount('feedback.reopened');

    await request(httpServer(app)).patch(`/${PREFIX}/admin/feedback/${found.id}`).set('Cookie', owner.cookie).send({ handled: false }).expect(204);

    await expect(auditCount('feedback.reopened')).resolves.toBe(beforeReopened + 1);

    const reopened = await latestAuditRow('feedback.reopened');

    expect(reopened).toMatchObject({ actorId: owner.id, entity: 'feedback', entityId: found.id, ipHash: null, metadata: {}, subjectUserId: null });
  });

  it('writes setting.changed {key, enabled}, entityId the key and no subject', async () => {
    const read: Response = await admin('settings', owner.cookie).expect(200);
    const original = (read.body as { flags: { checkInReminders: boolean } }).flags.checkInReminders;
    const target = !original;

    try {
      const before = await auditCount('setting.changed');

      await request(httpServer(app))
        .patch(`/${PREFIX}/admin/settings`)
        .set('Cookie', owner.cookie)
        .send({ enabled: target, flag: 'checkInReminders' })
        .expect(200);

      await expect(auditCount('setting.changed')).resolves.toBe(before + 1);

      const row = await latestAuditRow('setting.changed');

      expect(row).toMatchObject({
        actorId: owner.id,
        entity: 'setting',
        entityId: 'check_in_reminders',
        ipHash: null,
        metadata: { enabled: target, key: 'check_in_reminders' },
        subjectUserId: null
      });
    } finally {
      await request(httpServer(app))
        .patch(`/${PREFIX}/admin/settings`)
        .set('Cookie', owner.cookie)
        .send({ enabled: original, flag: 'checkInReminders' })
        .expect(200);
    }
  });

  /**
   * No VAPID keys are configured for this run (see `./README.md`): the test
   * cannot reach the "sent" branch, so it proves the other one — a click that
   * never reaches the provider writes nothing, rather than a row claiming a
   * push that was never delivered.
   */
  it('writes no push.test_sent row when push is not configured', async () => {
    const before = await auditCount('push.test_sent');

    const sent: Response = await request(httpServer(app)).post(`/${PREFIX}/admin/push-test`).set('Cookie', owner.cookie).expect(200);

    expect(sent.body).toMatchObject({ configured: false });
    await expect(auditCount('push.test_sent')).resolves.toBe(before);
  });

  it('a refused mutation writes no row: an unknown account, and taking back a grant nobody holds', async () => {
    const beforeActivated = await auditCount('account.activated');

    await request(httpServer(app)).post(`/${PREFIX}/admin/accounts/not-an-account/activate`).set('Cookie', owner.cookie).expect(404);
    await expect(auditCount('account.activated')).resolves.toBe(beforeActivated);

    const target = await register(app, `audit-norevoke-${stamp}@e2e.invalid`);

    made.push(target.cookie);

    const beforeRevoked = await auditCount('professional.revoked');

    // Never granted, so nothing to take back.
    await request(httpServer(app)).delete(`/${PREFIX}/admin/accounts/${target.id}/professional`).set('Cookie', owner.cookie).expect(404);
    await expect(auditCount('professional.revoked')).resolves.toBe(beforeRevoked);
  });

  it('leaves its rows behind, with the account no longer named, once the account is deleted', async () => {
    const target = await register(app, `audit-delete-${stamp}@e2e.invalid`);

    await request(httpServer(app))
      .patch(`/${PREFIX}/admin/accounts/${target.id}/tier`)
      .set('Cookie', owner.cookie)
      .send({ tier: 'premium' })
      .expect(200);

    const [before] = await auditRowsAboutSubject(target.id);

    if (!before) {
      throw new Error('No audit row was written for the tier change');
    }

    await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', target.cookie).expect(204);

    const after = await auditRowById(before.id);

    expect(after).toMatchObject({ id: before.id, action: 'account.tier_changed', subjectUserId: null });

    // The console still reads it back, subject-less, once the account is gone.
    const trail: Response = await admin('audit?action=account.tier_changed&size=1', owner.cookie).expect(200);
    const found = (trail.body as Paged<AuditLogView>).rows.find(row => row.at === new Date(before.createdAt).toISOString());

    expect(found).toMatchObject({ subject: null });
  });

  /**
   * A fact about the whole table, not only about the rows this suite wrote:
   * nothing in the product ever sets `ip_hash`, and `AuditLogView` does not
   * expose it even if something did — checked once here rather than once per
   * row above.
   */
  it('never carries an ip hash, on any row in the table', async () => {
    await expect(auditRowsWithIpHash()).resolves.toBe(0);
  });

  describe('GET /admin/audit: the trail an ordinary account may not see, and the shape of what it answers', () => {
    it('is a 404 for an ordinary account before its query is even read', async () => {
      await admin('audit?action=not-a-real-action', ordinary.cookie).expect(404);
      await admin('audit?action=not-a-real-action').expect(404);
    });

    it('refuses an unknown action and a repeated parameter as INVALID_INPUT', async () => {
      const bad = ['audit?action=not-a-real-action', 'audit?action=account.activated&action=professional.granted'];

      for (const path of bad) {
        const response: Response = await admin(path, owner.cookie).expect(422);

        expect((response.body as { code?: string }).code).toBe('INVALID_INPUT');
      }
    });

    it('answers the envelope and a row with exactly their declared keys', async () => {
      const page: Response = await admin('audit', owner.cookie).expect(200);
      const body = page.body as Paged<AuditLogView>;

      expect(Object.keys(body).sort()).toEqual(['offset', 'rows', 'size', 'total']);
      expect(body.rows.length).toBeGreaterThan(0);

      for (const row of body.rows) {
        expect(Object.keys(row).sort()).toEqual(['action', 'actor', 'at', 'detail', 'subject']);
      }
    });

    it('filters by action, sorts newest first, and pages without overlap', async () => {
      const a = await register(app, `audit-page-a-${stamp}@e2e.invalid`);
      const b = await register(app, `audit-page-b-${stamp}@e2e.invalid`);
      const c = await register(app, `audit-page-c-${stamp}@e2e.invalid`);

      made.push(a.cookie, b.cookie, c.cookie);

      for (const account of [a, b, c]) {
        await request(httpServer(app))
          .patch(`/${PREFIX}/admin/accounts/${account.id}/tier`)
          .set('Cookie', owner.cookie)
          .send({ tier: 'premium' })
          .expect(200);
      }

      const page = (offset: number) =>
        admin(`audit?action=account.tier_changed&size=1&offset=${offset}`, owner.cookie)
          .expect(200)
          .then(response => response.body as Paged<AuditLogView>);

      const [newest, second, third] = await Promise.all([0, 1, 2].map(page));

      expect(newest.rows.every(row => row.action === 'account.tier_changed')).toBe(true);

      // Newest first: the three accounts this test just moved to premium come
      // back in the order they were moved, most recent first, and every page
      // agrees on the same total.
      expect([newest.rows[0]?.subject, second.rows[0]?.subject, third.rows[0]?.subject]).toEqual([c.email, b.email, a.email]);
      expect(new Set([newest.total, second.total, third.total]).size).toBe(1);
    });
  });
});
