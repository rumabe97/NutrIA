import { applyForBadgeSchema } from 'core/entities/Professional';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The college and the number the practitioner declares (PRD 025 scope 6). No contact: a code never goes to one the applicant gives. */
export const ApplyForBadgeDto = zodDto('ApplyForBadge', applyForBadgeSchema);
export type ApplyForBadgeDto = InferDto<typeof ApplyForBadgeDto>;
