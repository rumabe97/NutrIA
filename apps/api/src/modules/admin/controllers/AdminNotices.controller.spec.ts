import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { NoticeController } from 'core/controllers/Notice';
import { UserController } from 'core/controllers/User';
import { ConflictError, InputParseError, NoticeDailyCapError } from 'core/entities/Error';

import { AdminNoticesController } from './AdminNotices.controller.js';
import { AdminNoticesService } from '../services/index.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { EmailService } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import type { OutgoingEmail } from '../../email/services/index.js';

const PREFIX = 'api/v1';
const NOT_FOUND = { code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 };

/** Who the request is: the owner with the second factor by default, anybody else when a test says so. */
const session = { role: 'admin' as 'admin' | 'user' };

/*
 * Project 025 phase 10, `textos/06` § Z: the owner's notice to every account,
 * from the console. The rules — who, once, the day, the order of mail and row —
 * are `NoticeController`'s spec; this one holds the doors.
 */
describe('AdminNoticesController', () => {
  let app: INestApplication;
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminNoticesController],
      providers: [
        AdminNoticesService,
        { provide: EmailService, useValue: { send } },
        { provide: ENV, useValue: { APP_URL: 'https://nutria.example', EMAIL_FROM: 'hola@nutria.example' } },
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
                role: session.role,
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
    session.role = 'admin';
    jest.spyOn(UserController, 'needsSecondFactor').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    send.mockReset();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  it('previews for the owner: the totals, the day as written, and the page the query asks for', async () => {
    const view = {
      alreadySent: 0,
      campaignDate: null,
      dateAsWritten: { 'en-GB': '1 December 2026', 'es-ES': '1 de diciembre de 2026' },
      recipients: { offset: 100, rows: [{ email: 'ana@example.invalid', locale: 'es-ES' }], size: 50, total: 160 },
      skippedUnconfirmed: 1,
      toSend: 160
    };
    const preview = jest.spyOn(NoticeController, 'preview').mockResolvedValue(view);

    const response = await request(server())
      .post(`/${PREFIX}/admin/notices/terms-2.4.0/preview?offset=100&size=50`)
      .send({ date: '2026-12-01' })
      .expect(200);

    expect(response.body).toEqual(view);
    expect(preview).toHaveBeenCalledWith('terms-2.4.0', { date: '2026-12-01' }, { offset: 100, size: 50 }, expect.any(Function));
    expect(send).not.toHaveBeenCalled();
  });

  it('pages 25 from the start by default, and refuses a page larger than 100', async () => {
    const preview = jest
      .spyOn(NoticeController, 'preview')
      .mockResolvedValue({
        alreadySent: 0,
        campaignDate: null,
        dateAsWritten: { 'en-GB': '', 'es-ES': '' },
        recipients: { offset: 0, rows: [], size: 25, total: 0 },
        skippedUnconfirmed: 0,
        toSend: 0
      });

    await request(server()).post(`/${PREFIX}/admin/notices/terms-2.4.0/preview`).send({ date: '2026-12-01' }).expect(200);
    expect(preview).toHaveBeenCalledWith('terms-2.4.0', { date: '2026-12-01' }, { offset: 0, size: 25 }, expect.any(Function));

    await request(server()).post(`/${PREFIX}/admin/notices/terms-2.4.0/preview?size=101`).send({ date: '2026-12-01' }).expect(422);
  });

  it('sends a batch as the session’s owner, with the cursor from the body and never an id of anybody', async () => {
    const answer = {
      after: 'usr-9',
      failed: 1,
      failedRecipients: [{ email: 'bad@example.invalid' }],
      remaining: 4,
      sent: 2,
      skippedUnconfirmed: 1,
      stoppedEarly: false
    };
    const sendBatch = jest.spyOn(NoticeController, 'send').mockResolvedValue(answer);

    const response = await request(server())
      .post(`/${PREFIX}/admin/notices/terms-2.4.0/send`)
      .send({ after: 'usr-3', date: '2026-12-01', ownerId: 'usr-other' })
      .expect(200);

    expect(response.body).toEqual(answer);
    expect(sendBatch).toHaveBeenCalledWith('terms-2.4.0', 'usr-owner', { after: 'usr-3', date: '2026-12-01' }, expect.any(Function));
  });

  it('answers the day’s cap with its own 409: the cap and when it resets', async () => {
    jest.spyOn(NoticeController, 'send').mockRejectedValue(new NoticeDailyCapError(200, new Date('2026-11-20T23:00:00.000Z')));

    const response = await request(server()).post(`/${PREFIX}/admin/notices/terms-2.4.0/send`).send({ date: '2026-12-01' }).expect(409);

    expect(response.body).toMatchObject({ code: 'NOTICE_DAILY_CAP', noticeCap: { cap: 200, resetsAt: '2026-11-20T23:00:00.000Z' }, statusCode: 409 });
  });

  it('answers a day more than 60 days ahead with a 422 `too_far` — the real controller decides, nothing is sent', async () => {
    const response = await request(server()).post(`/${PREFIX}/admin/notices/terms-2.4.0/send`).send({ date: '2099-12-01' }).expect(422);

    expect(response.body).toMatchObject({ fieldErrors: { date: ['too_far'] } });
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['preview', 'send'])('is the 404 for anybody but the owner (%s), before the core is asked', async action => {
    session.role = 'user';
    const preview = jest.spyOn(NoticeController, 'preview');
    const sendBatch = jest.spyOn(NoticeController, 'send');

    const response = await request(server()).post(`/${PREFIX}/admin/notices/terms-2.4.0/${action}`).send({ date: '2026-12-01' }).expect(404);

    expect(response.body).toMatchObject({ statusCode: 404 });
    expect(preview).not.toHaveBeenCalled();
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('is the 404 for the owner without the second factor, as every console door', async () => {
    jest.spyOn(UserController, 'needsSecondFactor').mockResolvedValue(true);
    const sendBatch = jest.spyOn(NoticeController, 'send');

    await request(server()).post(`/${PREFIX}/admin/notices/terms-2.4.0/send`).send({ date: '2026-12-01' }).expect(404);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('is the 404 for a notice not on core’s list — the real controller decides', async () => {
    const response = await request(server()).post(`/${PREFIX}/admin/notices/terms-9.9.9/send`).send({ date: '2026-12-01' }).expect(404);

    expect(response.body).toEqual(NOT_FOUND);
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a body without a calendar day as 422, before the core is asked', async () => {
    const sendBatch = jest.spyOn(NoticeController, 'send');

    await request(server()).post(`/${PREFIX}/admin/notices/terms-2.4.0/send`).send({ date: 'mañana' }).expect(422);
    await request(server()).post(`/${PREFIX}/admin/notices/terms-2.4.0/send`).send({}).expect(422);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('answers a day today or past with a 422 that says so — the real controller decides, nothing is sent', async () => {
    const response = await request(server()).post(`/${PREFIX}/admin/notices/terms-2.4.0/send`).send({ date: '2020-01-01' }).expect(422);

    expect(response.body).toMatchObject({ code: 'INVALID_INPUT', fieldErrors: { date: ['not_after_today'] } });
    expect(send).not.toHaveBeenCalled();
  });

  it('answers another day than the campaign’s with a 422 naming it', async () => {
    jest.spyOn(NoticeController, 'send').mockRejectedValue(new InputParseError('one notice, one day', { date: ['campaign_date:2026-12-01'] }));

    const response = await request(server()).post(`/${PREFIX}/admin/notices/terms-2.4.0/send`).send({ date: '2026-12-02' }).expect(422);

    expect(response.body).toMatchObject({ fieldErrors: { date: ['campaign_date:2026-12-01'] } });
  });

  it('answers a press while another runs with a 409', async () => {
    jest.spyOn(NoticeController, 'send').mockRejectedValue(new ConflictError('another press is running'));

    await request(server()).post(`/${PREFIX}/admin/notices/terms-2.4.0/send`).send({ date: '2026-12-01' }).expect(409);
  });
});
