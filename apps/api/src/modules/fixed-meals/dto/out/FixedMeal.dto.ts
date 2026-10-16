import type { FixableDish, FixedMealConsequence, NotOfferedDish } from '../../services/index.js';
import type { FixedMeal } from 'core/entities/FixedMeal';
import type { FixedMealHonourability, FixedMealsView } from 'core/controllers/FixedMeal';

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

/*
 * `maxPerDay` travels with them (`0103`): a weekday may hold at most that many
 * rules, whatever the tier's own allowance leaves, so the screen greys a full
 * day out instead of offering dishes `POST /fixed-meals` would refuse.
 */

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
 * What fixing one chosen dish to one meal would cost (`0103`).
 *
 * **The offer no longer answers this per dish, and that is the change.** The
 * picker's list is the plate fit — 16 ms against the 4.05 s the day's arithmetic
 * cost over the library — so a dish that cannot sit beside the rule the day
 * already holds is now *in* the list. This is the read that puts the sentence on
 * the row the person touched, before they commit.
 *
 * `fixable: true` means nothing to accept. `fixable: false` with
 * `acceptable: true` is the warning, and there is exactly one:
 * `clashes_with_fixed` — this day may not reach its four macros, and the meal is
 * served anyway. `acceptable: false` is a plain no and the screen must not offer
 * a way past it; `too_big_or_small` is among those although it is arithmetic,
 * because the generation would drop that pin, and `allergen` above all (`0004`).
 *
 * Reading it is not what lets a rule be written: `POST /fixed-meals` asks the
 * same question again and refuses a warning whose reason the body did not name.
 * A weekday already holding `maxPerDay` rules answers 409 `FIXED_MEAL_DAY_FULL`
 * instead, here and there, because that is not a fact about the dish.
 */
export type FixedMealConsequenceDto = FixedMealConsequence;

/**
 * A dish the library has and this person was not offered, with the reason
 * (report `0011` § 2).
 *
 * `actionable` says whether the screen owes them a way forward or a plain no:
 * six of the nine reasons leave the person something to do, the appliance they
 * said they do not have among them (`0102`), and the other three must not be
 * dressed up as advice.
 *
 * **There is no `acceptable` here**, unlike `UnhonouredRule` (`0103`): nothing
 * this list can say is a reason somebody may fix the dish over. The one
 * acceptable reason is offered rather than refused, and the other arithmetic one
 * is settled as a refusal, so the field would be a branch no screen could reach.
 */
export type NotOfferedDishDto = NotOfferedDish;

/**
 * Which standing rules the next plan could not honour, each with the reason
 * (021 phase 5b).
 *
 * **A second request and not a field of `FixedMealsDto`**, because answering it
 * assembles a generation's context: 75–90 ms measured against the local library
 * beside the 2 ms the rules themselves cost, for an answer that is empty for
 * almost every account. The rules screen opens on what it always cost and asks
 * for this once it is on the screen.
 *
 * `judged: false` means the answer could not be computed, **not** that every
 * rule is fine: a profile whose targets the equations reject answers that way
 * rather than turning somebody's list of rules into an error.
 */
export type FixedMealHonourabilityDto = FixedMealHonourability;
