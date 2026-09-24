import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { CARE_CONSENT_VERSION, CARE_HEALTH_SHARED, CARE_SHARED } from 'core/entities/Care';
import { CareController } from 'core/controllers/Care';
import { CareLinkExistsError, InputParseError, NotFoundError, PracticeFullError } from 'core/entities/Error';
import { ProfessionalController } from 'core/controllers/Professional';
import { ProfileController } from 'core/controllers/Profile';

import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { BackgroundTaskService } from '../../../shared/services/index.js';
import { CareAnswersController } from './CareAnswers.controller.js';
import { CareClientsController } from './CareClients.controller.js';
import { CareInvitationsController } from './CareInvitations.controller.js';
import { BillingService } from '../../billing/services/index.js';
import { CareLinksController } from './CareLinks.controller.js';
import { CarePracticeController } from './CarePractice.controller.js';
import { CareService } from '../services/index.js';
import { EmailService } from '../../email/services/index.js';
import { MealSwapService, PlanJobRunner } from '../../meal-plans/index.js';
import { ENV } from '../../../config/index.js';
import { RateLimitGuard } from '../../../shared/guards/RateLimit.guard.js';

import type { CareAccessPageView, CareClientLinkView, CareClientOverviewView, CareClientsView, CareLinkView, ForClient } from 'core/controllers/Care';
import type { JobView, MealDetailView, PlanView } from 'core/controllers/Plan';
import type { PracticeOfferView } from 'core/controllers/Billing';
import type { INestApplication } from '@nestjs/common';
import type { ResolvedTargets } from 'core/domain/Nutrition';
import type { OutgoingEmail } from '../../email/services/index.js';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';
const LINK_ID = '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b';
const SESSION = { id: 'usr-session', activated: true, email: 'ana@example.invalid', emailVerified: true, name: 'Ana Dietista', role: 'user' };

const LINK: CareLinkView = {
  id: LINK_ID,
  consentVersion: CARE_CONSENT_VERSION,
  professionalName: 'Ana Dietista',
  shares: CARE_SHARED,
  sharesHealth: false,
  since: '2026-09-23T10:00:00.000Z',
  status: 'active'
};

const CLIENTS: CareClientsView = {
  clients: [
    {
      linkId: LINK_ID,
      name: 'Lucía',
      reviewBeforePublish: true,
      sharesHealth: false,
      since: '2026-09-23T10:00:00.000Z',
      stage: 'plan_under_way',
      status: 'active'
    }
  ],
  invitations: [{ email: 'nueva@example.invalid', expiresAt: '2026-10-07T10:00:00.000Z' }]
};

const OVERVIEW: CareClientOverviewView = {
  client: { linkId: LINK_ID, name: 'Lucía', reviewBeforePublish: true, sharesHealth: false, since: '2026-09-23T10:00:00.000Z', status: 'active' },
  plan: null,
  plans: [],
  progress: {
    fortnights: [],
    overall: { adherence: null, eaten: 0, marked: 0 },
    weight: {
      changeKg: null,
      entries: [],
      fortnightChangeKg: null,
      goalType: null,
      latestKg: null,
      startingWeightKg: null,
      targetWeightKg: null,
      toTargetKg: null
    }
  },
  targets: null
};

const TRAIL: CareAccessPageView = {
  entries: [
    { id: '9a8b7c6d-5e4f-4a2b-8b8e-7f4a3c2d4e1f', action: 'read', at: '2026-09-24T10:00:00.000Z', kind: 'overview', professionalName: 'Ana Dietista' }
  ],
  next: null
};

/** Lets the background task's promise chain run: the service deliberately does not await it. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await new Promise(resolve => {
      setImmediate(resolve);
    });
  }
}

/**
 * The link's routes (`0059`) through a real Nest application: which door each
 * route has, what reaches `CareController` from the session and the body, the
 * 404s and the 409, and that the invitation's token leaves only in the mail.
 */
describe('care routes', () => {
  let app: INestApplication;
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>();
  const start = jest.fn<PlanJobRunner['start']>();
  const swap = jest.fn<MealSwapService['swap']>();
  const practiceOffer = jest.fn<(user: unknown) => Promise<PracticeOfferView>>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CareAnswersController, CareClientsController, CareInvitationsController, CareLinksController, CarePracticeController],
      providers: [
        BackgroundTaskService,
        CareService,
        { provide: BillingService, useValue: { practiceOffer } },
        { provide: EmailService, useValue: { send } },
        { provide: PlanJobRunner, useValue: { start } },
        { provide: MealSwapService, useValue: { swap } },
        { provide: ENV, useValue: { APP_URL: 'https://nutria.example', RATE_LIMIT_MAX: 1000, RATE_LIMIT_TTL: 60 } },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
              context.switchToHttp().getRequest().user = SESSION;

              return true;
            }
          }
        },
        { provide: APP_GUARD, useClass: RateLimitGuard }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(PREFIX);
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use(express.json());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue(true);
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('en-GB');
    // Every client route needs a practice paid for (`0061`); its own suite below says what happens without one.
    jest
      .spyOn(ProfessionalController, 'find')
      .mockResolvedValue({ collegiateNumber: '28/1', grantedAt: '2026-09-01T00:00:00.000Z', includedClients: 30, practiceOpen: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  describe('POST /care/invitations', () => {
    it('is a 404 for an account that is not a professional, and nothing is written or sent', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
      const invite = jest.spyOn(CareController, 'invite');

      await request(server()).post(`/${PREFIX}/care/invitations`).send({ email: 'cliente@example.invalid' }).expect(404);
      await settle();

      expect(invite).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it('answers the view alone, and the token goes only into the mail, in the inviter’s language', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const invite = jest
        .spyOn(CareController, 'invite')
        .mockResolvedValue({ invitation: { email: 'cliente@example.invalid', expiresAt: '2026-10-07T10:00:00.000Z' }, token: TOKEN });

      const response = await request(server())
        .post(`/${PREFIX}/care/invitations`)
        .send({ email: ' Cliente@Example.invalid ', sharesHealth: true })
        .expect(201);

      // The body is parsed first: trimmed, lowercased, and nothing else carried.
      expect(invite).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id, email: SESSION.email }), { email: 'cliente@example.invalid' });
      expect(response.body).toEqual({ email: 'cliente@example.invalid', expiresAt: '2026-10-07T10:00:00.000Z' });
      expect(JSON.stringify(response.body)).not.toContain(TOKEN);

      await settle();

      expect(send).toHaveBeenCalledTimes(1);
      const mail = send.mock.calls[0]?.[0];

      expect(mail?.to).toBe('cliente@example.invalid');
      expect(mail?.text).toContain(`https://nutria.example/en/invitacion/${TOKEN}`);
      expect(mail?.subject).toBe('Ana Dietista has invited you to NutrIA');
    });

    it('refuses a body that is not an address as 422', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const invite = jest.spyOn(CareController, 'invite');

      await request(server()).post(`/${PREFIX}/care/invitations`).send({ email: 'no' }).expect(422);
      await request(server()).post(`/${PREFIX}/care/invitations`).send({}).expect(422);

      expect(invite).not.toHaveBeenCalled();
    });

    it('turns the professional’s own address into a 422 on the field, and sends nothing', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      jest.spyOn(CareController, 'invite').mockRejectedValue(new InputParseError('You cannot invite your own address', { email: ['own_address'] }));

      const response = await request(server()).post(`/${PREFIX}/care/invitations`).send({ email: SESSION.email }).expect(422);

      expect(response.body).toMatchObject({ code: 'INVALID_INPUT', fieldErrors: { email: ['own_address'] } });
      await settle();
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('while the switch is off', () => {
    beforeEach(() => {
      jest.spyOn(ProfessionalController, 'isOpen').mockResolvedValue(false);
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
    });

    it('answers every invitation route 404 before any pipe reads the body or the path', async () => {
      const calls = [
        jest.spyOn(CareController, 'invitation'),
        jest.spyOn(CareController, 'accept'),
        jest.spyOn(CareController, 'decline'),
        jest.spyOn(CareController, 'invite')
      ];

      const responses = [
        await request(server()).get(`/${PREFIX}/care/invitations/x`).expect(404),
        // A body the pipe would refuse with 422 while the switch is on.
        await request(server()).post(`/${PREFIX}/care/invitations/x/accept`).send({}).expect(404),
        await request(server()).post(`/${PREFIX}/care/invitations/x/decline`).expect(404),
        await request(server()).post(`/${PREFIX}/care/invitations`).send({}).expect(404)
      ];

      for (const response of responses) {
        expect(response.body).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
      }

      for (const call of calls) {
        expect(call).not.toHaveBeenCalled();
      }
    });

    it('answers the professional’s reading routes 404, whatever the path, and reads nothing', async () => {
      const calls = [jest.spyOn(CareController, 'clients'), jest.spyOn(CareController, 'overview'), jest.spyOn(CareController, 'setTargets')];

      const responses = [
        await request(server()).get(`/${PREFIX}/care/clients`).expect(404),
        await request(server()).get(`/${PREFIX}/care/clients/${LINK_ID}`).expect(404),
        await request(server()).get(`/${PREFIX}/care/clients/not-a-link`).expect(404),
        await request(server()).patch(`/${PREFIX}/care/clients/${LINK_ID}/targets`).send({ kcal: 1750 }).expect(404)
      ];

      for (const response of responses) {
        expect(response.body).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
      }

      for (const call of calls) {
        expect(call).not.toHaveBeenCalled();
      }
    });

    it('still shows the client their own trail — what was read about them stays theirs', async () => {
      const accessLog = jest.spyOn(CareController, 'accessLog').mockResolvedValue(TRAIL);

      expect((await request(server()).get(`/${PREFIX}/care/access-log`).expect(200)).body).toEqual(TRAIL);
      expect(accessLog).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), null);
    });

    it('still shows the client their own link — consent stays visible', async () => {
      jest.spyOn(CareController, 'myLink').mockResolvedValue(LINK);

      expect((await request(server()).get(`/${PREFIX}/care/links/me`).expect(200)).body).toEqual(LINK);
    });

    it('still lets the client end their link, and answers a path that is not a link id with 404, not 400', async () => {
      await request(server()).delete(`/${PREFIX}/care/links/not-a-uuid`).expect(404);

      const end = jest.spyOn(CareController, 'end').mockResolvedValue(undefined);

      await request(server()).delete(`/${PREFIX}/care/links/${LINK_ID}`).expect(204);
      expect(end).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), LINK_ID);
    });
  });

  describe('the professional reading their clients', () => {
    it('is a 404 for an account that is not a professional, and nothing is read', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
      const calls = [jest.spyOn(CareController, 'clients'), jest.spyOn(CareController, 'overview')];

      await request(server()).get(`/${PREFIX}/care/clients`).expect(404);
      await request(server()).get(`/${PREFIX}/care/clients/${LINK_ID}`).expect(404);

      for (const call of calls) {
        expect(call).not.toHaveBeenCalled();
      }
    });

    it('lists the session’s own clients', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const clients = jest.spyOn(CareController, 'clients').mockResolvedValue(CLIENTS);

      expect((await request(server()).get(`/${PREFIX}/care/clients`).expect(200)).body).toEqual(CLIENTS);
      expect(clients).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }));
    });

    it('reads one client by the link id in the path, for the session, in the reader’s language', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const overview = jest.spyOn(CareController, 'overview').mockResolvedValue(OVERVIEW);

      const response = await request(server()).get(`/${PREFIX}/care/clients/${LINK_ID}`).set('Accept-Language', 'en-GB').expect(200);

      expect(overview).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), LINK_ID, 'en-GB');
      expect(response.body).toEqual(OVERVIEW);
      expect(response.body).not.toHaveProperty('health');
    });

    it('answers a path that is not a link id with the same 404 as a link that is not the caller’s — never a 400', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);

      const notALink = await request(server()).get(`/${PREFIX}/care/clients/not-a-link`).expect(404);

      jest.spyOn(CareController, 'overview').mockRejectedValue(new NotFoundError('Client not found'));
      const notTheirs = await request(server()).get(`/${PREFIX}/care/clients/${LINK_ID}`).expect(404);

      expect(notALink.body).toEqual({ code: 'NOT_FOUND', message: 'Client not found', statusCode: 404 });
      expect(notTheirs.body).toEqual(notALink.body);
    });
  });

  describe('the professional setting a client’s targets', () => {
    const TARGETS = { overrideStatus: 'applied', setBy: { kind: 'professional', name: 'Ana Dietista' } } as unknown as ResolvedTargets;

    it('is a 404 for an account that is not a professional, before the body is read, and nothing is written', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
      const setTargets = jest.spyOn(CareController, 'setTargets');

      // A body the pipe would refuse with 422 for a professional.
      const refused = await request(server()).patch(`/${PREFIX}/care/clients/${LINK_ID}/targets`).send({ kcal: 'many' }).expect(404);

      expect(refused.body).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
      expect(setTargets).not.toHaveBeenCalled();
    });

    it('sets them by the link id in the path, for the session, with the body as validated', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const setTargets = jest.spyOn(CareController, 'setTargets').mockResolvedValue(TARGETS);

      const response = await request(server()).patch(`/${PREFIX}/care/clients/${LINK_ID}/targets`).send({ kcal: 1750, proteinG: null }).expect(200);

      expect(setTargets).toHaveBeenCalledTimes(1);
      expect(setTargets).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), LINK_ID, { kcal: 1750, proteinG: null });
      expect(response.body).toEqual(TARGETS);
    });

    it('refuses a body the client’s own route refuses, as 422, without reaching core', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const setTargets = jest.spyOn(CareController, 'setTargets');

      await request(server()).patch(`/${PREFIX}/care/clients/${LINK_ID}/targets`).send({ kcal: 100 }).expect(422);
      expect(setTargets).not.toHaveBeenCalled();
    });

    it('answers an out-of-bounds target with core’s refusal — the same code and field errors as the client’s own', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      jest
        .spyOn(CareController, 'setTargets')
        .mockRejectedValue(new InputParseError('Targets out of bounds', { targets: ['El mínimo para tu perfil son 1300 kcal.'] }));

      const refused = await request(server()).patch(`/${PREFIX}/care/clients/${LINK_ID}/targets`).send({ kcal: 600 }).expect(422);

      expect(refused.body).toMatchObject({ code: 'INVALID_INPUT', fieldErrors: { targets: ['El mínimo para tu perfil son 1300 kcal.'] } });
    });

    it('answers a path that is not a link id, and a link that is not the caller’s, with the same 404', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);

      const notALink = await request(server()).patch(`/${PREFIX}/care/clients/not-a-link/targets`).send({ kcal: 1750 }).expect(404);

      jest.spyOn(CareController, 'setTargets').mockRejectedValue(new NotFoundError('Client not found'));
      const notTheirs = await request(server()).patch(`/${PREFIX}/care/clients/${LINK_ID}/targets`).send({ kcal: 1750 }).expect(404);

      expect(notALink.body).toEqual({ code: 'NOT_FOUND', message: 'Client not found', statusCode: 404 });
      expect(notTheirs.body).toEqual(notALink.body);
    });
  });

  describe('the professional reviewing a client’s plan (0060)', () => {
    const MEAL_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
    const JOB_ID = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a';
    const JOB: JobView = { id: JOB_ID, error: null, errorDetail: null, pendingReview: false, planId: null, status: 'queued', step: null };
    const PLAN = { id: 'plan-1', days: [], endDate: '2026-10-07', startDate: '2026-09-24', status: 'active', strategy: null, version: 2 } as PlanView;
    const REVIEWED: CareClientLinkView = { ...OVERVIEW.client, reviewBeforePublish: false };
    const record = jest.fn<Parameters<ForClient<unknown>>[1]>();

    beforeEach(() => {
      start.mockReset();
      swap.mockReset();
    });

    it('is a 404 on every review route for an account that is not a professional, before any body, and nothing is reached', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
      const calls = [
        jest.spyOn(CareController, 'pendingPlan'),
        jest.spyOn(CareController, 'generatePlan'),
        jest.spyOn(CareController, 'planJob'),
        jest.spyOn(CareController, 'swapPendingMeal'),
        jest.spyOn(CareController, 'publishPlan'),
        jest.spyOn(CareController, 'setReview')
      ];

      const responses = [
        await request(server()).get(`/${PREFIX}/care/clients/${LINK_ID}/plan/pending`).expect(404),
        await request(server()).post(`/${PREFIX}/care/clients/${LINK_ID}/plan/generate`).expect(404),
        await request(server()).get(`/${PREFIX}/care/clients/${LINK_ID}/plan/jobs/${JOB_ID}`).expect(404),
        await request(server()).post(`/${PREFIX}/care/clients/${LINK_ID}/plan/meals/${MEAL_ID}/swap`).send({ axis: 'sideways' }).expect(404),
        await request(server()).post(`/${PREFIX}/care/clients/${LINK_ID}/plan/publish`).expect(404),
        await request(server()).patch(`/${PREFIX}/care/clients/${LINK_ID}`).send({ reviewBeforePublish: 'yes' }).expect(404)
      ];

      for (const response of responses) {
        expect(response.body).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
      }

      for (const call of [...calls, start, swap]) {
        expect(call).not.toHaveBeenCalled();
      }
    });

    it('reads the pending plan by the link id, for the session, in the reader’s language — null when there is none', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const pendingPlan = jest.spyOn(CareController, 'pendingPlan').mockResolvedValue(null);

      const response = await request(server()).get(`/${PREFIX}/care/clients/${LINK_ID}/plan/pending`).set('Accept-Language', 'en-GB').expect(200);

      expect(pendingPlan).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), LINK_ID, 'en-GB');
      // A null answer is an empty 200, as `GET /meal-plans/active` answers one.
      expect(response.text).toBe('');
    });

    it('generates through core, which hands the runner the client’s id and the write’s record — never the route', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      start.mockResolvedValue(JOB);
      const generatePlan = jest
        .spyOn(CareController, 'generatePlan')
        .mockImplementation(async (_professional, _link, starter: ForClient<JobView>) => starter('usr-client', record));

      expect((await request(server()).post(`/${PREFIX}/care/clients/${LINK_ID}/plan/generate`).expect(201)).body).toEqual(JOB);
      expect(generatePlan).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), LINK_ID, expect.any(Function));
      expect(start).toHaveBeenCalledWith('usr-client', record);
    });

    it('follows a job of the client by its id', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const planJob = jest.spyOn(CareController, 'planJob').mockResolvedValue({ ...JOB, pendingReview: true, planId: 'plan-2', status: 'succeeded' });

      const response = await request(server()).get(`/${PREFIX}/care/clients/${LINK_ID}/plan/jobs/${JOB_ID}`).expect(200);

      expect(planJob).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), LINK_ID, JOB_ID);
      expect(response.body).toMatchObject({ pendingReview: true, planId: 'plan-2' });
    });

    it('swaps a meal through core with the client’s own body, and the swap service gets the review’s record', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const detail = { id: MEAL_ID, planStatus: 'pending_review' } as MealDetailView;
      swap.mockResolvedValue(detail);
      const swapPendingMeal = jest
        .spyOn(CareController, 'swapPendingMeal')
        .mockImplementation(async (_professional, _link, _meal, swapper: ForClient<MealDetailView>) => swapper('usr-client', record));

      const response = await request(server())
        .post(`/${PREFIX}/care/clients/${LINK_ID}/plan/meals/${MEAL_ID}/swap`)
        .set('Accept-Language', 'en-GB')
        .send({ axis: 'quicker' })
        .expect(201);

      expect(response.body).toEqual(detail);
      expect(swapPendingMeal).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), LINK_ID, MEAL_ID, expect.any(Function));
      expect(swap).toHaveBeenCalledWith('usr-client', MEAL_ID, 'en-GB', 'quicker', { record });
    });

    it('refuses a swap body the client’s own route refuses, as 422, without reaching core', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const swapPendingMeal = jest.spyOn(CareController, 'swapPendingMeal');

      await request(server()).post(`/${PREFIX}/care/clients/${LINK_ID}/plan/meals/${MEAL_ID}/swap`).send({ axis: 'sideways' }).expect(422);
      expect(swapPendingMeal).not.toHaveBeenCalled();
    });

    it('publishes with 200 and the plan now active, and answers “nothing pending” with the same 404', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const publishPlan = jest.spyOn(CareController, 'publishPlan').mockResolvedValue(PLAN);

      expect((await request(server()).post(`/${PREFIX}/care/clients/${LINK_ID}/plan/publish`).expect(200)).body).toEqual(PLAN);
      expect(publishPlan).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), LINK_ID, null);

      publishPlan.mockRejectedValue(new NotFoundError('Plan not found'));
      expect((await request(server()).post(`/${PREFIX}/care/clients/${LINK_ID}/plan/publish`).expect(404)).body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('turns review off by the link id with the body as validated, and refuses any other body as 422', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const setReview = jest.spyOn(CareController, 'setReview').mockResolvedValue(REVIEWED);

      expect((await request(server()).patch(`/${PREFIX}/care/clients/${LINK_ID}`).send({ reviewBeforePublish: false }).expect(200)).body).toEqual(
        REVIEWED
      );
      expect(setReview).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), LINK_ID, { reviewBeforePublish: false });

      setReview.mockClear();
      await request(server()).patch(`/${PREFIX}/care/clients/${LINK_ID}`).send({ reviewBeforePublish: 'no' }).expect(422);
      expect(setReview).not.toHaveBeenCalled();
    });

    it('answers a path that is not a link id with the same 404 as every other denial', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);

      const response = await request(server()).post(`/${PREFIX}/care/clients/not-a-link/plan/publish`).expect(404);

      expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Client not found', statusCode: 404 });
    });
  });

  describe('the client’s routes', () => {
    beforeEach(() => {
      jest.spyOn(ProfessionalController, 'isOpen').mockResolvedValue(true);
    });

    it('are not behind the professional’s door, and a link is not behind the switch either', async () => {
      const hasAccess = jest.spyOn(ProfessionalController, 'hasAccess');
      const isOpen = jest.spyOn(ProfessionalController, 'isOpen');

      jest.spyOn(CareController, 'myLink').mockResolvedValue(null);
      await request(server()).get(`/${PREFIX}/care/links/me`).expect(200);

      expect(hasAccess).not.toHaveBeenCalled();
      expect(isOpen).not.toHaveBeenCalled();
    });

    it('read an invitation for the session, by the token in the path', async () => {
      const invitation = jest
        .spyOn(CareController, 'invitation')
        .mockResolvedValue({
          consentVersion: CARE_CONSENT_VERSION,
          expiresAt: '2026-10-07T10:00:00.000Z',
          healthShares: CARE_HEALTH_SHARED,
          professionalName: 'Ana Dietista',
          shares: CARE_SHARED
        });

      const response = await request(server()).get(`/${PREFIX}/care/invitations/${TOKEN}`).expect(200);

      expect(invitation).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id, email: SESSION.email, emailVerified: true }), TOKEN);
      expect(response.body).toMatchObject({ consentVersion: CARE_CONSENT_VERSION, professionalName: 'Ana Dietista' });
    });

    it('answer every invitation that cannot be answered with the same 404', async () => {
      jest.spyOn(CareController, 'invitation').mockRejectedValue(new NotFoundError('Invitation not found'));
      jest.spyOn(CareController, 'accept').mockRejectedValue(new NotFoundError('Invitation not found'));
      jest.spyOn(CareController, 'decline').mockRejectedValue(new NotFoundError('Invitation not found'));

      const read = await request(server()).get(`/${PREFIX}/care/invitations/${TOKEN}`).expect(404);
      const accepted = await request(server())
        .post(`/${PREFIX}/care/invitations/${TOKEN}/accept`)
        .send({ consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })
        .expect(404);
      const declined = await request(server()).post(`/${PREFIX}/care/invitations/${TOKEN}/decline`).expect(404);

      for (const response of [read, accepted, declined]) {
        expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Invitation not found', statusCode: 404 });
      }
    });

    it('accept only the current consent version, with an explicit health answer', async () => {
      const accept = jest.spyOn(CareController, 'accept').mockResolvedValue(LINK);

      await request(server()).post(`/${PREFIX}/care/invitations/${TOKEN}/accept`).send({ consentVersion: '0.0.1', sharesHealth: false }).expect(422);
      await request(server()).post(`/${PREFIX}/care/invitations/${TOKEN}/accept`).send({ consentVersion: CARE_CONSENT_VERSION }).expect(422);
      expect(accept).not.toHaveBeenCalled();

      const response = await request(server())
        .post(`/${PREFIX}/care/invitations/${TOKEN}/accept`)
        .send({ clientId: 'usr-other', consentVersion: CARE_CONSENT_VERSION, sharesHealth: true })
        .expect(200);

      expect(accept).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), TOKEN, {
        consentVersion: CARE_CONSENT_VERSION,
        sharesHealth: true
      });
      expect(response.body).toEqual(LINK);
    });

    it('name the link in the way as a 409 the screen can act on', async () => {
      jest
        .spyOn(CareController, 'accept')
        .mockRejectedValue(new CareLinkExistsError({ professionalName: 'Otra Dietista', since: '2026-09-01T10:00:00.000Z', status: 'active' }));

      const response = await request(server())
        .post(`/${PREFIX}/care/invitations/${TOKEN}/accept`)
        .send({ consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })
        .expect(409);

      expect(response.body).toMatchObject({
        code: 'CARE_LINK_EXISTS',
        link: { professionalName: 'Otra Dietista', since: '2026-09-01T10:00:00.000Z', status: 'active' }
      });
    });

    it('decline with no content', async () => {
      const decline = jest.spyOn(CareController, 'decline').mockResolvedValue(undefined);

      await request(server()).post(`/${PREFIX}/care/invitations/${TOKEN}/decline`).expect(204);
      expect(decline).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), TOKEN);
    });

    it('answer the client’s own link, or null', async () => {
      jest.spyOn(CareController, 'myLink').mockResolvedValueOnce(LINK).mockResolvedValueOnce(null);

      expect((await request(server()).get(`/${PREFIX}/care/links/me`).expect(200)).body).toEqual(LINK);
      await request(server()).get(`/${PREFIX}/care/links/me`).expect(200);
    });

    it('end a link by its id, for the session, and answer an id that is not one with the same 404', async () => {
      const notALink = await request(server()).delete(`/${PREFIX}/care/links/not-a-link`).expect(404);

      expect(notALink.body).toEqual({ code: 'NOT_FOUND', message: 'Link not found', statusCode: 404 });

      const end = jest.spyOn(CareController, 'end').mockResolvedValue(undefined);

      await request(server()).delete(`/${PREFIX}/care/links/${LINK_ID}`).expect(204);
      expect(end).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), LINK_ID);

      end.mockRejectedValue(new NotFoundError('Link not found'));
      await request(server()).delete(`/${PREFIX}/care/links/${LINK_ID}`).expect(404);
    });
  });

  /* `0061`: the practice is paid for through the signed webhook, and the workspace shows the way to pay. */
  describe('a practice', () => {
    const OFFER: PracticeOfferView = { available: true, plans: [], subscription: null, testMode: false, trialDays: 14 };

    function lapsed(): void {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      jest
        .spyOn(ProfessionalController, 'find')
        .mockResolvedValue({ collegiateNumber: '28/1', grantedAt: '2026-09-01T00:00:00.000Z', includedClients: 30, practiceOpen: false });
    }

    it('opens the workspace’s own page to a professional whose practice is not paid for, with the way to pay', async () => {
      lapsed();
      practiceOffer.mockResolvedValue(OFFER);
      const practice = jest
        .spyOn(CareController, 'practice')
        .mockResolvedValue({ activeClients: 0, includedClients: 30, open: false, pendingInvitations: 0 });

      const response = await request(server()).get(`/${PREFIX}/care/practice`).expect(200);

      expect(practice).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }));
      expect(response.body).toEqual({ activeClients: 0, billing: OFFER, includedClients: 30, open: false, pendingInvitations: 0 });
    });

    it('keeps that page shut to an account that is not a professional', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);

      await request(server()).get(`/${PREFIX}/care/practice`).expect(404);
    });

    it.each([
      ['get', '/care/clients'],
      ['get', `/care/clients/${LINK_ID}`],
      ['post', '/care/invitations']
    ] as const)('closes %s %s while the practice is not paid for, with the same 404', async (method, path) => {
      lapsed();
      const clients = jest.spyOn(CareController, 'clients');
      const invite = jest.spyOn(CareController, 'invite');

      await request(server())[method](`/${PREFIX}${path}`).send({ email: 'cliente@example.invalid' }).expect(404);
      expect(clients).not.toHaveBeenCalled();
      expect(invite).not.toHaveBeenCalled();
    });

    it('answers a full practice with 409 PRACTICE_FULL, the number, and the ways up — and sends no mail', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      jest.spyOn(CareController, 'invite').mockRejectedValue(new PracticeFullError(30));

      const response = await request(server()).post(`/${PREFIX}/care/invitations`).send({ email: 'n31@example.invalid' }).expect(409);
      await settle();

      expect(response.body).toEqual({
        code: 'PRACTICE_FULL',
        message: 'Tu consulta ya tiene todos los pacientes que incluye tu plan.',
        practice: { includedClients: 30, waysUp: ['larger_plan', 'end_link'] },
        statusCode: 409
      });
      expect(send).not.toHaveBeenCalled();
    });

    it('takes no number from a body: an invitation body carrying one is read for its address alone', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const invite = jest
        .spyOn(CareController, 'invite')
        .mockResolvedValue({ invitation: { email: 'cliente@example.invalid', expiresAt: '2026-10-07T10:00:00.000Z' }, token: TOKEN });

      await request(server())
        .post(`/${PREFIX}/care/invitations`)
        .send({ email: 'cliente@example.invalid', includedClients: 999, practiceOpen: true })
        .expect(201);
      expect(invite).toHaveBeenCalledWith(expect.anything(), { email: 'cliente@example.invalid' });
    });
  });
});
