import { PROMPT_VERSION } from '../ai/PoolPrompt.js';

import type { CandidateDish, RecipeDraft } from 'core/entities/Plan';
import type { CheckInForGeneration } from 'core/controllers/CheckIn';
import type { FullProfileView } from 'core/controllers/Profile';
import type { GenerationContext } from 'core/controllers/Recipe';
import type { NutritionTargets } from 'core/entities/Nutrition';
import type { PromptContext } from '../ai/PoolPrompt.js';

/** A dish the model composed, as the repository stores it. */
export function toRecipeDraft(dish: CandidateDish, context: GenerationContext): RecipeDraft {
  return {
    cookMinutes: dish.cookMinutes,
    cuisine: dish.cuisine ?? null,
    difficulty: dish.difficulty,
    ingredients: dish.ingredients.map(item => ({
      grams: item.grams,
      // Safe: the dish passed the catalogue check before reaching here.
      ingredientId: context.catalogue.get(item.slug)?.id ?? '',
      unit: 'g' as const
    })),
    mealSlots: dish.slots,
    name: dish.name,
    prepMinutes: dish.prepMinutes,
    servings: dish.servings,
    slug: dish.slug,
    steps: dish.steps,
    // Stamped with the prompt that wrote them, so a later one can find its predecessors.
    stepsVersion: PROMPT_VERSION
  };
}

export type PromptPreferences = Omit<PromptContext, 'excludeSlugs' | 'forbiddenLabels' | 'language' | 'needBySlot'>;

/**
 * Everything the prompt is told about the person, from one place — a whole plan
 * and a single meal's swap describe them the same way.
 */
export function promptPreferences(
  profile: FullProfileView,
  verdicts: { readonly disliked: readonly { readonly name: string }[]; readonly liked: readonly { readonly name: string }[] },
  avoidNames: readonly string[],
  targets: NutritionTargets,
  checkIn: CheckInForGeneration | null = null,
  swapWish: string | null = null
): PromptPreferences {
  return {
    avoidNames,
    breakfastStyle: profile.preferences?.breakfastStyle ?? null,
    budget: profile.preferences?.budget ?? null,
    checkIn,
    cookingFrequency: profile.preferences?.cookingFrequency ?? null,
    cookingTimeMinutes: profile.preferences?.cookingTimeMinutes ?? null,
    cuisines: profile.cuisines,
    dietaryPatterns: profile.dietaryPatterns,
    dislikedLabels: profile.foodPreferences.filter(item => item.sentiment === 'disliked').map(item => item.label),
    dislikedNames: verdicts.disliked.map(dish => dish.name),
    likedLabels: profile.foodPreferences.filter(item => item.sentiment === 'liked').map(item => item.label),
    lovedNames: verdicts.liked.map(dish => dish.name),
    portionPreference: profile.preferences?.portionPreference ?? null,
    scheduleNotes: profile.preferences?.workScheduleNotes ?? null,
    swapWish,
    targets
  };
}
