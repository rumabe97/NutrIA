import { NotFoundError } from 'core/entities/Error';
import { acceptable, actionable } from 'core/domain/FixableReason';
import { countedStanding } from 'core/domain/Allowance';
import { DishRequestController } from 'core/controllers/DishRequest';
import { FixedMealRepository } from '#repositories/FixedMeal';
import { PlanController } from 'core/controllers/Plan';

import { MAX_FIXED_MEALS_PER_DAY } from 'core/entities/FixedMeal';

import type { AddFixedMeal, FixedMeal, Weekday } from 'core/entities/FixedMeal';
import type { AcceptableReason, FixableVerdict, NotFixable } from 'core/domain/FixableReason';
import type { MealSlot } from 'core/entities/Plan';
import type { CountedStanding } from 'core/domain/Allowance';

/**
 * The rules this account has, how many more it may have, and what is left of
 * this month's dish requests.
 *
 * The second allowance travels with the first because the screen reads them
 * together (report `0011` § 4 a): asking us to write a dish is what somebody does when
 * the library has nothing for that meal, and a free account has to be told it
 * is premium *before* it types a dish's name rather than after.
 */
export type FixedMealsView = {
  readonly dishRequests: CountedStanding;
  /**
   * How many meals of one weekday may be fixed (`0103`). On the wire for the
   * reason `KitchenController` puts `maxPreferred` there: the screen greys out
   * a full day before anybody taps, and a number repeated in a dictionary is a
   * number that will disagree with the server.
   */
  readonly maxPerDay: number;
  readonly rules: readonly FixedMeal[];
  readonly standing: CountedStanding;
};

/**
 * One standing rule the plan this person would generate next could not honour,
 * and why (021 phase 5b).
 *
 * `id` is the rule's own, as `FixedMealsView.rules` carries it, so a screen
 * marks the row it already has rather than matching on a weekday and a slot.
 *
 * `why` is `whyNotFixable`'s answer and `actionable` is `FixableReason`'s, for
 * the same reason it used to travel beside a not-offered dish: whether somebody
 * is owed a way forward or a plain no is a judgement the domain already made,
 * and two places deciding it is how they come to disagree.
 *
 * **Every reason here means the plan will not carry the rule**, and that is what
 * the type now says rather than what a reader has to know (`0103`). The five it
 * can hold take the dish out of the pool or fail `fitsPlate`, so `honouredPin`
 * drops the pin and there is something to do about it. `clashes_with_fixed` does
 * **not** belong: the day's macro bands are not one of `honouredPin`'s three
 * bounds, so a clashing rule is served and the day simply misses its numbers —
 * proved on real rows, a clashing pair both on the plate with the day 5.8% under
 * on energy. It travels as `OutOfBandDay` instead, and `Exclude` is what stops
 * it coming back here.
 */
export type UnhonouredRule = { readonly id: string; readonly actionable: boolean; readonly why: Exclude<NotFixable, AcceptableReason> };

/**
 * A standing rule whose day **is** served and will miss its four macros for it
 * (`0103`).
 *
 * Not a fault in the rule and nothing to undo: it is what the person chose when
 * they accepted the warning, or what their targets drifted into afterwards.
 * Which is why it is its own list — one field carrying both facts is how phase
 * 5b came to tell somebody a rule was not being honoured while the plan served
 * it, and to say so about the rule they had made no trade about at all.
 *
 * **Computed per day, not per rule**: one `dayHoldsPin` answer covers the day,
 * and when it says no, **every** rule of that day is here, because every one of
 * them is served and every one contributes to the miss. `weekday` is beside the
 * id so a screen can group them without matching back against the rules list.
 */
export type OutOfBandDay = { readonly id: string; readonly weekday: Weekday };

/**
 * Which of this account's standing rules are not being honoured.
 *
 * **Its own answer and its own request** (021 phase 5b), not a field of
 * `FixedMealsView`: answering it assembles a generation's context — the
 * catalogue, the safety profile, the kitchen and the library pool — and
 * measured on 2026-10-16 against the local library that is **75–90 ms** beside
 * the **2 ms** `FixedMealController.standing` costs. The phase's own acceptance
 * criterion is that opening the profile is no slower than it was, so the screen
 * asks for this separately, once the rules are on it.
 *
 * `judged` is false when the answer could not be computed at all — a profile
 * whose targets the equations reject, a consent withdrawn between the two
 * requests. **Both** lists are then empty and say nothing: a screen must not
 * read either as "every rule is fine".
 */
export type FixedMealHonourability = {
  readonly judged: boolean;
  /** The days that are served and miss their numbers for it — information, not a fault (`0103`). */
  readonly outOfBand: readonly OutOfBandDay[];
  readonly unhonoured: readonly UnhonouredRule[];
};

/**
 * The rules of these that a verdict refuses, in the order a screen should say
 * them: the ones the person can do something about first, then by weekday.
 *
 * `judge` is the caller's because answering it needs a generation's context,
 * which is the API's to assemble and not a domain controller's — the same split
 * `add` makes with `pinnable`. What lives here is that a refused rule is
 * reported with the domain's own `actionable`, that a list leading with a
 * refusal buries the two taps that would have fixed the next one, and that a
 * day's arithmetic is not a refusal at all (`0103`).
 */
export function unhonouredFrom(rules: readonly FixedMeal[], judge: (rule: FixedMeal) => FixableVerdict): readonly UnhonouredRule[] {
  return rules
    .flatMap(rule => {
      const verdict = judge(rule);

      if (verdict.fixable || acceptable(verdict.why)) {
        // Fixable, or a day's arithmetic — which is not an unhonoured rule and
        // is the caller's to report as `OutOfBandDay`. Narrowed here rather than
        // trusted: `UnhonouredRule.why` excludes it, so this is where the one
        // vocabulary splits into the two facts.
        return [];
      }

      return [{ id: rule.id, actionable: actionable(verdict.why), rule, why: verdict.why }];
    })
    .sort((a, b) => Number(b.actionable) - Number(a.actionable) || a.rule.weekday - b.rule.weekday)
    .map(({ id, actionable: canAct, why }) => ({ id, actionable: canAct, why }));
}

export const FixedMealController = {
  /**
   * Fixes a meal to a weekday.
   *
   * The dish is **not** checked here. Whether a dish can be fixed to a slot is
   * `pinnable`'s answer, and answering it needs the pool, the targets and the
   * season — everything a generation assembles — which is the API's to build
   * and not a domain controller's. The route gates on it before calling this,
   * and the repository's own comment says so too. What this owns is the
   * allowance and the weekday.
   *
   * The cap check and the insert are one statement under one lock, inside
   * `createWithinQuota` — never a `standing()` read followed by an `add()`,
   * which is exactly the race a security scan found in `EventController.add`
   * on 2026-09-22. `quota` re-reads the tier on every attempt, and the
   * repository re-counts `MAX_FIXED_MEALS_PER_DAY` in the same lock (`0103`):
   * both bounds are a count followed by an insert, so neither may be read
   * outside it.
   */
  async add(userId: string, rule: AddFixedMeal): Promise<FixedMeal> {
    return FixedMealRepository.createWithinQuota(userId, rule, async standing => {
      const limits = await PlanController.limitsOf(userId);

      return countedStanding(standing.length, limits.fixedMeals).allowed;
    });
  },

  /**
   * Which day indexes of a plan this account's rules land on, and the dish for
   * each — what `SchedulerInput.pinned` is built from (`0098`).
   *
   * Returned as a plain list rather than the map the scheduler takes, because
   * building the map is where the one-rule-per-day invariant has to hold and
   * that belongs beside the scheduler, not here. `daysFor` is the expansion.
   */
  async forPlan(userId: string): Promise<readonly FixedMeal[]> {
    return FixedMealRepository.findByUser(userId);
  },

  async remove(userId: string, id: string): Promise<void> {
    if (!(await FixedMealRepository.remove(userId, id))) {
      throw new NotFoundError(`Fixed meal "${id}" not found`);
    }
  },

  /** What this account has fixed, and what is left of each of the two allowances its screen spends. */
  async standing(userId: string): Promise<FixedMealsView> {
    const [rules, limits, dishRequests] = await Promise.all([
      FixedMealRepository.findByUser(userId),
      PlanController.limitsOf(userId),
      DishRequestController.standing(userId)
    ]);

    return { dishRequests, maxPerDay: MAX_FIXED_MEALS_PER_DAY, rules, standing: countedStanding(rules.length, limits.fixedMeals) };
  },

  /**
   * Which meals of which weekdays this account has already fixed, for a screen
   * to say so before the insert refuses it.
   *
   * The refusal itself is the database's — `UNIQUE(user_id, weekday, slot)` —
   * and this does not replace it: between this answer and the insert the
   * person's other tab can take the meal. It exists so the ordinary case is a
   * meal missing from a picker rather than an error after a tap.
   *
   * A **meal** and not a day since `0101`: a day may hold more than one rule,
   * so what a screen must grey out is the meals of that day that are spoken
   * for, and a day drops off the list only when every meal this person eats
   * already carries one.
   */
  async taken(userId: string): Promise<readonly { readonly slot: MealSlot; readonly weekday: Weekday }[]> {
    return (await FixedMealRepository.findByUser(userId)).map(rule => ({ slot: rule.slot, weekday: rule.weekday }));
  }
};
