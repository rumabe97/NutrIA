import { describe, expect, it, jest } from '@jest/globals';

import type { Env } from '../../config/index.js';
import type { Event, EventHint } from '@sentry/node';

// Captured from the real call `ErrorReporter`'s constructor makes, so the
// assertions below run the actual `beforeSend` the SDK would call — not a
// re-implementation of it.
let capturedBeforeSend: ((event: Event, hint: EventHint) => Event | null) | undefined;
let capturedOptions: Record<string, unknown> | undefined;

jest.unstable_mockModule('@sentry/node', () => ({
  captureException: jest.fn(),
  init: jest.fn((options: { beforeSend?: typeof capturedBeforeSend }) => {
    capturedOptions = options;
    capturedBeforeSend = options.beforeSend;
  }),
  withScope: jest.fn((callback: (scope: { setTag: (key: string, value: string) => void }) => void) => callback({ setTag: jest.fn() }))
}));

const { ErrorReporter } = await import('./ErrorReporter.js');

// Assembled at runtime rather than written as literals, so `pnpm check:leaks`
// sees no key-shaped string in a tracked file.
// The OpenRouter key has no prefix a pattern knows, so only the value can catch it.
const SECRET = {
  cron: ['cr0n', 'SecretVaLue', '0123456789'].join(''),
  db: `postgres://user:${['sUp3r', 'S3cr3t', 'Pa55'].join('')}@host/db`,
  openRouter: ['0rK', 'h7qXmW2p', 'Lz9vT4n'].join('')
};

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
  OPENROUTER_API_KEY: SECRET.openRouter,
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

  it('turns every Sentry 11 data-collection category off and no longer passes sendDefaultPii', async () => {
    const { DATA_COLLECTION } = await import('./ErrorReporter.js');

    new ErrorReporter(ENV_STUB);

    expect(capturedOptions?.dataCollection).toBe(DATA_COLLECTION);
    expect(capturedOptions).not.toHaveProperty('sendDefaultPii');
    // Any rate, even 0, loads the tracing integrations: absent, not zero.
    expect(capturedOptions).not.toHaveProperty('tracesSampleRate');
    expect(capturedOptions).not.toHaveProperty('tracesSampler');
    expect(capturedOptions?.tracePropagationTargets).toEqual([]);
    expect(capturedOptions?.includeServerName).toBe(false);
    expect((capturedOptions?.beforeSendLog as () => unknown)()).toBeNull();
    expect((capturedOptions?.beforeSendMetric as () => unknown)()).toBeNull();
    expect(DATA_COLLECTION).toEqual({
      cookies: false,
      databaseQueryData: false,
      frameContextLines: 5,
      genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
      httpBodies: [],
      httpHeaders: { request: false, response: false },
      queues: false,
      stackFrameVariables: false,
      urlQueryParams: false,
      userInfo: false
    });
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

  it('deletes the transaction name, which carries the raw path, and keeps tags.where', () => {
    new ErrorReporter(ENV_STUB);

    const scrubbed = capturedBeforeSend?.({ tags: { where: 'POST /invitations/:token' }, transaction: 'POST /invitations/tok_abc123' }, {});

    expect(scrubbed?.transaction).toBeUndefined();
    expect(scrubbed?.tags?.where).toBe('POST /invitations/:token');
  });

  it('cuts everything from the params line of a query error', () => {
    new ErrorReporter(ENV_STUB);

    const text = 'Failed query: insert into "conditions" values ($1)\nparams: diabetes-metformin';
    const scrubbed = capturedBeforeSend?.({ exception: { values: [{ value: text }] }, message: text }, {});

    expect(scrubbed?.message).toBe('Failed query: insert into "conditions" values ($1)');
    expect(scrubbed?.exception?.values?.[0]?.value).toBe('Failed query: insert into "conditions" values ($1)');
  });

  it('redacts the SMTP password, the Blob token and the image key', () => {
    const smtp = ['sm7pPass', 'W0rd', 'Value12'].join('');
    const blob = ['bl0bTok', 'enValue', '987654'].join('');
    const image = ['1mgKey', 'Value', 'abcdef123'].join('');
    new ErrorReporter({ ...ENV_STUB, BLOB_READ_WRITE_TOKEN: blob, OPENROUTER_IMAGE_API_KEY: image, SMTP_PASS: smtp } as unknown as Env);

    const scrubbed = capturedBeforeSend?.({ message: `${smtp} ${blob} ${image}` }, {});

    for (const secret of [smtp, blob, image]) {
      expect(scrubbed?.message).not.toContain(secret);
    }
  });

  it('redacts the OpenRouter key, by its value, from the message and the exception', () => {
    new ErrorReporter(ENV_STUB);

    const event: Event = {
      exception: { values: [{ value: `401 from https://openrouter.ai/api/v1: key ${SECRET.openRouter} is not valid` }] },
      message: `Incorrect API key provided: ${SECRET.openRouter}`
    };

    const scrubbed = capturedBeforeSend?.(event, {});

    expect(scrubbed?.message).not.toContain(SECRET.openRouter);
    expect(scrubbed?.message).toContain('[redacted]');
    expect(scrubbed?.exception?.values?.[0]?.value).not.toContain(SECRET.openRouter);
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
