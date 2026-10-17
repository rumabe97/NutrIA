import { addFixedMealSchema } from 'core/entities/FixedMeal';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * Which dish, at which meal of which weekday, somebody is about to fix —
 * asked so the warning can be read before they commit (`0103`).
 *
 * The same three fields a rule is written with, which is the point: the question
 * answered here is the one `POST /fixed-meals` will ask again, of the same dish.
 *
 * **In a body and not a query string**, for the reason `SearchDishDto` gives:
 * the platform's access log keys on the path including its query, is not ours to
 * redact, and this would put the dish somebody is choosing for their Tuesday
 * dinner in it. A body is not in that log at all.
 */
export const dishConsequenceSchema = addFixedMealSchema;

export const DishConsequenceDto = zodDto('DishConsequence', dishConsequenceSchema);
export type DishConsequenceDto = InferDto<typeof DishConsequenceDto>;
