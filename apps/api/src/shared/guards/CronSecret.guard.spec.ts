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
