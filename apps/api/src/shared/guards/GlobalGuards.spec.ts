import { describe, expect, it } from '@jest/globals';

import { AdminGuard } from './Admin.guard.js';
import { GLOBAL_GUARDS } from './GlobalGuards.js';
import { RateLimitGuard } from './RateLimit.guard.js';
import { RequiresOnboardingGuard } from './RequiresOnboarding.guard.js';
import { SessionGuard } from './Session.guard.js';
import { VerifiedEmailGuard } from './VerifiedEmail.guard.js';

import type { Auth } from '../../modules/auth/auth.config.js';
import type { CanActivate, ExecutionContext, Type } from '@nestjs/common';
import type { Env } from '../../config/index.js';
import type { Reflector } from '@nestjs/core';

const ENV_STUB = { RATE_LIMIT_MAX: 100, RATE_LIMIT_TTL: 3600 } as Env;
/** The real limit on `POST /meal-plans/generate` — the route this order exists for. */
const GENERATE = { limit: 3, ttlSeconds: 3600 };
/** One office, one carrier NAT, one attacker's first proxy: every request below arrives from here. */
const ONE_ADDRESS = '203.0.113.7';

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getClass: () => class {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
}

function requestFrom(cookie: string | undefined): Record<string, unknown> {
  return {
    headers: cookie === undefined ? {} : { cookie },
    ip: ONE_ADDRESS,
    method: 'POST',
    route: { path: '/meal-plans/generate' },
    url: '/meal-plans/generate'
  };
}

/** A session store that answers with whichever account the cookie names, and refuses a request without one. */
function makeAuth(): Auth {
  const getSession = ({ headers }: { headers: { get: (name: string) => string | null } }) => {
    const id = headers.get('cookie')?.replace('session=', '');

    return Promise.resolve(
      id === undefined ? null : { user: { id, activatedAt: new Date(), email: `${id}@example.com`, emailVerified: true, name: id } }
    );
  };

  return { api: { getSession } } as unknown as Auth;
}

/**
 * The two guards that matter here, instantiated and then ordered by
 * `GLOBAL_GUARDS` itself — so reordering the registration reorders this chain,
 * and the assertions below are about the order the application really runs.
 */
function makeChain() {
  const metadata: Record<string, unknown> = { rateLimit: GENERATE };
  const reflector = { getAllAndOverride: (key: string) => metadata[key] } as unknown as Reflector;
  const limiter = new RateLimitGuard(ENV_STUB, reflector);
  const keyedOn: (string | undefined)[] = [];
  const watchedLimiter: CanActivate = {
    canActivate: context => {
      keyedOn.push(context.switchToHttp().getRequest<{ user?: { id: string } }>().user?.id);

      return limiter.canActivate(context);
    }
  };
  const instances = new Map<Type<CanActivate>, CanActivate>([
    [RateLimitGuard, watchedLimiter],
    [SessionGuard, new SessionGuard(makeAuth(), reflector)]
  ]);
  const chain = GLOBAL_GUARDS.map(guard => instances.get(guard)).filter(guard => guard !== undefined);

  return { chain, keyedOn };
}

async function run(chain: readonly CanActivate[], request: Record<string, unknown>): Promise<void> {
  const context = makeContext(request);

  for (const guard of chain) {
    await guard.canActivate(context);
  }
}

describe('GLOBAL_GUARDS', () => {
  it('names all five guards, in the order that keeps SessionGuard first', () => {
    // A deletion here is one element of one array, not a visible line removed
    // from app.module.ts — pin membership as well as the two guards' order.
    expect(GLOBAL_GUARDS).toEqual([SessionGuard, RateLimitGuard, VerifiedEmailGuard, AdminGuard, RequiresOnboardingGuard]);
  });

  it('has the signed-in user on the request by the time the limiter builds its key', async () => {
    const { chain, keyedOn } = makeChain();

    await run(chain, requestFrom('session=usr-alice'));

    expect(keyedOn).toEqual(['usr-alice']);
  });

  it('gives two accounts behind one address a window each, and holds each to its own', async () => {
    const { chain } = makeChain();

    for (let attempt = 0; attempt < GENERATE.limit; attempt += 1) {
      await run(chain, requestFrom('session=usr-alice'));
    }

    await expect(run(chain, requestFrom('session=usr-alice'))).rejects.toMatchObject({ status: 429 });
    await expect(run(chain, requestFrom('session=usr-bob'))).resolves.toBeUndefined();
  });

  it('refuses a request with no session before the limiter ever sees it', async () => {
    const { chain, keyedOn } = makeChain();

    await expect(run(chain, requestFrom(undefined))).rejects.toMatchObject({ status: 404 });
    // `toHaveLength`, not `toEqual([])`: an unkeyed call pushes `undefined`, and
    // `toEqual` counts an array of one `undefined` as empty.
    expect(keyedOn).toHaveLength(0);
  });
});
