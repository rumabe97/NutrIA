import { describe, expect, it } from '@jest/globals';

import { AccountNotActivatedError, EmailNotVerifiedError } from 'core/entities/Error';

import { ALLOW_UNVERIFIED_KEY } from '../decorators/AllowUnverified.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/Public.decorator.js';
import { VerifiedEmailGuard } from './VerifiedEmail.guard.js';

import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

type User = { id: string; activated: boolean; emailVerified: boolean };

/** Both open unless a test says otherwise, so each case names the one lock it is about. */
function makeContext(user?: Partial<User>): ExecutionContext {
  return {
    getClass: () => class {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: user && { id: 'u1', activated: true, emailVerified: true, ...user } }) })
  } as unknown as ExecutionContext;
}

function makeGuard(flags: { allowUnverified?: boolean; isPublic?: boolean } = {}) {
  const reflector = {
    getAllAndOverride: (key: string) => (key === IS_PUBLIC_KEY ? flags.isPublic : key === ALLOW_UNVERIFIED_KEY ? flags.allowUnverified : undefined)
  } as unknown as Reflector;

  return new VerifiedEmailGuard(reflector);
}

describe('VerifiedEmailGuard', () => {
  it('lets an account through when both locks are open', () => {
    expect(makeGuard().canActivate(makeContext({}))).toBe(true);
  });

  it('refuses an account that has not been activated, with the code the screen routes on', () => {
    expect(() => makeGuard().canActivate(makeContext({ activated: false }))).toThrow(AccountNotActivatedError);
  });

  it('refuses an account whose address was never confirmed, even once the owner opened it', () => {
    expect(() => makeGuard().canActivate(makeContext({ activated: true, emailVerified: false }))).toThrow(EmailNotVerifiedError);
  });

  it('names the address first when neither is done — it is the half the person can fix', () => {
    expect(() => makeGuard().canActivate(makeContext({ activated: false, emailVerified: false }))).toThrow(EmailNotVerifiedError);
  });

  it('is not the business of a public route', () => {
    expect(makeGuard({ isPublic: true }).canActivate(makeContext({ activated: false, emailVerified: false }))).toBe(true);
  });

  it('lets an account in either state reach the routes marked for it', () => {
    expect(makeGuard({ allowUnverified: true }).canActivate(makeContext({ activated: false, emailVerified: false }))).toBe(true);
  });

  it('leaves an absent user to the session guard', () => {
    expect(makeGuard().canActivate(makeContext(undefined))).toBe(true);
  });
});
