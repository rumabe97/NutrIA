import { Logger, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { CronSecretGuard } from './CronSecret.guard.js';

import type { Env } from '../../config/index.js';
import type { ExecutionContext } from '@nestjs/common';

function makeContext(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: authorization === undefined ? {} : { authorization } }) })
  } as unknown as ExecutionContext;
}

function makeGuard(cronSecret: string | undefined) {
  return new CronSecretGuard({ CRON_SECRET: cronSecret } as Env);
}

/** A header whose type the Express declaration rules out, but the wire does not. */
function makeMalformedContext(authorization: unknown): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }) } as unknown as ExecutionContext;
}

describe('CronSecretGuard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets the platform through with the configured bearer secret', () => {
    expect(makeGuard('s3cr3t').canActivate(makeContext('Bearer s3cr3t'))).toBe(true);
  });

  it('denies the wrong secret with 404 — not 401 or 403, like every other denial here', () => {
    const guard = makeGuard('s3cr3t');

    expect(() => guard.canActivate(makeContext('Bearer wrong'))).toThrow(NotFoundException);
    expect(() => guard.canActivate(makeContext('Bearer wrong'))).toThrow(expect.objectContaining({ status: 404 }) as unknown as Error);
  });

  it('denies a request with no Authorization header at all', () => {
    expect(() => makeGuard('s3cr3t').canActivate(makeContext(undefined))).toThrow(NotFoundException);
  });

  it('denies a wrong secret of exactly the right length — the comparison is constant time, not short-circuiting', () => {
    const guard = makeGuard('s3cr3t');

    expect(() => guard.canActivate(makeContext('Bearer s3cr3u'))).toThrow(NotFoundException);
    expect(() => guard.canActivate(makeContext('Bearer x3cr3t'))).toThrow(NotFoundException);
  });

  it('denies a token longer or shorter than the secret without throwing anything but the 404', () => {
    const guard = makeGuard('s3cr3t');

    expect(() => guard.canActivate(makeContext('Bearer s3cr3'))).toThrow(NotFoundException);
    expect(() => guard.canActivate(makeContext('Bearer s3cr3tt'))).toThrow(NotFoundException);
  });

  it('denies a malformed header — empty, unprefixed, or repeated into an array — rather than crashing on it', () => {
    const guard = makeGuard('s3cr3t');

    expect(() => guard.canActivate(makeContext(''))).toThrow(NotFoundException);
    expect(() => guard.canActivate(makeContext('s3cr3t'))).toThrow(NotFoundException);
    expect(() => guard.canActivate(makeContext('Basic czNjcjN0'))).toThrow(NotFoundException);
    expect(() => guard.canActivate(makeMalformedContext(['Bearer s3cr3t', 'Bearer s3cr3t']))).toThrow(NotFoundException);
    expect(() => guard.canActivate(makeMalformedContext(null))).toThrow(NotFoundException);
  });

  it('denies every call when CRON_SECRET is not configured, never confirming the route to a prober', () => {
    expect(() => makeGuard(undefined).canActivate(makeContext('Bearer anything'))).toThrow(NotFoundException);
    expect(() => makeGuard('').canActivate(makeContext(undefined))).toThrow(NotFoundException);
  });

  it('warns once per call when CRON_SECRET is unset, so a silent 404 is tellable from someone knocking', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    expect(() => makeGuard(undefined).canActivate(makeContext(undefined))).toThrow(NotFoundException);

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
