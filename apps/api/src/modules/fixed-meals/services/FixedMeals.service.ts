import { Injectable } from '@nestjs/common';

import { ConflictError, InputParseError } from 'core/entities/Error';
import { daysFor } from 'core/entities/FixedMeal';
import { DEFAULT_MEAL_SHAPE, proteinWeightsFor, slotsIn, weightsFor } from 'core/domain/MealShape';
import { FixedMealController } from 'core/controllers/FixedMeal';
import { larderFor } from 'core/domain/Accompaniment';
import { minimumDailyKcal } from 'core/domain/Nutrition';
import { pinnable, PLAN_DAYS } from 'core/domain/Scheduler';
import { PlanController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';
import { SettingsController } from 'core/controllers/Settings';

import type { AddFixedMeal, FixedMeal, Weekday } from 'core/entities/FixedMeal';
import type { CandidateDish, MealSlot } from 'core/entities/Plan';
import type { FixedMealsView } from 'core/controllers/FixedMeal';

/** A dish a person could fix to a slot, as the picker lists them. */
export type FixableDish = { readonly id: string; readonly name: string; readonly slug: string };

/**
 * Standing fixed meals: which dishes can be fixed, and the rules themselves
 * (`0098`, `0099`).
 *
 * **Judged against the plan that comes next, and that is a decision with a
 * cost** (owner, 2026-10-13). `pinnable` needs a day, because a day has targets
 * and — the part that bites — a *month*: fresh fruit and what goes beside a
 * plate are filtered by the season the day falls in (017 phase 2, project 016).
 * A standing rule has no day; it is for ever. So the question "can this dish be
 * fixed?" is answered against the fortnight the person would generate next, and
 * the known consequence is that a rule written in June with a summer dish stops
 * being honourable in December **without anybody being told**.
 *
 * That is accepted here and not forgotten: telling somebody a rule can no longer
 * be honoured is the next change, and it is one mechanism for three cases — the
 * season, a dish deleted from the catalogue, and an account that switches
 * language and keeps a rule pointing at a Spanish dish its pool will never hold.
 * Each of those produces the same silent symptom, and none of them is worth its
 * own machinery.
 *
 * **No model is called here.** The pool is the person's own safe library —
 * `reusablePool` with no rotation — because a picker that spent a generation's
 * worth of model calls to list dishes would be a picker nobody could open twice.
 */
@Injectable()
export class FixedMealsService {
  /** Fixes a meal, after checking the dish is one this person could actually be served there. */
  async add(userId: string, rule: AddFixedMeal): Promise<FixedMeal> {
    const offered = await this.fixable(userId, rule.weekday, rule.slot);

    if (!offered.some(dish => dish.slug === rule.dishSlug)) {
      // Said before the rule exists rather than discovered once a fortnight for
      // ever, which is `0098`'s whole reason for `pinnable` being exported.
      throw new InputParseError('That dish cannot be fixed to that meal', { dishSlug: ['is not offered for this slot'] });
    }

    if ((await FixedMealController.taken(userId)).includes(rule.weekday)) {
      // The database refuses it too (`fixed_meals_user_weekday_unique`); this is
      // only so the ordinary case reads as a sentence rather than a 500.
      throw new ConflictError('A meal is already fixed to that day');
    }

    return FixedMealController.add(userId, rule);
  }

  /**
   * Which dishes this person could fix to `slot` on `weekday`.
   *
   * Everything a generation would assemble except the model's third: the
   * catalogue and safety context, the library pool, the day's targets and the
   * season — then `pinnable` answers.
   */
  async fixable(userId: string, weekday: Weekday, slot: MealSlot): Promise<readonly FixableDish[]> {
    const [profile, context, allowances, verdicts] = await Promise.all([
      ProfileController.getFullProfile(userId),
      RecipeController.generationContext(userId),
      PlanController.allowances(userId),
      RecipeController.verdicts(userId)
    ]);

    if (!profile.targets) {
      throw new InputParseError('Finish your profile before fixing a meal', { profile: ['is incomplete'] });
    }

    const shape = profile.preferences?.mealShape ?? DEFAULT_MEAL_SHAPE;
    const slots = slotsIn(shape);

    if (!slots.includes(slot)) {
      throw new InputParseError('You do not eat that meal', { slot: ['is not one of your meals'] });
    }

    // The day the rule would land on in the plan this person would generate
    // next — `defaultStart` is the day the chooser offers first (project 015).
    const [dayIndex] = daysFor(weekday, allowances.defaultStart, PLAN_DAYS);

    if (dayIndex === undefined) {
      return [];
    }

    const disliked = new Set(verdicts.disliked.map(dish => dish.slug));
    const pool = (await RecipeController.reusablePool(slots, context)).filter(dish => !disliked.has(dish.slug));
    const start = new Date(`${allowances.defaultStart}T00:00:00Z`);

    const monthOf = (index: number): number => {
      const day = new Date(start);

      day.setUTCDate(day.getUTCDate() + index);

      return day.getUTCMonth() + 1;
    };

    const sides = (await SettingsController.accompaniments())
      ? { accompaniments: { larder: larderFor({ catalogue: context.catalogue, preferences: context.preferences, safety: context.safety }), monthOf } }
      : {};

    const offered = pinnable(
      {
        ...sides,
        catalogue: context.catalogue,
        minimumKcal: minimumDailyKcal(profile.profile?.sex ?? 'prefer_not_to_say'),
        monthOf,
        pool,
        proteinWeights: proteinWeightsFor(profile.goal?.type, weightsFor(shape)),
        targets: profile.targets.effective,
        weights: weightsFor(shape)
      },
      dayIndex,
      slot
    );

    return [...offered]
      .map((dish: CandidateDish) => ({ id: dish.slug, name: dish.name, slug: dish.slug }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async remove(userId: string, id: string): Promise<void> {
    return FixedMealController.remove(userId, id);
  }

  async standing(userId: string): Promise<FixedMealsView> {
    return FixedMealController.standing(userId);
  }
}
