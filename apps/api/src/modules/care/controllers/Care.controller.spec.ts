import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { CARE_CONSENT_VERSION, CARE_HEALTH_SHARED, CARE_SHARED } from 'core/entities/Care';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';
import { CareController } from 'core/controllers/Care';
import {
  CareIllnessRuleError,
  CareLinkExistsError,
  ConflictError,
  InputParseError,
  NotFoundError,
  PracticeFullError,
  ProfileConsentRequiredError,
  QuotaExceededError
} from 'core/entities/Error';
import { ProfessionalBadgeController, ProfessionalController, ProfessionalProfileController } from 'core/controllers/Professional';
import { ProfileController } from 'core/controllers/Profile';
import { UserController } from 'core/controllers/User';

import { ALLOW_UNVERIFIED_KEY } from '../../../shared/decorators/AllowUnverified.decorator.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { BackgroundTaskService } from '../../../shared/services/index.js';
import { CareAnswersController } from './CareAnswers.controller.js';
import { CareClientsController } from './CareClients.controller.js';
import { CareInvitationsController } from './CareInvitations.controller.js';
import { BillingService } from '../../billing/services/index.js';
import { CareLinksController } from './CareLinks.controller.js';
import { CareOpenPracticeController } from './CareOpenPractice.controller.js';
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
const SESSION = {
  id: 'usr-session',
  activated: true,
  email: 'ana@example.invalid',
  emailVerified: true,
  name: 'Ana Dietista',
  role: 'user',
  twoFactorEnabled: true
};

const LINK: CareLinkView = {
  id: LINK_ID,
  consentIsCurrent: true,
  consentScope: 'full',
  consentVersion: CARE_CONSENT_VERSION,
  professionalName: 'Ana Dietista',
  professionalVerified: true,
  reconsentOffered: false,
  scope: 'full',
  shares: CARE_SHARED,
  sharesHealth: false,
  sharesPlan: [],
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
    {
      id: '9a8b7c6d-5e4f-4a2b-8b8e-7f4a3c2d4e1f',
      action: 'read',
      at: '2026-09-24T10:00:00.000Z',
      kind: 'overview',
      linkId: LINK_ID,
      professionalName: 'Ana Dietista'
    }
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
      controllers: [
        CareAnswersController,
        CareClientsController,
        CareInvitationsController,
        CareLinksController,
        CareOpenPracticeController,
        CarePracticeController
      ],
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
    // Every client route needs a practice paid for (`0061`) and the agreement accepted; their own suites below say what happens without.
    jest
      .spyOn(ProfessionalController, 'find')
      .mockResolvedValue({
        agreementRequired: false,
        collegiateNumber: '28/1',
        grantedAt: '2026-09-01T00:00:00.000Z',
        includedClients: 30,
        practiceOpen: true,
        restricted: false,
        restriction: null
      });
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
        .mockResolvedValue({
          invitation: { email: 'cliente@example.invalid', expiresAt: '2026-10-07T10:00:00.000Z' },
          inviterName: 'Ana Pérez',
          token: TOKEN
        });

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
      expect(mail?.subject).toBe('Ana Pérez has invited you to NutrIA');
      // RGPD art. 14 (`docs/legal/textos/06` § A): who gave the address, and where the rights are, in the inviter's language.
      expect(mail?.text).toContain('We are writing because Ana Pérez gave us your address');
      expect(mail?.text).toContain('https://nutria.example/en/privacidad');
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

    it('still lets the client stop sharing the health line — consent stays theirs to take back', async () => {
      const setSharesHealth = jest.spyOn(CareController, 'setSharesHealth').mockResolvedValue(LINK);

      expect((await request(server()).patch(`/${PREFIX}/care/links/me`).send({ sharesHealth: false }).expect(200)).body).toEqual(LINK);
      expect(setSharesHealth).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), { sharesHealth: false });
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
    const PLAN = {
      id: 'plan-1',
      days: [],
      endDate: '2026-10-07',
      pantry: null,
      startDate: '2026-09-24',
      status: 'active',
      strategy: null,
      version: 2
    } as PlanView;
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

  /*
   * Project 025 phase 4, step 6 (PRD 025 criterion 13, `0013` § 5.3): every
   * refusal a practitioner can receive from generate, swap or publish names no
   * allergen, intolerance or condition of the client. One case per refusal the
   * runner, the swap service and core raise on those routes, each with the
   * error exactly as its source throws it, through the real filter: the answer
   * is a code and a fixed sentence, and nothing of the client is in it.
   */
  describe('under a `plan` scope, every refusal of generate, swap and publish names nothing of the client (project 025)', () => {
    const MEAL_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
    const record = jest.fn<Parameters<ForClient<unknown>>[1]>();
    /** What a client may have declared, any word of which in an answer would be a leak. */
    const DECLARED = /cacahuete|gluten|lactosa|marisco|celiac|celíac|diabet|embaraz|metformina|allerg|alerg|intoler|condition|condici/i;

    function assertNamesNothing(body: unknown): void {
      expect(Object.keys(body as object).sort()).toEqual(expect.arrayContaining(['code', 'message', 'statusCode']));
      expect(JSON.stringify(body)).not.toMatch(DECLARED);
    }

    beforeEach(() => {
      start.mockReset();
      swap.mockReset();
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      // One case per refusal is more calls than the routes' hourly limit: the limit is its own suite's.
      jest.spyOn(RateLimitGuard.prototype, 'canActivate').mockReturnValue(true);
    });

    it.each([
      ['a fortnight under way, or a link not open to them', new NotFoundError('Client not found'), 404],
      ['a generation already running', new ConflictError('A plan is already being generated'), 409],
      ['the client’s redo spent', new QuotaExceededError('plan_redo'), 429],
      ['the client’s profile consent not given', new ProfileConsentRequiredError(), undefined]
    ])('generate: %s', async (_case, error, status) => {
      start.mockRejectedValue(error);
      jest
        .spyOn(CareController, 'generatePlan')
        .mockImplementation(async (_professional, _link, starter: ForClient<JobView>) => starter('usr-client', record));

      const response = await request(server()).post(`/${PREFIX}/care/clients/${LINK_ID}/plan/generate`);

      if (status !== undefined) {
        expect(response.status).toBe(status);
      }

      expect(response.status).toBeGreaterThanOrEqual(400);
      assertNamesNothing(response.body);
    });

    it.each([
      ['a meal not in the plan under review, or a plan not made through this link', new NotFoundError('Meal not found'), 404],
      ['the meal is not part of its plan', new ConflictError('Meal is not part of its plan'), 409],
      ['no dish fits — the allergen gate refused every one', new ConflictError('No dish fits this meal right now'), 409],
      ['the plan’s swaps spent', new QuotaExceededError('meal_swap'), 429],
      ['the client’s profile consent not given', new ProfileConsentRequiredError(), undefined]
    ])('swap: %s', async (_case, error, status) => {
      swap.mockRejectedValue(error);
      jest
        .spyOn(CareController, 'swapPendingMeal')
        .mockImplementation(async (_professional, _link, _meal, swapper: ForClient<MealDetailView>) => swapper('usr-client', record));

      const response = await request(server()).post(`/${PREFIX}/care/clients/${LINK_ID}/plan/meals/${MEAL_ID}/swap`).send({});

      if (status !== undefined) {
        expect(response.status).toBe(status);
      }

      expect(response.status).toBeGreaterThanOrEqual(400);
      assertNamesNothing(response.body);
    });

    it('publish: nothing made through this link is pending', async () => {
      jest.spyOn(CareController, 'publishPlan').mockRejectedValue(new NotFoundError('Plan not found'));

      const response = await request(server()).post(`/${PREFIX}/care/clients/${LINK_ID}/plan/publish`).expect(404);

      expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Plan not found', statusCode: 404 });
      assertNamesNothing(response.body);
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
          badge: { checkedAt: '2026-09-01T09:00:00.000Z', collegiateNumber: '28/12345' },
          collegiateNumber: '28/12345',
          consentVersion: CARE_CONSENT_VERSION,
          expiresAt: '2026-10-07T10:00:00.000Z',
          healthShares: CARE_HEALTH_SHARED,
          professionalName: 'Ana Dietista',
          scope: 'full',
          shares: CARE_SHARED,
          sharesPlan: []
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
        .send({ consentScope: 'full', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })
        .expect(404);
      const declined = await request(server()).post(`/${PREFIX}/care/invitations/${TOKEN}/decline`).expect(404);

      for (const response of [read, accepted, declined]) {
        expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Invitation not found', statusCode: 404 });
      }
    });

    it('accept only the current consent version, with an explicit health answer', async () => {
      const accept = jest.spyOn(CareController, 'accept').mockResolvedValue(LINK);

      await request(server())
        .post(`/${PREFIX}/care/invitations/${TOKEN}/accept`)
        .send({ consentScope: 'full', consentVersion: '0.0.1', sharesHealth: false })
        .expect(422);
      await request(server())
        .post(`/${PREFIX}/care/invitations/${TOKEN}/accept`)
        .send({ consentScope: 'full', consentVersion: CARE_CONSENT_VERSION })
        .expect(422);
      expect(accept).not.toHaveBeenCalled();

      const response = await request(server())
        .post(`/${PREFIX}/care/invitations/${TOKEN}/accept`)
        .send({ clientId: 'usr-other', consentScope: 'full', consentVersion: CARE_CONSENT_VERSION, sharesHealth: true })
        .expect(200);

      expect(accept).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), TOKEN, {
        consentScope: 'full',
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
        .send({ consentScope: 'full', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })
        .expect(409);

      expect(response.body).toMatchObject({
        code: 'CARE_LINK_EXISTS',
        link: { professionalName: 'Otra Dietista', since: '2026-09-01T10:00:00.000Z', status: 'active' }
      });
    });

    it('pass the list the client read to the controller, and refuse a body without one, or a list that is neither', async () => {
      const accept = jest.spyOn(CareController, 'accept').mockResolvedValue(LINK);

      // Required: nothing is presumed from its absence (review round one, P1-1).
      await request(server())
        .post(`/${PREFIX}/care/invitations/${TOKEN}/accept`)
        .send({ consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })
        .expect(422);
      await request(server())
        .post(`/${PREFIX}/care/invitations/${TOKEN}/accept`)
        .send({ consentScope: 'everything', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })
        .expect(422);
      expect(accept).not.toHaveBeenCalled();

      await request(server())
        .post(`/${PREFIX}/care/invitations/${TOKEN}/accept`)
        .send({ consentScope: 'plan', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })
        .expect(200);
      expect(accept).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), TOKEN, {
        consentScope: 'plan',
        consentVersion: CARE_CONSENT_VERSION,
        sharesHealth: false
      });
    });

    /* Project 025 phase 5 (`0111` § 8): a state the client's screen explains, naming nothing — and nothing reaches the practitioner. */
    it('answer the illness rule as a 409 naming no condition, and send no mail', async () => {
      jest.spyOn(CareController, 'accept').mockRejectedValue(new CareIllnessRuleError());

      const response = await request(server())
        .post(`/${PREFIX}/care/invitations/${TOKEN}/accept`)
        .send({ consentScope: 'plan', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })
        .expect(409);

      expect(response.body).toEqual({ code: 'CARE_ILLNESS_RULE', message: 'No puedes aceptar esta invitación.', statusCode: 409 });
      await settle();
      expect(send).not.toHaveBeenCalled();
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
        .mockResolvedValue({
          agreementRequired: false,
          collegiateNumber: '28/1',
          grantedAt: '2026-09-01T00:00:00.000Z',
          includedClients: 30,
          practiceOpen: false,
          restricted: false,
          restriction: null
        });
    }

    it('opens the workspace’s own page to a professional whose practice is not paid for, with the way to pay', async () => {
      lapsed();
      practiceOffer.mockResolvedValue(OFFER);
      const practice = jest
        .spyOn(CareController, 'practice')
        .mockResolvedValue({
          activeClients: 0,
          agreementAcceptedAt: '2026-09-02T00:00:00.000Z',
          agreementRequired: false,
          agreementVersion: PROFESSIONAL_AGREEMENT_VERSION,
          includedClients: 30,
          open: false,
          pendingInvitations: 0,
          restriction: null,
          seats: 30
        });

      const response = await request(server()).get(`/${PREFIX}/care/practice`).expect(200);

      expect(practice).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }));
      expect(response.body).toEqual({
        activeClients: 0,
        agreementAcceptedAt: '2026-09-02T00:00:00.000Z',
        agreementRequired: false,
        agreementVersion: PROFESSIONAL_AGREEMENT_VERSION,
        billing: OFFER,
        includedClients: 30,
        open: false,
        pendingInvitations: 0,
        restriction: null,
        seats: 30,
        secondFactorRequired: false
      });
    });

    /* PLAN 011 phase 6: the page opens without the second factor, and says it is needed; the client routes do not. */
    it('opens that page to a professional who still needs a second factor, and says so', async () => {
      practiceOffer.mockResolvedValue(OFFER);
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const needs = jest.spyOn(UserController, 'needsSecondFactor').mockResolvedValue(true);
      jest
        .spyOn(CareController, 'practice')
        .mockResolvedValue({
          activeClients: 0,
          agreementAcceptedAt: '2026-09-02T00:00:00.000Z',
          agreementRequired: false,
          agreementVersion: PROFESSIONAL_AGREEMENT_VERSION,
          includedClients: 30,
          open: true,
          pendingInvitations: 0,
          restriction: null,
          seats: 30
        });

      const response = await request(server()).get(`/${PREFIX}/care/practice`).expect(200);

      expect(response.body).toMatchObject({ open: true, secondFactorRequired: true });
      expect(needs).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }));
    });

    it.each([
      ['get', '/care/clients'],
      ['get', `/care/clients/${LINK_ID}`],
      ['post', '/care/invitations']
    ] as const)('closes %s %s to a professional who still needs a second factor, with the same 404', async (method, path) => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      jest.spyOn(UserController, 'needsSecondFactor').mockResolvedValue(true);
      const clients = jest.spyOn(CareController, 'clients');
      const invite = jest.spyOn(CareController, 'invite');

      await request(server())[method](`/${PREFIX}${path}`).send({ email: 'cliente@example.invalid' }).expect(404);

      expect(clients).not.toHaveBeenCalled();
      expect(invite).not.toHaveBeenCalled();
    });

    it('keeps that page shut to an account that is not a professional', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);

      await request(server()).get(`/${PREFIX}/care/practice`).expect(404);
    });

    /* PRD 025 scope 2 (project 025 phase 6): `practiceOpen` left the door — a practice nobody pays for reaches its clients. */
    it('lets a practice nobody pays for reach its clients and invite', async () => {
      lapsed();
      const clients = jest.spyOn(CareController, 'clients').mockResolvedValue({ clients: [], invitations: [] });
      const invite = jest
        .spyOn(CareController, 'invite')
        .mockResolvedValue({
          invitation: { email: 'cliente@example.invalid', expiresAt: '2026-10-07T10:00:00.000Z' },
          inviterName: 'Ana Pérez',
          token: TOKEN
        });

      await request(server()).get(`/${PREFIX}/care/clients`).expect(200);
      await request(server()).post(`/${PREFIX}/care/invitations`).send({ email: 'cliente@example.invalid' }).expect(201);
      expect(clients).toHaveBeenCalled();
      expect(invite).toHaveBeenCalled();
    });

    /* PRD 025 criterion 24: a suspension, or a close whose day has come, closes every client route — the same 404. */
    it.each([
      ['get', '/care/clients'],
      ['get', `/care/clients/${LINK_ID}`],
      ['post', '/care/invitations'],
      ['patch', `/care/clients/${LINK_ID}/targets`]
    ] as const)('closes %s %s to a suspended practitioner, with the same 404, and calls nothing', async (method, path) => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      jest
        .spyOn(ProfessionalController, 'find')
        .mockResolvedValue({
          agreementRequired: false,
          collegiateNumber: '28/1',
          grantedAt: '2026-09-01T00:00:00.000Z',
          includedClients: 0,
          practiceOpen: false,
          restricted: true,
          restriction: { closing: null, suspended: { since: '2026-11-19T09:00:00.000Z', statement: null } }
        });
      const calls = [jest.spyOn(CareController, 'clients'), jest.spyOn(CareController, 'overview'), jest.spyOn(CareController, 'invite')];

      const response = await request(server())[method](`/${PREFIX}${path}`).send({ email: 'cliente@example.invalid', kcal: 1750 }).expect(404);

      expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 });

      for (const call of calls) {
        expect(call).not.toHaveBeenCalled();
      }
    });

    it('answers a full practice with 409 PRACTICE_FULL, the number, and the ways up — and sends no mail', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      jest.spyOn(CareController, 'invite').mockRejectedValue(new PracticeFullError(30));

      const response = await request(server()).post(`/${PREFIX}/care/invitations`).send({ email: 'n31@example.invalid' }).expect(409);
      await settle();

      expect(response.body).toEqual({
        code: 'PRACTICE_FULL',
        message: 'Tu consulta ya tiene todas sus plazas ocupadas.',
        practice: { includedClients: 30, waysUp: ['larger_plan', 'end_link'] },
        statusCode: 409
      });
      expect(send).not.toHaveBeenCalled();
    });

    it('takes no number from a body: an invitation body carrying one is read for its address alone', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      const invite = jest
        .spyOn(CareController, 'invite')
        .mockResolvedValue({
          invitation: { email: 'cliente@example.invalid', expiresAt: '2026-10-07T10:00:00.000Z' },
          inviterName: 'Ana Pérez',
          token: TOKEN
        });

      await request(server())
        .post(`/${PREFIX}/care/invitations`)
        .send({ email: 'cliente@example.invalid', includedClients: 999, practiceOpen: true })
        .expect(201);
      expect(invite).toHaveBeenCalledWith(expect.anything(), { email: 'cliente@example.invalid' });
    });
  });

  /* P0-1 (`docs/legal/analysis.md`): the health line, switched by the client on their own link. */
  describe('PATCH /care/links/me', () => {
    it('takes the yes or no alone, for the session’s own link — never a link id or another account from the body', async () => {
      const shared = { ...LINK, shares: [...CARE_SHARED, ...CARE_HEALTH_SHARED], sharesHealth: true };
      const setSharesHealth = jest.spyOn(CareController, 'setSharesHealth').mockResolvedValue(shared);

      const response = await request(server())
        .patch(`/${PREFIX}/care/links/me`)
        .send({ clientId: 'usr-other', linkId: LINK_ID, sharesHealth: true })
        .expect(200);

      expect(setSharesHealth).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), { sharesHealth: true });
      expect(response.body).toEqual(shared);
    });

    it('refuses a body without a boolean as 422, and changes nothing', async () => {
      const setSharesHealth = jest.spyOn(CareController, 'setSharesHealth');

      await request(server()).patch(`/${PREFIX}/care/links/me`).send({}).expect(422);
      await request(server()).patch(`/${PREFIX}/care/links/me`).send({ sharesHealth: 'no' }).expect(422);

      expect(setSharesHealth).not.toHaveBeenCalled();
    });

    it('is a 404 for a client with no open link', async () => {
      jest.spyOn(CareController, 'setSharesHealth').mockRejectedValue(new NotFoundError('Link not found'));

      await request(server()).patch(`/${PREFIX}/care/links/me`).send({ sharesHealth: false }).expect(404);
    });

    it('asks neither the switch nor whether the account is a professional', async () => {
      const hasAccess = jest.spyOn(ProfessionalController, 'hasAccess');
      const isOpen = jest.spyOn(ProfessionalController, 'isOpen');

      jest.spyOn(CareController, 'setSharesHealth').mockResolvedValue(LINK);
      await request(server()).patch(`/${PREFIX}/care/links/me`).send({ sharesHealth: false }).expect(200);

      expect(hasAccess).not.toHaveBeenCalled();
      expect(isOpen).not.toHaveBeenCalled();
    });
  });

  /* Project 025 phase 5 (`docs/legal/textos/05` § F.4): the client widens their own link to the badged list. */
  describe('POST /care/links/me/consent', () => {
    it('takes the version alone, for the session’s own link — never a link id or another account from the body', async () => {
      const widened = { ...LINK, consentScope: 'full' as const, scope: 'full' as const };
      const reconsent = jest.spyOn(CareController, 'reconsent').mockResolvedValue(widened);

      const response = await request(server())
        .post(`/${PREFIX}/care/links/me/consent`)
        .send({ clientId: 'usr-other', consentVersion: CARE_CONSENT_VERSION, linkId: LINK_ID })
        .expect(200);

      expect(reconsent).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }), { consentVersion: CARE_CONSENT_VERSION });
      expect(response.body).toEqual(widened);
    });

    it('refuses an older version as 422, and changes nothing', async () => {
      const reconsent = jest.spyOn(CareController, 'reconsent');

      await request(server()).post(`/${PREFIX}/care/links/me/consent`).send({ consentVersion: '1.0.0' }).expect(422);
      await request(server()).post(`/${PREFIX}/care/links/me/consent`).send({}).expect(422);

      expect(reconsent).not.toHaveBeenCalled();
    });

    it('is the same 404 as any link that is not there, when there is nothing to widen', async () => {
      jest.spyOn(CareController, 'reconsent').mockRejectedValue(new NotFoundError('Link not found'));

      const response = await request(server()).post(`/${PREFIX}/care/links/me/consent`).send({ consentVersion: CARE_CONSENT_VERSION }).expect(404);

      expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Link not found', statusCode: 404 });
    });
  });

  /* Project 025 phase 5 (`docs/legal/textos/05` § G.3): why the client's last link ended, when the illness rule ended it. */
  describe('GET /care/links/me/ended', () => {
    it('answers the session’s own, or null', async () => {
      const endedLink = jest
        .spyOn(CareController, 'endedLink')
        .mockResolvedValueOnce({ endedAt: '2026-11-19T06:00:00.000Z', professionalName: 'Ana Dietista', reason: 'declared' })
        .mockResolvedValueOnce(null);

      expect((await request(server()).get(`/${PREFIX}/care/links/me/ended`).expect(200)).body).toEqual({
        endedAt: '2026-11-19T06:00:00.000Z',
        professionalName: 'Ana Dietista',
        reason: 'declared'
      });
      await request(server()).get(`/${PREFIX}/care/links/me/ended`).expect(200);
      expect(endedLink).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION.id }));
    });

    it('asks neither the switch nor whether the account is a professional', async () => {
      const hasAccess = jest.spyOn(ProfessionalController, 'hasAccess');
      const isOpen = jest.spyOn(ProfessionalController, 'isOpen');

      jest.spyOn(CareController, 'endedLink').mockResolvedValue(null);
      await request(server()).get(`/${PREFIX}/care/links/me/ended`).expect(200);

      expect(hasAccess).not.toHaveBeenCalled();
      expect(isOpen).not.toHaveBeenCalled();
    });
  });

  /* P1-1 (`docs/legal/textos/01`): no client route before the agreement, and the page that shows it. */
  describe('the professional’s agreement', () => {
    function unaccepted(): void {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      jest
        .spyOn(ProfessionalController, 'find')
        .mockResolvedValue({
          agreementRequired: true,
          collegiateNumber: '28/1',
          grantedAt: '2026-09-01T00:00:00.000Z',
          includedClients: 30,
          practiceOpen: true,
          restricted: false,
          restriction: null
        });
    }

    it.each([
      ['get', '/care/clients'],
      ['get', `/care/clients/${LINK_ID}`],
      ['post', '/care/invitations'],
      ['patch', `/care/clients/${LINK_ID}/targets`]
    ] as const)('closes %s %s until it is accepted, with the same 404, even with the practice paid for', async (method, path) => {
      unaccepted();
      const calls = [jest.spyOn(CareController, 'clients'), jest.spyOn(CareController, 'overview'), jest.spyOn(CareController, 'invite')];

      await request(server())[method](`/${PREFIX}${path}`).send({ email: 'cliente@example.invalid', kcal: 1750 }).expect(404);

      for (const call of calls) {
        expect(call).not.toHaveBeenCalled();
      }
    });

    it('opens the workspace’s own page, which says it is required', async () => {
      unaccepted();
      practiceOffer.mockResolvedValue({ available: true, plans: [], subscription: null, testMode: false, trialDays: 14 });
      jest
        .spyOn(CareController, 'practice')
        .mockResolvedValue({
          activeClients: 0,
          agreementAcceptedAt: null,
          agreementRequired: true,
          agreementVersion: PROFESSIONAL_AGREEMENT_VERSION,
          includedClients: 30,
          open: true,
          pendingInvitations: 0,
          restriction: null,
          seats: 30
        });

      expect((await request(server()).get(`/${PREFIX}/care/practice`).expect(200)).body).toMatchObject({ agreementRequired: true });
    });

    it('accepts the current version for the session’s account, with no content', async () => {
      unaccepted();
      const accept = jest
        .spyOn(ProfessionalController, 'acceptAgreement')
        .mockResolvedValue({
          agreementRequired: false,
          collegiateNumber: '28/1',
          grantedAt: '2026-09-01T00:00:00.000Z',
          includedClients: 30,
          practiceOpen: true,
          restricted: false,
          restriction: null
        });

      await request(server())
        .post(`/${PREFIX}/care/practice/agreement`)
        .send({ userId: 'usr-other', version: PROFESSIONAL_AGREEMENT_VERSION })
        .expect(204);
      expect(accept).toHaveBeenCalledWith(SESSION.id, { version: PROFESSIONAL_AGREEMENT_VERSION });
    });

    it('refuses any other version as 422, and writes nothing', async () => {
      unaccepted();
      const accept = jest.spyOn(ProfessionalController, 'acceptAgreement');

      await request(server()).post(`/${PREFIX}/care/practice/agreement`).send({ version: '0.9.0' }).expect(422);
      await request(server()).post(`/${PREFIX}/care/practice/agreement`).send({}).expect(422);

      expect(accept).not.toHaveBeenCalled();
    });

    it('is a 404 for an account that is not a professional, before the body is read', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
      const accept = jest.spyOn(ProfessionalController, 'acceptAgreement');

      await request(server()).post(`/${PREFIX}/care/practice/agreement`).send({}).expect(404);

      expect(accept).not.toHaveBeenCalled();
    });
  });

  /**
   * The badge (project 025 phase 3): the practitioner's own routes, in the
   * before-practice lane, by the session's account alone. No body or path names
   * a user, no body carries a contact, and every refusal of a code is the same
   * 404 as a route the account cannot see.
   */
  describe('the badge', () => {
    const BADGE = {
      checkedAt: null,
      codeEntered: false,
      codeExpiresAt: null,
      decision: null,
      dueAt: null,
      lapsesAt: null,
      number: null,
      register: 'Colegio de Madrid',
      state: 'applied' as const
    };

    /** A practitioner whose practice is not paid for and whose agreement is not accepted: the badge must still be reachable. */
    function beforeAnything(): void {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      jest
        .spyOn(ProfessionalController, 'find')
        .mockResolvedValue({
          agreementRequired: true,
          collegiateNumber: null,
          grantedAt: '2026-09-01T00:00:00.000Z',
          includedClients: 0,
          practiceOpen: false,
          restricted: false,
          restriction: null
        });
    }

    it('is a 404 on every badge route for an account that is not a practitioner, and nothing is read or written', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
      const calls = [
        jest.spyOn(ProfessionalBadgeController, 'state'),
        jest.spyOn(ProfessionalBadgeController, 'apply'),
        jest.spyOn(ProfessionalBadgeController, 'enterCode')
      ];

      await request(server()).get(`/${PREFIX}/care/practice/badge`).expect(404);
      await request(server()).post(`/${PREFIX}/care/practice/badge`).send({ number: 'MAD00123', register: 'Colegio de Madrid' }).expect(404);
      await request(server()).post(`/${PREFIX}/care/practice/badge/code`).send({ code: 'ABCDE-FGHJK' }).expect(404);

      for (const call of calls) {
        expect(call).not.toHaveBeenCalled();
      }
    });

    it('answers the session’s own badge, before the practice is paid for or the agreement accepted', async () => {
      beforeAnything();
      const state = jest.spyOn(ProfessionalBadgeController, 'state').mockResolvedValue(BADGE);

      const response = await request(server()).get(`/${PREFIX}/care/practice/badge`).expect(200);

      expect(state).toHaveBeenCalledWith(SESSION.id);
      expect(response.body).toEqual(BADGE);
    });

    it('applies with the register and number alone, for the session’s account — a user id or a contact in the body is dropped', async () => {
      beforeAnything();
      const apply = jest.spyOn(ProfessionalBadgeController, 'apply').mockResolvedValue(BADGE);

      await request(server())
        .post(`/${PREFIX}/care/practice/badge`)
        .send({ email: 'otra@example.invalid', number: ' MAD00123 ', phone: '600000000', register: ' Colegio de Madrid ', userId: 'usr-other' })
        .expect(201);

      expect(apply).toHaveBeenCalledWith(SESSION.id, { number: 'MAD00123', register: 'Colegio de Madrid' });
    });

    it('refuses a malformed number or a missing register as 422, and writes nothing', async () => {
      beforeAnything();
      const apply = jest.spyOn(ProfessionalBadgeController, 'apply');

      await request(server()).post(`/${PREFIX}/care/practice/badge`).send({ number: 'no spaces allowed', register: 'Colegio' }).expect(422);
      await request(server()).post(`/${PREFIX}/care/practice/badge`).send({ number: 'MAD00123' }).expect(422);

      expect(apply).not.toHaveBeenCalled();
    });

    it('answers a refused application — a badge already standing — with the same 404', async () => {
      beforeAnything();
      jest.spyOn(ProfessionalBadgeController, 'apply').mockRejectedValue(new NotFoundError('Not Found'));

      await request(server()).post(`/${PREFIX}/care/practice/badge`).send({ number: 'MAD00123', register: 'Colegio de Madrid' }).expect(404);
    });

    it('takes a right code for the session’s account with no content', async () => {
      beforeAnything();
      const enter = jest.spyOn(ProfessionalBadgeController, 'enterCode').mockResolvedValue();

      await request(server()).post(`/${PREFIX}/care/practice/badge/code`).send({ code: 'ABCDE-FGHJK', userId: 'usr-other' }).expect(204);

      expect(enter).toHaveBeenCalledWith(SESSION.id, { code: 'ABCDE-FGHJK' });
    });

    it('answers a wrong, used, expired or malformed code exactly as a route the account cannot see', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
      const unseen = await request(server()).post(`/${PREFIX}/care/practice/badge/code`).send({ code: 'ABCDE-FGHJK' }).expect(404);

      beforeAnything();
      // The message core throws with (`ProfessionalBadgeController`'s spec pins it): the guard's own.
      jest.spyOn(ProfessionalBadgeController, 'enterCode').mockRejectedValue(new NotFoundError('Not Found'));
      const wrong = await request(server()).post(`/${PREFIX}/care/practice/badge/code`).send({ code: 'ZZZZZ-ZZZZZ' }).expect(404);
      const odd = await request(server()).post(`/${PREFIX}/care/practice/badge/code`).send({ code: '!' }).expect(404);

      expect(wrong.body).toEqual(unseen.body);
      expect(odd.body).toEqual(unseen.body);
    });

    it.each([
      ['an empty code', { code: '' }],
      ['no code at all', {}],
      ['a code too long', { code: 'A'.repeat(65) }],
      ['a code that is not a string', { code: 12_345 }],
      ['a body that is not an object', ['ABCDE-FGHJK']]
    ])('reads %s as the empty code, never a 422: the same 404 as a wrong one', async (_what, body) => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
      const unseen = await request(server()).post(`/${PREFIX}/care/practice/badge/code`).send({ code: 'ABCDE-FGHJK' }).expect(404);

      beforeAnything();
      const enter = jest.spyOn(ProfessionalBadgeController, 'enterCode').mockRejectedValue(new NotFoundError('Not Found'));
      const response = await request(server()).post(`/${PREFIX}/care/practice/badge/code`).send(body).expect(404);

      expect(enter).toHaveBeenCalledWith(SESSION.id, { code: '' });
      expect(response.body).toEqual(unseen.body);
    });
  });

  /**
   * Anyone can open a practice (project 025 phase 6, PRD 025 scope 1, criteria
   * 1, 2 and 24): the session's account, behind the switch alone, with nothing
   * from the body but a birth date; every refusal the same 404.
   */
  describe('POST /care/practice', () => {
    const STANDING = {
      activeClients: 0,
      agreementAcceptedAt: null,
      agreementRequired: true,
      agreementVersion: PROFESSIONAL_AGREEMENT_VERSION,
      includedClients: 0,
      open: false,
      pendingInvitations: 0,
      restriction: null,
      seats: 10
    };

    beforeEach(() => {
      jest.spyOn(ProfessionalController, 'isOpen').mockResolvedValue(true);
      practiceOffer.mockResolvedValue({ available: false });
      jest.spyOn(CareController, 'practice').mockResolvedValue(STANDING);
    });

    it('opens the session’s own practice from the birth date alone — no badge, no `practiceOpen`, no seats, no user from the body', async () => {
      const open = jest.spyOn(ProfessionalController, 'open').mockResolvedValue();

      const response = await request(server())
        .post(`/${PREFIX}/care/practice`)
        .set('Accept-Language', 'en-GB')
        .send({ badge: true, birthDate: '1990-04-02', includedClients: 999, practiceOpen: true, userId: 'usr-other' })
        .expect(200);

      // The request's language goes with it, for a profile the opening creates: never from the body.
      expect(open).toHaveBeenCalledWith(SESSION.id, { birthDate: '1990-04-02' }, 'en-GB');
      expect(response.body).toMatchObject({ open: false, seats: 10 });
    });

    it('needs no practice to reach it: an account with none is who opens one', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
      const open = jest.spyOn(ProfessionalController, 'open').mockResolvedValue();

      await request(server()).post(`/${PREFIX}/care/practice`).send({}).expect(200);
      expect(open).toHaveBeenCalledWith(SESSION.id, {}, null);
    });

    it('is the guard’s 404 while the switch is off, before the body is read', async () => {
      jest.spyOn(ProfessionalController, 'isOpen').mockResolvedValue(false);
      const open = jest.spyOn(ProfessionalController, 'open');

      const response = await request(server()).post(`/${PREFIX}/care/practice`).send({ birthDate: 'nonsense' }).expect(404);

      expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 });
      expect(open).not.toHaveBeenCalled();
    });

    it('answers every refusal of the core with the same 404 body as the switch off', async () => {
      jest.spyOn(ProfessionalController, 'open').mockRejectedValue(new NotFoundError('Not Found'));

      const response = await request(server()).post(`/${PREFIX}/care/practice`).send({ birthDate: '2012-01-01' }).expect(404);

      expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 });
    });

    it('refuses a malformed birth date as 422, and writes nothing', async () => {
      const open = jest.spyOn(ProfessionalController, 'open');

      await request(server()).post(`/${PREFIX}/care/practice`).send({ birthDate: 'yesterday' }).expect(422);
      expect(open).not.toHaveBeenCalled();
    });
  });

  /** What the opening form names (PRD 025 phase 8): the seats in force, for the session's account alone. */
  describe('GET /care/practice/opening', () => {
    beforeEach(() => {
      jest.spyOn(ProfessionalController, 'isOpen').mockResolvedValue(true);
    });

    it('answers the seats for the session’s own account — nobody else’s id is read', async () => {
      const seats = jest.spyOn(ProfessionalController, 'openingSeats').mockResolvedValue({ seats: 7 });

      const response = await request(server()).get(`/${PREFIX}/care/practice/opening?userId=usr-other`).expect(200);

      expect(response.body).toEqual({ seats: 7 });
      expect(seats).toHaveBeenCalledWith(SESSION.id);
    });

    it('lets an unconfirmed or unopened account through, as the POST does — `canOpenPractice` does not ask either lock', () => {
      expect(Reflect.getMetadata(ALLOW_UNVERIFIED_KEY, CareOpenPracticeController.prototype.opening)).toBe(true);
      expect(Reflect.getMetadata(ALLOW_UNVERIFIED_KEY, CareOpenPracticeController.prototype.open)).toBe(true);
    });

    it('needs no practice to reach it — the account has none yet', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
      jest.spyOn(ProfessionalController, 'openingSeats').mockResolvedValue({ seats: 10 });

      await request(server()).get(`/${PREFIX}/care/practice/opening`).expect(200);
    });

    it('is the guard’s 404 while the switch is off, before the core is asked', async () => {
      jest.spyOn(ProfessionalController, 'isOpen').mockResolvedValue(false);
      const seats = jest.spyOn(ProfessionalController, 'openingSeats');

      const response = await request(server()).get(`/${PREFIX}/care/practice/opening`).expect(404);

      expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 });
      expect(seats).not.toHaveBeenCalled();
    });

    it('answers the core’s refusal — a practice already, a suspension, a close — with the POST’s 404 body', async () => {
      jest.spyOn(ProfessionalController, 'openingSeats').mockRejectedValue(new NotFoundError('Not Found'));

      const response = await request(server()).get(`/${PREFIX}/care/practice/opening`).expect(404);

      expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 });
    });
  });

  /** The practitioner's profile (PRD 025 scope 4): the session's own, in the before-practice lane, its words judged server-side. */
  describe('the profile', () => {
    const PROFILE = {
      displayName: 'Ana · asesora nutricional',
      hidden: null,
      hours: null,
      priceCents: null,
      priceUnit: null,
      review: 'queued' as const,
      studies: null,
      updatedAt: '2026-11-19T09:00:00.000Z',
      withheld: []
    };

    function practising(restricted = false): void {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);
      jest
        .spyOn(ProfessionalController, 'find')
        .mockResolvedValue({
          agreementRequired: true,
          collegiateNumber: null,
          grantedAt: '2026-09-01T00:00:00.000Z',
          includedClients: 0,
          practiceOpen: false,
          restricted,
          restriction: restricted ? { closing: null, suspended: { since: '2026-11-19T09:00:00.000Z', statement: null } } : null
        });
    }

    it.each([false, true])('reads the session’s own profile, before the agreement — suspended: %s', async restricted => {
      practising(restricted);
      const mine = jest.spyOn(ProfessionalProfileController, 'mine').mockResolvedValue(PROFILE);

      expect((await request(server()).get(`/${PREFIX}/care/practice/profile`).expect(200)).body).toEqual(PROFILE);
      expect(mine).toHaveBeenCalledWith(SESSION.id);
    });

    it('saves the whole profile for the session’s account, and nothing that is not the profile', async () => {
      practising();
      const save = jest.spyOn(ProfessionalProfileController, 'save').mockResolvedValue(PROFILE);

      await request(server())
        .put(`/${PREFIX}/care/practice/profile`)
        .send({ displayName: 'Ana · asesora nutricional', queuedAt: null, seenAt: '2026-11-19', userId: 'usr-other' })
        .expect(200);

      expect(save).toHaveBeenCalledWith(SESSION.id, {
        displayName: 'Ana · asesora nutricional',
        hours: null,
        priceCents: null,
        priceUnit: null,
        studies: null
      });
    });

    it('answers a refused word as 422 naming the field, the list and the word', async () => {
      practising();
      jest
        .spyOn(ProfessionalProfileController, 'save')
        .mockRejectedValue(new InputParseError('A word the profile may not carry', { displayName: ['badge_only:nutricionista'] }));

      const response = await request(server()).put(`/${PREFIX}/care/practice/profile`).send({ displayName: 'Ana, nutricionista' }).expect(422);

      expect(response.body).toMatchObject({ code: 'INVALID_INPUT', fieldErrors: { displayName: ['badge_only:nutricionista'] } });
    });

    it('is a 404 for an account that is not a practitioner, before the body is read', async () => {
      jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);
      const calls = [jest.spyOn(ProfessionalProfileController, 'mine'), jest.spyOn(ProfessionalProfileController, 'save')];

      await request(server()).get(`/${PREFIX}/care/practice/profile`).expect(404);
      await request(server()).put(`/${PREFIX}/care/practice/profile`).send({}).expect(404);

      for (const call of calls) {
        expect(call).not.toHaveBeenCalled();
      }
    });
  });
});
