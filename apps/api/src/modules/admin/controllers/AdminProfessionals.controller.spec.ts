import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { NotFoundError } from 'core/entities/Error';
import { ProfessionalController } from 'core/controllers/Professional';

import { AdminProfessionalsController } from './AdminProfessionals.controller.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AdminProfessionalsService } from '../services/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';

import type { ProfessionalAccountView } from 'core/controllers/Professional';
import type { INestApplication } from '@nestjs/common';
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
describe('AdminProfessionalsController', () => {
  let app: INestApplication;
  let role = 'user';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminProfessionalsController],
      providers: [
        AdminProfessionalsService,
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

  afterEach(() => {
    jest.restoreAllMocks();
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
      const grant = jest.spyOn(ProfessionalController, 'grant').mockResolvedValue(GRANTED);

      const response = await request(app.getHttpServer() as Server)
        .post(`/${PREFIX}/admin/accounts/usr-dietitian/professional`)
        .send({ collegiateNumber: '  MAD00123 ' })
        .expect(201);

      expect(grant).toHaveBeenCalledWith('usr-dietitian', { collegiateNumber: 'MAD00123' }, 'usr-owner');
      expect(response.body).toEqual(GRANTED);
    });

    it('refuses a body without a valid number as 422, and writes nothing', async () => {
      const grant = jest.spyOn(ProfessionalController, 'grant');
      const server = app.getHttpServer() as Server;

      await request(server).post(`/${PREFIX}/admin/accounts/usr-dietitian/professional`).send({}).expect(422);
      await request(server).post(`/${PREFIX}/admin/accounts/usr-dietitian/professional`).send({ collegiateNumber: 'no' }).expect(422);

      expect(grant).not.toHaveBeenCalled();
    });

    it('lets nothing but the number through the body — a role or a practice in it is dropped', async () => {
      const grant = jest.spyOn(ProfessionalController, 'grant').mockResolvedValue(GRANTED);

      await request(app.getHttpServer() as Server)
        .post(`/${PREFIX}/admin/accounts/usr-dietitian/professional`)
        .send({ collegiateNumber: 'MAD00123', includedClients: 99, practiceOpen: true, role: 'admin' })
        .expect(201);

      expect(grant).toHaveBeenCalledWith('usr-dietitian', { collegiateNumber: 'MAD00123' }, 'usr-owner');
    });

    it('is 404 when the account does not exist', async () => {
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
