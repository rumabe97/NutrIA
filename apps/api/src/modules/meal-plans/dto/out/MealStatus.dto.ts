import type { SetMealStatus } from 'core/entities/Plan';

/**
 * The mark as it now stands. It is the request echoed — `packages/core` answers
 * the write with nothing, and the day screen would otherwise re-read a plan to
 * learn what it just said.
 */
export type MealStatusDto = SetMealStatus;
