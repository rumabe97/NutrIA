import { Injectable, Logger } from '@nestjs/common';

import { normaliseForMatching } from 'core/domain/Safety';
import { buildShoppingList } from 'core/domain/ShoppingList';
import { axisFilter, pickReplacement } from 'core/domain/Scheduler';
import { ConflictError, QuotaExceededError } from 'core/entities/Error';
import { PlanController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';

import { PoolBuilder } from '../ai/PoolBuilder.service.js';
import { promptPreferences, toRecipeDraft } from './GenerationShared.js';

import type { MealCompositionView, MealDetailView } from 'core/controllers/Plan';
import type { Placement } from 'core/domain/Variety';
import type { RecipeDraft, SwapAxis } from 'core/entities/Plan';

/**
 * How many dishes to ask the model for when the library has nothing for the
 * slot. More than one, so the fit still gets a choice; far fewer than a plan
 * asks, because one meal is being replaced.
 */
const SWAP_CANDIDATES = 3;

/** The budget's protein when "more protein" is asked: the picker then ranks a richer plate as the better fit. */
const MORE_PROTEIN_BUDGET = 1.25;

/** What the model is told when the library had nothing that answers the axis. */
function wishFor(axis: SwapAxis | undefined, current: { readonly cookMinutes: number; readonly prepMinutes: number }): string | null {
  switch (axis) {
    case 'quicker':
      return `quicker than the current dish — under ${current.prepMinutes + current.cookMinutes} minutes in total, prep and cooking`;
    case 'no_cooking':
      return 'no cooking at all: assembled cold, cooking time zero';
    case 'more_protein':
      return 'clearly more protein per calorie than an ordinary dish of this kind';
    case 'vegetarian':
      return 'vegetarian: no meat, no fish and no shellfish (eggs and dairy are fine)';
    default:
      return null;
  }
}

/**
 * Replaces one meal of the active plan
 * ([`0015`](../../../../../docs/decisions/0015-one-redo-a-fortnight-five-swaps-a-plan.md)).
 *
 * Library first: a dish already written, safe for this person, not in their plan
 * and not among their dislikes, that lands closest to the meal's own calories
 * and protein — the swap costs nothing and returns at once. The model is asked
 * only when the library has nothing that fits, and then for a handful of dishes
 * for this one slot. Either way the dish passes the same allergen gate as a
 * plan's, the variety rules hold, and the shopping list is rebuilt to match.
 */
@Injectable()
export class MealSwapService {
  private readonly logger = new Logger(MealSwapService.name);

  constructor(private readonly pool: PoolBuilder) {}

  async swap(userId: string, mealId: string, locale: string | null, axis?: SwapAxis): Promise<MealDetailView> {
    const anchor = await PlanController.mealForSwap(userId, mealId);

    if (anchor.plan.status !== 'active') {throw new ConflictError('Only the active plan can be changed');}

    const { mealSwaps } = await PlanController.allowances(userId);

    if (!mealSwaps.allowed) {throw new QuotaExceededError('meal_swap');}

    const [context, verdicts, profile, meals] = await Promise.all([
      RecipeController.generationContext(userId),
      RecipeController.verdicts(userId),
      ProfileController.getFullProfile(userId),
      PlanController.composition(userId, anchor.plan.id)
    ]);
    const current = meals.find(meal => meal.id === mealId);

    if (!current) {throw new ConflictError('Meal is not part of its plan');}

    // The rest of the plan, as the variety rules see it: the meal being replaced
    // is out, so its own dish may not come straight back into the same slot.
    const placed: Placement[] = meals.filter(meal => meal.id !== mealId).map(meal => ({ dayIndex: meal.dayIndex, dishSlug: meal.recipeSlug, slot: meal.slot }));
    const inPlan = new Set(meals.map(meal => meal.recipeSlug));
    const disliked = new Set(verdicts.disliked.map(dish => dish.slug));
    // The meal's own planned figures are the budget: the day's totals stay where
    // they were. An axis (0022) is a test every candidate must pass, judged
    // against the dish being replaced; "more protein" also raises the protein
    // the fit is scored against, so a richer plate ranks as the better one.
    const filter = axisFilter(axis, { cookMinutes: anchor.recipe.cookMinutes, macros: current.macros, prepMinutes: anchor.recipe.prepMinutes }, context.catalogue);
    const budget = { kcal: current.macros.kcal, proteinG: axis === 'more_protein' ? current.macros.proteinG * MORE_PROTEIN_BUDGET : current.macros.proteinG };
    const leaning = {
      preferCuisines: new Set(profile.cuisines.map(cuisine => normaliseForMatching(cuisine))),
      preferIngredientSlugs: context.preferences.preferredIngredientSlugs,
      preferSlugs: new Set(verdicts.liked.map(dish => dish.slug))
    };
    const pick = { budget, catalogue: context.catalogue, dayIndex: current.dayIndex, filter, leaning, placed, slot: current.slot };

    const library = (await RecipeController.reusablePool([current.slot], context)).filter(dish => !inPlan.has(dish.slug) && !disliked.has(dish.slug));
    let replacement = pickReplacement({ ...pick, pool: library });
    let source: 'library' | 'model' = 'library';
    let newRecipe: RecipeDraft | null = null;

    if (!replacement) {
      const targets = anchor.plan.strategy ?? { carbsG: 0, fatG: 0, fiberG: 0, kcal: current.macros.kcal * 4, proteinG: current.macros.proteinG * 4 };
      const built = await this.pool.build({
        context,
        needPerSlot: SWAP_CANDIDATES,
        preferences: promptPreferences(profile, verdicts, [...inPlan], targets, null, wishFor(axis, anchor.recipe), context.preferences.unenforceableLabels),
        reusable: [],
        slots: [current.slot]
      });

      replacement = pickReplacement({ ...pick, pool: built.generated.filter(dish => !inPlan.has(dish.slug)) });

      if (!replacement) {
        this.logger.warn(`No replacement for meal ${mealId} (${current.slot}${axis ? `, ${axis}` : ''}): library empty for the slot and the model returned nothing usable`);
        throw new ConflictError('No dish fits this meal right now');
      }

      source = 'model';
      newRecipe = toRecipeDraft(replacement.dish, context);
    }

    const swapped = replacement;
    const shopping = buildShoppingList(
      { days: groupByDay(meals.map(meal => (meal.id === mealId ? { ...meal, ingredients: swapped.ingredients } : meal))) },
      context.catalogue,
      context.locale
    );

    await PlanController.swapMeal(
      userId,
      mealId,
      { locale: context.locale, macros: swapped.macros, newRecipe, recipeSlug: swapped.dish.slug, servings: swapped.servings, source },
      shopping.items.map(item => ({
        category: item.category,
        displayQuantity: item.displayQuantity,
        displayUnit: item.displayUnit,
        ingredientId: item.ingredientId,
        name: item.name,
        totalGrams: item.totalGrams
      }))
    );
    this.logger.log(`Meal ${mealId} swapped from the ${source} (${current.recipeSlug} → ${swapped.dish.slug})`);

    return PlanController.getMeal(userId, mealId, locale);
  }
}

function groupByDay(meals: readonly MealCompositionView[]): readonly { readonly meals: readonly MealCompositionView[] }[] {
  const days = new Map<number, MealCompositionView[]>();

  for (const meal of meals) {days.set(meal.dayIndex, [...(days.get(meal.dayIndex) ?? []), meal]);}

  return [...days.values()].map(entries => ({ meals: entries }));
}
