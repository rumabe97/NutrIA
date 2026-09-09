import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { SettingsController } from 'core/controllers/Settings';
import { UserController } from 'core/controllers/User';

import { activateIfRegistrationIsOpen } from './SelfService.js';

/**
 * The two halves of `0031` meeting: the door decides whether confirming an
 * address is enough to open the account. Getting this backwards either locks
 * everybody out of an open product or lets everybody into a closed one.
 */
describe('activateIfRegistrationIsOpen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the account when the door is open', async () => {
    jest.spyOn(SettingsController, 'registrationOpen').mockResolvedValue(true);
    const activate = jest.spyOn(UserController, 'activate').mockResolvedValue({ email: 'ada@example.invalid' });

    await expect(activateIfRegistrationIsOpen('usr-1')).resolves.toBe(true);
    expect(activate).toHaveBeenCalledWith({ id: 'usr-1' });
  });

  it('leaves the account waiting when the door is closed', async () => {
    jest.spyOn(SettingsController, 'registrationOpen').mockResolvedValue(false);
    const activate = jest.spyOn(UserController, 'activate');

    await expect(activateIfRegistrationIsOpen('usr-1')).resolves.toBe(false);
    expect(activate).not.toHaveBeenCalled();
  });

  it('leaves the account waiting rather than failing the verification when the settings read breaks', async () => {
    jest.spyOn(SettingsController, 'registrationOpen').mockRejectedValue(new Error('no database'));

    await expect(activateIfRegistrationIsOpen('usr-1')).resolves.toBe(false);
  });
});
