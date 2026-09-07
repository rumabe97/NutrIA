import { hasUsableMethod } from 'core/domain/Method';
import { rotatePool } from 'core/domain/Variety';
import { dishSafety } from 'core/domain/Safety';
import { FALLBACK_LOCALE, RecipeRepository } from '#repositories/Recipe';
import { ProfileRepository } from '#repositories/Profile';
import { SafetyController } from 'core/controllers/Safety';
import { toCatalogue } from 'core/entities/Plan';
import type { CandidateDish, Catalogue, MealSlot } from 'core/entities/Plan';
import type { Rotation } from 'core/domain/Variety';
import type { ReusableRecipe } from '#repositories/Recipe';
import type { SafetyProfile } from 'core/entities/Safety';

/** How many library recipes to consider per generation. */
const REUSE_FETCH_LIMIT = 300;

export type GenerationContext = {
  readonly catalogue: Catalogue;
  /** The user's language. Names are resolved into it, reuse is scoped to it, and the model is told to write in it. */
  readonly locale: string;
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
    // Through `SafetyController`, not rebuilt from repositories here. This used
    // to assemble its own profile, which meant "what is this user allowed to
    // eat" had two implementations that happened to agree — until free-text
    // allergies arrived and only one of them knew.
    // The locale comes from the profile, not from a request header: generation
    // runs as a background job, where there is no request to read one from, and
    // a second source would drift from the first.
    const profile = await ProfileRepository.findByUserId(userId);
    const locale = profile?.locale ?? FALLBACK_LOCALE;

    const [catalogue, safety] = await Promise.all([RecipeRepository.loadCatalogue(locale), SafetyController.getSafetyProfile(userId)]);

    return { catalogue: toCatalogue(catalogue), locale, safety };
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
      .filter(recipe => hasUsableMethod(recipe) && dishSafety(recipe.ingredients, context.catalogue, context.safety).kind === 'safe')
      .map(toCandidateDish);

    // Without a rotation every user is handed the whole safe library in the same
    // order, and the deterministic scheduler then hands them the same plan. With
    // one, each user gets their own dozen per slot, minus last fortnight's.
    return rotation ? rotatePool(usable, slots, rotation) : usable;
  }
};
