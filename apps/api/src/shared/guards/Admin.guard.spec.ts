import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import { IS_PUBLIC_KEY } from '../decorators/Public.decorator.js';
import { AdminGuard } from './Admin.guard.js';

import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

function makeContext(user?: { role: string }): ExecutionContext {
  return {
    getClass: () => class {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) })
  } as unknown as ExecutionContext;
}

/** The reflector answers per key, because the guard now asks it two questions. */
function makeGuard(roles?: readonly string[], isPublic = false) {
  return new AdminGuard({ getAllAndOverride: (key: string) => (key === IS_PUBLIC_KEY ? isPublic : roles) } as unknown as Reflector);
}

describe('AdminGuard', () => {
  it('is a no-op on routes that declare no roles', () => {
    expect(makeGuard(undefined).canActivate(makeContext({ role: 'user' }))).toBe(true);
  });

  it('allows a user holding the required role', () => {
    expect(makeGuard(['admin']).canActivate(makeContext({ role: 'admin' }))).toBe(true);
  });

  it('denies a user without the required role', () => {
    expect(() => makeGuard(['admin']).canActivate(makeContext({ role: 'user' }))).toThrow(NotFoundException);
  });

  it('denies with 404 — a 403 tells a prober that the admin route is real', () => {
    expect(() => makeGuard(['admin']).canActivate(makeContext({ role: 'user' }))).toThrow(
      expect.objectContaining({ status: 404 }) as unknown as Error
    );
  });

  it('denies when the request carries no user at all', () => {
    expect(() => makeGuard(['admin']).canActivate(makeContext())).toThrow(NotFoundException);
  });

  /*
   * The owner's one-click activation link is `@Public()` on a controller that
   * is `@Roles('admin')`, so it arrives here with no user and a role list it
   * inherited. It used to 404 every time, which read as a broken link rather
   * than as a guard.
   */
  it('lets a public route through even when its controller declares a role', () => {
    expect(makeGuard(['admin'], true).canActivate(makeContext())).toBe(true);
  });
});
