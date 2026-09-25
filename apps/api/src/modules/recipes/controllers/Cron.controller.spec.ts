import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { CheckInReminderService } from '../../notifications/index.js';
import { CronController } from './Cron.controller.js';
import { ExpiredInvitationsService } from '../../care/services/ExpiredInvitations.service.js';
import { ENV } from '../../../config/index.js';
import { RecipeIllustrator, RecipeRewriter } from '../../ai/index.js';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

/**
 * The cron's door. Wrong secret, no secret, no secret configured: all 404, the
 * same as every other denial, so probing does not confirm the route exists.
 */
describe('GET /cron/illustrate', () => {
  let app: INestApplication;
  const illustrateMissing = jest.fn<(limit: number) => Promise<{ drawn: number; failed: number; pending: number }>>();
  const rewriteOutdated = jest.fn<(limit: number) => Promise<{ pending: number; rewritten: number; skipped: number; unreached: number }>>();
  const sweep = jest.fn(async () => Promise.resolve({ considered: 0, failed: 0, pushed: 0, sent: 0 }));
  const forget = jest.fn(async () => Promise.resolve());

  afterEach(async () => {
    jest.clearAllMocks();
    await app?.close();
  });

  async function boot(secret: string | undefined): Promise<Server> {
    const moduleRef = await Test.createTestingModule({
      controllers: [CronController],
      providers: [
        { provide: ENV, useValue: { CRON_SECRET: secret } },
        { provide: RecipeIllustrator, useValue: { illustrateMissing } },
        { provide: RecipeRewriter, useValue: { rewriteOutdated } },
        { provide: CheckInReminderService, useValue: { sweep } },
        { provide: ExpiredInvitationsService, useValue: { forget } }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    return app.getHttpServer() as Server;
  }

  it('runs a bounded sweep for the platform’s bearer', async () => {
    illustrateMissing.mockResolvedValue({ drawn: 2, failed: 0, pending: 2 });
    const server = await boot('a-secret-of-sixteen-chars');

    const response = await request(server).get('/cron/illustrate').set('Authorization', 'Bearer a-secret-of-sixteen-chars').expect(200);

    expect(response.body).toEqual({ drawn: 2, failed: 0, pending: 2 });
    expect(illustrateMissing).toHaveBeenCalledWith(6);
  });

  /* RGPD art. 14: the invitation mail promises an address is gone within 14 days, answered or not. */
  it('deletes expired invitations on the daily reminder run, then sends the reminders', async () => {
    const server = await boot('a-secret-of-sixteen-chars');

    await request(server).get('/cron/reminders').set('Authorization', 'Bearer a-secret-of-sixteen-chars').expect(200);

    expect(forget).toHaveBeenCalledTimes(1);
    expect(sweep).toHaveBeenCalledTimes(1);
  });

  it('deletes nothing for the wrong bearer', async () => {
    const server = await boot('a-secret-of-sixteen-chars');

    await request(server).get('/cron/reminders').set('Authorization', 'Bearer wrong').expect(404);
    expect(forget).not.toHaveBeenCalled();
  });

  it('runs a bounded rewrite sweep on its own route', async () => {
    rewriteOutdated.mockResolvedValue({ pending: 12, rewritten: 9, skipped: 1, unreached: 2 });
    const server = await boot('a-secret-of-sixteen-chars');

    const response = await request(server).get('/cron/rewrite-steps').set('Authorization', 'Bearer a-secret-of-sixteen-chars').expect(200);

    expect(response.body).toEqual({ pending: 12, rewritten: 9, skipped: 1, unreached: 2 });
    expect(rewriteOutdated).toHaveBeenCalledWith(12);
  });

  it('guards the rewrite route exactly as it guards the other', async () => {
    const server = await boot('a-secret-of-sixteen-chars');

    await request(server).get('/cron/rewrite-steps').set('Authorization', 'Bearer wrong').expect(404);
    expect(rewriteOutdated).not.toHaveBeenCalled();
  });

  it('is 404 for the wrong bearer, and draws nothing', async () => {
    const server = await boot('a-secret-of-sixteen-chars');

    await request(server).get('/cron/illustrate').set('Authorization', 'Bearer wrong').expect(404);
    expect(illustrateMissing).not.toHaveBeenCalled();
  });

  it('is 404 with no bearer at all', async () => {
    const server = await boot('a-secret-of-sixteen-chars');

    await request(server).get('/cron/illustrate').expect(404);
  });

  it('does not exist when no secret is configured, whatever is sent', async () => {
    const server = await boot(undefined);

    await request(server).get('/cron/illustrate').set('Authorization', 'Bearer anything').expect(404);
    expect(illustrateMissing).not.toHaveBeenCalled();
  });
});
