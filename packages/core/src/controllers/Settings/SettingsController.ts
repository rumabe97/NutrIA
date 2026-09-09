import { SettingsRepository } from '#repositories/Settings';

/** The switches the owner can throw while the service runs. One so far. */
export const SETTING_KEYS = { registrationOpen: 'registration_open' } as const;

/**
 * Signing up is open unless the owner has closed it.
 *
 * Open is the default because a service that refuses new accounts the moment a
 * settings row goes missing is a service that fails closed for the wrong
 * reason. Closing is a deliberate act, and it leaves a row saying so.
 */
const REGISTRATION_OPEN_BY_DEFAULT = true;

export type SettingsView = { readonly registrationOpen: boolean };

export const SettingsController = {
  async read(): Promise<SettingsView> {
    return { registrationOpen: await SettingsController.registrationOpen() };
  },

  async registrationOpen(): Promise<boolean> {
    return SettingsRepository.isEnabled(SETTING_KEYS.registrationOpen, REGISTRATION_OPEN_BY_DEFAULT);
  },

  async setRegistrationOpen(open: boolean): Promise<SettingsView> {
    await SettingsRepository.set(SETTING_KEYS.registrationOpen, open);

    return { registrationOpen: open };
  }
};
