import { setAllergiesSchema } from 'core/entities/Safety';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * The complete set, always. A partial update could never delete an allergy,
 * which is the one edit that must be expressible.
 */
export const SetAllergiesDto = zodDto('SetAllergies', setAllergiesSchema);
export type SetAllergiesDto = InferDto<typeof SetAllergiesDto>;
