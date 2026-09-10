import { setMealStatusSchema } from 'core/entities/Plan';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Eaten, skipped, or taken back to planned. `meal_completions` keeps the day it was said. */
export const SetMealStatusDto = zodDto('SetMealStatus', setMealStatusSchema);
export type SetMealStatusDto = InferDto<typeof SetMealStatusDto>;
