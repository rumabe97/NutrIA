#!/usr/bin/env node
/**
 * Can the deployed entry be loaded under the function runtime's module rules?
 *
 * The runtime refuses `require()` of an ES module — its own loader throws
 * `ERR_REQUIRE_ESM` — while Node 22.12+ allows it by default. So a CommonJS
 * dependency that `require()`s the ESM `@nestjs/*` passes every local run and
 * every test, and kills the function on its first cold start with nothing else
 * in the log. `nestjs-pino` was the live example.
 *
 * This imports the entry under `--no-experimental-require-module`, which is the
 * rule the runtime applies, and fails on anything that stops it loading. It runs
 * as part of `build`, so a violating dependency fails the deploy at build time
 * rather than at the first request.
 *
 * Nothing connects: the database client is lazy and nothing bootstraps here. The
 * placeholders below let environment validation pass where no `.env` exists, and
 * do not override a real value that is already set.
 */
process.env.APP_URL ??= 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET ??= 'check-cjs-placeholder-secret-value';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3001';
process.env.DATABASE_URL ??= 'postgres://check-cjs@localhost/placeholder';

const NO_REQUIRE_ESM = process.execArgv.includes('--no-experimental-require-module');

if (!NO_REQUIRE_ESM) {
  console.error('check:cjs must run under --no-experimental-require-module, or it proves nothing.');
  process.exit(2);
}

try {
  await import('../vercel/index.js');
  console.log('check:cjs ✓ the deployed entry loads without require(esm)');
  process.exit(0);
} catch (error) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : 'unknown';
  const [first] = String(error instanceof Error ? error.message : error).split('\n');

  console.error(`check:cjs ✗ the deployed entry cannot be loaded (${code})\n  ${first}`);

  if (code === 'ERR_REQUIRE_ESM' || code === 'ERR_REQUIRE_ASYNC_MODULE') {
    console.error('  A CommonJS dependency is require()-ing an ES module. Replace it or load it with import().');
  }

  process.exit(1);
}
