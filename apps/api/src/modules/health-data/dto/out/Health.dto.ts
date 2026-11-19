import type { HealthSavedView, HealthView } from 'core/controllers/Health';

/** Conditions, medications and supplements, with the consent they are held under. */
export type HealthDto = HealthView;

/**
 * What saving the section answers: the section, and `linkEnded` — the
 * practitioner whose link this save ended under the illness rule (`0111` § 8),
 * by name, or null — so the screen tells the person at once
 * (`docs/legal/textos/05` § G.3).
 */
export type HealthSavedDto = HealthSavedView;
