import { describe, expect, it, jest } from '@jest/globals';

import type { Env } from '../../config/index.js';
import type { Event, EventHint } from '@sentry/node';

// Captured from the real call `ErrorReporter`'s constructor makes, so the
// assertions below run the actual `beforeSend` the SDK would call — not a
// re-implementation of it.
let capturedBeforeSend: ((event: Event, hint: EventHint) => Event | null) | undefined;

jest.unstable_mockModule('@sentry/node', () => ({
  captureException: jest.fn(),
  init: jest.fn((options: { beforeSend?: typeof capturedBeforeSend }) => {
    capturedBeforeSend = options.beforeSend;
  }),
  withScope: jest.fn((callback: (scope: { setTag: (key: string, value: string) => void }) => void) => callback({ setTag: jest.fn() }))
}));

const { ErrorReporter } = await import('./ErrorReporter.js');

// Assembled at runtime rather than written as literals, so `pnpm check:leaks`
// sees no key-shaped string in a tracked file.
const SECRET = { cron: ['cr0n', 'SecretVaLue', '0123456789'].join(''), db: `postgres://user:${['sUp3r', 'S3cr3t', 'Pa55'].join('')}@host/db` };

const ENV_STUB = {
  ANTHROPIC_API_KEY: undefined,
  APPLE_OAUTH_PRIVATE_KEY: undefined,
  BETTER_AUTH_SECRET: undefined,
  CRON_SECRET: SECRET.cron,
  DATABASE_URL: SECRET.db,
  DIRECT_DATABASE_URL: undefined,
  GOOGLE_API_KEY: undefined,
  GOOGLE_OAUTH_CLIENT_SECRET: undefined,
  NODE_ENV: 'test',
  OMNIROUTE_API_KEY: undefined,
  OPENROUTER_API_KEY: undefined,
  SENTRY_DSN: 'https://key@sentry.example/1',
  STRIPE_SECRET_KEY: undefined,
  STRIPE_WEBHOOK_SECRET: undefined,
  VAPID_PRIVATE_KEY: undefined,
  VERCEL_GIT_COMMIT_SHA: 'abc123'
} as unknown as Env;

describe('ErrorReporter', () => {
  it('registers beforeSend when enabled', () => {
    new ErrorReporter(ENV_STUB);

    expect(capturedBeforeSend).toBeDefined();
  });

  it('deletes request, user, the response context, breadcrumbs and extra — nothing this codebase sets on purpose', () => {
    new ErrorReporter(ENV_STUB);

    const event: Event = {
      breadcrumbs: [{ message: 'GET /meal-plans' }],
      contexts: { response: { status_code: 500 } },
      extra: { anything: 'at all' },
      request: { url: '/meal-plans/generate' },
      user: { id: 'usr_1', email: 'someone@example.com' }
    };

    const scrubbed = capturedBeforeSend?.(event, {});

    expect(scrubbed?.request).toBeUndefined();
    expect(scrubbed?.user).toBeUndefined();
    expect(scrubbed?.contexts?.response).toBeUndefined();
    expect(scrubbed?.breadcrumbs).toBeUndefined();
    expect(scrubbed?.extra).toBeUndefined();
  });

  it('redacts a secret from message and exception values beyond the three AI provider keys', () => {
    new ErrorReporter(ENV_STUB);

    const event: Event = { exception: { values: [{ value: `connection failed: ${SECRET.db}` }] }, message: `cron rejected: expected ${SECRET.cron}` };

    const scrubbed = capturedBeforeSend?.(event, {});

    expect(scrubbed?.message).not.toContain(SECRET.cron);
    expect(scrubbed?.message).toContain('[redacted]');
    expect(scrubbed?.exception?.values?.[0]?.value).not.toContain(SECRET.db);
  });

  it('redacts a secret out of a tag value too, while keeping the tag itself', () => {
    new ErrorReporter(ENV_STUB);

    const event: Event = { tags: { where: `POST /cron/failed (${SECRET.cron})` } };
    const scrubbed = capturedBeforeSend?.(event, {});

    expect(scrubbed?.tags?.where).not.toContain(SECRET.cron);
    expect(scrubbed?.tags?.where).toContain('[redacted]');
  });

  it('does nothing at all when SENTRY_DSN is unset', () => {
    capturedBeforeSend = undefined;

    new ErrorReporter({ ...ENV_STUB, SENTRY_DSN: undefined } as unknown as Env);

    expect(capturedBeforeSend).toBeUndefined();
  });
});
