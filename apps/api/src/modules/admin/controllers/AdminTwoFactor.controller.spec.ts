import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { NotFoundError, TwoFactorRemovalRefusedError } from 'core/entities/Error';
import { ProfileController } from 'core/controllers/Profile';
import { TwoFactorController } from 'core/controllers/TwoFactor';

import { AdminGuard } from '../../../shared/guards/index.js';
import { AdminTwoFactorController } from './AdminTwoFactor.controller.js';
import { AdminTwoFactorService } from '../services/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { BackgroundTaskService } from '../../../shared/services/index.js';
import { EmailService } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';

import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../../email/services/index.js';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';
const ROUTE = `/${PREFIX}/admin/accounts/usr-ana/two-factor/removal`;
const NOT_FOUND = { code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 };

/** Lets the background task's promise chain run: the service deliberately does not await it. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await new Promise(resolve => {
      setImmediate(resolve);
    });
  }
}

/**
 * The owner's removal of a lost second factor (PLAN 011 phase 4), through a
 * real Nest application: the class-level role, the session user as the actor,
 * the filter's codes and the mail that leaves in the background are all
 * things a direct method call would not exercise.
 */
describe('AdminTwoFactorController', () => {
  let app: INestApplication;
  let role = 'user';
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminTwoFactorController],
      providers: [
        AdminTwoFactorService,
        BackgroundTaskService,
        { provide: EmailService, useValue: { configured: true, send } },
        { provide: ENV, useValue: { APP_URL: 'https://nutria.example' } },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
              context.switchToHttp().getRequest().user = {
                id: 'usr-owner',
                activated: true,
                email: 'owner@example.invalid',
                emailVerified: true,
                name: 'Owner',
                role
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

  beforeEach(() => {
    send.mockResolvedValue(true);
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('es-ES');
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    send.mockReset();
  });

  describe('as an ordinary account', () => {
    it('is the guard’s 404 on both routes, and nothing is asked or cancelled', async () => {
      role = 'user';
      const requestRemoval = jest.spyOn(TwoFactorController, 'requestRemoval');
      const cancel = jest.spyOn(TwoFactorController, 'cancelRemovalByOwner');
      const server = app.getHttpServer() as Server;

      expect((await request(server).post(ROUTE).expect(404)).body).toEqual(NOT_FOUND);
      expect((await request(server).delete(ROUTE).expect(404)).body).toEqual(NOT_FOUND);

      expect(requestRemoval).not.toHaveBeenCalled();
      expect(cancel).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('as the owner', () => {
    beforeAll(() => {
      role = 'admin';
    });

    it('asks with the session user as actor, answers { dueAt } alone, and mails the account’s own address', async () => {
      const requestRemoval = jest
        .spyOn(TwoFactorController, 'requestRemoval')
        .mockResolvedValue({ dueAt: '2026-10-03T19:00:00.000Z', email: 'ana@example.invalid' });

      const response = await request(app.getHttpServer() as Server)
        .post(ROUTE)
        .expect(201);

      expect(requestRemoval).toHaveBeenCalledWith('usr-ana', 'usr-owner');
      // The address the mail went to never reaches the owner's answer.
      expect(response.body).toEqual({ dueAt: '2026-10-03T19:00:00.000Z' });

      await settle();

      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[0]).toMatchObject({ kind: 'two-factor-removal-requested', to: 'ana@example.invalid' });
    });

    it.each([
      ['not_enabled', 'TWO_FACTOR_NOT_ENABLED'],
      ['pending', 'TWO_FACTOR_REMOVAL_PENDING']
    ] as const)('answers a refusal (%s) as 409 %s, and mails nothing', async (reason, code) => {
      jest.spyOn(TwoFactorController, 'requestRemoval').mockRejectedValue(new TwoFactorRemovalRefusedError(reason));

      const response = await request(app.getHttpServer() as Server)
        .post(ROUTE)
        .expect(409);

      expect(response.body).toMatchObject({ code, statusCode: 409 });
      await settle();
      expect(send).not.toHaveBeenCalled();
    });

    it('answers an unknown account as the same 404 every denial is', async () => {
      jest.spyOn(TwoFactorController, 'requestRemoval').mockRejectedValue(new NotFoundError('User "nobody" not found'));

      expect(
        (
          await request(app.getHttpServer() as Server)
            .post(`/${PREFIX}/admin/accounts/nobody/two-factor/removal`)
            .expect(404)
        ).body
      ).toEqual(NOT_FOUND);
    });

    it('cancels with the session user as actor, answers 204, and mails the account', async () => {
      const cancel = jest.spyOn(TwoFactorController, 'cancelRemovalByOwner').mockResolvedValue({ email: 'ana@example.invalid' });

      const response = await request(app.getHttpServer() as Server)
        .delete(ROUTE)
        .expect(204);

      expect(cancel).toHaveBeenCalledWith('usr-ana', 'usr-owner');
      expect(response.text).toBe('');

      await settle();

      expect(send.mock.calls[0]?.[0]).toMatchObject({ kind: 'two-factor-removal-cancelled', to: 'ana@example.invalid' });
    });

    it('answers a cancel with nothing pending as 404, and mails nothing', async () => {
      jest.spyOn(TwoFactorController, 'cancelRemovalByOwner').mockRejectedValue(new NotFoundError('No pending two-factor removal'));

      expect(
        (
          await request(app.getHttpServer() as Server)
            .delete(ROUTE)
            .expect(404)
        ).body
      ).toEqual(NOT_FOUND);
      await settle();
      expect(send).not.toHaveBeenCalled();
    });
  });
});
