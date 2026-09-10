import { SettingsRepository } from '#repositories/Settings';

import { FLAGS, flagsFor, flagsFrom } from 'core/domain/Flag';

import type { FlagAudience, FlagName, FlagSet } from 'core/domain/Flag';

/**
 * The switches the owner can throw while the service runs.
 *
 * Which switches exist, and what each one means when nobody has thrown it,
 * lives in `core/domain/Flag` — a pure registry with no database in it, so the
 * rule that matters (an absent row falls back to *this* position, for *this*
 * reason) is testable on its own. This controller is only the read and the
 * write.
 */
export type SettingsView = { readonly flags: Partial<FlagSet> };

export const SettingsController = {
  /**
   * Whether confirming an address opens the account by itself (`0031`).
   *
   * Kept as its own named accessor rather than folded into `flags()` because
   * sign-up asks this question on a path where nothing else about the flags is
   * wanted, and a caller reading one switch should not have to know it lives in
   * a set.
   */
  async automaticActivation(): Promise<boolean> {
    return SettingsRepository.isEnabled(FLAGS.automaticActivation.key, FLAGS.automaticActivation.fallback);
  },

  /** Every flag, in one read, with absent rows resolved to their declared fallback. */
  async flags(): Promise<FlagSet> {
    return flagsFrom(await SettingsRepository.all());
  },

  /** What an audience is allowed to see of them. */
  async read(audience: FlagAudience = 'signed-in'): Promise<SettingsView> {
    return { flags: flagsFor(await SettingsController.flags(), audience) };
  },

  /**
   * Throw one switch.
   *
   * The name is a `FlagName`, not a string: the key written to the table comes
   * from the registry, so a caller cannot invent a row that nothing reads.
   */
  async setFlag(name: FlagName, enabled: boolean): Promise<SettingsView> {
    await SettingsRepository.set(FLAGS[name].key, enabled);

    return SettingsController.read('owner');
  }
};
