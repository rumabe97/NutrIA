import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { NotFoundError } from 'core/entities/Error';
import { ProfessionalController } from 'core/controllers/Professional';
import { ProfileController } from 'core/controllers/Profile';

import { AdminProfessionalsController } from './AdminProfessionals.controller.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AdminProfessionalsService } from '../services/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { BackgroundTaskService } from '../../../shared/services/index.js';
import { EmailService } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';

import type { ProfessionalAccountView } from 'core/controllers/Professional';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../../email/services/index.js';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';

const GRANTED: ProfessionalAccountView = {
  collegiateNumber: 'MAD00123',
  email: 'dietista@example.invalid',
  grantedAt: '2026-09-23T10:00:00.000Z',
  links: { active: 0, ended: 0, paused: 0 },
  userId: 'usr-dietitian'
};

/**
 * The only door through which an account becomes a professional (`0059`),
 * through a real Nest application: the class-level role, the body binding and
 * the session user as the granter are all things a direct method call would
 * not exercise.
 */
/** Lets the background task's promise chain run: the service deliberately does not await it. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await new Promise(resolve => {
      setImmediate(resolve);
    });
  }
}

describe('AdminProfessionalsController', () => {
  let app: INestApplication;
  let role = 'user';
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminProfessionalsController],
      providers: [
        AdminProfessionalsService,
        BackgroundTaskService,
        { provide: EmailService, useValue: { send } },
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
    send.mockReset();
  });

  describe('as an ordinary account', () => {
    it('is 404 on every route, and nothing is read or written', async () => {
      role = 'user';
      const grant = jest.spyOn(ProfessionalController, 'grant');
      const revoke = jest.spyOn(ProfessionalController, 'revoke');
      const list = jest.spyOn(ProfessionalController, 'list');
      const server = app.getHttpServer() as Server;

      await request(server).get(`/${PREFIX}/admin/professionals`).expect(404);
      await request(server).post(`/${PREFIX}/admin/accounts/usr-dietitian/professional`).send({ collegiateNumber: 'MAD00123' }).expect(404);
      await request(server).delete(`/${PREFIX}/admin/accounts/usr-dietitian/professional`).expect(404);

      expect(grant).not.toHaveBeenCalled();
      expect(revoke).not.toHaveBeenCalled();
      expect(list).not.toHaveBeenCalled();
    });
  });

  describe('as the owner', () => {
    beforeAll(() => {
      role = 'admin';
    });

    it('grants with the collegiate number, remembering the session user as the granter', async () => {
      jest.spyOn(ProfessionalController, 'find').mockResolvedValue(null);
      const grant = jest.spyOn(ProfessionalController, 'grant').mockResolvedValue(GRANTED);

      const response = await request(app.getHttpServer() as Server)
        .post(`/${PREFIX}/admin/accounts/usr-dietitian/professional`)
        .send({ collegiateNumber: '  MAD00123 ' })
        .expect(201);

      expect(grant).toHaveBeenCalledWith('usr-dietitian', { collegiateNumber: 'MAD00123' }, 'usr-owner');
      expect(response.body).toEqual(GRANTED);
    });

    /* `docs/legal/textos/06` § B: the professional hears of a first grant, in their own language. */
    it('tells the professional of a first grant, by mail to the granted account, with its number', async () => {
      send.mockResolvedValue(true);
      jest.spyOn(ProfessionalController, 'find').mockResolvedValue(null);
      jest.spyOn(ProfessionalController, 'grant').mockResolvedValue(GRANTED);
      jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('en-GB');

      await request(app.getHttpServer() as Server)
        .post(`/${PREFIX}/admin/accounts/usr-dietitian/professional`)
        .send({ collegiateNumber: 'MAD00123' })
        .expect(201);
      await settle();

      expect(send).toHaveBeenCalledTimes(1);
      const mail = send.mock.calls[0]?.[0];

      expect(mail).toMatchObject({ kind: 'professional-granted', subject: 'Your NutrIA practice is ready', to: GRANTED.email });
      expect(mail?.text).toContain('MAD00123');
      expect(mail?.text).toContain('https://nutria.example/en/consulta');
    });

    it('sends nothing when the grant is made again — a corrected number', async () => {
      jest
        .spyOn(ProfessionalController, 'find')
        .mockResolvedValue({
          agreementRequired: true,
          collegiateNumber: 'MAD0012',
          grantedAt: '2026-09-23T10:00:00.000Z',
          includedClients: 0,
          practiceOpen: false
        });
      jest.spyOn(ProfessionalController, 'grant').mockResolvedValue(GRANTED);

      await request(app.getHttpServer() as Server)
        .post(`/${PREFIX}/admin/accounts/usr-dietitian/professional`)
        .send({ collegiateNumber: 'MAD00123' })
        .expect(201);
      await settle();

      expect(send).not.toHaveBeenCalled();
    });

    it('sends nothing when the grant is refused', async () => {
      jest.spyOn(ProfessionalController, 'find').mockResolvedValue(null);
      jest.spyOn(ProfessionalController, 'grant').mockRejectedValue(new NotFoundError('User "usr-nobody" not found'));

      await request(app.getHttpServer() as Server)
        .post(`/${PREFIX}/admin/accounts/usr-nobody/professional`)
        .send({ collegiateNumber: 'MAD00123' })
        .expect(404);
      await settle();

      expect(send).not.toHaveBeenCalled();
    });

    it('refuses a body without a valid number as 422, and writes nothing', async () => {
      const grant = jest.spyOn(ProfessionalController, 'grant');
      const server = app.getHttpServer() as Server;

      await request(server).post(`/${PREFIX}/admin/accounts/usr-dietitian/professional`).send({}).expect(422);
      await request(server).post(`/${PREFIX}/admin/accounts/usr-dietitian/professional`).send({ collegiateNumber: 'no' }).expect(422);

      expect(grant).not.toHaveBeenCalled();
    });

    it('lets nothing but the number through the body — a role or a practice in it is dropped', async () => {
      jest.spyOn(ProfessionalController, 'find').mockResolvedValue(null);
      const grant = jest.spyOn(ProfessionalController, 'grant').mockResolvedValue(GRANTED);

      await request(app.getHttpServer() as Server)
        .post(`/${PREFIX}/admin/accounts/usr-dietitian/professional`)
        .send({ collegiateNumber: 'MAD00123', includedClients: 99, practiceOpen: true, role: 'admin' })
        .expect(201);

      expect(grant).toHaveBeenCalledWith('usr-dietitian', { collegiateNumber: 'MAD00123' }, 'usr-owner');
    });

    it('is 404 when the account does not exist', async () => {
      jest.spyOn(ProfessionalController, 'find').mockResolvedValue(null);
      jest.spyOn(ProfessionalController, 'grant').mockRejectedValue(new NotFoundError('User "usr-nobody" not found'));

      await request(app.getHttpServer() as Server)
        .post(`/${PREFIX}/admin/accounts/usr-nobody/professional`)
        .send({ collegiateNumber: 'MAD00123' })
        .expect(404);
    });

    it('revokes with no content', async () => {
      const revoke = jest.spyOn(ProfessionalController, 'revoke').mockResolvedValue(undefined);

      await request(app.getHttpServer() as Server)
        .delete(`/${PREFIX}/admin/accounts/usr-dietitian/professional`)
        .expect(204);

      expect(revoke).toHaveBeenCalledWith('usr-dietitian');
    });

    it('is 404 when revoking an account that was never granted', async () => {
      jest.spyOn(ProfessionalController, 'revoke').mockRejectedValue(new NotFoundError('User "usr-plain" is not a professional'));

      await request(app.getHttpServer() as Server)
        .delete(`/${PREFIX}/admin/accounts/usr-plain/professional`)
        .expect(404);
    });

    it('lists every professional with links counted and no client named', async () => {
      jest.spyOn(ProfessionalController, 'list').mockResolvedValue([GRANTED]);

      const response = await request(app.getHttpServer() as Server)
        .get(`/${PREFIX}/admin/professionals`)
        .expect(200);

      expect(response.body).toEqual([GRANTED]);
    });
  });
});
