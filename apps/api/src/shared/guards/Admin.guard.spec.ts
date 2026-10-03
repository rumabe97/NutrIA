import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { UserController } from 'core/controllers/User';

import { IS_PUBLIC_KEY } from '../decorators/Public.decorator.js';
import { AdminGuard } from './Admin.guard.js';

import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

function makeContext(user?: { id?: string; role: string; twoFactorEnabled?: boolean }): ExecutionContext {
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
  beforeEach(() => {
    jest.spyOn(UserController, 'needsSecondFactor').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is a no-op on routes that declare no roles', async () => {
    await expect(makeGuard(undefined).canActivate(makeContext({ role: 'user' }))).resolves.toBe(true);
  });

  it('allows a user holding the required role', async () => {
    await expect(makeGuard(['admin']).canActivate(makeContext({ role: 'admin' }))).resolves.toBe(true);
  });

  it('denies a user without the required role', async () => {
    await expect(makeGuard(['admin']).canActivate(makeContext({ role: 'user' }))).rejects.toThrow(NotFoundException);
  });

  it('denies with 404 — a 403 tells a prober that the admin route is real', async () => {
    await expect(makeGuard(['admin']).canActivate(makeContext({ role: 'user' }))).rejects.toThrow(
      expect.objectContaining({ status: 404 }) as unknown as Error
    );
  });

  it('denies when the request carries no user at all', async () => {
    await expect(makeGuard(['admin']).canActivate(makeContext())).rejects.toThrow(NotFoundException);
  });

  /*
   * The owner's one-click activation link is `@Public()` on a controller that
   * is `@Roles('admin')`, so it arrives here with no user and a role list it
   * inherited. It used to 404 every time, which read as a broken link rather
   * than as a guard.
   */
  it('lets a public route through even when its controller declares a role', async () => {
    await expect(makeGuard(['admin'], true).canActivate(makeContext())).resolves.toBe(true);
  });
});

/* PLAN 011 phase 6: the console reads every account, so an admin with a password needs the authenticator app on. */
describe('AdminGuard — the second factor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('denies an admin who still needs one, with the same 404 a stranger gets', async () => {
    jest.spyOn(UserController, 'needsSecondFactor').mockResolvedValue(true);

    await expect(makeGuard(['admin']).canActivate(makeContext({ id: 'usr-owner', role: 'admin', twoFactorEnabled: false }))).rejects.toThrow(
      expect.objectContaining({ status: 404 }) as unknown as Error
    );
  });

  it('asks about the session’s own user and its flag', async () => {
    const needs = jest.spyOn(UserController, 'needsSecondFactor').mockResolvedValue(false);

    await expect(makeGuard(['admin']).canActivate(makeContext({ id: 'usr-owner', role: 'admin', twoFactorEnabled: true }))).resolves.toBe(true);
    expect(needs).toHaveBeenCalledWith(expect.objectContaining({ id: 'usr-owner', twoFactorEnabled: true }));
  });

  it('never asks on a route with no role, nor of a non-admin, nor on a public route', async () => {
    const needs = jest.spyOn(UserController, 'needsSecondFactor').mockResolvedValue(true);

    await expect(makeGuard(undefined).canActivate(makeContext({ role: 'admin' }))).resolves.toBe(true);
    await expect(makeGuard(['admin']).canActivate(makeContext({ role: 'user' }))).rejects.toThrow(NotFoundException);
    await expect(makeGuard(['admin'], true).canActivate(makeContext())).resolves.toBe(true);
    expect(needs).not.toHaveBeenCalled();
  });
});
