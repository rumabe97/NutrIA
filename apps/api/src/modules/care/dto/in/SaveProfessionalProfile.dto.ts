import { saveProfessionalProfileSchema } from 'core/entities/Professional';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * The practitioner's whole profile (PRD 025 scope 4): the name shown, the
 * studies as declared, the final price with its unit, the hours. The words are
 * judged after this, with the badge (`ProfessionalProfileController.save`).
 */
export const SaveProfessionalProfileDto = zodDto('SaveProfessionalProfile', saveProfessionalProfileSchema);
export type SaveProfessionalProfileDto = InferDto<typeof SaveProfessionalProfileDto>;
