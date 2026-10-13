import { MAX_DISH_REQUEST } from 'core/domain/DishRequest';
import { fixedMealSlotSchema, weekdaySchema } from 'core/entities/FixedMeal';
import { z } from 'zod';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * Asking for a dish the library does not have (`0011` § 4 a).
 *
 * `name` is the one field in this product whose content a person writes and a
 * model reads. The bound is capped here as well as on the screen, and it is
 * honest about what it buys: a determined person fits a sentence into a hundred
 * and twenty characters, so this makes the field read as a name rather than a
 * message box. The safety is the notice beside it and the gate on what comes
 * back.
 */
export const requestDishSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(MAX_DISH_REQUEST)
    .refine(value => !/[\n\r]/.test(value), { message: 'one line' }),
  slot: fixedMealSlotSchema,
  weekday: weekdaySchema
});

export const RequestDishDto = zodDto('RequestDish', requestDishSchema);
export type RequestDishDto = InferDto<typeof RequestDishDto>;
