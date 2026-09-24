import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { ProfessionalController } from 'core/controllers/Professional';

import { ProfessionalSwitchGuard } from './ProfessionalSwitch.guard.js';

/**
 * The switch as a door (`0059`): off is a 404 like any route that does not
 * exist, on lets the request reach its pipes and its handler.
 */
describe('ProfessionalSwitchGuard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets the request through while the switch is on', async () => {
    jest.spyOn(ProfessionalController, 'isOpen').mockResolvedValue(true);

    await expect(new ProfessionalSwitchGuard().canActivate()).resolves.toBe(true);
  });

  it('is a 404 while the switch is off — never a 403, never the pipe’s 400 or 422', async () => {
    jest.spyOn(ProfessionalController, 'isOpen').mockResolvedValue(false);

    await expect(new ProfessionalSwitchGuard().canActivate()).rejects.toThrow(NotFoundException);
  });

  it('asks about the switch alone, never whether this account is a professional', async () => {
    jest.spyOn(ProfessionalController, 'isOpen').mockResolvedValue(true);
    const hasAccess = jest.spyOn(ProfessionalController, 'hasAccess');

    await new ProfessionalSwitchGuard().canActivate();

    expect(hasAccess).not.toHaveBeenCalled();
  });
});
