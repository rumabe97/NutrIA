import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import {
  acceptAgreement,
  completeOnboarding,
  createApp,
  deleteAccounts,
  generateAndWait,
  httpServer,
  openPractice,
  planRow,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient,
  shiftPlansBack
} from './harness.js';
import { EmailService } from '../src/modules/email/services/index.js';

import type { Account } from './harness.js';
import type { AllowancesView, PlanView } from 'core/controllers/Plan';
import type { CareLinkView } from 'core/controllers/Care';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * A professional's plan for a client who has a plan waiting for its day (project 015).
 *
 * The client runs a plan and has the next one scheduled. They ask for their next
 * plan, which their professional (review before publishing, the default) publishes:
 *
 * - asking is not refused for the client's allowance, which is unspent;
 * - publishing deletes the scheduled plan, charges the client no redo, and leaves
 *   the published plan active through the day the scheduled one would have started.
 *
 * The owner's decision, 2026-10: the professional's plan wins, and costs the client nothing.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
describe('a professional publishes over a scheduled plan', () => {
  let app: INestApplication;
  let owner: Account;
  let professional: Account;
  let client: Account;
  let linkId: string;
  const made: string[] = [];
  const sent: OutgoingEmail[] = [];
  const stamp = Date.now();

  const server = (): ReturnType<typeof httpServer> => httpServer(app);
  const redo = async (who: Account): Promise<AllowancesView['planRedo']> =>
    ((await request(server()).get(`/${PREFIX}/meal-plans/allowances`).set('Cookie', who.cookie).expect(200)).body as AllowancesView).planRedo;

  async function make(name: string): Promise<Account> {
    const created = await register(app, `scheduled-care-${name}-${stamp}@e2e.invalid`);

    made.push(created.cookie);

    return created;
  }

  /** The token in the newest invitation mail to `to`, waiting for the background task that sends it. */
  async function tokenMailedTo(to: string): Promise<string> {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const token = sent
        .filter(message => message.to === to.toLowerCase())
        .at(-1)
        ?.text.match(/\/invitacion\/([A-Za-z0-9_-]{43})/)?.[1];

      if (token) {
        return token;
      }

      await new Promise(resolve => {
        setTimeout(resolve, 50);
      });
    }

    throw new Error('No invitation mail arrived');
  }

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));
    jest.spyOn(EmailService.prototype, 'send').mockImplementation(async message => {
      sent.push(message);

      return true;
    });

    owner = await make('owner');
    professional = await make('pro');
    client = await make('client');
    await UserController.grantAdmin(owner.email);
    await SettingsController.setFlag('professional', true, UNAUDITED);
    await request(server())
      .post(`/${PREFIX}/admin/accounts/${professional.id}/professional`)
      .set('Cookie', owner.cookie)
      .send({ collegiateNumber: `28/${String(stamp).slice(-6)}` })
      .expect(201);
    await acceptAgreement(app, professional);
    await openPractice(professional.id);
    await completeOnboarding(app, client);

    // The client's running plan, eight days in, and the next one scheduled for the day after it.
    expect((await generateAndWait(app, client, 120_000)).status).toBe('succeeded');

    const first = (await request(server()).get(`/${PREFIX}/meal-plans/active`).set('Cookie', client.cookie).expect(200)).body as PlanView;

    await shiftPlansBack(client.id, 8);
    await request(server())
      .post(`/${PREFIX}/meal-plans/generate`)
      .set('Cookie', client.cookie)
      .send({ startDate: new Date(Date.parse(`${first.startDate}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10) })
      .expect(201);

    for (let waited = 0; waited < 120_000; waited += 250) {
      await new Promise(resolve => setTimeout(resolve, 250));

      if ((await request(server()).get(`/${PREFIX}/meal-plans/scheduled`).set('Cookie', client.cookie)).status === 200) {
        break;
      }
    }

    const before = sent.length;

    await request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', professional.cookie).send({ email: client.email }).expect(201);

    const accepted: Response = await request(server())
      .post(`/${PREFIX}/care/invitations/${await tokenMailedTo(client.email)}/accept`)
      .set('Cookie', client.cookie)
      .send({ consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })
      .expect(200);

    expect(sent.length).toBeGreaterThan(before);
    linkId = (accepted.body as CareLinkView).id;
  }, 300_000);

  afterAll(async () => {
    try {
      await SettingsController.setFlag('professional', false, UNAUDITED);
      await deleteAccounts(app, made);
    } finally {
      jest.restoreAllMocks();
      await app?.close();
    }
  });

  it('is not refused for the client’s allowance, and publishing deletes the scheduled plan without charging a redo', async () => {
    const scheduled = (await request(server()).get(`/${PREFIX}/meal-plans/scheduled`).set('Cookie', client.cookie).expect(200)).body as PlanView;
    const running = (await request(server()).get(`/${PREFIX}/meal-plans/active`).set('Cookie', client.cookie).expect(200)).body as PlanView;
    const path = (rest: string): string => `/${PREFIX}/care/clients/${linkId}${rest}`;

    expect(await redo(client)).toMatchObject({ allowed: true, used: 0 });

    /*
     * With the link's review on, the client's own request for a plan is the one the
     * professional publishes (the professional's direct generation is for a client
     * with no plan under way). It is not refused: the redo is unspent.
     */
    const asked = await generateAndWait(app, client, 120_000);

    expect(asked).toMatchObject({ planId: null, status: 'succeeded' });

    const spentByGenerating = (await redo(client)).used;
    const published: Response = await request(server()).post(path('/plan/publish')).set('Cookie', professional.cookie).expect(200);
    const plan = published.body as PlanView;

    expect(plan.status).toBe('active');
    expect(plan.id).not.toBe(running.id);
    expect(plan.id).not.toBe(scheduled.id);

    // The scheduled plan is gone, and publishing charged nothing.
    expect(await planRow(scheduled.id)).toBeNull();
    await request(server()).get(`/${PREFIX}/meal-plans/scheduled`).set('Cookie', client.cookie).expect(404);
    expect((await redo(client)).used).toBe(spentByGenerating);

    // The published plan stays active through the day the scheduled one would have started.
    await shiftPlansBack(client.id, 6);

    const stillActive = (await request(server()).get(`/${PREFIX}/meal-plans/active`).set('Cookie', client.cookie).expect(200)).body as PlanView;

    expect(stillActive.id).toBe(plan.id);
    expect(stillActive.status).toBe('active');
  }, 300_000);
});
