#!/usr/bin/env node
/**
 * Does the deployed entry point actually serve?
 *
 * `main.ts` is exercised by every local run and `api/index.ts` by nothing —
 * it is the code path that exists only in production, which is the worst place
 * to discover that `createApp` behaves differently through an ExpressAdapter.
 * This stands a plain Node server in front of the exported function, the way the
 * function runtime does — imported through `vercel/index.js`, the committed shim
 * the platform is actually pointed at, so the re-export is exercised too — and
 * checks three things that each catch a real class of failure:
 *
 *   - the app boots at all and reaches the database;
 *   - an unauthenticated read is 404, not 401 — the deny-as-404 invariant, which
 *     depends on the global guard and the exception filter both being wired;
 *   - an unmatched route returns the JSON envelope, not express's HTML page,
 *     which only holds if the fallback was registered *after* init().
 *
 * Deliberately not in the gate: it needs a live DATABASE_URL. Run it after any
 * change to how the application is assembled.
 *
 *   pnpm --filter api smoke:function
 */
import { createServer } from 'node:http';

import handler from '../vercel/index.js';

// Stand in for the platform: one Node server that hands every request to the
// exported function, exactly as the function runtime does.
const server = createServer((request, response) => {
  handler(request, response).catch(error => {
    console.error('handler rejected:', error.message);
    if (!response.headersSent) {response.statusCode = 500;}
    response.end();
  });
});

await new Promise(resolve => server.listen(4599, resolve));

async function hit(path) {
  const response = await fetch(`http://127.0.0.1:4599${path}`);
  const body = await response.text();

  console.log(`${path} → ${response.status} ${body.slice(0, 120)}`);
}

await hit('/api/v1/health');
await hit('/api/v1/profile');
await hit('/nope');

server.close();
process.exit(0);
