import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { NotificationController } from 'core/controllers/Notification';

import { completeOnboarding, createApp, deleteAccounts, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { PlanView } from 'core/controllers/Plan';
import type { Recipient } from 'core/controllers/Notification';
import type { Response } from 'supertest';

/**
 * Who the check-in reminder goes to, asserted against the real query (`0027`,
 * `0054`). The unit spec fakes the list of recipients; this is where the SQL
 * that builds it runs — the conditions that keep a reminder from reaching
 * someone who would resent it, and the one that keeps it to once a fortnight.
 *
 * The sweep is asked about a day, so nothing here moves a plan's dates: it is
 * asked about the plan's last day, which is when the check-in comes due.
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */

const PHONE = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/reminders-e2e',
  keys: { auth: 'tBHItJI5svbpez7KI4CCXg', p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM' }
};
const DAY_MS = 24 * 60 * 60 * 1000;

function dayBefore(day: string): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() - DAY_MS).toISOString().slice(0, 10);
}

describe('the check-in reminder', () => {
  let app: INestApplication;
  let account: Account;
  let closes: string;

  async function dueOn(day: string): Promise<Recipient | undefined> {
    return (await NotificationController.checkInDue(day, 1000)).find(recipient => recipient.userId === account.id);
  }

  async function due(): Promise<Recipient | undefined> {
    return dueOn(closes);
  }

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));
    account = await register(app, `reminders-${Date.now()}@example.invalid`);
    await completeOnboarding(app, account);

    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');

    const plan: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);

    closes = (plan.body as PlanView).endDate;
  }, 120_000);

  afterAll(async () => {
    if (account) {
      await deleteAccounts(app, [account.cookie]);
    }

    await app.close();
  });

  it('finds nobody before the fortnight has closed', async () => {
    expect(await dueOn(dayBefore(closes))).toBeUndefined();
  });

  it('finds them on its last day, wanting the mail and with no phone yet', async () => {
    expect(await due()).toMatchObject({ pushTargets: [], wantsEmail: true });
  });

  it('offers no key while push is not set up', async () => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/notifications/push`).set('Cookie', account.cookie).expect(200);

    expect(response.body).toEqual({ publicKey: null });
  });

  /* The server later POSTs to what is stored: anything but a push service would let a caller aim it. */
  it('refuses a subscription on anything but a push service browsers use', async () => {
    await request(httpServer(app))
      .put(`/${PREFIX}/notifications/push`)
      .set('Cookie', account.cookie)
      .send({ ...PHONE, endpoint: 'https://169.254.169.254/latest/meta-data' })
      .expect(422);
  });

  it('tells nobody who wants neither the mail nor a phone, and finds them again for the phone they subscribe', async () => {
    const server = httpServer(app);

    await request(server).patch(`/${PREFIX}/notifications/settings`).set('Cookie', account.cookie).send({ checkInEmail: false }).expect(200);
    expect(await due()).toBeUndefined();

    await request(server).put(`/${PREFIX}/notifications/push`).set('Cookie', account.cookie).send(PHONE).expect(204);
    expect(await due()).toMatchObject({
      pushTargets: [{ auth: PHONE.keys.auth, endpoint: PHONE.endpoint, p256dh: PHONE.keys.p256dh }],
      wantsEmail: false
    });
  });

  it('forgets a browser that unsubscribes', async () => {
    await request(httpServer(app))
      .delete(`/${PREFIX}/notifications/push`)
      .set('Cookie', account.cookie)
      .send({ endpoint: PHONE.endpoint })
      .expect(204);

    // The mail is still off, and now there is no phone either: nowhere left to tell them.
    expect(await due()).toBeUndefined();
  });

  it('tells nobody twice: once a reminder is recorded, on any channel, they are not due again this fortnight', async () => {
    await request(httpServer(app)).patch(`/${PREFIX}/notifications/settings`).set('Cookie', account.cookie).send({ checkInEmail: true }).expect(200);
    expect(await due()).toBeDefined();

    await NotificationController.recordCheckInReminder(account.id, 'Tu quincena ha terminado', 'Dos minutos de check-in.', 'push');

    expect(await due()).toBeUndefined();
  });
});
