import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { ProfessionalController } from 'core/controllers/Professional';

import { ProfessionalGuard } from './Professional.guard.js';

import type { ExecutionContext } from '@nestjs/common';

function makeContext(user?: { id: string }): ExecutionContext {
  return {
    getClass: () => class {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) })
  } as unknown as ExecutionContext;
}

/**
 * The door to the workspace (`0059`). Both halves — the switch and the grant —
 * are `ProfessionalController.hasAccess`'s to weigh; what is pinned here is
 * that the guard asks about the session's user and nobody else, and that every
 * refusal is the same 404.
 */
describe('ProfessionalGuard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets a granted account through while the switch is on', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);

    await expect(new ProfessionalGuard().canActivate(makeContext({ id: 'usr-dietitian' }))).resolves.toBe(true);
  });

  it('denies an account without access, with 404 — a 403 would say the workspace is real', async () => {
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);

    await expect(new ProfessionalGuard().canActivate(makeContext({ id: 'usr-plain' }))).rejects.toThrow(
      expect.objectContaining({ status: 404 }) as unknown as Error
    );
  });

  it('asks about the session user, never an id from the request', async () => {
    const hasAccess = jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);

    await new ProfessionalGuard().canActivate(makeContext({ id: 'usr-alice' }));

    expect(hasAccess).toHaveBeenCalledWith('usr-alice');
  });

  it('denies a request carrying no user at all, and does not even ask', async () => {
    const hasAccess = jest.spyOn(ProfessionalController, 'hasAccess');

    await expect(new ProfessionalGuard().canActivate(makeContext())).rejects.toThrow(NotFoundException);
    expect(hasAccess).not.toHaveBeenCalled();
  });
});
