import { submitCheckInSchema } from 'core/entities/CheckIn';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Weight, portions and words. Once per plan, from its last day (`0018`). */
export const SubmitCheckInDto = zodDto('SubmitCheckIn', submitCheckInSchema);
export type SubmitCheckInDto = InferDto<typeof SubmitCheckInDto>;
