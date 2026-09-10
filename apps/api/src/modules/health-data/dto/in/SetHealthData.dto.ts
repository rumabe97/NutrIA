import { setHealthDataSchema } from 'core/entities/Health';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * The whole section at once, carrying the consent version it was given under.
 * A partial update could never delete a medication.
 */
export const SetHealthDataDto = zodDto('SetHealthData', setHealthDataSchema);
export type SetHealthDataDto = InferDto<typeof SetHealthDataDto>;
