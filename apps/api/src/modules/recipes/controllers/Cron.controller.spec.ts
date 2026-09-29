import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { CheckInReminderService } from '../../notifications/index.js';
import { CronController } from './Cron.controller.js';
import { CronRunService } from '../services/index.js';
import { ExpiredInvitationsService } from '../../care/services/ExpiredInvitations.service.js';
import { ENV } from '../../../config/index.js';
import { RecipeRewriter } from '../../ai/index.js';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const SECRET = 'a-secret-of-sixteen-chars';

/**
 * The cron's door. Wrong secret, no secret, no secret configured: all 404, the
 * same as every other denial, so probing does not confirm the route exists.
 */
describe('the cron routes', () => {
  let app: INestApplication;
  const rewriteOutdated = jest.fn<(limit: number) => Promise<{ pending: number; rewritten: number; skipped: number; unreached: number }>>();
  const sweep = jest.fn(async () => Promise.resolve({ considered: 0, failed: 0, pushed: 0, sent: 0 }));
  const forget = jest.fn(async () => Promise.resolve());
  const record = jest.fn(async (_job: string, _counts: Readonly<Record<string, number>>) => Promise.resolve());
  const bearer = (secret: string) => ['Bearer', secret].join(' ');

  afterEach(async () => {
    jest.clearAllMocks();
    await app?.close();
  });

  async function boot(secret: string | undefined): Promise<Server> {
    const moduleRef = await Test.createTestingModule({
      controllers: [CronController],
      providers: [
        { provide: ENV, useValue: { CRON_SECRET: secret } },
        { provide: RecipeRewriter, useValue: { rewriteOutdated } },
        { provide: CheckInReminderService, useValue: { sweep } },
        { provide: ExpiredInvitationsService, useValue: { forget } },
        { provide: CronRunService, useValue: { record } }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    return app.getHttpServer() as Server;
  }

  /* RGPD art. 14: the invitation mail promises an address is gone within 14 days, answered or not. */
  it('deletes expired invitations on the daily reminder run, then sends the reminders', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer(SECRET)).expect(200);

    expect(forget).toHaveBeenCalledTimes(1);
    expect(sweep).toHaveBeenCalledTimes(1);
  });

  /* 0071: a run leaves no row of its own, so each one that finishes says so — its job and its counts. */
  it('records the reminder run once it finished, with its counts', async () => {
    sweep.mockResolvedValueOnce({ considered: 3, failed: 1, pushed: 1, sent: 2 });
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer(SECRET)).expect(200);

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith('reminders', { considered: 3, failed: 1, pushed: 1, sent: 2 });
  });

  it('records no run that did not finish', async () => {
    sweep.mockRejectedValueOnce(new Error('database gone'));
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer(SECRET)).expect(500);

    expect(record).not.toHaveBeenCalled();
  });

  it('deletes nothing for the wrong bearer', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer('wrong')).expect(404);
    expect(forget).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('runs a bounded rewrite sweep on its own route', async () => {
    rewriteOutdated.mockResolvedValue({ pending: 12, rewritten: 9, skipped: 1, unreached: 2 });
    const server = await boot(SECRET);

    const response = await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);

    expect(response.body).toEqual({ pending: 12, rewritten: 9, skipped: 1, unreached: 2 });
    expect(rewriteOutdated).toHaveBeenCalledWith(12);
    expect(record).toHaveBeenCalledWith('rewrite', { pending: 12, rewritten: 9, skipped: 1, unreached: 2 });
  });

  it('guards the rewrite route exactly as it guards the other', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer('wrong')).expect(404);
    expect(rewriteOutdated).not.toHaveBeenCalled();
  });

  /* 0066: a dish is drawn the first time its meal page is opened, never by a sweep. */
  it('has no illustration sweep any more', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/illustrate').set('Authorization', bearer(SECRET)).expect(404);
  });

  it('is 404 with no bearer at all', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/rewrite-steps').expect(404);
    expect(rewriteOutdated).not.toHaveBeenCalled();
  });

  it('does not exist when no secret is configured, whatever is sent', async () => {
    const server = await boot(undefined);

    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer('anything')).expect(404);
    expect(rewriteOutdated).not.toHaveBeenCalled();
  });
});
