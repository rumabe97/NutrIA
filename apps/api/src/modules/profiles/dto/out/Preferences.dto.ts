import type { KitchenView } from 'core/controllers/Kitchen';
import type { PreferencesView } from 'core/controllers/Profile';

/** Eating, lifestyle and cooking preferences, and the kitchen as it now stands. */
export type PreferencesDto = PreferencesView & { kitchen: KitchenView };
