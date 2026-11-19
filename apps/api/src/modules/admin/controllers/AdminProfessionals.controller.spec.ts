import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { NotFoundError } from 'core/entities/Error';
import { ProfessionalController, ProfessionalProfileController } from 'core/controllers/Professional';
import { ProfileController } from 'core/controllers/Profile';

import { AdminProfessionalsController } from './AdminProfessionals.controller.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AdminProfessionalsService } from '../services/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { BackgroundTaskService } from '../../../shared/services/index.js';
import { EmailService } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';

import type { PracticeRestrictionAct, ProfessionalAccountView, ProfileHiding, QueuedProfileView } from 'core/controllers/Professional';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../../email/services/index.js';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';

const PRACTITIONER: ProfessionalAccountView = {
  collegiateNumber: 'MAD00123',
  email: 'dietista@example.invalid',
  grantedAt: '2026-09-23T10:00:00.000Z',
  links: { active: 0, ended: 0, paused: 0 },
  practising: true,
  restriction: null,
  userId: 'usr-dietitian'
};

const QUEUED: QueuedProfileView = {
  badged: false,
  displayName: 'Ana · asesora nutricional',
  email: 'dietista@example.invalid',
  hidden: null,
  hours: null,
  name: 'Ana Pérez',
  priceCents: null,
  priceUnit: null,
  queuedAt: '2026-11-19T09:00:00.000Z',
  review: 'queued',
  seenAt: null,
  studies: null,
  updatedAt: '2026-11-19T09:00:00.000Z',
  userId: 'usr-dietitian',
  withheld: []
};

const STATEMENT = { clause: 2, facts: 'Se presenta como médico en su perfil.', source: 'own_review' as const };

function act(kind: PracticeRestrictionAct['kind'], overrides: Partial<PracticeRestrictionAct> = {}): PracticeRestrictionAct {
  return {
    answer: { restriction: null, userId: 'usr-dietitian' },
    closesAt: null,
    kind,
    statement: { authority: null, clause: 2, facts: STATEMENT.facts, source: 'own_review' },
    suspended: false,
    to: 'dietista@example.invalid',
    userId: 'usr-dietitian',
    wasSuspended: false,
    withdrawnClose: null,
    ...overrides
  };
}

/**
 * The owner's acts on practitioners (`0059`, project 025), through a real Nest
 * application: the class-level role, the body binding and the session user as
 * the actor are all things a direct method call would not exercise.
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

  describe('as an ordinary account', () => {
    it('is 404 on every route, and nothing is read or written', async () => {
      role = 'user';
      const calls = [
        jest.spyOn(ProfessionalController, 'list'),
        jest.spyOn(ProfessionalController, 'suspend'),
        jest.spyOn(ProfessionalController, 'close'),
        jest.spyOn(ProfessionalController, 'lift'),
        jest.spyOn(ProfessionalProfileController, 'queue'),
        jest.spyOn(ProfessionalProfileController, 'markSeen'),
        jest.spyOn(ProfessionalProfileController, 'hide')
      ];
      const server = app.getHttpServer() as Server;

      await request(server).get(`/${PREFIX}/admin/professionals`).expect(404);
      await request(server).get(`/${PREFIX}/admin/professionals/queue`).expect(404);
      await request(server).post(`/${PREFIX}/admin/professionals/usr-dietitian/profile/seen`).expect(404);
      await request(server)
        .post(`/${PREFIX}/admin/professionals/usr-dietitian/profile/hide`)
        .send({ reasons: ['promises'] })
        .expect(404);
      await request(server).post(`/${PREFIX}/admin/professionals/usr-dietitian/suspension`).send(STATEMENT).expect(404);
      await request(server).post(`/${PREFIX}/admin/professionals/usr-dietitian/close`).send(STATEMENT).expect(404);
      await request(server).post(`/${PREFIX}/admin/professionals/usr-dietitian/lift`).send({}).expect(404);

      for (const call of calls) {
        expect(call).not.toHaveBeenCalled();
      }
    });
  });

  describe('as the owner', () => {
    beforeAll(() => {
      role = 'admin';
    });

    /*
     * PRD 025 criterion 2 — **replaces PRD 004 criterion 1's test** ("lets nothing
     * but the number through the body — a role or a practice in it is dropped"),
     * inverted on purpose: the owner's grant is retired, so no request body, the
     * owner's included, can make an account a practitioner, set the badge, its
     * date or checker, `practiceOpen` or `includedClients`. The route does not
     * exist; the revoke beside it became the close.
     */
    it('has no route that makes an account a practitioner, or sets a badge, `practiceOpen` or `includedClients`', async () => {
      const server = app.getHttpServer() as Server;
      const writers = [
        jest.spyOn(ProfessionalController, 'open'),
        jest.spyOn(ProfessionalController, 'suspend'),
        jest.spyOn(ProfessionalController, 'close'),
        jest.spyOn(ProfessionalController, 'lift')
      ];
      const body = {
        badge: true,
        badgeCheckedAt: '2026-11-19T09:00:00.000Z',
        checkedBy: 'usr-owner',
        collegiateNumber: 'MAD00123',
        includedClients: 99,
        practiceOpen: true,
        role: 'admin'
      };

      for (const path of ['accounts/usr-dietitian/professional', 'professionals/usr-dietitian', 'professionals/usr-dietitian/practice']) {
        await request(server).post(`/${PREFIX}/admin/${path}`).send(body).expect(404);
        await request(server).put(`/${PREFIX}/admin/${path}`).send(body).expect(404);
        await request(server).patch(`/${PREFIX}/admin/${path}`).send(body).expect(404);
      }

      await request(server).delete(`/${PREFIX}/admin/accounts/usr-dietitian/professional`).expect(404);

      for (const writer of writers) {
        expect(writer).not.toHaveBeenCalled();
      }
    });

    it('lists every practitioner with links counted, what stands against them, and no client named', async () => {
      jest.spyOn(ProfessionalController, 'list').mockResolvedValue([PRACTITIONER]);

      const response = await request(app.getHttpServer() as Server)
        .get(`/${PREFIX}/admin/professionals`)
        .expect(200);

      expect(response.body).toEqual([PRACTITIONER]);
    });

    it('asks for the most recently opened first when nothing is asked, as the list always did', async () => {
      const list = jest.spyOn(ProfessionalController, 'list').mockResolvedValue([]);

      await request(app.getHttpServer() as Server)
        .get(`/${PREFIX}/admin/professionals`)
        .expect(200);

      expect(list).toHaveBeenCalledWith({ dir: 'desc', q: undefined, sort: 'grantedAt' });
    });

    it('passes the search and an allowed sort through', async () => {
      const list = jest.spyOn(ProfessionalController, 'list').mockResolvedValue([]);

      await request(app.getHttpServer() as Server)
        .get(`/${PREFIX}/admin/professionals?q=%20Mad%20&sort=links&dir=asc`)
        .expect(200);

      expect(list).toHaveBeenCalledWith({ dir: 'asc', q: 'Mad', sort: 'links' });
    });

    it('refuses a sort outside the allow-list with INVALID_INPUT, and reads nothing', async () => {
      const list = jest.spyOn(ProfessionalController, 'list');

      for (const path of ['sort=collegiateNumber', 'sort=email;drop', 'dir=up', 'sort=email&sort=links']) {
        const response = await request(app.getHttpServer() as Server)
          .get(`/${PREFIX}/admin/professionals?${path}`)
          .expect(422);

        expect((response.body as { code: string }).code).toBe('INVALID_INPUT');
      }

      expect(list).not.toHaveBeenCalled();
    });

    /* PRD 025 criterion 18: the first look — seen, or hidden with one statement; practitioner data only. */
    describe('the profiles’ first look', () => {
      it('answers the queue', async () => {
        jest.spyOn(ProfessionalProfileController, 'queue').mockResolvedValue({ profiles: [QUEUED] });

        expect(
          (
            await request(app.getHttpServer() as Server)
              .get(`/${PREFIX}/admin/professionals/queue`)
              .expect(200)
          ).body
        ).toEqual({ profiles: [QUEUED] });
      });

      it('marks a profile seen as the session’s owner, and mails nobody — seen is not an approval', async () => {
        const seen = jest.spyOn(ProfessionalProfileController, 'markSeen').mockResolvedValue({ ...QUEUED, queuedAt: null, review: 'seen' });

        await request(app.getHttpServer() as Server)
          .post(`/${PREFIX}/admin/professionals/usr-dietitian/profile/seen`)
          .expect(200);
        await settle();

        expect(seen).toHaveBeenCalledWith('usr-dietitian', 'usr-owner');
        expect(send).not.toHaveBeenCalled();
      });

      it('hides with the statement of reasons of § X, mailed to the practitioner in their language', async () => {
        const hiding: ProfileHiding = {
          hadBeenSeen: false,
          profile: {
            ...QUEUED,
            hidden: { afterNotice: true, at: '2026-11-19T09:00:00.000Z', facts: null, reasons: ['badge_word'], word: 'nutricionista' }
          },
          statement: { afterNotice: true, at: '2026-11-19T09:00:00.000Z', facts: null, reasons: ['badge_word'], word: 'nutricionista' },
          to: 'dietista@example.invalid',
          userId: 'usr-dietitian'
        };
        const hide = jest.spyOn(ProfessionalProfileController, 'hide').mockResolvedValue(hiding);

        await request(app.getHttpServer() as Server)
          .post(`/${PREFIX}/admin/professionals/usr-dietitian/profile/hide`)
          .send({ afterNotice: true, reasons: ['badge_word'], userId: 'usr-other', word: 'nutricionista' })
          .expect(200);
        await settle();

        // The session's owner hid it, and the audit row names them (ADR `0071`); the body names nobody.
        expect(hide).toHaveBeenCalledWith('usr-dietitian', 'usr-owner', { afterNotice: true, reasons: ['badge_word'], word: 'nutricionista' });
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0]?.[0]).toMatchObject({
          kind: 'professional-profile-hidden',
          subject: 'Hemos ocultado tu perfil de NutrIA',
          to: 'dietista@example.invalid'
        });
        expect(send.mock.calls[0]?.[0].text).toContain('Usa una palabra que el acuerdo no permite sin la insignia: «nutricionista».');
        expect(send.mock.calls[0]?.[0].text).toContain(', después de un aviso que nos llegó.');
      });

      it('refuses a hiding that says nothing as 422, and writes nothing', async () => {
        const hide = jest.spyOn(ProfessionalProfileController, 'hide');

        await request(app.getHttpServer() as Server)
          .post(`/${PREFIX}/admin/professionals/usr-dietitian/profile/hide`)
          .send({})
          .expect(422);
        expect(hide).not.toHaveBeenCalled();
      });
    });

    /* PRD 025 scope 16, criterion 24: suspend, close and lift, each with its statement mailed. */
    describe('suspension, close and lift', () => {
      it('suspends with the session’s owner as the actor, and mails § W bis.1', async () => {
        const suspend = jest.spyOn(ProfessionalController, 'suspend').mockResolvedValue(act('suspended', { suspended: true }));

        const response = await request(app.getHttpServer() as Server)
          .post(`/${PREFIX}/admin/professionals/usr-dietitian/suspension`)
          .send({ ...STATEMENT, effectiveAt: '2026-11-20' })
          .expect(200);
        await settle();

        // The date in the body is dropped: a suspension is immediate, and nothing else rides in.
        expect(suspend).toHaveBeenCalledWith('usr-dietitian', 'usr-owner', STATEMENT);
        expect(response.body).toEqual({ restriction: null, userId: 'usr-dietitian' });
        expect(send.mock.calls[0]?.[0]).toMatchObject({
          kind: 'professional-suspended',
          subject: 'Hemos suspendido tu cuenta como profesional en NutrIA'
        });
        expect(send.mock.calls[0]?.[0].text).toContain(
          'Por qué: Se presenta como médico en su perfil. Es lo que dice el § 13 del acuerdo del profesional que aceptaste, en relación con su § 2. Lo hemos decidido nosotros, por nuestra propia revisión.'
        );
      });

      it('closes with thirty days’ notice, and mails § W bis.3 at once', async () => {
        jest
          .spyOn(ProfessionalController, 'close')
          .mockResolvedValue(act('closing', { closesAt: new Date('2026-12-19T09:00:00.000Z'), suspended: true }));

        await request(app.getHttpServer() as Server)
          .post(`/${PREFIX}/admin/professionals/usr-dietitian/close`)
          .send(STATEMENT)
          .expect(200);
        await settle();

        const mail = send.mock.calls[0]?.[0];

        expect(mail).toMatchObject({ kind: 'professional-closing', subject: 'Vamos a cerrar tu consulta en NutrIA el 19 de diciembre de 2026' });
        expect(mail?.text).toContain('Hasta esa fecha sigue como está, es decir, suspendida.');
      });

      it('lifts, and mails § W bis.2 only when a suspension was lifted', async () => {
        const lift = jest
          .spyOn(ProfessionalController, 'lift')
          .mockResolvedValueOnce(
            act('lifted', { statement: { authority: null, clause: null, facts: 'los hechos no se confirmaron', source: null }, wasSuspended: true })
          );

        await request(app.getHttpServer() as Server)
          .post(`/${PREFIX}/admin/professionals/usr-dietitian/lift`)
          .send({ facts: 'los hechos no se confirmaron' })
          .expect(200);
        await settle();

        expect(lift).toHaveBeenCalledWith('usr-dietitian', 'usr-owner', { facts: 'los hechos no se confirmaron' });
        expect(send.mock.calls[0]?.[0]).toMatchObject({ kind: 'professional-suspension-lifted' });
        expect(send.mock.calls[0]?.[0].text).toBe(
          'Desde hoy puedes volver a abrir tu consulta en NutrIA. Lo hemos revisado y los hechos no se confirmaron.'
        );

        send.mockClear();
        lift.mockResolvedValueOnce(act('lifted', { wasSuspended: false }));

        await request(app.getHttpServer() as Server)
          .post(`/${PREFIX}/admin/professionals/usr-dietitian/lift`)
          .send({})
          .expect(200);
        await settle();

        expect(send).not.toHaveBeenCalled();
      });

      /* `textos/06` § W bis.4 (drafted, not yet approved): a lift that ended a close says which close, before or after its day. */
      it.each([
        [
          'not yet carried out',
          false,
          'No vamos a cerrar tu consulta en NutrIA',
          'Tu consulta sigue abierta, y también hemos levantado la suspensión.'
        ],
        [
          'already carried out',
          true,
          'Puedes volver a abrir tu consulta en NutrIA',
          'Los enlaces con tus clientes terminaron con el cierre y no vuelven solos'
        ]
      ])('lifts a close %s, and mails § W bis.4 rather than § W bis.2', async (_case, carriedOut, subject, sentence) => {
        jest
          .spyOn(ProfessionalController, 'lift')
          .mockResolvedValue(
            act('lifted', {
              statement: { authority: null, clause: null, facts: null, source: null },
              wasSuspended: true,
              withdrawnClose: { carriedOut, closesAt: new Date('2026-12-19T09:00:00.000Z') }
            })
          );

        await request(app.getHttpServer() as Server)
          .post(`/${PREFIX}/admin/professionals/usr-dietitian/lift`)
          .send({})
          .expect(200);
        await settle();

        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0]?.[0]).toMatchObject({ kind: 'professional-close-withdrawn', subject });
        expect(send.mock.calls[0]?.[0].text).toContain(sentence);
      });

      it('answers the core’s refusal with the 404, and mails nobody', async () => {
        jest.spyOn(ProfessionalController, 'suspend').mockRejectedValue(new NotFoundError('Not Found'));

        await request(app.getHttpServer() as Server)
          .post(`/${PREFIX}/admin/professionals/usr-plain/suspension`)
          .send(STATEMENT)
          .expect(404);
        await settle();

        expect(send).not.toHaveBeenCalled();
      });

      it('never undoes the act when the mail fails: the answer stands', async () => {
        send.mockResolvedValue(false);
        jest.spyOn(ProfessionalController, 'suspend').mockResolvedValue(act('suspended', { suspended: true }));

        await request(app.getHttpServer() as Server)
          .post(`/${PREFIX}/admin/professionals/usr-dietitian/suspension`)
          .send(STATEMENT)
          .expect(200);
        await settle();

        expect(send).toHaveBeenCalledTimes(1);
      });

      it.each([
        ['no facts', { source: 'own_review' }],
        ['an authority as the source with none named', { facts: 'x', source: 'authority' }],
        ['markup in the facts', { facts: '<script>x</script>', source: 'own_review' }]
      ])('refuses a statement with %s as 422, and writes nothing', async (_label, body) => {
        const suspend = jest.spyOn(ProfessionalController, 'suspend');

        await request(app.getHttpServer() as Server)
          .post(`/${PREFIX}/admin/professionals/usr-dietitian/suspension`)
          .send(body)
          .expect(422);
        expect(suspend).not.toHaveBeenCalled();
      });
    });
  });
});
