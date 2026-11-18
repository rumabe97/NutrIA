import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { NotFoundError } from 'core/entities/Error';
import { ProfessionalBadgeController } from 'core/controllers/Professional';
import { ProfileController } from 'core/controllers/Profile';

import { AdminGuard } from '../../../shared/guards/index.js';
import { AdminProfessionalsController } from './AdminProfessionals.controller.js';
import { AdminProfessionalsService } from '../services/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { BackgroundTaskService } from '../../../shared/services/index.js';
import { EmailService } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';

import type { BadgeRecordView } from 'core/controllers/Professional';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../../email/services/index.js';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';
const CODE = 'ABCDE-FGHJK';
const EXPIRES = new Date('2026-12-18T09:00:00.000Z');

const RECORD: BadgeRecordView = {
  application: { appliedAt: '2026-11-17T09:00:00.000Z', number: 'MAD00123', register: 'Colegio de Madrid' },
  badge: null,
  checks: [],
  code: null,
  email: 'pro@example.invalid',
  name: 'Ana Pérez',
  state: 'applied',
  userId: 'usr-pro'
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
 * The owner's half of the badge (project 025 phase 3), through a real Nest
 * application: the class-level role, the bodies, the session as the checker,
 * and what leaves — a code once for a letter or a call, a mail to the
 * register's address for the e-mail channel, the statement of reasons to the
 * account's own address.
 */
describe('AdminProfessionalsController — the badge', () => {
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

  beforeEach(() => {
    send.mockResolvedValue(true);
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('es-ES');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    send.mockReset();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  it('is 404 on every badge route for an ordinary account, and nothing is read, written or sent', async () => {
    role = 'user';
    const calls = [
      jest.spyOn(ProfessionalBadgeController, 'queue'),
      jest.spyOn(ProfessionalBadgeController, 'record'),
      jest.spyOn(ProfessionalBadgeController, 'issueCode'),
      jest.spyOn(ProfessionalBadgeController, 'confirm'),
      jest.spyOn(ProfessionalBadgeController, 'remove')
    ];

    await request(server()).get(`/${PREFIX}/admin/professionals/badges`).expect(404);
    await request(server()).get(`/${PREFIX}/admin/professionals/usr-pro/badge`).expect(404);
    await request(server()).post(`/${PREFIX}/admin/professionals/usr-pro/badge/code`).send({ channel: 'post' }).expect(404);
    await request(server()).post(`/${PREFIX}/admin/professionals/usr-pro/badge/confirm`).expect(404);
    await request(server())
      .post(`/${PREFIX}/admin/professionals/usr-pro/badge/removal`)
      .send({ kind: 'fail', reason: 'not_me', source: 'own_check' })
      .expect(404);
    await settle();

    for (const call of calls) {
      expect(call).not.toHaveBeenCalled();
    }

    expect(send).not.toHaveBeenCalled();
  });

  describe('as the owner', () => {
    beforeAll(() => {
      role = 'admin';
    });

    it('lists the work and reads one record by the account named', async () => {
      const queue = jest.spyOn(ProfessionalBadgeController, 'queue').mockResolvedValue({ applications: [], due: [] });
      const record = jest.spyOn(ProfessionalBadgeController, 'record').mockResolvedValue(RECORD);

      await request(server()).get(`/${PREFIX}/admin/professionals/badges`).expect(200);
      const response = await request(server()).get(`/${PREFIX}/admin/professionals/usr-pro/badge`).expect(200);

      expect(queue).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith('usr-pro');
      expect(response.body).toEqual(RECORD);
    });

    it('answers an unknown account as the guard does', async () => {
      jest.spyOn(ProfessionalBadgeController, 'record').mockRejectedValue(new NotFoundError('Not Found'));

      const response = await request(server()).get(`/${PREFIX}/admin/professionals/usr-nobody/badge`).expect(404);

      expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 });
    });

    it.each(['post', 'phone'] as const)('hands a %s code back once and mails nothing, whatever contact the body carries', async channel => {
      const issue = jest
        .spyOn(ProfessionalBadgeController, 'issueCode')
        .mockResolvedValue({ channel, code: CODE, expiresAt: EXPIRES, number: 'MAD00123', register: 'Colegio de Madrid', userId: 'usr-pro' });

      const response = await request(server())
        .post(`/${PREFIX}/admin/professionals/usr-pro/badge/code`)
        .send({ channel, email: 'someone@example.invalid', phone: '600000000' })
        .expect(201);
      await settle();

      expect(issue.mock.calls[0]).toEqual(['usr-pro', { channel }]);
      expect(response.body).toEqual({ channel, code: CODE, expiresAt: EXPIRES.toISOString(), mailed: null });
      expect(send).not.toHaveBeenCalled();
    });

    it('mails an e-mail code to the register’s address, with the art. 14 information and the way out, and never answers it', async () => {
      jest
        .spyOn(ProfessionalBadgeController, 'issueCode')
        .mockResolvedValue({
          channel: 'register_email',
          code: CODE,
          expiresAt: EXPIRES,
          number: 'MAD00123',
          register: 'Colegio de Madrid',
          userId: 'usr-pro'
        });

      const response = await request(server())
        .post(`/${PREFIX}/admin/professionals/usr-pro/badge/code`)
        .send({ channel: 'register_email', email: 'registro@colegio.example', register: 'CODINMA', registerName: 'Ana Pérez García' })
        .expect(201);

      expect(response.body).toEqual({ channel: 'register_email', code: null, expiresAt: EXPIRES.toISOString(), mailed: true });
      expect(JSON.stringify(response.body)).not.toContain(CODE);
      expect(send).toHaveBeenCalledTimes(1);
      const mail = send.mock.calls[0]?.[0];

      expect(mail?.to).toBe('registro@colegio.example');
      expect(mail?.kind).toBe('professional-badge-code');
      expect(mail?.text).toContain(CODE);
      // The college as the owner typed it from the register, never the applicant's free text (invariant review, P2-7).
      expect(mail?.text).toContain('Ana Pérez García, número MAD00123, de CODINMA');
      expect(mail?.text).not.toContain('Colegio de Madrid');
      expect(mail?.text).toContain('Si no has sido tú, no hagas nada con el código');
      expect(mail?.text).toContain('Hemos sacado esta dirección del registro público de colegiados de CODINMA');
      expect(mail?.text).toContain('https://nutria.example/privacidad#tu-profesional');
    });

    it('says when the e-mail did not leave', async () => {
      send.mockResolvedValue(false);
      jest
        .spyOn(ProfessionalBadgeController, 'issueCode')
        .mockResolvedValue({
          channel: 'register_email',
          code: CODE,
          expiresAt: EXPIRES,
          number: 'MAD00123',
          register: 'Colegio de Madrid',
          userId: 'usr-pro'
        });

      const response = await request(server())
        .post(`/${PREFIX}/admin/professionals/usr-pro/badge/code`)
        .send({ channel: 'register_email', email: 'registro@colegio.example', register: 'CODINMA', registerName: 'Ana Pérez' })
        .expect(201);

      expect(response.body).toMatchObject({ code: null, mailed: false });
    });

    it('refuses an unknown channel, an e-mail channel without its address, and a missing name as 422', async () => {
      const issue = jest.spyOn(ProfessionalBadgeController, 'issueCode');

      await request(server()).post(`/${PREFIX}/admin/professionals/usr-pro/badge/code`).send({ channel: 'college_email' }).expect(422);
      await request(server()).post(`/${PREFIX}/admin/professionals/usr-pro/badge/code`).send({ channel: 'register_email' }).expect(422);
      await request(server())
        .post(`/${PREFIX}/admin/professionals/usr-pro/badge/code`)
        .send({ channel: 'register_email', email: 'registro@colegio.example' })
        .expect(422);

      // A name, never a link or an address, reaches a stranger's inbox.
      for (const register of ['https://evil.example', 'www.evil.example', 'mail me at x@y.example', 'Colegio\nVisita']) {
        await request(server())
          .post(`/${PREFIX}/admin/professionals/usr-pro/badge/code`)
          .send({ channel: 'register_email', email: 'registro@colegio.example', register, registerName: 'Ana' })
          .expect(422);
      }

      await request(server())
        .post(`/${PREFIX}/admin/professionals/usr-pro/badge/code`)
        .send({ channel: 'register_email', email: 'registro@colegio.example', register: 'CODINMA', registerName: 'Ana <https://evil.example>' })
        .expect(422);

      expect(issue).not.toHaveBeenCalled();
    });

    it('confirms with the session as the checker', async () => {
      const confirm = jest.spyOn(ProfessionalBadgeController, 'confirm').mockResolvedValue({ ...RECORD, application: null, state: 'badged' });

      await request(server()).post(`/${PREFIX}/admin/professionals/usr-pro/badge/confirm`).send({ checkedBy: 'usr-other' }).expect(200);

      expect(confirm).toHaveBeenCalledWith('usr-pro', 'usr-owner');
    });

    it('withdraws with a reason and mails the statement to the account’s own address, in its language', async () => {
      const remove = jest
        .spyOn(ProfessionalBadgeController, 'remove')
        .mockResolvedValue({
          checkedAt: new Date('2026-11-18T09:00:00.000Z'),
          facts: null,
          kind: 'withdrawn',
          number: 'MAD00123',
          reason: 'not_on_register',
          record: { ...RECORD, state: 'none' },
          register: 'Colegio de Madrid',
          source: 'own_check',
          to: 'pro@example.invalid'
        });

      const response = await request(server())
        .post(`/${PREFIX}/admin/professionals/usr-pro/badge/removal`)
        .send({ kind: 'withdrawn', reason: 'not_on_register', source: 'own_check' })
        .expect(200);
      await settle();

      expect(remove).toHaveBeenCalledWith('usr-pro', 'usr-owner', { kind: 'withdrawn', reason: 'not_on_register', source: 'own_check' });
      expect(response.body).toMatchObject({ state: 'none' });
      const mail = send.mock.calls[0]?.[0];

      expect(mail?.to).toBe('pro@example.invalid');
      expect(mail?.kind).toBe('professional-badge-removed');
      expect(mail?.text).toContain('Te retiramos la insignia');
      expect(mail?.text).toContain('El registro de Colegio de Madrid no te muestra como colegiada/o habilitada/o con el número MAD00123');
    });

    it('refuses other reasons without facts, and a kind that is not a removal, as 422', async () => {
      const remove = jest.spyOn(ProfessionalBadgeController, 'remove');

      await request(server())
        .post(`/${PREFIX}/admin/professionals/usr-pro/badge/removal`)
        .send({ kind: 'fail', reason: 'other', source: 'own_check' })
        .expect(422);
      await request(server())
        .post(`/${PREFIX}/admin/professionals/usr-pro/badge/removal`)
        .send({ kind: 'pass', reason: 'not_me', source: 'own_check' })
        .expect(422);

      expect(remove).not.toHaveBeenCalled();
    });
  });
});
