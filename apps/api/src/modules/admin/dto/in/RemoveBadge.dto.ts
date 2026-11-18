import { removeBadgeSchema } from 'core/entities/Professional';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** A `fail` or a `withdrawn`, its closed reason, the owner's facts and whether a notice set it off (`docs/legal/textos/06` § W). */
export const RemoveBadgeDto = zodDto('RemoveBadge', removeBadgeSchema);
export type RemoveBadgeDto = InferDto<typeof RemoveBadgeDto>;
