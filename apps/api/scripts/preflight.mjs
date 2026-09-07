#!/usr/bin/env node
/**
 * Would the deployed entry survive its first cold start here?
 *
 * Two checks, each for a failure the platform reported at the first request and
 * nothing local had caught:
 *
 * 1. **The entry loads under the runtime's module rule.** The runtime refuses
 *    `require()` of an ES module — its own loader throws `ERR_REQUIRE_ESM` —
 *    while Node 22.12+ allows it by default. A CommonJS dependency that
 *    `require()`s the ESM `@nestjs/*` passes every local run and every test and
 *    kills the function at boot. `nestjs-pino` was the live example. This runs
 *    under `--no-experimental-require-module`, which is the rule the runtime
 *    applies.
 *
 * 2. **The environment passes boot validation.** `ConfigModule.forRoot` is async,
 *    so a validation failure at import is a rejected promise nothing observes
 *    until bootstrap. Calling `validateEnv` directly is what makes a bad
 *    production environment — a development `NODE_ENV` on a production
 *    deployment, a localhost origin — fail the build instead of the first
 *    request, and before migrations.
 *
 * It runs as part of `build`. Nothing connects: the database client is lazy and
 * nothing bootstraps here. The placeholders let validation pass where no `.env`
 * exists, and never override a value that is already set.
 */
process.env.APP_URL ??= 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET ??= 'preflight-placeholder-secret-value';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3001';
process.env.DATABASE_URL ??= 'postgres://preflight@localhost/placeholder';

if (!process.execArgv.includes('--no-experimental-require-module')) {
  console.error('preflight must run under --no-experimental-require-module, or the first check proves nothing.');
  process.exit(2);
}

function fail(step, error) {
  const code = error && typeof error === 'object' && 'code' in error ? ` (${error.code})` : '';
  const [first] = String(error instanceof Error ? error.message : error).split('\n');

  console.error(`preflight ✗ ${step}${code}\n  ${first}`);
}

try {
  await import('../vercel/index.js');
} catch (error) {
  fail('the deployed entry cannot be loaded', error);

  if (error?.code === 'ERR_REQUIRE_ESM' || error?.code === 'ERR_REQUIRE_ASYNC_MODULE') {
    console.error('  A CommonJS dependency is require()-ing an ES module. Replace it or load it with import().');
  }

  process.exit(1);
}

console.log('preflight ✓ the deployed entry loads without require(esm)');

try {
  const { validateEnv } = await import('../dist/config/Env.validation.js');

  validateEnv(process.env);
} catch (error) {
  fail('this environment would not pass boot validation', error);
  // The full report, one line per problem, exactly as boot would print it.
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}

console.log('preflight ✓ the environment passes boot validation');
process.exit(0);
