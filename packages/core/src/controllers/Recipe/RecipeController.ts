import { hasUsableMethod } from 'core/domain/Method';
import { rotatePool } from 'core/domain/Variety';
import { dishSafety } from 'core/domain/Safety';
import { FALLBACK_LOCALE, RecipeRepository } from '#repositories/Recipe';
import { ProfileRepository } from '#repositories/Profile';
import { resolvePreferences, withinTime } from 'core/domain/Preference';
import { SafetyController } from 'core/controllers/Safety';
import { NotFoundError, PlanPausedError } from 'core/entities/Error';
import { VacationRepository } from '#repositories/Vacation';
import { isAway } from 'core/domain/Vacation';
import { toCatalogue } from 'core/entities/Plan';
import type { CandidateDish, Catalogue, MealSlot, RecipeVerdict } from 'core/entities/Plan';
import type { Rotation } from 'core/domain/Variety';
import type { RecipeStep } from 'database/schema/recipe';
import type { DishRef, ReusableRecipe, UndocumentedRecipe } from '#repositories/Recipe';

/** Re-exported: a rewriter in `apps/api` needs this shape, and depends on controllers, not repositories. */
export type { UndocumentedRecipe } from '#repositories/Recipe';
import type { PreferenceExclusions } from 'core/domain/Preference';
import type { SafetyProfile } from 'core/entities/Safety';

/** How many library recipes to consider per generation. */
const REUSE_FETCH_LIMIT = 300;

export type GenerationContext = {
  readonly catalogue: Catalogue;
  /** The user's language. Names are resolved into it, reuse is scoped to it, and the model is told to write in it. */
  readonly locale: string;
  /**
   * What their way of eating and their dislikes rule out (0023).
   *
   * Beside `safety` rather than inside it: both remove food before it can be
   * proposed, but one is a constraint and the other a preference, and merging
   * them would report a vegetarian's chicken as an allergy violation.
   */
  readonly preferences: PreferenceExclusions;
  readonly safety: SafetyProfile;
};

/**
 * Whether a dish uses anything this person's way of eating or dislikes rule out
 * (0023). A recipe already in the library is no more evidence that they want it
 * than that it is safe for them, so reuse is filtered exactly as generation is.
 */
function usesExcluded(ingredients: readonly { readonly slug: string }[], context: GenerationContext): boolean {
  return ingredients.some(item => {
    const ingredient = context.catalogue.get(item.slug);

    return ingredient !== undefined && context.preferences.excludedIngredientIds.has(ingredient.id);
  });
}

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
    // Through `SafetyController`, not rebuilt from repositories here. This used
    // to assemble its own profile, which meant "what is this user allowed to
    // eat" had two implementations that happened to agree — until free-text
    // allergies arrived and only one of them knew.
    // The locale comes from the profile, not from a request header: generation
    // runs as a background job, where there is no request to read one from, and
    // a second source would drift from the first.
    const profile = await ProfileRepository.findByUserId(userId);
    const locale = profile?.locale ?? FALLBACK_LOCALE;
    // Same reasoning as the locale, and the same source: a plan is built from
    // what this person can buy, and where they are is a fact about them rather
    // than about the request that happens to trigger the job (`0034`).
    const country = profile?.country ?? null;

    const [catalogue, safety, dietaryPatterns, foodPreferences, preferred] = await Promise.all([
      RecipeRepository.loadCatalogue(locale, country),
      SafetyController.getSafetyProfile(userId),
      ProfileRepository.findDietaryPatterns(userId),
      ProfileRepository.findFoodPreferences(userId),
      ProfileRepository.findPreferences(userId)
    ]);

    // Resolved here, once, for the same reason the safety profile is: a rule
    // rebuilt at each call site is a rule that disagrees with itself.
    const preferences = resolvePreferences({
      dietaryPatterns,
      dislikedLabels: foodPreferences.filter(item => item.sentiment === 'disliked').map(item => item.label),
      ingredients: catalogue,
      likedLabels: foodPreferences.filter(item => item.sentiment === 'liked').map(item => item.label),
      maxMinutesPerDish: preferred?.cookingTimeMinutes ?? null
    });

    return { catalogue: toCatalogue(catalogue), locale, preferences, safety };
  },

  /** The stored illustration for a public route to serve; nothing else about the recipe. */
  async illustration(recipeId: string): Promise<{ readonly bytes: Buffer; readonly contentType: string } | undefined> {
    return RecipeRepository.findImage(recipeId);
  },

  /** What the illustrator still has to draw. Bounded, oldest first. */
  async pendingIllustrations(
    limit: number
  ): Promise<readonly { readonly id: string; readonly ingredientNames: readonly string[]; readonly locale: string; readonly name: string }[]> {
    return RecipeRepository.findWithoutImage(limit);
  },

  /** Recipes still written by an older prompt, oldest first. Bounded. */
  async pendingStepUpgrades(stepsVersion: string, limit: number): Promise<readonly UndocumentedRecipe[]> {
    return RecipeRepository.findUndocumented(stepsVersion, limit);
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
   *
   * With a `rotation`, the library is then narrowed to this user's own pick — see
   * `rotatePool` for why "reuse everything" meant "everyone gets the same plan".
   *
   * Dishes with no method are dropped too, and that gate is the only thing that
   * lets a quality change ever reach an existing user. Reuse is preferred over
   * generation by design ([`0006`](../../../../docs/decisions/0006-reuse-before-generating.md)),
   * so a library built under an older prompt is served back for ever: the first
   * plan generated after prompt 2.1.0 landed was 41 dishes, of which 3 were new.
   * A recipe that never says how to cook it is the one defect worth spending a
   * regeneration on, so it is the one this filter names.
   */
  async reusablePool(slots: readonly MealSlot[], context: GenerationContext, rotation?: Rotation): Promise<readonly CandidateDish[]> {
    const recipes = await RecipeRepository.findReusable(slots, REUSE_FETCH_LIMIT, context.locale);
    const usable = recipes
      .filter(
        recipe =>
          hasUsableMethod(recipe) &&
          dishSafety(recipe.ingredients, context.catalogue, context.safety).kind === 'safe' &&
          !usesExcluded(recipe.ingredients, context) &&
          withinTime(recipe, context.preferences.maxMinutesPerDish)
      )
      .map(toCandidateDish);

    // Without a rotation every user is handed the whole safe library in the same
    // order, and the deterministic scheduler then hands them the same plan. With
    // one, each user gets their own dozen per slot, minus last fortnight's.
    return rotation ? rotatePool(usable, slots, rotation) : usable;
  },

  async rewriteSteps(recipeId: string, steps: readonly RecipeStep[], stepsVersion: string): Promise<void> {
    await RecipeRepository.updateSteps(recipeId, steps, stepsVersion);
  },

  /** Replaces a recipe's method and records which prompt wrote it. Ingredients are never touched. */
  /** A verdict on a recipe that does not exist is a 404, like every other denial. */
  async setVerdict(userId: string, recipeId: string, verdict: RecipeVerdict): Promise<void> {
    /*
     * Paused too (`0032`). A verdict is harmless on its own, but it is one of
     * the three things the plan screen offers and the rule people can hold is
     * "while I am away, my plan does not change". One exception to that is a
     * rule nobody remembers.
     */
    const today = new Date().toISOString().slice(0, 10);

    if ((await VacationRepository.findUpcoming(userId, today)).some(trip => isAway(trip, today))) {
      throw new PlanPausedError();
    }

    if (!(await RecipeRepository.setVerdict(userId, recipeId, verdict))) {
      throw new NotFoundError('Recipe not found');
    }
  },

  async storeIllustration(
    recipeId: string,
    image: {
      readonly bytes: Buffer;
      readonly contentType: string;
      readonly height: number;
      readonly model: string;
      readonly promptVersion: string;
      readonly width: number;
    }
  ): Promise<void> {
    await RecipeRepository.saveImage(recipeId, image);
  },

  async verdictFor(userId: string, recipeId: string): Promise<'disliked' | 'liked' | null> {
    return RecipeRepository.findVerdict(userId, recipeId);
  },

  /** Everything this person has said about dishes, for the next plan to honour. */
  async verdicts(userId: string): Promise<{ readonly disliked: readonly DishRef[]; readonly liked: readonly DishRef[] }> {
    return RecipeRepository.findVerdicts(userId);
  }
};
