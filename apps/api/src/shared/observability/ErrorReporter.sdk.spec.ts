import { afterAll, describe, expect, it } from '@jest/globals';
import * as Sentry from '@sentry/node';
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';

import { ErrorReporter } from './ErrorReporter.js';

import type { Env } from '../../config/index.js';
import type { AddressInfo } from 'node:net';

// The REAL SDK, no mock: a local sink stands in for Sentry and records every
// envelope that actually leaves the process — the ones that never pass
// `beforeSend` (spans) included.
const envelopes: string[] = [];
const sink = createServer((request, response) => {
  const chunks: Buffer[] = [];
  request.on('data', (chunk: Buffer) => chunks.push(chunk));
  request.on('end', () => {
    const raw = Buffer.concat(chunks);
    envelopes.push((request.headers['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw).toString('utf8'));
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{}');
  });
});
await new Promise<void>(resolve => sink.listen(0, '127.0.0.1', resolve));
const sinkPort = (sink.address() as AddressInfo).port;

Reflect.set(process.env, 'SENTRY_TRACES_SAMPLE_RATE', '1');

const reporter = new ErrorReporter({ NODE_ENV: 'test', SENTRY_DSN: `http://key@127.0.0.1:${sinkPort}/1` } as unknown as Env);

const app = createServer((request, response) => {
  request.resume();
  request.on('end', () => {
    reporter.report(new Error('boom'), 'POST /meal-plans/:id');
    response.writeHead(500);
    response.end();
  });
});
await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
const appPort = (app.address() as AddressInfo).port;

afterAll(async () => {
  await Sentry.close(2000);
  app.close();
  sink.close();
});

describe('ErrorReporter on the real SDK', () => {
  it('sends the error and nothing of the request, and no span or transaction, even when the caller asks to be sampled', async () => {
    await Sentry.suppressTracing(() =>
      fetch(`http://127.0.0.1:${appPort}/meal-plans/PATHID-0190aaaa?token=QUERY-SECRET`, {
        body: JSON.stringify({ condition: 'BODY-diabetes' }),
        headers: {
          'content-type': 'application/json',
          cookie: 'session=COOKIE-VALUE',
          'sentry-trace': '0123456789abcdef0123456789abcdef-0123456789abcdef-1'
        },
        method: 'POST'
      })
    );
    await Sentry.flush(3000);
    await new Promise(resolve => setTimeout(resolve, 500));
    await Sentry.flush(3000);

    const all = envelopes.join('\n');

    expect(all).toContain('boom');
    expect(all).toContain('POST /meal-plans/:id');
    expect(all).not.toMatch(/"type":"(span|transaction)"/);

    for (const leak of ['PATHID-0190aaaa', 'QUERY-SECRET', 'COOKIE-VALUE', 'BODY-diabetes']) {
      expect(all).not.toContain(leak);
    }
  });
});
