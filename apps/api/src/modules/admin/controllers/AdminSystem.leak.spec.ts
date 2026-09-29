import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import { createRequire } from 'node:module';
import express from 'express';
import { pathToFileURL } from 'node:url';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { AdminGuard } from '../../../shared/guards/index.js';
import { AdminSystemController } from './AdminSystem.controller.js';
import { AdminSystemService } from '../services/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { EmailService } from '../../email/services/Email.service.js';
import { ENV } from '../../../config/index.js';
import { PushService } from '../../notifications/index.js';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

/** Placeholders shaped like the settings they stand for, none of them a real value. */
const PLACEHOLDERS = {
  AI_IMAGE_MODEL: 'placeholder-image-model-name',
  AI_MODEL: 'placeholder-text-model-name',
  BETTER_AUTH_SECRET: 'placeholder-auth-secret-'.padEnd(48, 'x'),
  BLOB_READ_WRITE_TOKEN: 'placeholder-blob-token',
  CRON_SECRET: 'placeholder-cron-secret',
  DATABASE_URL: 'postgres://placeholder-user:placeholder-pass@placeholder-host/db',
  EMAIL_FROM: 'placeholder-sender@example.invalid',
  GOOGLE_OAUTH_CLIENT_SECRET: 'placeholder-google-secret',
  OPENROUTER_API_KEY: 'placeholder-openrouter-key',
  OPENROUTER_IMAGE_API_KEY: 'placeholder-image-key',
  OWNER_EMAIL: 'placeholder-owner@example.invalid',
  SENTRY_DSN: 'https://placeholder-key@sentry.example.invalid/1',
  SMTP_HOST: 'placeholder-smtp-host',
  SMTP_PASS: 'placeholder-smtp-pass',
  SMTP_USER: 'placeholder-smtp-user',
  STRIPE_SECRET_KEY: 'sk_test_placeholder',
  STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
  VAPID_PRIVATE_KEY: 'placeholder-vapid-private',
  VAPID_PUBLIC_KEY: 'placeholder-vapid-public',
  VAPID_SUBJECT: 'mailto:placeholder-vapid@example.invalid'
};

const COMMIT = '0123456789abcdef0123456789abcdef01234567';

/**
 * `GET /admin/system` end to end through the real snapshot and the real
 * `AdminSystemController` of `packages/core`, with only the database read
 * replaced. However the environment is filled, the answer holds none of it
 * (`0071`, `0028`) and has exactly the keys the console reads.
 */
describe('GET /admin/system leaks nothing from the environment', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // The repositories are not a public export of core: reach the built module core itself imports, so the stub lands on the same object.
    const controllers = createRequire(import.meta.url).resolve('core/controllers/Admin');
    const { AdminSystemRepository } = (await import(
      pathToFileURL(controllers.replace(/controllers[\\/]Admin[\\/]index\.js$/, 'repositories/Admin/index.js')).href
    )) as { AdminSystemRepository: { lastCronRuns: () => Promise<unknown>; mailPerDay: () => Promise<unknown> } };

    jest.spyOn(AdminSystemRepository, 'lastCronRuns').mockResolvedValue([{ at: new Date(), job: 'reminders' }]);
    jest.spyOn(AdminSystemRepository, 'mailPerDay').mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminSystemController],
      providers: [
        AdminSystemService,
        {
          provide: ENV,
          useValue: {
            ...PLACEHOLDERS,
            AI_IMAGE_MONTHLY_CAP_USD: 10,
            AI_PROVIDER: 'openrouter',
            AI_REWRITE_STEPS: true,
            NODE_ENV: 'production',
            VERCEL_GIT_COMMIT_SHA: COMMIT
          }
        },
        { provide: EmailService, useValue: { configured: true } },
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
                role: 'admin'
              };

              return true;
            }
          }
        },
        { provide: APP_GUARD, useClass: AdminGuard }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use(express.json());
    await app.init();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('holds none of the environment’s values and only the keys the console reads', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/admin/system')
      .expect(200);
    const text = JSON.stringify(response.body);

    const leaked = Object.entries(PLACEHOLDERS).flatMap(([name, value]) => (text.includes(value) ? [name] : []));

    expect(leaked).toEqual([]);
    expect(Object.keys(response.body as object).sort()).toEqual(['caps', 'commit', 'crons', 'integrations', 'mail', 'period', 'versions', 'window']);
    expect((response.body as { commit: string }).commit).toBe(COMMIT);
    expect((response.body as { integrations: Record<string, boolean> }).integrations).toMatchObject({
      cronSecret: true,
      ownerAddress: true,
      sentry: true
    });
  });
});
