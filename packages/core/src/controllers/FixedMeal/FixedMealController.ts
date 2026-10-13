import { ConflictError, NotFoundError } from 'core/entities/Error';
import { countedStanding } from 'core/domain/Allowance';
import { FixedMealRepository } from '#repositories/FixedMeal';
import { PlanController } from 'core/controllers/Plan';

import type { AddFixedMeal, FixedMeal, Weekday } from 'core/entities/FixedMeal';
import type { CountedStanding } from 'core/domain/Allowance';

/** The rules this account has, and how many more it may have. */
export type FixedMealsView = { readonly rules: readonly FixedMeal[]; readonly standing: CountedStanding };

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
   * on 2026-09-22. `quota` re-reads the tier on every attempt.
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

  /** What this account has fixed, and what is left of its allowance. */
  async standing(userId: string): Promise<FixedMealsView> {
    const [rules, limits] = await Promise.all([FixedMealRepository.findByUser(userId), PlanController.limitsOf(userId)]);

    return { rules, standing: countedStanding(rules.length, limits.fixedMeals) };
  },

  /**
   * Whether this weekday is already taken, for a screen to say so before the
   * insert refuses it.
   *
   * The refusal itself is the database's — `UNIQUE(user_id, weekday)` — and
   * this does not replace it: between this answer and the insert the person's
   * other tab can take the day. It exists so the ordinary case is a disabled
   * day on a picker rather than an error after a tap.
   */
  async taken(userId: string): Promise<readonly Weekday[]> {
    return (await FixedMealRepository.findByUser(userId)).map(rule => rule.weekday);
  }
};

/** A rule for the same weekday already exists — the shape the route turns into a 409. */
export function weekdayTaken(weekday: Weekday): ConflictError {
  return new ConflictError(`A meal is already fixed to weekday ${weekday}`);
}
