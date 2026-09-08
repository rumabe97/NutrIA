import { Injectable, Logger } from '@nestjs/common';

import { buildShoppingList, unresolvedSlugs } from 'core/domain/ShoppingList';
import { dishSafety } from 'core/domain/Safety';
import { PLAN_DAYS, schedulePlan, slotsFor } from 'core/domain/Scheduler';
import { isBlocking, validatePlan } from 'core/domain/PlanValidation';
import { OnboardingController } from 'core/controllers/Onboarding';
import { PlanController, PlanJobController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';

import { PoolBuilder } from '../ai/PoolBuilder.service.js';
import { PROMPT_VERSION } from '../ai/PoolPrompt.js';

import type { CandidateDish, PlanAssignment } from 'core/entities/Plan';
import type { NutritionTargets } from 'core/entities/Nutrition';
import type { PlanViolation } from 'core/domain/PlanValidation';
import type { GenerationContext } from 'core/controllers/Recipe';
import type { Rotation } from 'core/domain/Variety';
import type { PlanDraft, RecipeDraft } from 'core/entities/Plan';

/**
 * Stage **codes**, not labels. Each is written to the job before the stage runs,
 * so the progress screen can never show a step the pipeline did not reach (PRD
 * criterion 8).
 *
 * Codes rather than sentences for the same reason failures are codes: the API
 * writes them once, in no language, and the client turns them into whichever one
 * the reader has. They used to be Spanish, which put a Spanish line in the
 * middle of an otherwise English screen.
 */
export const STEPS = {
  building: 'BUILDING_LIST',
  choosing: 'CHOOSING_RECIPES',
  loading: 'LOADING_PROFILE',
  saving: 'SAVING_PLAN',
  scheduling: 'SCHEDULING_MEALS',
  validating: 'VALIDATING_PLAN'
} as const;

/** Stable failure codes. The client maps these to copy; none is a raw error. */
export type GenerationFailure =
  | 'GENERATION_AI_UNAVAILABLE'
  | 'GENERATION_INVALID_PLAN'
  | 'GENERATION_ONBOARDING_INCOMPLETE'
  | 'GENERATION_POOL_TOO_SMALL'
  | 'GENERATION_PROFILE_INCOMPLETE'
  | 'GENERATION_UNSAFE_CONTENT';

export class GenerationError extends Error {
  constructor(public readonly code: GenerationFailure, detail?: string) {
    super(detail ?? code);
    this.name = 'GenerationError';
  }
}

@Injectable()
export class PlanGenerationService {
  private readonly logger = new Logger(PlanGenerationService.name);

  constructor(private readonly pool: PoolBuilder) {}

  /**
   * Runs the whole pipeline and returns the new plan's id.
   *
   * Nothing is written until the final stage: every earlier stage is pure
   * computation over data loaded up front, so a failure at any point leaves the
   * database exactly as it was, including the user's previous plan.
   */
  async generate(userId: string, jobId: string, markStep: (step: string) => Promise<void>): Promise<string> {
    await markStep(STEPS.loading);

    const [onboarding, profile, context, history] = await Promise.all([
      OnboardingController.getState(userId),
      ProfileController.getFullProfile(userId),
      RecipeController.generationContext(userId),
      PlanController.generationHistory(userId)
    ]);

    if (!onboarding.isComplete) {throw new GenerationError('GENERATION_ONBOARDING_INCOMPLETE');}

    this.reportUntranslatedIngredients(context);

    const targets = this.targetsFor(profile);
    const mealsPerDay = profile.preferences?.mealsPerDay ?? 4;
    const includesSnacks = profile.preferences?.includesSnacks ?? true;
    const slots = slotsFor(mealsPerDay, includesSnacks);

    await markStep(STEPS.choosing);

    // The seed is the user and the plan version: the library pick is theirs, it is
    // reproducible for a failed generation, and next fortnight's is a different one.
    // What they were served last time is excluded from reuse and named to the model.
    const rotation: Rotation = { avoidSlugs: new Set(history.recentDishes.map(dish => dish.slug)), seed: `${userId}:${history.nextVersion}` };
    const reusable = await RecipeController.reusablePool(slots, context, rotation);
    const built = await this.pool.build({
      context,
      preferences: {
        avoidNames: history.recentDishes.map(dish => dish.name),
        breakfastStyle: profile.preferences?.breakfastStyle ?? null,
        budget: profile.preferences?.budget ?? null,
        cookingFrequency: profile.preferences?.cookingFrequency ?? null,
        cookingTimeMinutes: profile.preferences?.cookingTimeMinutes ?? null,
        cuisines: profile.cuisines,
        dietaryPatterns: profile.dietaryPatterns,
        dislikedLabels: profile.foodPreferences.filter(item => item.sentiment === 'disliked').map(item => item.label),
        likedLabels: profile.foodPreferences.filter(item => item.sentiment === 'liked').map(item => item.label),
        portionPreference: profile.preferences?.portionPreference ?? null,
        scheduleNotes: profile.preferences?.workScheduleNotes ?? null,
        targets
      },
      reusable,
      slots
    });

    await markStep(STEPS.scheduling);

    let scheduled = schedulePlan({ catalogue: context.catalogue, includesSnacks, mealsPerDay, pool: built.dishes, targets });
    let fallback: 'full_library' | null = null;

    if (!scheduled.ok) {
      this.logger.warn(
        `Pool too small for ${scheduled.shortfall.slot} on day ${scheduled.shortfall.dayIndex} ` +
          `(reused ${built.metadata.reused}, generated ${built.generated.length}, rejected ${built.metadata.rejected}, ` +
          `provider ${built.metadata.providerUsed ? built.metadata.model : 'none'})`
      );

      // The rotation held back last fortnight's dishes and capped the rest — a
      // variety preference, backed by the model filling the gap. With the model
      // gone (quota, key, outage) that preference is the only thing between this
      // person and no plan at all, and a repeated dish is strictly better than
      // that. So: the whole safe library, nothing held back, no second model call
      // — the one that failed is not asked again — and the plan says it happened.
      // Returning users were the ones this hit: a new user has no history to
      // exclude, and a full library needs no model.
      const everything = await RecipeController.reusablePool(slots, context);
      const widened = new Map([...everything, ...built.generated].map(dish => [dish.slug, dish]));

      this.logger.warn(`Retrying with the full library (${widened.size} dishes, last fortnight included)`);
      scheduled = schedulePlan({ catalogue: context.catalogue, includesSnacks, mealsPerDay, pool: [...widened.values()], targets });
      fallback = 'full_library';
    }

    if (!scheduled.ok) {
      // A configured provider that failed is a different problem from no provider,
      // and telling someone to "configure AI_PROVIDER" when they already have is
      // the worst possible answer. Distinguish them.
      if (built.metadata.providerError) {throw new GenerationError('GENERATION_AI_UNAVAILABLE', built.metadata.providerError);}

      throw new GenerationError('GENERATION_POOL_TOO_SMALL', scheduled.shortfall.slot);
    }

    await markStep(STEPS.validating);

    const violations = validatePlan({
      assignment: scheduled.assignment,
      expectedDays: PLAN_DAYS,
      expectedSlots: slots,
      sex: profile.profile?.sex ?? 'prefer_not_to_say',
      targets,
      // Present by construction: targets resolve to null without a starting weight.
      weightKg: profile.goal?.startingWeightKg ?? 0
    });

    const blocking = violations.filter(isBlocking);
    const advisories = violations.filter(violation => !isBlocking(violation));

    if (blocking.length > 0) {
      const summary = summarise(blocking);

      this.logger.warn(`Plan rejected by validation: ${summary}`);
      throw new GenerationError('GENERATION_INVALID_PLAN', summary);
    }

    const advisorySummary = advisories.map(describe);

    if (advisories.length > 0) {
      // Delivered, not discarded. The targets are an estimate — the profile screen
      // says so — and a plan that misses one on two days out of fourteen serves the
      // person better than the nothing they get if it is thrown away. Recorded on
      // the plan so an operator can still see which days drifted and by how much.
      this.logger.log(`Plan delivered with advisories: ${summarise(advisories)}`);
    }

    // The gate runs again over the *assembled* plan, immediately before anything is
    // written. Phase 3 validated candidates; this validates what is actually about
    // to be stored. The duplication is deliberate — see PRD criterion 3.
    this.assertPlanIsSafe(scheduled.assignment, context);

    await markStep(STEPS.building);

    const missing = unresolvedSlugs(scheduled.assignment, context.catalogue);

    if (missing.length > 0) {throw new GenerationError('GENERATION_INVALID_PLAN', `unresolved ingredients: ${missing.join(', ')}`);}

    const shopping = buildShoppingList(scheduled.assignment, context.catalogue, context.locale);

    await markStep(STEPS.saving);

    return PlanJobController.persist(userId, this.toDraft(scheduled.assignment, shopping, built, targets, context, jobId, rotation, advisorySummary, fallback));
  }

  /**
   * Logs catalogue entries that had no name in the user's language.
   *
   * The fallback is shown — an English user seeing "Calabacín" is better than
   * seeing nothing — but it is a gap in the catalogue, not a feature, and it is
   * invisible to everyone except the person reading a shopping list in the wrong
   * language. Logged at warn with a count and a sample rather than the whole
   * list, because 200 slugs in a log line is a line nobody reads.
   */
  private reportUntranslatedIngredients(context: GenerationContext): void {
    const missing = [...context.catalogue.values()].filter(ingredient => ingredient.nameLocale !== context.locale);

    if (missing.length === 0) {return;}

    this.logger.warn(
      `${missing.length} ingredient(s) have no ${context.locale} name and fell back to ${missing[0]?.nameLocale ?? 'es-ES'}: ` +
        `${missing.slice(0, 10).map(ingredient => ingredient.slug).join(', ')}${missing.length > 10 ? '…' : ''}`
    );
  }

  /**
   * The targets in effect — the user's own if they set them, the computed ones
   * otherwise.
   *
   * Read from `getFullProfile` rather than recomputed. This used to call
   * `nutritionTargets` itself, which meant the number generation planned against
   * and the number the profile screen showed were produced by two call sites
   * that only happened to agree. An override would have reached one and not the
   * other.
   */
  private targetsFor(profile: Awaited<ReturnType<typeof ProfileController.getFullProfile>>): NutritionTargets {
    if (!profile.targets) {throw new GenerationError('GENERATION_PROFILE_INCOMPLETE');}

    return profile.targets.effective;
  }

  private assertPlanIsSafe(assignment: PlanAssignment, context: GenerationContext): void {
    for (const day of assignment.days) {
      for (const meal of day.meals) {
        const safety = dishSafety(meal.ingredients, context.catalogue, context.safety);

        if (safety.kind === 'safe') {continue;}

        // Reaching here means an upstream check let something through. Logged at
        // error level regardless of how the request is answered.
        this.logger.error(`Assembled plan rejected on day ${day.dayIndex} (${meal.slot}): ${safety.kind}`);
        throw new GenerationError('GENERATION_UNSAFE_CONTENT');
      }
    }
  }

  private toDraft(
    assignment: PlanAssignment,
    shopping: ReturnType<typeof buildShoppingList>,
    built: Awaited<ReturnType<PoolBuilder['build']>>,
    targets: NutritionTargets,
    context: GenerationContext,
    jobId: string,
    rotation: Rotation,
    advisories: readonly string[],
    fallback: 'full_library' | null
  ): PlanDraft {
    const start = new Date();
    const end = new Date(start);

    end.setUTCDate(end.getUTCDate() + PLAN_DAYS - 1);

    const used = new Set(assignment.days.flatMap(day => day.meals.map(meal => meal.dish.slug)));

    return {
      days: assignment.days.map(day => ({
        date: isoDate(addDays(start, day.dayIndex - 1)),
        dayIndex: day.dayIndex,
        meals: day.meals.map(meal => ({
          carbsG: meal.macros.carbsG,
          fatG: meal.macros.fatG,
          fiberG: meal.macros.fiberG,
          kcal: meal.macros.kcal,
          proteinG: meal.macros.proteinG,
          recipeSlug: meal.dish.slug,
          servings: meal.servings,
          slot: meal.slot,
          sortOrder: meal.sortOrder
        }))
      })),
      endDate: isoDate(end),
      // The seed and the number of dishes held back say *why* this plan differs from
      // the last one, which is the first thing anyone asks when two plans look alike.
      generationMetadata: { ...built.metadata, advisories, avoidedDishes: rotation.avoidSlugs.size, fallback, jobId, locale: context.locale, poolSeed: rotation.seed, scheduledAt: start.toISOString() },
      // Only dishes the plan actually uses are persisted — a generated dish the
      // scheduler never placed is not worth a row.
      locale: context.locale,
      newRecipes: built.generated.filter(dish => used.has(dish.slug)).map(dish => this.toRecipeDraft(dish, context)),
      shoppingItems: shopping.items.map(item => ({
        category: item.category,
        displayQuantity: item.displayQuantity,
        displayUnit: item.displayUnit,
        ingredientId: item.ingredientId,
        name: item.name,
        totalGrams: item.totalGrams
      })),
      startDate: isoDate(start),
      strategy: { carbsG: targets.carbsG, fatG: targets.fatG, fiberG: targets.fiberG, kcal: targets.kcal, proteinG: targets.proteinG }
    };
  }

  private toRecipeDraft(dish: CandidateDish, context: GenerationContext): RecipeDraft {
    return {
      cookMinutes: dish.cookMinutes,
      cuisine: dish.cuisine ?? null,
      difficulty: dish.difficulty,
      ingredients: dish.ingredients.map(item => ({
        grams: item.grams,
        // Safe: the plan passed `unresolvedSlugs` before reaching here.
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
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);

  next.setUTCDate(next.getUTCDate() + days);

  return next;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * One line per rule: which fired, how many days it touched, and the worst miss —
 * enough to tell "the pool was carb-heavy" from "a day came out short" without
 * reading a log.
 */
function summarise(violations: readonly PlanViolation[]): string {
  const byKind = new Map<string, { count: number; worst: string }>();

  for (const violation of violations) {
    const existing = byKind.get(violation.kind) ?? { count: 0, worst: '' };

    byKind.set(violation.kind, { count: existing.count + 1, worst: existing.worst || detailOf(violation) });
  }

  return [...byKind.entries()].map(([kind, { count, worst }]) => `${kind} (${count} días${worst ? `, p. ej. ${worst}` : ''})`).join('; ');
}

/** One advisory, per day, for the plan's own record. */
function describe(violation: PlanViolation): string {
  const detail = detailOf(violation);

  return `${violation.kind}${'dayIndex' in violation ? ` día ${violation.dayIndex}` : ''}${detail ? `: ${detail}` : ''}`;
}

function detailOf(violation: PlanViolation): string {
  if ('actual' in violation && 'target' in violation) {return `${Math.round(violation.actual)} frente a ${Math.round(violation.target)}`;}

  if ('actual' in violation && 'ceiling' in violation) {return `${Math.round(violation.actual)} sobre un techo de ${Math.round(violation.ceiling)}`;}

  if ('actual' in violation && 'minimum' in violation) {return `${Math.round(violation.actual)} bajo un mínimo de ${Math.round(violation.minimum)}`;}

  return '';
}

