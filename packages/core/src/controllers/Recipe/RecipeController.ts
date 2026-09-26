import { randomUUID } from 'node:crypto';

import { fitSlots, libraryUsage, SECOND_CUT_SLOTS } from 'core/domain/MealFit';
import { hasUsableMethod } from 'core/domain/Method';
import { rotatePool } from 'core/domain/Variety';
import { bestEffortExclusions, dishSafety, mentionsUnresolvedAllergy } from 'core/domain/Safety';
import { FALLBACK_LOCALE, RecipeRepository } from '#repositories/Recipe';
import { ProfileRepository } from '#repositories/Profile';
import { HealthRepository } from '#repositories/Health';
import { proteinSupplementExclusions } from 'core/domain/Health';
import { breaksDishRule, resolvePreferences, withinTime } from 'core/domain/Preference';
import { SafetyController } from 'core/controllers/Safety';
import { requireProfileConsent } from 'core/controllers/Profile';
import { NotFoundError, OnboardingIncompleteError, PlanPausedError } from 'core/entities/Error';
import { OnboardingRepository } from '#repositories/Onboarding';
import { VacationRepository } from '#repositories/Vacation';
import { isAway } from 'core/domain/Vacation';
import { toCatalogue } from 'core/entities/Plan';
import type { CandidateDish, Catalogue, MealSlot, RecipeVerdict } from 'core/entities/Plan';
import type { LibraryUsage } from 'core/domain/MealFit';
import type { Rotation } from 'core/domain/Variety';
import type { RecipeStep } from 'database/schema/recipe';
import type { DishRef, ReusableRecipe, UndocumentedRecipe } from '#repositories/Recipe';

/** Re-exported: a rewriter in `apps/api` needs this shape, and depends on controllers, not repositories. */
export type { UndocumentedRecipe } from '#repositories/Recipe';
import type { PreferenceExclusions } from 'core/domain/Preference';
import type { SafetyProfile } from 'core/entities/Safety';

/**
 * How many library recipes to consider per generation — a ceiling on the read,
 * sized well above the library rather than to a sample of it.
 *
 * It was 300, with no order, and that was a sample: once the library passed
 * three hundred Spanish dishes, whichever rows Postgres returned first were the
 * only ones any generation, swap or rebuild could see, and a five-hundred-dish
 * seed would have been mostly invisible. Everything that follows — safety,
 * dislikes, the per-person rotation — filters what this reads, so it has to
 * read all of it. Five hundred recipes and their ingredients are a few
 * thousand rows; the read is not where a generation spends its time.
 */
const REUSE_FETCH_LIMIT = 5000;

/**
 * How long a sweep holds the recipes it took. Longer than a sweep's own 240
 * seconds, so no second sweep takes a recipe the first is still rewriting;
 * short enough that one it could not finish is free again within minutes.
 */
const REWRITE_CLAIM_MINUTES = 5;

export type GenerationContext = {
  readonly catalogue: Catalogue;
  /**
   * Their ways of eating, as stored — the same list `preferences` was resolved
   * from, carried so the meal a dish may be served at is decided for this
   * person (`MealFit`: a vegan or vegetarian sees every plant protein at every
   * meal, `0062` § 4). Read once, here, for the library and the model's dishes
   * alike. Never a prompt line by itself: the prompt names a way of eating only
   * through `NAMEABLE_PATTERNS`.
   */
  readonly dietaryPatterns: readonly string[];
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
  return (
    breaksDishRule(ingredients, context.catalogue, context.preferences) ||
    ingredients.some(item => {
      const ingredient = context.catalogue.get(item.slug);

      return ingredient !== undefined && context.preferences.excludedIngredientIds.has(ingredient.id);
    })
  );
}

/**
 * Everything a generation needs to reason about food, read for one id. Behind
 * `generationContext`, which adds the consent check, and `nobodysContext`.
 */
async function buildContext(userId: string): Promise<GenerationContext> {
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

  const [catalogue, safety, dietaryPatterns, foodPreferences, preferred, takesProteinSupplement, allergens] = await Promise.all([
    RecipeRepository.loadCatalogue(locale, country),
    SafetyController.getSafetyProfile(userId),
    ProfileRepository.findDietaryPatterns(userId),
    ProfileRepository.findFoodPreferences(userId),
    ProfileRepository.findPreferences(userId),
    HealthRepository.takesProteinSupplement(userId),
    // By key, so a gluten-free or lactose-free way of eating is enforced by
    // the same tags the allergy gate reads, and never named to the model.
    SafetyController.listAllergens()
  ]);

  // Resolved here, once, for the same reason the safety profile is: a rule
  // rebuilt at each call site is a rule that disagrees with itself.
  const resolved = resolvePreferences({
    allergenIdsByKey: new Map(allergens.map(allergen => [allergen.key, allergen.id])),
    dietaryPatterns,
    dislikedLabels: foodPreferences.filter(item => item.sentiment === 'disliked').map(item => item.label),
    ingredients: catalogue,
    likedLabels: foodPreferences.filter(item => item.sentiment === 'liked').map(item => item.label),
    maxMinutesPerDish: preferred?.cookingTimeMinutes ?? null
  });
  // Protein powder is for the people who take it (`0052`). Excluded the way a
  // dislike is, so the prompt, the library and the gate all agree — and what
  // reaches the model is a catalogue without it, never the supplement.
  const supplements = proteinSupplementExclusions(takesProteinSupplement, catalogue);
  // An allergy the catalogue could not resolve is never named to the model
  // (no free text leaves the building); what shares a word with it is taken
  // out of the catalogue instead, quietly, beside the preferences — never as
  // a safety violation, because it is not a guarantee (`bestEffortExclusions`).
  const unresolvedAllergies = bestEffortExclusions(safety.unenforceableLabels, catalogue);
  const extra = [...supplements, ...unresolvedAllergies];
  const preferences = extra.length === 0 ? resolved : { ...resolved, excludedIngredientIds: new Set([...resolved.excludedIngredientIds, ...extra]) };

  return { catalogue: toCatalogue(catalogue), dietaryPatterns, locale, preferences, safety };
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
  /** Every recipe's own method, for `apps/api/scripts/clean-stored-steps.mjs`. See `RecipeRepository.listForStepCleanup`. */
  async allStepsForCleanup(): Promise<
    readonly {
      readonly id: string;
      readonly ingredientSlugs: readonly string[];
      readonly instructions: readonly RecipeStep[];
      readonly locale: string;
      readonly name: string;
    }[]
  > {
    return RecipeRepository.listForStepCleanup();
  },

  /**
   * The catalogue's own slug → display name, lower case, for one locale — the
   * same map `PoolBuilder` builds `cleanSteps`' `ingredientNames` option from.
   * A slug absent here (a food removed from the catalogue since) is left as
   * `cleanStep` leaves any unknown token: untouched.
   */
  async catalogueNames(locale: string): Promise<ReadonlyMap<string, string>> {
    const catalogue = await RecipeRepository.loadCatalogue(locale);

    return new Map(catalogue.map(ingredient => [ingredient.slug, ingredient.name.toLowerCase()]));
  },

  /** Recipes still written by an older prompt, held for this sweep so no other takes them. Bounded. */
  async claimStepUpgrades(stepsVersion: string, limit: number): Promise<readonly UndocumentedRecipe[]> {
    return RecipeRepository.claimUndocumented(stepsVersion, limit, REWRITE_CLAIM_MINUTES);
  },

  /**
   * Everything a generation needs to reason about food: the catalogue, and the
   * user's safety profile as sets.
   *
   * Loaded once and threaded down. Fourteen days of meals is thousands of allergen
   * lookups, and a profile re-fetched inside that loop is how a check becomes
   * something someone later decides to skip "for performance".
   */
  async generationContext(userId: string): Promise<GenerationContext> {
    const context = await buildContext(userId);

    // Asked *after* the reads, and that order is the point: a withdrawal
    // deletes the allergies and the consent in one transaction, so a context
    // read after it committed is always followed by a check that sees no
    // consent. Asked before, a withdrawal landing between the two would hand a
    // generation an empty safety profile. The one door generation, swaps and
    // the event rebuild all pass through.
    await requireProfileConsent(userId);

    // And a finished profile, read after the same reads for the same reason:
    // a withdrawal reopens the allergy step, and a consent given again before
    // it is answered would otherwise hand any path without its own onboarding
    // check — a professional's swap on a plan under review — an empty safety
    // profile.
    if (!(await OnboardingRepository.find(userId))?.completedAt) {
      throw new OnboardingIncompleteError();
    }

    return context;
  },

  /** The stored illustration for a public route to serve; nothing else about the recipe. */
  async illustration(recipeId: string): Promise<{ readonly bytes: Buffer; readonly contentType: string } | undefined> {
    return RecipeRepository.findImage(recipeId);
  },

  /**
   * Which ingredients the library cooks each of these meals from, for this
   * person — the first of the three things `0063`'s second cut keeps. Only
   * lunch and dinner are cut, so only they are read; a request for neither
   * reads nothing.
   *
   * Every recipe is narrowed with `fitSlots` for this person before it counts
   * (`MealFit.libraryUsage`), never taken at its stored meals.
   */
  async libraryUsage(slots: readonly MealSlot[], context: GenerationContext): Promise<LibraryUsage> {
    const cut = slots.filter(slot => SECOND_CUT_SLOTS.has(slot));

    if (cut.length === 0) {
      return new Map();
    }

    const recipes = await RecipeRepository.findLibraryUsage(cut);

    return libraryUsage(recipes, cut, context.catalogue, context.dietaryPatterns);
  },

  /**
   * Every food the catalogue knows, by name, in one language — what a rewritten
   * method is read against, so that it names no food its dish does not contain.
   */
  async methodVocabulary(locale: string): Promise<readonly string[]> {
    const catalogue = await RecipeRepository.loadCatalogue(locale);

    return catalogue.map(ingredient => ingredient.name);
  },

  /**
   * The context of nobody: a random id that names no account, so no profile,
   * no allergy and no consent — reference data only. For
   * `apps/api/scripts/evaluate-plans.mjs`, which lays synthetic profiles over
   * it and never writes. Never call it with a person in mind.
   */
  async nobodysContext(): Promise<GenerationContext> {
    return buildContext(randomUUID());
  },

  /** What the illustrator still has to draw. Bounded, oldest first. */
  async pendingIllustrations(
    limit: number
  ): Promise<readonly { readonly id: string; readonly ingredientNames: readonly string[]; readonly locale: string; readonly name: string }[]> {
    return RecipeRepository.findWithoutImage(limit);
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
          !mentionsUnresolvedAllergy(recipe, context.safety.unenforceableLabels) &&
          withinTime(recipe, context.preferences.maxMinutesPerDish)
      )
      // Served only at the meals every ingredient belongs to, for this person
      // (`0062` § 5): a lentil stew stays a lunch and stops being a dinner, and
      // one that belongs nowhere leaves the pool. Before the rotation, so the
      // dozen it picks per slot is counted from what can actually be served
      // there — a dish counted at dinner and then never placed there is one
      // fewer dinner nobody noticed was missing.
      .map(toCandidateDish)
      .map(dish => ({ ...dish, slots: fitSlots(dish, context.catalogue, context.dietaryPatterns) }))
      .filter(dish => dish.slots.length > 0);

    // Without a rotation every user is handed the whole safe library in the same
    // order, and the deterministic scheduler then hands them the same plan. With
    // one, each user gets their own dozen per slot, minus last fortnight's.
    return rotation ? rotatePool(usable, slots, rotation) : usable;
  },

  async rewriteSteps(recipeId: string, steps: readonly RecipeStep[], stepsVersion: string): Promise<void> {
    await RecipeRepository.updateSteps(recipeId, steps, stepsVersion);
  },

  /** `instructions` alone, nothing else about the recipe. See `RecipeRepository.setInstructionsOnly`. */
  async setCleanedSteps(recipeId: string, steps: readonly RecipeStep[]): Promise<void> {
    await RecipeRepository.setInstructionsOnly(recipeId, steps);
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
