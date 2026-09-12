import { Injectable, Logger } from '@nestjs/common';

import { normaliseForMatching } from 'core/domain/Safety';
import { buildShoppingList, unresolvedSlugs } from 'core/domain/ShoppingList';
import { dishSafety } from 'core/domain/Safety';
import { PLAN_DAYS, schedulePlan } from 'core/domain/Scheduler';
import { DEFAULT_MEAL_SHAPE, slotsIn, weightsFor } from 'core/domain/MealShape';
import { isBlocking, validatePlan } from 'core/domain/PlanValidation';
import { eventOn, loadedTargets } from 'core/domain/Event';
import { targetViolations } from 'core/domain/Nutrition';
import { CheckInController } from 'core/controllers/CheckIn';
import { EventController } from 'core/controllers/Event';
import { OnboardingController } from 'core/controllers/Onboarding';
import { PlanController, PlanJobController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';

import { PoolBuilder } from '../../ai/services/PoolBuilder.service.js';
import { promptPreferences, toRecipeDraft } from './GenerationShared.js';

import type { AiCallRecord, CandidateDish, PlanAssignment } from 'core/entities/Plan';
import type { NutritionTargets } from 'core/entities/Nutrition';
import type { TargetBounds } from 'core/domain/Nutrition';
import type { PlanViolation } from 'core/domain/PlanValidation';
import type { GenerationContext } from 'core/controllers/Recipe';
import { rotatePool } from 'core/domain/Variety';
import type { Rotation } from 'core/domain/Variety';
import type { PlanDraft } from 'core/entities/Plan';

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
  constructor(
    public readonly code: GenerationFailure,
    detail?: string
  ) {
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
  async generate(
    userId: string,
    jobId: string,
    markStep: (step: string) => Promise<void>,
    // Where the model calls are kept, as soon as the pool is built: a job that
    // fails after that point still has them (`0050`).
    recordCalls: (calls: readonly AiCallRecord[]) => Promise<void> = () => Promise.resolve()
  ): Promise<string> {
    await markStep(STEPS.loading);

    const [onboarding, profile, context, history, verdicts, checkIn] = await Promise.all([
      OnboardingController.getState(userId),
      ProfileController.getFullProfile(userId),
      RecipeController.generationContext(userId),
      PlanController.generationHistory(userId),
      RecipeController.verdicts(userId),
      CheckInController.latestForGeneration(userId)
    ]);

    if (!onboarding.isComplete) {
      throw new GenerationError('GENERATION_ONBOARDING_INCOMPLETE');
    }

    this.reportUntranslatedIngredients(context);

    const targets = this.targetsFor(profile);
    // Which meals they eat and how big each is (`0036`). The default is the
    // ordinary three plus an afternoon snack, which is what the column carries
    // for a profile that has not answered.
    const shape = profile.preferences?.mealShape ?? DEFAULT_MEAL_SHAPE;
    const weights = weightsFor(shape);
    const slots = slotsIn(shape);

    // Laid out from today, one day after another, which is what a fortnight is
    // — and what lets an event's date become a day index before scheduling.
    const start = new Date();
    const loads = await this.loadsFor(userId, targets, profile.targets?.bounds ?? null, start);

    await markStep(STEPS.choosing);

    // The seed is the user and the plan version: the library pick is theirs, it is
    // reproducible for a failed generation, and next fortnight's is a different one.
    // What they were served last time is excluded from reuse and named to the model.
    // A disliked dish is excluded like last fortnight's, for good; a liked one goes to
    // the front of the library pick. Both are also named to the model (0014).
    const rotation: Rotation = {
      avoidSlugs: new Set([...history.recentDishes.map(dish => dish.slug), ...verdicts.disliked.map(dish => dish.slug)]),
      // Their kitchens and their foods lean the library pick without narrowing
      // it (0026): a dish of a chosen cuisine, or using something they said they
      // like, is offered first and the rest still follow.
      preferCuisines: new Set(profile.cuisines.map(cuisine => normaliseForMatching(cuisine))),
      preferIngredientSlugs: context.preferences.preferredIngredientSlugs,
      preferSlugs: new Set(verdicts.liked.map(dish => dish.slug)),
      seed: `${userId}:${history.nextVersion}`
    };
    const [reusable, everything] = await Promise.all([
      RecipeController.reusablePool(slots, context, rotation),
      RecipeController.reusablePool(slots, context)
    ]);
    // What rotation held back for freshness, minus last fortnight's and the
    // dislikes: the builder covers a short first round from here rather than
    // asking the model again.
    const inPool = new Set(reusable.map(dish => dish.slug));
    const backfill = everything.filter(dish => !inPool.has(dish.slug) && !rotation.avoidSlugs.has(dish.slug));
    const built = await this.pool.build({
      backfill,
      context,
      preferences: {
        ...promptPreferences(
          profile,
          verdicts,
          history.recentDishes.map(dish => dish.name),
          targets,
          checkIn,
          null,
          context.preferences.unenforceableLabels
        ),
        // The days that eat for an event draw from this same pool; the model is
        // asked for some dishes at their split, or they have nothing built for
        // them (`0047`). Distinct targets, since several days share one load.
        loadedTargets: [...new Map([...loads.dayTargets.values()].map(load => [JSON.stringify(load), load])).values()]
      },
      reusable,
      // The job id, so a gateway's own log files this generation's calls together.
      session: jobId,
      slots
    });

    await recordCalls(built.metadata.aiCalls);

    await markStep(STEPS.scheduling);

    // Last fortnight's dishes come back in a rescue — a repeat beats no plan.
    // A dish the person said they do not want does not (`0014`: excluded for
    // good). It used to: this read the library with no rotation at all, so the
    // one path meant to spare somebody an empty fortnight could serve them the
    // thing they had turned down. Taking the dislikes out leaves a library of
    // well over a hundred dishes, and if that still cannot fill a fortnight the
    // honest answer is the error below, not a plate they refused. No extra
    // model call either: this runs mostly when the model has just failed, and
    // it has already been asked for exactly the shortfall (`0046`).
    const disliked = new Set(verdicts.disliked.map(dish => dish.slug));

    const wholeLibrary = async (): Promise<CandidateDish[]> => {
      const everything = await RecipeController.reusablePool(slots, context);

      return [...new Map([...everything, ...built.generated].map(dish => [dish.slug, dish])).values()].filter(dish => !disliked.has(dish.slug));
    };

    let scheduled = schedulePlan({ catalogue: context.catalogue, dayTargets: loads.dayTargets, pool: built.dishes, targets, weights });
    let fallback: Fallback = null;

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
      const widened = await wholeLibrary();

      this.logger.warn(`Retrying with the full library (${widened.length} dishes, last fortnight included)`);
      scheduled = schedulePlan({ catalogue: context.catalogue, dayTargets: loads.dayTargets, pool: widened, targets, weights });
      fallback = 'full_library';
    }

    if (!scheduled.ok) {
      // A configured provider that failed is a different problem from no provider,
      // and telling someone to "configure AI_PROVIDER" when they already have is
      // the worst possible answer. Distinguish them.
      if (built.metadata.providerError) {
        throw new GenerationError('GENERATION_AI_UNAVAILABLE', built.metadata.providerError);
      }

      throw new GenerationError('GENERATION_POOL_TOO_SMALL', scheduled.shortfall.slot);
    }

    await markStep(STEPS.validating);

    const check = (assignment: PlanAssignment) =>
      validatePlan({
        assignment,
        // A loaded day is judged against what it was built to (`0043`), or every
        // plan with an event in it would record its own load as drift.
        dayTargets: loads.dayTargets,
        expectedDays: PLAN_DAYS,
        expectedSlots: slots,
        sex: profile.profile?.sex ?? 'prefer_not_to_say',
        targets,
        // Present by construction: targets resolve to null without a starting weight.
        weightKg: profile.goal?.startingWeightKg ?? 0
      });

    let violations = check(scheduled.assignment);

    /*
     * A plan the gate refuses is not a plan — but refusing it and *giving up* is
     * a different decision, and it was being made by accident. The escape hatch
     * below existed only for a pool too short to fill; a pool that filled but
     * came out unbalanced went straight to a failed generation, which is how a
     * person ends up with nothing and an error code.
     *
     * More dishes is exactly what an unbalanced day needs, and the whole library
     * costs no call, no tokens and no quota. So: try once more before failing,
     * and only take the result if the gate accepts it.
     */
    if (violations.some(isBlocking) && fallback === null) {
      this.logger.warn(`Plan rejected by validation (${summarise(violations.filter(isBlocking))}); retrying with the full library`);

      const retried = schedulePlan({ catalogue: context.catalogue, dayTargets: loads.dayTargets, pool: await wholeLibrary(), targets, weights });

      if (retried.ok) {
        const retriedViolations = check(retried.assignment);

        if (!retriedViolations.some(isBlocking)) {
          scheduled = retried;
          violations = retriedViolations;
          fallback = 'full_library';
        }
      }
    }

    /*
     * A plan inside every bound can still miss its macros, and it did: the
     * rotation hands the scheduler about a dozen library dishes per slot — held
     * short on purpose, so the model writes the fresh third (`0013`) — and the
     * scheduler builds the days in order. The dishes that carry the carbohydrate
     * reach their two uses a plan in the first week, and days ten to fourteen
     * are built from what is left: 20–50% off on fat, measured on a real plan.
     *
     * The same rotation without the cap fixes it — every day inside 5% on all
     * four macros, on the same user's library, same seed, same exclusions. So
     * when a plan misses a band, it is scheduled once more from what it already
     * had plus the rest of this user's rotation, and whichever plan misses by
     * less is kept (`0046`). What the rotation protects is kept too: this
     * user's shuffled order, nothing from last fortnight, nothing they said
     * they dislike. The fresh dishes the model wrote stay first in the pool.
     * No second model call — the library costs nothing to read.
     */
    if (fallback === null && bandMiss(violations) > 0) {
      const rest = rotatePool(everything, slots, rotation, Number.POSITIVE_INFINITY);
      const wider = [...new Map([...built.dishes, ...rest].map(dish => [dish.slug, dish])).values()];
      const retried = schedulePlan({ catalogue: context.catalogue, dayTargets: loads.dayTargets, pool: wider, targets, weights });

      if (retried.ok) {
        const retriedViolations = check(retried.assignment);

        if (!retriedViolations.some(isBlocking) && bandMiss(retriedViolations) < bandMiss(violations)) {
          this.logger.log(`Macros missed with the rotated pool; the uncapped rotation (${wider.length} dishes) missed by less`);
          scheduled = retried;
          violations = retriedViolations;
          fallback = 'wider_rotation';
        }
      }
    }

    const blocking = violations.filter(isBlocking);
    const advisories = violations.filter(violation => !isBlocking(violation));

    if (blocking.length > 0) {
      const summary = summarise(blocking);

      this.logger.warn(`Plan rejected by validation: ${summary}`);
      throw new GenerationError('GENERATION_INVALID_PLAN', summary);
    }

    const advisorySummary = [...advisories.map(describe), ...loads.refused];

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

    if (missing.length > 0) {
      throw new GenerationError('GENERATION_INVALID_PLAN', `unresolved ingredients: ${missing.join(', ')}`);
    }

    const shopping = buildShoppingList(scheduled.assignment, context.catalogue, context.locale);

    await markStep(STEPS.saving);

    return PlanJobController.persist(
      userId,
      this.toDraft(scheduled.assignment, shopping, built, targets, context, jobId, rotation, advisorySummary, fallback, start, loads)
    );
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

    if (missing.length === 0) {
      return;
    }

    this.logger.warn(
      `${missing.length} ingredient(s) have no ${context.locale} name and fell back to ${missing[0]?.nameLocale ?? 'es-ES'}: ` +
        `${missing
          .slice(0, 10)
          .map(ingredient => ingredient.slug)
          .join(', ')}${missing.length > 10 ? '…' : ''}`
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
    if (!profile.targets) {
      throw new GenerationError('GENERATION_PROFILE_INCOMPLETE');
    }

    return profile.targets.effective;
  }

  /**
   * Which days of this fortnight eat for something, and what they eat (`0043`).
   *
   * Resolved by date: the plan runs from `start`, an event is a date, and the
   * days before it are dates. Each loaded day's targets come from
   * `core/domain/Event` and are then held to the same bounds the profile's own
   * targets are held to — a load the bounds refuse is not applied, the day is
   * built to the plan's targets like any other, and the refusal is recorded
   * with the plan's advisories so the person can be told rather than left to
   * wonder why Saturday looks ordinary. With no bounds to check against (a
   * profile that has none) nothing is loaded, because "we could not check" must
   * never quietly become "so we did it anyway".
   */
  private async loadsFor(userId: string, targets: NutritionTargets, bounds: TargetBounds | null, start: Date): Promise<Loads> {
    const dayTargets = new Map<number, NutritionTargets>();
    const loadedFor = new Map<number, string>();
    const refused: string[] = [];
    const events = await EventController.list(userId, isoDate(start));

    if (events.length === 0 || !bounds) {
      return { dayTargets, loadedFor, refused };
    }

    for (let dayIndex = 1; dayIndex <= PLAN_DAYS; dayIndex += 1) {
      const event = eventOn(isoDate(addDays(start, dayIndex - 1)), events);

      if (!event) {
        continue;
      }

      const loaded = loadedTargets(targets, event);
      const violations = targetViolations(loaded, bounds);

      if (violations.length > 0) {
        // Spanish like the advisories beside it: this reaches the person, not only the log.
        refused.push(`día ${dayIndex}: la carga para «${event.name}» no se aplicó (${violations.map(violation => violation.kind).join(', ')})`);
        continue;
      }

      dayTargets.set(dayIndex, loaded);
      loadedFor.set(dayIndex, event.name);
    }

    return { dayTargets, loadedFor, refused };
  }

  private assertPlanIsSafe(assignment: PlanAssignment, context: GenerationContext): void {
    for (const day of assignment.days) {
      for (const meal of day.meals) {
        const safety = dishSafety(meal.ingredients, context.catalogue, context.safety);

        if (safety.kind === 'safe') {
          continue;
        }

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
    fallback: Fallback,
    start: Date,
    loads: Loads
  ): PlanDraft {
    const end = new Date(start);

    end.setUTCDate(end.getUTCDate() + PLAN_DAYS - 1);

    const used = new Set(assignment.days.flatMap(day => day.meals.map(meal => meal.dish.slug)));

    return {
      days: assignment.days.map(day => ({
        date: isoDate(addDays(start, day.dayIndex - 1)),
        dayIndex: day.dayIndex,
        // Stamped on the day, not looked up later: the event may be deleted and
        // this plan is history (`0021`, `0043`).
        loadedFor: loads.loadedFor.get(day.dayIndex) ?? null,
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
        })),
        targets: loads.dayTargets.get(day.dayIndex) ?? {
          carbsG: targets.carbsG,
          fatG: targets.fatG,
          fiberG: targets.fiberG,
          kcal: targets.kcal,
          proteinG: targets.proteinG
        }
      })),
      endDate: isoDate(end),
      // The seed and the number of dishes held back say *why* this plan differs from
      // the last one, which is the first thing anyone asks when two plans look alike.
      generationMetadata: {
        ...built.metadata,
        advisories,
        avoidedDishes: rotation.avoidSlugs.size,
        fallback,
        jobId,
        locale: context.locale,
        poolSeed: rotation.seed,
        scheduledAt: start.toISOString()
      },
      // Only dishes the plan actually uses are persisted — a generated dish the
      // scheduler never placed is not worth a row.
      locale: context.locale,
      newRecipes: built.generated.filter(dish => used.has(dish.slug)).map(dish => toRecipeDraft(dish, context)),
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
}

/**
 * How the plan came to be scheduled from something other than its first pool.
 * `full_library` is the rescue from no plan at all; `wider_rotation` is the
 * rescue from a plan that missed its macros (`0046`).
 */
type Fallback = 'full_library' | 'wider_rotation' | null;

const BAND_KINDS = new Set<PlanViolation['kind']>([
  'carbs_out_of_band',
  'fat_out_of_band',
  'kcal_out_of_band',
  'protein_above_target',
  'protein_below_target'
]);

/**
 * How far a plan's days fall outside their macro bands, summed: zero when every
 * day of every macro is inside. A count would call a plan with one day at 30%
 * better than one with two days at 6%, which is not what "misses by less"
 * means to someone reading their Tuesday.
 */
function bandMiss(violations: readonly PlanViolation[]): number {
  return violations.reduce((sum, violation) => {
    if (!BAND_KINDS.has(violation.kind) || !('target' in violation) || violation.target <= 0) {
      return sum;
    }

    return sum + Math.max(0, Math.abs(violation.actual - violation.target) / violation.target - violation.tolerance);
  }, 0);
}

/** The days that eat for something, by index, and what the bounds would not allow. */
type Loads = {
  readonly dayTargets: ReadonlyMap<number, NutritionTargets>;
  readonly loadedFor: ReadonlyMap<number, string>;
  readonly refused: readonly string[];
};

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
  if ('actual' in violation && 'target' in violation) {
    return `${Math.round(violation.actual)} frente a ${Math.round(violation.target)}`;
  }

  if ('actual' in violation && 'ceiling' in violation) {
    return `${Math.round(violation.actual)} sobre un techo de ${Math.round(violation.ceiling)}`;
  }

  if ('actual' in violation && 'minimum' in violation) {
    return `${Math.round(violation.actual)} bajo un mínimo de ${Math.round(violation.minimum)}`;
  }

  return '';
}
