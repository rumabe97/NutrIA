import { describe, expect, it } from '@jest/globals';

import { RateLimitGuard } from './RateLimit.guard.js';

import type { Env } from '../../config/index.js';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

const ENV_STUB = { RATE_LIMIT_MAX: 3, RATE_LIMIT_TTL: 60 } as Env;

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getClass: () => class {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
}

function makeGuard(metadata: Record<string, unknown> = {}) {
  const reflector = { getAllAndOverride: (key: string) => metadata[key] } as unknown as Reflector;

  return new RateLimitGuard(ENV_STUB, reflector);
}

const anonymous = { ip: '10.0.0.1', method: 'POST', route: { path: '/generate' }, url: '/generate' };

describe('RateLimitGuard', () => {
  it('allows requests up to the limit', () => {
    const guard = makeGuard();

    for (let attempt = 0; attempt < ENV_STUB.RATE_LIMIT_MAX; attempt += 1) {
      expect(guard.canActivate(makeContext({ ...anonymous }))).toBe(true);
    }
  });

  it('rejects the request after the limit with 429 and a stable code', () => {
    const guard = makeGuard();

    for (let attempt = 0; attempt < ENV_STUB.RATE_LIMIT_MAX; attempt += 1) {
      guard.canActivate(makeContext({ ...anonymous }));
    }

    expect(() => guard.canActivate(makeContext({ ...anonymous }))).toThrow(expect.objectContaining({ status: 429 }) as unknown as Error);
  });

  it('counts each user separately, so one heavy user does not block another', () => {
    const guard = makeGuard();
    const alice = { ...anonymous, user: { id: 'usr-alice' } };
    const bob = { ...anonymous, user: { id: 'usr-bob' } };

    for (let attempt = 0; attempt < ENV_STUB.RATE_LIMIT_MAX; attempt += 1) {
      guard.canActivate(makeContext({ ...alice }));
    }

    expect(() => guard.canActivate(makeContext({ ...alice }))).toThrow();
    expect(guard.canActivate(makeContext({ ...bob }))).toBe(true);
  });

  it('does not let one shared IP throttle every signed-in user behind it', () => {
    const guard = makeGuard();
    const office = { ...anonymous, ip: '203.0.113.9' };

    for (let attempt = 0; attempt < ENV_STUB.RATE_LIMIT_MAX; attempt += 1) {
      guard.canActivate(makeContext({ ...office, user: { id: `usr-${attempt}` } }));
    }

    expect(guard.canActivate(makeContext({ ...office, user: { id: 'usr-late' } }))).toBe(true);
  });

  it('counts each route separately', () => {
    const guard = makeGuard();

    for (let attempt = 0; attempt < ENV_STUB.RATE_LIMIT_MAX; attempt += 1) {
      guard.canActivate(makeContext({ ...anonymous }));
    }

    expect(guard.canActivate(makeContext({ ...anonymous, route: { path: '/other' } }))).toBe(true);
  });

  it('honours a tighter per-route limit', () => {
    const guard = makeGuard({ rateLimit: { limit: 1, ttlSeconds: 3600 } });

    expect(guard.canActivate(makeContext({ ...anonymous }))).toBe(true);
    expect(() => guard.canActivate(makeContext({ ...anonymous }))).toThrow();
  });

  it('exempts a route that opts out', () => {
    const guard = makeGuard({ skipRateLimit: true });

    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(guard.canActivate(makeContext({ ...anonymous }))).toBe(true);
    }
  });

  it('starts a fresh window once the old one expires', () => {
    const guard = makeGuard({ rateLimit: { limit: 1, ttlSeconds: 0 } });

    expect(guard.canActivate(makeContext({ ...anonymous }))).toBe(true);
    expect(guard.canActivate(makeContext({ ...anonymous }))).toBe(true);
  });

  it('falls back to a stable key when neither user nor IP is present', () => {
    const guard = makeGuard();
    const bare = { method: 'GET', url: '/x' };

    for (let attempt = 0; attempt < ENV_STUB.RATE_LIMIT_MAX; attempt += 1) {
      guard.canActivate(makeContext({ ...bare }));
    }

    expect(() => guard.canActivate(makeContext({ ...bare }))).toThrow();
  });
});
