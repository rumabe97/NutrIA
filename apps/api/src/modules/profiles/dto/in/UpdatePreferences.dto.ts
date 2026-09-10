import { updatePreferencesSchema } from 'core/entities/Profile';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Eating, lifestyle and cooking preferences — rules and weights alike (`0025`, `0026`). */
export const UpdatePreferencesDto = zodDto('UpdatePreferences', updatePreferencesSchema);
export type UpdatePreferencesDto = InferDto<typeof UpdatePreferencesDto>;
