import { SettingsRepository } from '#repositories/Settings';

/** The switches the owner can throw while the service runs. One so far. */
export const SETTING_KEYS = { automaticActivation: 'automatic_activation' } as const;

/**
 * Confirming the address opens the account, unless the owner has said it
 * should not (`0031`).
 *
 * Automatic is the default because a service that starts holding everybody in a
 * queue the moment a settings row goes missing is a service that fails shut for
 * the wrong reason. Turning it off is a deliberate act, and it leaves a row
 * saying so.
 */
const AUTOMATIC_BY_DEFAULT = true;

export type SettingsView = { readonly automaticActivation: boolean };

export const SettingsController = {
  async automaticActivation(): Promise<boolean> {
    return SettingsRepository.isEnabled(SETTING_KEYS.automaticActivation, AUTOMATIC_BY_DEFAULT);
  },

  async read(): Promise<SettingsView> {
    return { automaticActivation: await SettingsController.automaticActivation() };
  },

  async setAutomaticActivation(automatic: boolean): Promise<SettingsView> {
    await SettingsRepository.set(SETTING_KEYS.automaticActivation, automatic);

    return { automaticActivation: automatic };
  }
};
