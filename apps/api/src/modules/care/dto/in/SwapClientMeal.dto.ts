import { swapMealSchema } from 'core/entities/Plan';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * A professional's swap on the plan under review (`0060`): the client's own
 * `SwapMeal` body, the same schema, so a professional may ask exactly what the
 * client may — and `axisFilter` enforces it, as for the client.
 */
export const SwapClientMealDto = zodDto('SwapClientMeal', swapMealSchema);
export type SwapClientMealDto = InferDto<typeof SwapClientMealDto>;
