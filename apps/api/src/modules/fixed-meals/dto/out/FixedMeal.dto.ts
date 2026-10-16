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
 * what they could actually be served then (`FixedMealsService`).
 *
 * **The season is not part of it, and the first offer never claimed it rightly
 * before** (`tests`, 2026-10-15): `pinnable` filters by the pool, the slot and
 * the plate, and `servableOn` runs inside the scheduler's own day search. A pin
 * outranks the season anyway — a rule somebody wrote is served whatever month it
 * is — so the first offer listing an out-of-season dish is correct. What it
 * costs is a label on the *second* offer: a dish the day's probe refuses for the
 * season alone comes back as `clashes_with_fixed`, which names the wrong cause.
 * Narrow enough to be recorded rather than machined around (`0101`).
 */
export type FixableDishDto = FixableDish;

/**
 * A dish the library has and this person was not offered, with the reason
 * (report `0011` § 2).
 *
 * `actionable` says whether the screen owes them a way forward or a plain no:
 * six of the nine reasons leave the person something to do, the appliance they
 * said they do not have among them (`0102`), and the other three must not be
 * dressed up as advice.
 */
export type NotOfferedDishDto = NotOfferedDish;
