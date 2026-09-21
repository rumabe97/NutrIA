import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { SettingsController } from 'core/controllers/Settings';
import { UserController } from 'core/controllers/User';

import { onAccountCreated, onAddressConfirmed } from './SelfService.js';

const ACCOUNT = { id: 'usr-1', email: 'ada@example.invalid' };
const LINK = { apiUrl: 'https://api.example.invalid/api/v1', secret: 'a'.repeat(48) };

function deps(sent = true) {
  return {
    link: LINK,
    mailer: { configured: true, send: jest.fn<() => Promise<boolean>>().mockResolvedValue(sent) },
    ownerEmail: 'owner@example.invalid'
  };
}

/**
 * The two halves of `0031` meeting: the switch decides whether confirming an
 * address is enough to open the account, and therefore whether the owner has
 * anything to do. Getting it backwards either holds everybody in a queue for
 * nothing or lets everybody into a product meant to be gated.
 */
describe('onAddressConfirmed', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the account and tells nobody when activation is automatic', async () => {
    jest.spyOn(SettingsController, 'automaticActivation').mockResolvedValue(true);
    const activate = jest.spyOn(UserController, 'activate').mockResolvedValue({ email: ACCOUNT.email });
    const dependencies = deps();

    await expect(onAddressConfirmed(ACCOUNT, dependencies)).resolves.toBe('opened');
    expect(activate).toHaveBeenCalledWith({ id: ACCOUNT.id });
    expect(dependencies.mailer.send).not.toHaveBeenCalled();
  });

  it('leaves the account waiting and mails the owner when activation is manual', async () => {
    jest.spyOn(SettingsController, 'automaticActivation').mockResolvedValue(false);
    const activate = jest.spyOn(UserController, 'activate');
    const dependencies = deps();

    await expect(onAddressConfirmed(ACCOUNT, dependencies)).resolves.toBe('waiting');
    expect(activate).not.toHaveBeenCalled();
    expect(dependencies.mailer.send).toHaveBeenCalledTimes(1);
  });

  it('falls back to waiting, not to an error, when the settings read breaks', async () => {
    jest.spyOn(SettingsController, 'automaticActivation').mockRejectedValue(new Error('no database'));

    await expect(onAddressConfirmed(ACCOUNT, deps())).resolves.toBe('waiting');
  });
});

/**
 * `0058`: an account that arrives through a provider is born confirmed, and the
 * verification hook never runs for it. Its creation is the only moment there is.
 */
describe('onAccountCreated', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('leaves a password account alone — its verification link is where its moment comes', async () => {
    const automatic = jest.spyOn(SettingsController, 'automaticActivation');
    const dependencies = deps();

    await expect(onAccountCreated({ ...ACCOUNT, emailVerified: false }, dependencies)).resolves.toBe('unconfirmed');
    expect(automatic).not.toHaveBeenCalled();
    expect(dependencies.mailer.send).not.toHaveBeenCalled();
  });

  it('opens an account a provider vouched for, when activation is automatic', async () => {
    jest.spyOn(SettingsController, 'automaticActivation').mockResolvedValue(true);
    const activate = jest.spyOn(UserController, 'activate').mockResolvedValue({ email: ACCOUNT.email });

    await expect(onAccountCreated({ ...ACCOUNT, emailVerified: true }, deps())).resolves.toBe('opened');
    expect(activate).toHaveBeenCalledWith({ id: ACCOUNT.id });
  });

  it('tells the owner an account a provider vouched for is waiting, when the door is shut', async () => {
    jest.spyOn(SettingsController, 'automaticActivation').mockResolvedValue(false);
    const dependencies = deps();

    await expect(onAccountCreated({ ...ACCOUNT, emailVerified: true }, dependencies)).resolves.toBe('waiting');
    expect(dependencies.mailer.send).toHaveBeenCalledTimes(1);
  });
});
