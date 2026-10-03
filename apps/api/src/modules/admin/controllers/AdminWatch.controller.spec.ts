import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import {
  AdminConsentController,
  AdminNotificationController,
  AdminPlanQualityController,
  AdminRetentionController,
  AdminSystemController as CoreSystem
} from 'core/controllers/Admin';

import { AdminController } from './Admin.controller.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AdminService, AdminSystemService } from '../services/index.js';
import { AdminSystemController } from './AdminSystem.controller.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { EmailService } from '../../email/services/Email.service.js';
import { ENV } from '../../../config/index.js';
import { PushService } from '../../notifications/index.js';

import type { AdminConsentsView, AdminNotificationsView, AdminPlanQualityView, AdminRetentionView, AdminSystemView } from 'core/controllers/Admin';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';

const CONSENTS: AdminConsentsView = { consents: [], onboarded: { holding: 0, total: 0 } };
const WINDOW = { from: '2026-08-30T22:00:00.000Z', previousFrom: '2026-07-30T22:00:00.000Z', to: '2026-09-29T10:00:00.000Z' };
const NOTIFICATIONS: AdminNotificationsView = {
  checkIns: { answered: 0, reminded: 0 },
  period: 30,
  push: { people: 0, subscriptions: 0 },
  remindersPerWeek: { series: [], weeks: [] },
  window: WINDOW
};
const SYSTEM = { commit: null, period: 30, window: WINDOW } as unknown as AdminSystemView;

const PLAN_QUALITY = { fewData: true, period: 30, plans: 0 } as unknown as AdminPlanQualityView;
const RETENTION = { didSomething: [], usedTheApp: [] } as unknown as AdminRetentionView;

/**
 * The console's watching pages (`0071`): consents, notifications and system.
 * The owner's like every console read — a 404 for anyone else before the query
 * is read — and `?period=` a DTO bound to one parameter: 7, 30 or 90.
 */
describe('the watching pages', () => {
  let app: INestApplication;
  let role = 'user';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController, AdminSystemController],
      providers: [
        AdminService,
        AdminSystemService,
        { provide: ENV, useValue: { AI_IMAGE_MONTHLY_CAP_USD: 10, AI_PROVIDER: 'stub', AI_REWRITE_STEPS: false, NODE_ENV: 'test' } },
        { provide: EmailService, useValue: { configured: false } },
        { provide: PushService, useValue: { configured: true } },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
              context.switchToHttp().getRequest().user = {
                id: 'usr-1',
                activated: true,
                email: 'a@b.invalid',
                emailVerified: true,
                name: 'A',
                role,
                twoFactorEnabled: true
              };

              return true;
            }
          }
        },
        { provide: APP_GUARD, useClass: AdminGuard }
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function get(path: string) {
    return request(app.getHttpServer() as Server).get(`/${PREFIX}/admin/${path}`);
  }

  it('is 404 for an ordinary account, whatever it asks, and reads nothing', async () => {
    role = 'user';
    const consents = jest.spyOn(AdminConsentController, 'consents');
    const notifications = jest.spyOn(AdminNotificationController, 'notifications');
    const system = jest.spyOn(CoreSystem, 'system');

    for (const path of ['consents', 'notifications', 'notifications?period=12', 'system', 'system?period=abc']) {
      await get(path).expect(404);
    }

    expect(consents).not.toHaveBeenCalled();
    expect(notifications).not.toHaveBeenCalled();
    expect(system).not.toHaveBeenCalled();
  });

  it('answers the owner consents, and notifications and system over a period — 30 days when none is asked', async () => {
    role = 'admin';
    const consents = jest.spyOn(AdminConsentController, 'consents').mockResolvedValue(CONSENTS);
    const notifications = jest.spyOn(AdminNotificationController, 'notifications').mockResolvedValue(NOTIFICATIONS);
    const system = jest.spyOn(CoreSystem, 'system').mockResolvedValue(SYSTEM);

    expect((await get('consents').expect(200)).body).toEqual(CONSENTS);
    expect((await get('notifications').expect(200)).body).toEqual(NOTIFICATIONS);
    expect(notifications).toHaveBeenLastCalledWith(30);
    await get('notifications?period=90').expect(200);
    expect(notifications).toHaveBeenLastCalledWith(90);
    expect(consents).toHaveBeenCalledTimes(1);

    await get('system?period=7').expect(200);
    // The period, then the snapshot of the environment: yes or no per integration, taken from the services that decide it.
    expect(system).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ integrations: expect.objectContaining({ mail: false, push: true, rewriteSweep: false, sentry: false }) })
    );
  });

  it('refuses a period outside 7, 30 and 90 with INVALID_INPUT before anything is read', async () => {
    role = 'admin';
    const notifications = jest.spyOn(AdminNotificationController, 'notifications');
    const system = jest.spyOn(CoreSystem, 'system');

    for (const path of ['notifications?period=12', 'notifications?period=7&period=30', 'system?period=abc', 'system?period=0']) {
      const response = await get(path).expect(422);

      expect((response.body as { code: string }).code).toBe('INVALID_INPUT');
    }

    expect(notifications).not.toHaveBeenCalled();
    expect(system).not.toHaveBeenCalled();
  });

  it('reads plan quality and retention for the owner only, and refuses what is outside their grammar before reading', async () => {
    role = 'user';
    const planQuality = jest.spyOn(AdminPlanQualityController, 'quality').mockResolvedValue(PLAN_QUALITY);
    const retention = jest.spyOn(AdminRetentionController, 'retention').mockResolvedValue(RETENTION);

    for (const path of ['plans/quality', 'plans/quality?period=12', 'retention', 'retention?grouping=year']) {
      await get(path).expect(404);
    }

    role = 'admin';

    for (const path of [
      'plans/quality?period=12',
      'plans/quality?period=7&period=30',
      'retention?grouping=week',
      'retention?grouping=month',
      'retention?grouping=week&grouping=month'
    ]) {
      expect(((await get(path).expect(422)).body as { code: string }).code).toBe('INVALID_INPUT');
    }

    expect(planQuality).not.toHaveBeenCalled();
    expect(retention).not.toHaveBeenCalled();

    expect((await get('plans/quality').expect(200)).body).toEqual(PLAN_QUALITY);
    expect(planQuality).toHaveBeenLastCalledWith(30);
    await get('plans/quality?period=90').expect(200);
    expect(planQuality).toHaveBeenLastCalledWith(90);

    expect((await get('retention').expect(200)).body).toEqual(RETENTION);
    expect(retention).toHaveBeenLastCalledWith();
  });
});
