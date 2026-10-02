import { AuditRepository } from '#repositories/Audit';
import { SettingsRepository } from '#repositories/Settings';
import { UNAUDITED } from 'core/entities/Audit';

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
   * Whether a big lunch or dinner gets bread, a salad or fruit beside it
   * (project 016). Asked by generation, a swap and an event rebuild, each once.
   */
  async accompaniments(): Promise<boolean> {
    return SettingsRepository.isEnabled(FLAGS.accompaniments.key, FLAGS.accompaniments.fallback);
  },

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

  /** Whether the check-in reminder goes out at all (`0054`). Asked once a day, by the sweep and nothing else. */
  async checkInReminders(): Promise<boolean> {
    return SettingsRepository.isEnabled(FLAGS.checkInReminders.key, FLAGS.checkInReminders.fallback);
  },

  /** Whether a dish is drawn the first time its meal page is opened (`0066`). Asked by each such read. */
  async dishPictures(): Promise<boolean> {
    return SettingsRepository.isEnabled(FLAGS.dishPictures.key, FLAGS.dishPictures.fallback);
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
   * `actorId` is the session's user (`0071`); the key is the trail's
   * `entityId` — a switch is not a person. Required: a suite or a probe that
   * throws a switch to set a scenario up rather than to exercise the console
   * passes `UNAUDITED` instead of inventing an actor.
   */
  async setFlag(name: FlagName, enabled: boolean, actorId: string | typeof UNAUDITED): Promise<SettingsView> {
    const key = FLAGS[name].key;

    await SettingsRepository.set(
      key,
      enabled,
      actorId === UNAUDITED
        ? undefined
        : async tx => {
            await AuditRepository.record({ action: 'setting.changed', actorId, entity: 'setting', entityId: key, metadata: { enabled, key } }, tx);
          }
    );

    return SettingsController.read('owner');
  }
};
