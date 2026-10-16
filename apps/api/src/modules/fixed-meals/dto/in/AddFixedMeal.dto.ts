import { ACCEPTABLE_REASONS } from 'core/domain/FixableReason';
import { addFixedMealSchema } from 'core/entities/FixedMeal';
import { z } from 'zod';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * A meal fixed to one day of the week (`0098`, `0099`): a weekday 0-6 from
 * Monday, a slot, the dish by its slug — and which of the day's arithmetic
 * warnings this person says they accept (`0103`).
 *
 * The schema takes any slot and any dish; whether *this* person can be served
 * *that* dish there is `pinnable`'s answer and the service's to ask, because it
 * needs their pool, their targets and the season.
 *
 * **`accept` names the reasons rather than saying a bare yes**, and the service
 * checks the reason it found against the ones named, so that the day there is a
 * second warning an acceptance of the first cannot stand in for it. One reason
 * is acceptable today: `clashes_with_fixed`. Empty by default, which is every
 * ordinary fix — the warning is the rare path.
 *
 * It is **not** part of `addFixedMealSchema`, because nothing about it is part of
 * the rule that gets stored — it is what the person said while writing it, and
 * `FixedMealController.add` still takes the entity.
 */
export const addFixedMealBodySchema = addFixedMealSchema.extend({
  accept: z.array(z.enum(ACCEPTABLE_REASONS)).max(ACCEPTABLE_REASONS.length).default([])
});

export const AddFixedMealDto = zodDto('AddFixedMeal', addFixedMealBodySchema);
export type AddFixedMealDto = InferDto<typeof AddFixedMealDto>;
