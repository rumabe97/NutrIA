import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ENV } from '../../config/index.js';
import { RecipeIllustrator } from '../ai/RecipeIllustrator.service.js';
import { RecipeRewriter } from '../ai/RecipeRewriter.service.js';
import { CheckInReminderService } from '../notifications/CheckInReminder.service.js';
import { IllustrateController } from './illustrate.controller.js';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

/**
 * The cron's door. Wrong secret, no secret, no secret configured: all 404, the
 * same as every other denial, so probing does not confirm the route exists.
 */
describe('GET /cron/illustrate', () => {
  let app: INestApplication;
  const illustrateMissing = jest.fn<(limit: number) => Promise<{ drawn: number; failed: number; pending: number }>>();
  const rewriteOutdated = jest.fn<(limit: number) => Promise<{ pending: number; rewritten: number; skipped: number }>>();
  const sweep = jest.fn(async () => Promise.resolve({ considered: 0, failed: 0, sent: 0 }));

  afterEach(async () => {
    jest.clearAllMocks();
    await app?.close();
  });

  async function boot(secret: string | undefined): Promise<Server> {
    const moduleRef = await Test.createTestingModule({
      controllers: [IllustrateController],
      providers: [
        { provide: ENV, useValue: { CRON_SECRET: secret } },
        { provide: RecipeIllustrator, useValue: { illustrateMissing } },
        { provide: RecipeRewriter, useValue: { rewriteOutdated } },
        { provide: CheckInReminderService, useValue: { sweep } }
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

  it('runs a bounded rewrite sweep on its own route', async () => {
    rewriteOutdated.mockResolvedValue({ pending: 10, rewritten: 9, skipped: 1 });
    const server = await boot('a-secret-of-sixteen-chars');

    const response = await request(server).get('/cron/rewrite-steps').set('Authorization', 'Bearer a-secret-of-sixteen-chars').expect(200);

    expect(response.body).toEqual({ pending: 10, rewritten: 9, skipped: 1 });
    expect(rewriteOutdated).toHaveBeenCalledWith(10);
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
