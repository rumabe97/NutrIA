import { hideProfessionalProfileSchema } from 'core/entities/Professional';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * Hiding a profile from the first look — refusing is the same act (legal F6):
 * the closed reasons, the word quoted, the owner's facts and whether a notice
 * set it off (`docs/legal/textos/06` § X).
 */
export const HideProfessionalProfileDto = zodDto('HideProfessionalProfile', hideProfessionalProfileSchema);
export type HideProfessionalProfileDto = InferDto<typeof HideProfessionalProfileDto>;
