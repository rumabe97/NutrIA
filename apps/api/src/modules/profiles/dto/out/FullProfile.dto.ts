import type { FullProfileView } from 'core/controllers/Profile';
import type { KitchenView } from 'core/controllers/Kitchen';

/**
 * Profile, goal, preferences, restrictions and the resolved daily targets, in one read —
 * and the kitchen, defaulted, so the screen never asks whether the person has opened it.
 */
export type FullProfileDto = FullProfileView & { kitchen: KitchenView };
