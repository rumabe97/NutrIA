import { describe, expect, it } from '@jest/globals';

import { AccountNotActivatedError } from 'core/entities/Error';

import { ALLOW_UNVERIFIED_KEY } from '../decorators/AllowUnverified.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/Public.decorator.js';
import { VerifiedEmailGuard } from './VerifiedEmail.guard.js';

import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

function makeContext(user?: { id: string; activated: boolean }): ExecutionContext {
  return {
    getClass: () => class {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) })
  } as unknown as ExecutionContext;
}

function makeGuard(flags: { allowUnverified?: boolean; isPublic?: boolean } = {}) {
  const reflector = {
    getAllAndOverride: (key: string) => (key === IS_PUBLIC_KEY ? flags.isPublic : key === ALLOW_UNVERIFIED_KEY ? flags.allowUnverified : undefined)
  } as unknown as Reflector;

  return new VerifiedEmailGuard(reflector);
}

describe('VerifiedEmailGuard', () => {
  it('lets an activated account through', () => {
    expect(makeGuard().canActivate(makeContext({ id: 'u1', activated: true }))).toBe(true);
  });

  it('refuses an account that has not been activated, with the code the screen routes on', () => {
    expect(() => makeGuard().canActivate(makeContext({ id: 'u1', activated: false }))).toThrow(AccountNotActivatedError);
  });

  it('is not the business of a public route', () => {
    expect(makeGuard({ isPublic: true }).canActivate(makeContext({ id: 'u1', activated: false }))).toBe(true);
  });

  it('lets an unactivated account reach the routes marked for it', () => {
    expect(makeGuard({ allowUnverified: true }).canActivate(makeContext({ id: 'u1', activated: false }))).toBe(true);
  });

  it('leaves an absent user to the session guard', () => {
    expect(makeGuard().canActivate(makeContext(undefined))).toBe(true);
  });
});
