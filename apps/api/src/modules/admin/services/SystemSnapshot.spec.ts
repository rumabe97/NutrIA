import { describe, expect, it } from '@jest/globals';

import { systemSnapshot } from './SystemSnapshot.js';

import type { Env } from '../../../config/index.js';

/** Every setting the snapshot could leak, filled with something that can be searched for. */
const SECRETS = {
  AI_IMAGE_MODEL: 'secret-image-model',
  AI_MODEL: 'secret-model-name',
  AI_PROVIDER: 'openrouter',
  BETTER_AUTH_SECRET: 'secret-better-auth-'.padEnd(48, 'x'),
  BLOB_READ_WRITE_TOKEN: 'secret-blob-token',
  CRON_SECRET: 'secret-cron-secret-value',
  DATABASE_URL: 'postgres://secret-user:secret-pass@secret-host/db',
  EMAIL_FROM: 'secret-sender@example.com',
  GOOGLE_OAUTH_CLIENT_SECRET: 'secret-google-secret',
  OPENROUTER_API_KEY: 'secret-openrouter-key',
  OPENROUTER_IMAGE_API_KEY: 'secret-image-key',
  OWNER_EMAIL: 'secret-owner@example.com',
  SENTRY_DSN: 'https://secret-key@sentry.example/1',
  SMTP_HOST: 'secret-smtp-host',
  SMTP_PASS: 'secret-smtp-pass',
  SMTP_USER: 'secret-smtp-user',
  STRIPE_SECRET_KEY: 'sk_test_secret',
  STRIPE_WEBHOOK_SECRET: 'whsec_secret',
  VAPID_PRIVATE_KEY: 'secret-vapid-private',
  VAPID_PUBLIC_KEY: 'secret-vapid-public',
  VAPID_SUBJECT: 'mailto:secret-vapid@example.com',
  VERCEL_GIT_COMMIT_SHA: '0123456789abcdef0123456789abcdef01234567'
};

const ENV = { ...SECRETS, AI_IMAGE_MONTHLY_CAP_USD: 10, AI_REWRITE_STEPS: true, NODE_ENV: 'production' } as unknown as Env;

describe('systemSnapshot', () => {
  it('turns every integration into a yes or a no', () => {
    const snapshot = systemSnapshot(ENV, { mail: true, push: false });

    expect(snapshot.integrations).toEqual({
      cronSecret: true,
      mail: true,
      ownerAddress: true,
      pictures: true,
      push: false,
      rewriteSweep: true,
      sentry: true
    });
  });

  it('says no for what is not set, and for pictures without their key or their blob token', () => {
    const bare = { AI_IMAGE_MONTHLY_CAP_USD: 10, AI_PROVIDER: 'openrouter', AI_REWRITE_STEPS: false, NODE_ENV: 'production' } as unknown as Env;

    expect(systemSnapshot(bare, { mail: false, push: false }).integrations).toEqual({
      cronSecret: false,
      mail: false,
      ownerAddress: false,
      pictures: false,
      push: false,
      rewriteSweep: false,
      sentry: false
    });
    expect(systemSnapshot({ ...ENV, BLOB_READ_WRITE_TOKEN: undefined } as unknown as Env, { mail: true, push: true }).integrations.pictures).toBe(
      false
    );
    expect(systemSnapshot({ ...ENV, OPENROUTER_IMAGE_API_KEY: undefined } as unknown as Env, { mail: true, push: true }).integrations.pictures).toBe(
      false
    );
  });

  it('carries only booleans, versions, a cap and a commit — no configuration value, whatever the environment holds', () => {
    const snapshot = systemSnapshot(ENV, { mail: true, push: true });
    const answer = JSON.stringify(snapshot);

    for (const value of Object.values(SECRETS).filter(secret => secret !== SECRETS.VERCEL_GIT_COMMIT_SHA)) {
      expect(answer).not.toContain(value);
    }

    expect(snapshot.commit).toBe(SECRETS.VERCEL_GIT_COMMIT_SHA);
    expect(snapshot.promptVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(snapshot.stepsVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(snapshot.pictureMonthlyCapUsd).toBe(10);
    expect(Object.values(snapshot.integrations).every(value => typeof value === 'boolean')).toBe(true);
    expect(Object.keys(snapshot).sort()).toEqual(['commit', 'integrations', 'pictureMonthlyCapUsd', 'promptVersion', 'stepsVersion']);
  });
});
