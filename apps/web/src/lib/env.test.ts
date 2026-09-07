import { describe, expect, it } from 'vitest';

import { authTargets } from './env';

/**
 * Regression cover for a real 404.
 *
 * The auth client posted to `/api/sign-up/email` instead of
 * `/api/v1/auth/sign-up/email`, because Better Auth's `withPath` ignores
 * `basePath` whenever `baseURL` already carries a path. Nothing failed loudly —
 * sign-up simply 404'd, which reads as a broken server rather than a bad client
 * config. These assertions pin the split so it cannot regress quietly.
 */
describe('authTargets', () => {
  it('returns an origin with no path, so Better Auth applies the base path', () => {
    expect(authTargets('http://localhost:3001/api/v1').origin).toBe('http://localhost:3001');
  });

  it('derives the base path from the API prefix rather than hardcoding it', () => {
    expect(authTargets('http://localhost:3001/api/v1').basePath).toBe('/api/v1/auth');
  });

  it('composes the sign-up endpoint the server actually serves', () => {
    const { basePath, origin } = authTargets('http://localhost:3001/api/v1');

    expect(`${origin}${basePath}/sign-up/email`).toBe('http://localhost:3001/api/v1/auth/sign-up/email');
  });

  it('follows a different API prefix instead of drifting from it', () => {
    expect(authTargets('https://api.example.com/v2').basePath).toBe('/v2/auth');
  });

  it('handles an API URL with no path at all', () => {
    const { basePath, origin } = authTargets('https://api.example.com');

    expect(origin).toBe('https://api.example.com');
    expect(basePath).toBe('/auth');
  });

  it('tolerates a trailing slash', () => {
    expect(authTargets('http://localhost:3001/api/v1/').basePath).toBe('/api/v1/auth');
  });

  it('keeps a non-default port on the origin', () => {
    expect(authTargets('http://localhost:4000/api/v1').origin).toBe('http://localhost:4000');
  });
});
