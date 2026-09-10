import type { SettingsView } from 'core/controllers/Settings';

/**
 * The one switch a signed-in person may see, presented by
 * `packages/core`'s `SettingsController` and named here so a module's whole
 * answer surface reads in one place (`0039`).
 */
export type SettingsDto = SettingsView;
