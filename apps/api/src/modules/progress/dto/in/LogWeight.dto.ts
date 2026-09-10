import { logWeightSchema } from 'core/entities/Progress';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** One figure and the day it was taken. Logging the same day twice replaces the earlier one. */
export const LogWeightDto = zodDto('LogWeight', logWeightSchema);
export type LogWeightDto = InferDto<typeof LogWeightDto>;
