import { swapMealSchema } from 'core/entities/Plan';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * The wish, optionally: quicker, no cooking, more protein, vegetarian. The
 * model is told it and never trusted to honour it — `axisFilter` in
 * `packages/core` is what enforces it (`0022`).
 */
export const SwapMealDto = zodDto('SwapMeal', swapMealSchema);
export type SwapMealDto = InferDto<typeof SwapMealDto>;
