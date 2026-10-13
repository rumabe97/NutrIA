import type { FixableDish, NotOfferedDish } from '../../services/index.js';
import type { FixedMeal } from 'core/entities/FixedMeal';
import type { FixedMealsView } from 'core/controllers/FixedMeal';

/** One standing rule: the weekday, the slot and the dish. */
export type FixedMealDto = FixedMeal;

/**
 * The rules this account has, how many more it may have, and what is left of
 * this month's dish requests — each in the shape every counted allowance
 * answers in.
 *
 * The two allowances travel together because they are read together: the screen
 * says what is left of both before anybody chooses a day, and asking for a dish
 * is the same screen's second half (report `0011` § 4 a).
 */
export type FixedMealsDto = FixedMealsView;

/**
 * The dishes that can be fixed to one slot of one weekday.
 *
 * Answered against the plan this person would generate next, so the list is
 * what they could actually be served then — and a dish out of season in that
 * fortnight is not in it (`FixedMealsService`).
 */
export type FixableDishDto = FixableDish;

/**
 * A dish the library has and this person was not offered, with the reason
 * (report `0011` § 2).
 *
 * `actionable` says whether the screen owes them a way forward or a plain no:
 * four of the seven reasons are two taps away from being fixed, and the other
 * three must not be dressed up as advice.
 */
export type NotOfferedDishDto = NotOfferedDish;
