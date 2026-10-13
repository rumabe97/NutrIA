import { addFixedMealSchema } from 'core/entities/FixedMeal';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * A meal fixed to one day of the week (`0098`, `0099`): a weekday 0-6 from
 * Monday, a slot, and the dish by its slug.
 *
 * The schema takes any slot and any dish; whether *this* person can be served
 * *that* dish there is `pinnable`'s answer and the service's to ask, because it
 * needs their pool, their targets and the season.
 */
export const AddFixedMealDto = zodDto('AddFixedMeal', addFixedMealSchema);
export type AddFixedMealDto = InferDto<typeof AddFixedMealDto>;
