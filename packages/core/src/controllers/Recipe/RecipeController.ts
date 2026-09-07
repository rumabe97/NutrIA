import { dishSafety, toSafetyProfile } from 'core/domain/Safety';
import { toCatalogue } from 'core/entities/Plan';
import { RecipeRepository } from '#repositories/Recipe';
import { SafetyRepository } from '#repositories/Safety';
import type { CandidateDish, Catalogue, MealSlot } from 'core/entities/Plan';
import type { ReusableRecipe } from '#repositories/Recipe';
import type { SafetyProfile } from 'core/entities/Safety';

/** How many library recipes to consider per generation. */
const REUSE_FETCH_LIMIT = 300;

export type GenerationContext = {
  readonly catalogue: Catalogue;
  readonly safety: SafetyProfile;
};

// --- Presenters ---------------------------------------------------------------

function toCandidateDish(recipe: ReusableRecipe): CandidateDish {
  return {
    cookMinutes: recipe.cookMinutes,
    cuisine: recipe.cuisine,
    difficulty: recipe.difficulty,
    // Copied into mutable arrays: CandidateDish is inferred from a Zod schema,
    // which produces mutable array types.
    ingredients: [...recipe.ingredients],
    name: recipe.name,
    prepMinutes: recipe.prepMinutes,
    servings: recipe.servings,
    slots: [...recipe.mealSlots],
    slug: recipe.slug,
    steps: recipe.steps.map(step => ({ ...step }))
  };
}

// --- Controller ---------------------------------------------------------------

export const RecipeController = {
  /**
   * Everything a generation needs to reason about food: the catalogue, and the
   * user's safety profile as sets.
   *
   * Loaded once and threaded down. Fourteen days of meals is thousands of allergen
   * lookups, and a profile re-fetched inside that loop is how a check becomes
   * something someone later decides to skip "for performance".
   */
  async generationContext(userId: string): Promise<GenerationContext> {
    const [catalogue, allergies, intolerances] = await Promise.all([
      RecipeRepository.loadCatalogue(),
      SafetyRepository.findAllergies(userId),
      SafetyRepository.findIntolerances(userId)
    ]);

    return { catalogue: toCatalogue(catalogue), safety: toSafetyProfile(allergies, intolerances) };
  },

  /**
   * Dishes from the library this user may safely eat.
   *
   * Every candidate goes through `findSafetyViolations` — the same gate applied to
   * model output. A recipe already existing is not evidence that it is safe for
   * *this* person, and reuse would otherwise be a hole straight past the allergy
   * layer. See `docs/decisions/0006-reuse-before-generating.md`.
   *
   * Dishes referencing an ingredient no longer in the catalogue are dropped: their
   * macros could not be computed, so they cannot be scheduled.
   */
  async reusablePool(slots: readonly MealSlot[], context: GenerationContext): Promise<readonly CandidateDish[]> {
    const recipes = await RecipeRepository.findReusable(slots, REUSE_FETCH_LIMIT);

    return recipes.filter(recipe => dishSafety(recipe.ingredients, context.catalogue, context.safety).kind === 'safe').map(toCandidateDish);
  }
};
