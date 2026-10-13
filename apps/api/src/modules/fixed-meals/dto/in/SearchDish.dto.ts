import { MAX_DISH_REQUEST } from 'core/domain/DishRequest';
import { fixedMealSlotSchema, weekdaySchema } from 'core/entities/FixedMeal';
import { z } from 'zod';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * What somebody typed into the dish search, and the meal they were looking at
 * (report `0011` § 2).
 *
 * **In a body and not a query string**, which is the whole reason this DTO
 * exists. The words here are the same words the ask field is pre-filled with,
 * and a request fires on every pause in typing: our own log redacts `q=`
 * (`SECRET_PARAMETERS`), but the platform's access log keys on the path
 * *including* its query string and is not ours to redact — and `/privacidad`
 * says server and error logs do not keep what somebody writes
 * (`invariant-reviewer`, 2026-10-13). A body is not in that log at all, and
 * bodies are not recorded here either (`REDACTED_PATHS` carries `query`
 * regardless, for the night somebody turns body logging on).
 *
 * Bounded by the same length as a dish request: it is the same field, before
 * anybody decides to send it anywhere.
 */
export const searchDishSchema = z.object({
  query: z.string().trim().max(MAX_DISH_REQUEST).default(''),
  slot: fixedMealSlotSchema,
  weekday: weekdaySchema
});

export const SearchDishDto = zodDto('SearchDish', searchDishSchema);
export type SearchDishDto = InferDto<typeof SearchDishDto>;
