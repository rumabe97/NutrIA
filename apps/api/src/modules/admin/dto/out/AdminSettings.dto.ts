import type { AllowancesView, SettingsView } from 'core/controllers/Settings';

/** The switches the owner can throw. */
export type AdminSettingsViewDto = SettingsView;

/** What each tier is allowed now, what it ships as, and the bounds the console may not leave (`0097`). */
export type AdminAllowancesViewDto = AllowancesView;
