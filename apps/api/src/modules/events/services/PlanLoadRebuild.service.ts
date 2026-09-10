import { Injectable, Logger } from '@nestjs/common';

import { buildShoppingList, unresolvedSlugs } from 'core/domain/ShoppingList';
import { DEFAULT_MEAL_SHAPE, slotsIn, weightsFor } from 'core/domain/MealShape';
import { dishSafety } from 'core/domain/Safety';
import { loadedTargets } from 'core/domain/Event';
import { schedulePlan } from 'core/domain/Scheduler';
import { targetViolations } from 'core/domain/Nutrition';
import { PlanPausedError, QuotaExceededError } from 'core/entities/Error';
import { PlanController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';

import type { EventView } from 'core/controllers/Event';
import type { MealCompositionView } from 'core/controllers/Plan';
import type { MealSlot } from 'core/entities/Plan';
import type { Placement } from 'core/domain/Variety';

/**
 * Rebuilds the days of the fortnight under way that eat for an event declared
 * after the fortnight was made (`0044`). Premium only; the allowance says so.
 *
 * **No model call, by construction.** The pool is `RecipeController.reusablePool`
 * — the whole safe library, the same shape generation falls back to when the
 * provider is gone — and nothing here imports the AI module. Scheduling over a
 * pool is deterministic and free (`0043`), and a rebuild that spent a
 * generation would be a bug on a product whose binding constraint is the
 * provider's free tier. A day the library cannot fill is a day that is not
 * rebuilt, never a day the model is asked for.
 *
 * **Only days strictly after today.** A loaded day that is today may already
 * have meals marked eaten, and the past is read-only (`0021`). If that leaves
 * part of the load unapplied, what can be applied is, and the answer says
 * which days.
 *
 * Every "no" here is the same "no": the event stands and is read at the next
 * generation, exactly as `0043` shipped it for everybody. So the answer is
 * which days were rebuilt, and an empty list is a state rather than an error.
 */
@Injectable()
export class PlanLoadRebuildService {
  private readonly logger = new Logger(PlanLoadRebuildService.name);

  /** The dates of the active plan rebuilt for this event, oldest first. Empty when none were. */
  async forEvent(userId: string, event: EventView, today = isoToday()): Promise<readonly string[]> {
    const { events } = await PlanController.allowances(userId);

    // Null is a tier with no such thing; zero left is a tier that has spent it.
    // Both wait for the next generation, and the write below re-checks the
    // count under the transaction, so a race cannot spend what this read saw.
    if (!events.midPlan || events.midPlan.remaining <= 0) {
      return [];
    }

    const plan = await PlanController.getActivePlan(userId);

    if (!plan || plan.status !== 'active') {
      return [];
    }

    const wanted = new Set(event.loadedDates);
    const days = plan.days.filter(day => wanted.has(day.date) && day.date > today);

    if (days.length === 0) {
      return [];
    }

    const [profile, context, verdicts, composition] = await Promise.all([
      ProfileController.getFullProfile(userId),
      RecipeController.generationContext(userId),
      RecipeController.verdicts(userId),
      PlanController.composition(userId, plan.id)
    ]);
    // The load moves what *this plan* eats, which is its strategy — the profile's
    // targets may have moved since it was made, and a loaded Saturday built to
    // different base numbers from its Friday would not be a load, it would be a
    // different plan. The bounds are the profile's, as at generation (`0043`).
    const base = plan.strategy ?? profile.targets?.effective ?? null;
    const bounds = profile.targets?.bounds ?? null;

    if (!base || !bounds) {
      return [];
    }

    const targets = loadedTargets(base, event);
    const violations = targetViolations(targets, bounds);

    if (violations.length > 0) {
      this.logger.warn(
        `Load for "${event.name}" refused by the bounds (${violations.map(violation => violation.kind).join(', ')}); plan ${plan.id} untouched`
      );

      return [];
    }

    // The rebuilt days keep the shape the plan has: the meal rows are updated
    // in place, one per slot, so a day must come back with exactly the slots it
    // has. A profile whose shape changed since the plan was generated gets the
    // event at the next generation, like everybody did before this existed.
    const rebuilding = new Set(days.map(day => day.dayIndex));
    const shape = profile.preferences?.mealShape ?? DEFAULT_MEAL_SHAPE;
    const slots = slotsIn(shape);

    if (
      !days.every(day =>
        sameSlots(
          slots,
          composition.filter(meal => meal.dayIndex === day.dayIndex)
        )
      )
    ) {
      this.logger.warn(`Plan ${plan.id} no longer has the profile's meal shape; the load for "${event.name}" waits for the next generation`);

      return [];
    }

    const disliked = new Set(verdicts.disliked.map(dish => dish.slug));
    const pool = (await RecipeController.reusablePool(slots, context)).filter(dish => !disliked.has(dish.slug));
    // Everything the plan keeps, so the variety rules hold across the seam: a
    // rebuilt Thursday may not serve what the untouched Tuesday already does.
    const kept = composition.filter(meal => !rebuilding.has(meal.dayIndex));
    const placed: Placement[] = kept.map(meal => ({ dayIndex: meal.dayIndex, dishSlug: meal.recipeSlug, slot: meal.slot }));
    const dayIndexes = [...rebuilding].sort((a, b) => a - b);
    const scheduled = schedulePlan({
      catalogue: context.catalogue,
      dayIndexes,
      dayTargets: new Map(dayIndexes.map(dayIndex => [dayIndex, targets])),
      placed,
      pool,
      targets: base,
      weights: weightsFor(shape)
    });

    if (!scheduled.ok) {
      this.logger.warn(
        `Library too small to rebuild day ${scheduled.shortfall.dayIndex} (${scheduled.shortfall.slot}) of plan ${plan.id} for "${event.name}"; untouched`
      );

      return [];
    }

    // The gate runs over what is about to be written, exactly as generation
    // runs it over the assembled plan. The library was filtered on the way in;
    // a rebuilt day is new food, and new food passes the gate or is not served.
    for (const day of scheduled.assignment.days) {
      for (const meal of day.meals) {
        const safety = dishSafety(meal.ingredients, context.catalogue, context.safety);

        if (safety.kind !== 'safe') {
          this.logger.error(`Rebuilt day ${day.dayIndex} (${meal.slot}) of plan ${plan.id} rejected by the allergy gate: ${safety.kind}`);

          return [];
        }
      }
    }

    const missing = unresolvedSlugs(scheduled.assignment, context.catalogue);

    if (missing.length > 0) {
      this.logger.error(`Rebuilt days of plan ${plan.id} reference unresolved ingredients: ${missing.join(', ')}`);

      return [];
    }

    // The list is the whole plan's, rebuilt from the days kept and the days
    // remade, the way a swap does it (`0015`): quantities add across meals.
    const shopping = buildShoppingList({ days: [...groupByDay(kept), ...scheduled.assignment.days] }, context.catalogue, context.locale);

    try {
      await PlanController.rebuildLoadedDays(
        userId,
        plan.id,
        scheduled.assignment.days.map(day => ({
          dayIndex: day.dayIndex,
          loadedFor: event.name,
          meals: day.meals.map(meal => ({ macros: meal.macros, recipeSlug: meal.dish.slug, servings: meal.servings, slot: meal.slot })),
          targets
        })),
        shopping.items.map(item => ({
          category: item.category,
          displayQuantity: item.displayQuantity,
          displayUnit: item.displayUnit,
          ingredientId: item.ingredientId,
          name: item.name,
          totalGrams: item.totalGrams
        }))
      );
    } catch (error: unknown) {
      // Both are states the person is already told about elsewhere, and both
      // leave the plan exactly as it was: the event still stands for the next
      // generation. Anything else is a fault and goes up as one.
      if (error instanceof PlanPausedError || error instanceof QuotaExceededError) {
        this.logger.warn(`Plan ${plan.id} not rebuilt for "${event.name}": ${error.name}`);

        return [];
      }

      throw error;
    }

    const rebuilt = days.map(day => day.date).sort();

    this.logger.log(`Plan ${plan.id} rebuilt for "${event.name}" on ${rebuilt.join(', ')} from the library`);

    return rebuilt;
  }
}

/** Whether a day eats exactly the slots the shape says, no more and no fewer. */
function sameSlots(slots: readonly MealSlot[], meals: readonly MealCompositionView[]): boolean {
  const eaten = new Set(meals.map(meal => meal.slot));

  return eaten.size === slots.length && slots.every(slot => eaten.has(slot));
}

function groupByDay(meals: readonly MealCompositionView[]): readonly { readonly meals: readonly MealCompositionView[] }[] {
  const days = new Map<number, MealCompositionView[]>();

  for (const meal of meals) {
    days.set(meal.dayIndex, [...(days.get(meal.dayIndex) ?? []), meal]);
  }

  return [...days.values()].map(entries => ({ meals: entries }));
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
