import { kitchenChangesSchema } from 'core/entities/Kitchen';
import { updatePreferencesSchema } from 'core/entities/Profile';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * Eating, lifestyle and cooking preferences — rules and weights alike (`0025`, `0026`) —
 * and the kitchen (`0102`): a stance per appliance, `null` to take one back.
 *
 * The appliance is checked against the catalogue here, which is a question of shape.
 * How many may be `prefers` is not: `KitchenController.setStance` counts them inside
 * the repository's lock, and a count made at this edge would be the read-then-compare
 * it exists to avoid.
 */
export const UpdatePreferencesDto = zodDto('UpdatePreferences', updatePreferencesSchema.extend({ kitchen: kitchenChangesSchema.optional() }));
export type UpdatePreferencesDto = InferDto<typeof UpdatePreferencesDto>;
