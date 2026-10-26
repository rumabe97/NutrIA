import { Injectable, Logger } from '@nestjs/common';

import { OnboardingIncompleteError, ProfileConsentRequiredError } from 'core/entities/Error';
import { normaliseForMatching } from 'core/domain/Safety';
import { buildShoppingList, pantryPlates, seedFromPantry, unresolvedSlugs } from 'core/domain/ShoppingList';
import { dishSafety } from 'core/domain/Safety';
import { leaningSlugs } from 'core/domain/Preference';
import { PLAN_DAYS, schedulePlan } from 'core/domain/Scheduler';
import { daysFor } from 'core/entities/FixedMeal';
import { FixedMealController } from 'core/controllers/FixedMeal';
import { DEFAULT_MEAL_SHAPE, proteinWeightsFor, slotsIn, weightsFor } from 'core/domain/MealShape';
import { isBlocking, planBandMiss, planQuality, validatePlan } from 'core/domain/PlanValidation';
import { eventOn, loadedTargets } from 'core/domain/Event';
import { minimumDailyKcal, targetViolations } from 'core/domain/Nutrition';
import { CheckInController } from 'core/controllers/CheckIn';
import { EventController } from 'core/controllers/Event';
import { OnboardingController } from 'core/controllers/Onboarding';
import { PantryController } from 'core/controllers/Pantry';
import { PlanController, PlanJobController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';
import { SettingsController } from 'core/controllers/Settings';
import { accompanimentRows, larderFor } from 'core/domain/Accompaniment';

import { PoolBuilder } from '../../ai/services/PoolBuilder.service.js';
import { likedFoodNames, promptPreferences, toRecipeDraft } from './GenerationShared.js';
import { preferredAppliances } from 'core/domain/Preference';

import type { AiCallRecord, CandidateDish, MealSlot, PlanAssignment } from 'core/entities/Plan';
import type { FixedMeal } from 'core/entities/FixedMeal';
import type { PinnedMeal } from 'core/domain/Scheduler';
import type { NutritionTargets } from 'core/entities/Nutrition';
import type { TargetBounds } from 'core/domain/Nutrition';
import type { PlanQuality, PlanViolation } from 'core/domain/PlanValidation';
import type { GenerationContext } from 'core/controllers/Recipe';
import { FRESH_DISHES_PER_SLOT, narrowerShares, rotatePool, withApplianceShare } from 'core/domain/Variety';
import type { Rotation } from 'core/domain/Variety';
import type { PlanDraft } from 'core/entities/Plan';
import type { SeededShoppingRow, ShoppingRow } from 'core/domain/ShoppingList';

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
  | 'GENERATION_PROFILE_CONSENT_REQUIRED'
  | 'GENERATION_PROFILE_INCOMPLETE'
  | 'GENERATION_TIMED_OUT'
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

/**
 * Standing rules as the scheduler takes them: this plan's day index, then the
 * slot, then the dish fixed there (`0098`, `0101`).
 *
 * The expansion is the caller's on purpose — the scheduler is handed day
 * indexes and never learns what a weekday is. A weekly rule lands on two days
 * of a fortnight and on one of a plan a redo cut short, so `daysFor` counts
 * rather than assuming.
 *
 * **A day may hold several rules and a meal may hold one**, which is exactly
 * what the database allows (`fixed_meals_user_weekday_slot_unique`) and exactly
 * what the two-level map can express. The inner map is where the invariant is
 * structural: two rules for the same meal of the same day cannot both be here,
 * and if the constraint were ever lost this would keep the last one rather than
 * serve two dishes on one plate.
 */
function pinsFor(rules: readonly FixedMeal[], startDate: string): ReadonlyMap<number, ReadonlyMap<MealSlot, PinnedMeal>> {
  const pins = new Map<number, Map<MealSlot, PinnedMeal>>();

  for (const rule of rules) {
    for (const dayIndex of daysFor(rule.weekday, startDate, PLAN_DAYS)) {
      const day = pins.get(dayIndex) ?? new Map<MealSlot, PinnedMeal>();

      day.set(rule.slot, { slot: rule.slot, slug: rule.dishSlug });
      pins.set(dayIndex, day);
    }
  }

  return pins;
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
    recordCalls: (calls: readonly AiCallRecord[]) => Promise<void> = () => Promise.resolve(),
    // Aborted when the job's deadline passes; checked before anything is saved.
    deadline?: AbortSignal,
    // A professional's generation for their client (`0060`): saved as one, so it
    // never replaces a fortnight under way if review ended while it ran.
    byProfessional = false
  ): Promise<string> {
    await markStep(STEPS.loading);

    const [profile, context, history, verdicts, checkIn] = await Promise.all([
      ProfileController.getFullProfile(userId),
      RecipeController.generationContext(userId),
      PlanController.generationHistory(userId),
      RecipeController.verdicts(userId),
      CheckInController.latestForGeneration(userId)
    ]).catch((error: unknown) => {
      // `generationContext` is the door's own check (consent, a finished
      // profile); a refusal there is the same stable code as the ones below.
      if (error instanceof ProfileConsentRequiredError) {
        throw new GenerationError('GENERATION_PROFILE_CONSENT_REQUIRED');
      }

      if (error instanceof OnboardingIncompleteError) {
        throw new GenerationError('GENERATION_ONBOARDING_INCOMPLETE');
      }

      throw error;
    });
    // Read after the profile, never beside it: a withdrawal reopens these steps
    // and deletes the consent with the data, so a profile read after it
    // committed is always followed by a state that says so. Beside it, the two
    // could straddle the withdrawal and build a plan on an emptied profile.
    const onboarding = await OnboardingController.getState(userId);

    if (!onboarding.isComplete) {
      throw new GenerationError('GENERATION_ONBOARDING_INCOMPLETE');
    }

    // The second line behind `PlanJobController.start`: consent withdrawn
    // while the job waited is consent this plan no longer has.
    if (onboarding.profileConsentRequired) {
      throw new GenerationError('GENERATION_PROFILE_CONSENT_REQUIRED');
    }

    this.reportUntranslatedIngredients(context);

    const targets = this.targetsFor(profile);
    // Which meals they eat and how big each is (`0036`). The default is the
    // ordinary three plus an afternoon snack, which is what the column carries
    // for a profile that has not answered.
    const shape = profile.preferences?.mealShape ?? DEFAULT_MEAL_SHAPE;
    const weights = weightsFor(shape);
    const slots = slotsIn(shape);
    // A person building muscle has more of the day's protein at breakfast and between meals (019 phase 6, `0088`).
    const proteinWeights = proteinWeightsFor(profile.goal?.type, weights);

    // Laid out from its first day, one day after another, which is what a
    // fortnight is — and what lets an event's date become a day index before
    // scheduling. The first day is the one chosen with the job, or the person's
    // today (project 015); a later one makes the plan wait for it.
    const dates = await PlanJobController.dates(userId, jobId);
    const start = new Date(`${dates.start}T00:00:00Z`);
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
      // like or their way of eating leans towards (`0077`), is offered first and
      // the rest still follow.
      // What they would rather cook with leans it the same way and no further:
      // the preference half of `0102` is an order and never a filter.
      preferAppliances: new Set(preferredAppliances(context.preferences.kitchen)),
      preferCuisines: new Set(profile.cuisines.map(cuisine => normaliseForMatching(cuisine))),
      preferIngredientSlugs: leaningSlugs(context.preferences),
      preferSlugs: new Set(verdicts.liked.map(dish => dish.slug)),
      seed: `${userId}:${history.nextVersion}`
    };
    const [reusable, everything, libraryUsage] = await Promise.all([
      RecipeController.reusablePool(slots, context, rotation),
      RecipeController.reusablePool(slots, context),
      // What the library cooks lunch and dinner from, for this person: what
      // their requests keep of those meals' catalogues (`0063`).
      RecipeController.libraryUsage(slots, context)
    ]);
    // What rotation held back for freshness, minus last fortnight's and the
    // dislikes: the builder covers a short first round from here rather than
    // asking the model again.
    const inPool = new Set(reusable.map(dish => dish.slug));
    const backfill = everything.filter(dish => !inPool.has(dish.slug) && !rotation.avoidSlugs.has(dish.slug));
    const built = await this.pool.build({
      backfill,
      context,
      feature: 'plan',
      // 0013's fresh floor, applied regardless of how rich the rotation's own
      // cap (`REUSED_DISHES_PER_SLOT`, raised in `0065`) lets the library get:
      // a whole-plan build must never ask the model for fewer than seven
      // fresh dishes a slot, however well the library already covers it.
      freshFloorPerSlot: FRESH_DISHES_PER_SLOT,
      libraryUsage,
      preferences: {
        ...promptPreferences(
          profile,
          verdicts,
          history.recentDishes.map(dish => dish.name),
          targets,
          isoDate(start),
          checkIn,
          null,
          likedFoodNames(context)
        ),
        // The days that eat for an event draw from this same pool; the model is
        // asked for some dishes at their split, or they have nothing built for
        // them (`0047`). Distinct targets, since several days share one load.
        loadedTargets: [...new Map([...loads.dayTargets.values()].map(load => [JSON.stringify(load), load])).values()]
      },
      reusable,
      // The job id, so a gateway's own log files this generation's calls
      // together — and the seed of the sample a lunch and a dinner are shown
      // (`0063`), so this job's prompts can be rebuilt from it and the next
      // job's show other foods.
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

    // The floor validation blocks on, handed to the scheduler so that it never
    // sizes a day under it — the two read one function, or a target clamped to
    // the floor is scheduled and then thrown away (`FLOOR_OUTRANKS_ORDER`).
    const sex = profile.profile?.sex ?? 'prefer_not_to_say';
    const minimumKcal = minimumDailyKcal(sex);
    // What may go beside a big lunch or dinner (project 016), behind its flag:
    // this person's larder, filtered by the very context the dishes were —
    // their allergies, their way of eating, their dislikes, the free-from foods
    // only for whoever needs them — and the month each day falls in.
    // The month each day falls in: what fruit is in season on it, on the plate
    // (017 phase 2) and, with the flag, beside it.
    const monthOf = (dayIndex: number): number => addDays(start, dayIndex - 1).getUTCMonth() + 1;
    // The standing fixed meals, expanded into this plan's own day indexes
    // (`0098`: the scheduler never learns what a weekday is, so the caller
    // expands). One rule per weekday **and meal** is the database's promise
    // (`fixed_meals_user_weekday_slot_unique`, `0101`), and the two-level map is
    // where it has to hold: a day may carry several, and a second rule for the
    // same meal would silently replace the first.
    const pinned = pinsFor(await FixedMealController.forPlan(userId), dates.start);

    // **A pinned dish is a forced candidate, and the rotation must not be able
    // to hide it.** `honouredPin` draws from the pool it is given, so a dish
    // `rotatePool` held back — which it does to everything served last
    // fortnight — would have the scheduler refuse the rule for want of the
    // dish rather than for want of room: the rule silently does nothing, once a
    // fortnight, for ever. The evaluator always injected them (`0098`,
    // `withPins`); production did not, and an end-to-end run caught it serving
    // congrio on somebody's fixed Friday.
    const poolWithPins = async (pool: readonly CandidateDish[]): Promise<readonly CandidateDish[]> => {
      const wanted = new Set([...pinned.values()].flatMap(day => [...day.values()].map(pin => pin.slug)));
      const missing = [...wanted].filter(slug => !pool.some(dish => dish.slug === slug));

      if (missing.length === 0) {
        return pool;
      }

      const library = await RecipeController.reusablePool(slots, context);
      const restored = library.filter(dish => missing.includes(dish.slug));

      // **A rule the person's own filters now refuse cannot be restored**, and
      // `honouredPin` will then build the day as though it did not exist —
      // which is right (`0097`: a bound refuses a rule, and the pool is one of
      // the three) and was silent, for the season, a dish dropped from the
      // catalogue, a cooking time lowered under it, and now a kitchen that
      // says it has no oven (`0102`). Restoring it from the **unfiltered**
      // library instead is not an option: that library still holds the dishes
      // the allergy gate, a dislike and their way of eating removed, and a pin
      // is a forced candidate.
      //
      // So it is said here, where it is known, and the log is all this phase
      // adds: telling the *person* is the one mechanism the fixed-meal
      // service's own header is waiting for, and it is one sentence on a
      // screen for all five cases rather than a fifth special case.
      if (restored.length < missing.length) {
        const refused = missing.filter(slug => !restored.some(dish => dish.slug === slug));

        this.logger.warn(
          `${refused.length} fixed meal(s) cannot be honoured in this plan — ${refused.join(', ')} is not in this person's library today; the day is built as though the rule did not exist`
        );
      }

      return [...pool, ...restored];
    };

    const sides = (await SettingsController.accompaniments())
      ? { accompaniments: { larder: larderFor({ catalogue: context.catalogue, preferences: context.preferences, safety: context.safety }), monthOf } }
      : {};

    let scheduled = schedulePlan({
      pinned,
      proteinWeights,
      ...sides,
      catalogue: context.catalogue,
      dayTargets: loads.dayTargets,
      minimumKcal,
      monthOf,
      pool: await poolWithPins(built.dishes),
      targets,
      weights
    });
    let fallback: Fallback = null;
    /**
     * Which rung of the kitchen's share this plan ended on: `null` for the full
     * share, which is every plan that reached its bands with it and every plan
     * rescued from the whole library, and a number when the share had to give
     * way for the bands (`narrowerShares`).
     */
    let kitchenShare: number | null = null;

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
      scheduled = schedulePlan({
        pinned,
        proteinWeights,
        ...sides,
        catalogue: context.catalogue,
        dayTargets: loads.dayTargets,
        minimumKcal,
        monthOf,
        pool: await poolWithPins(widened),
        targets,
        weights
      });
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
        sex,
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

      const retried = schedulePlan({
        pinned,
        proteinWeights,
        ...sides,
        catalogue: context.catalogue,
        dayTargets: loads.dayTargets,
        minimumKcal,
        monthOf,
        pool: await poolWithPins(await wholeLibrary()),
        targets,
        weights
      });

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
     * A plan inside every bound can still miss its macros, and it did (`0046`):
     * the rotation caps what the scheduler sees per slot — `REUSED_DISHES_PER_SLOT`
     * library dishes plus the model's fixed fresh floor (`0013`, `0065`) — and the
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
    if (fallback === null && planBandMiss(violations) > 0) {
      /*
       * **The kitchen gives way before the rotation does** (`0102`
       * § *A rescued fortnight has no kitchen, and the share is what sends it
       * there*, 2026-10-18). A preferred appliance holds a share of every slot's
       * cap, and the dishes that share displaces may be the ones that were
       * reaching the macros: on the owner's own fortnight the share took the
       * rotation's pool from 14 days in band to 12, and the rescue below then
       * delivered 14 again **from the whole library, where a share is no longer
       * scarce — with none of his air fryer on any plate**. Asking for the
       * appliance returned fewer of its dishes than not asking for it.
       *
       * So before the pool becomes everything, the share walks down
       * `narrowerShares`: half of it, then none. The rotation is otherwise
       * untouched — the same seed, the same avoid list, the same food-group
       * reserves, the model's fresh dishes still first — because giving up an
       * appliance costs a person less than giving up all of that at once. The
       * first rung that reaches every band wins and nothing below it is tried;
       * a rung that does not miss by less is discarded, which is the same test
       * the rescue below applies, so this can never hand back a worse plan.
       */
      const fromBuilder = built.dishes.filter(dish => !inPool.has(dish.slug));

      for (const share of narrowerShares(rotation)) {
        const narrowed = RecipeController.rotateFor(everything, slots, context, withApplianceShare(rotation, share));
        const pool = [...new Map([...fromBuilder, ...narrowed].map(dish => [dish.slug, dish])).values()];
        const retried = schedulePlan({
          pinned,
          proteinWeights,
          ...sides,
          catalogue: context.catalogue,
          dayTargets: loads.dayTargets,
          minimumKcal,
          monthOf,
          // Awaited inside the loop on purpose: the rungs are tried in order, and the first that holds the bands stops it.
          pool: await poolWithPins(pool),
          targets,
          weights
        });

        if (!retried.ok) {
          continue;
        }

        const retriedViolations = check(retried.assignment);

        if (retriedViolations.some(isBlocking) || planBandMiss(retriedViolations) >= planBandMiss(violations)) {
          continue;
        }

        this.logger.log(`Macros missed with the kitchen's full share; ${share} dishes a slot missed by less`);
        scheduled = retried;
        violations = retriedViolations;
        kitchenShare = share;

        if (planBandMiss(violations) === 0) {
          break;
        }
      }
    }

    if (fallback === null && planBandMiss(violations) > 0) {
      const rest = rotatePool(everything, slots, rotation, Number.POSITIVE_INFINITY);
      const wider = [...new Map([...built.dishes, ...rest].map(dish => [dish.slug, dish])).values()];
      const retried = schedulePlan({
        pinned,
        proteinWeights,
        ...sides,
        catalogue: context.catalogue,
        dayTargets: loads.dayTargets,
        minimumKcal,
        monthOf,
        pool: await poolWithPins(wider),
        targets,
        weights
      });

      if (retried.ok) {
        const retriedViolations = check(retried.assignment);

        if (!retriedViolations.some(isBlocking) && planBandMiss(retriedViolations) < planBandMiss(violations)) {
          this.logger.log(`Macros missed with the rotated pool; the uncapped rotation (${wider.length} dishes) missed by less`);
          scheduled = retried;
          violations = retriedViolations;
          fallback = 'wider_rotation';
          // The share is a quota in a pool and this pool is the whole library:
          // whatever rung the loop above settled on, nothing is reserved here.
          kitchenShare = null;
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
    // The same judgement as counts, for the console to sum over a period (`0071`):
    // no target, no figure and no event's name — the sentences above carry those.
    const quality = planQuality({
      dayIndexes: scheduled.assignment.days.map(day => day.dayIndex),
      dayTargets: loads.dayTargets,
      fallback,
      loadsRefused: loads.refused.length,
      minimumKcal,
      targets,
      violations
    });

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

    const shopping = buildShoppingList(withDates(scheduled.assignment, start), context.catalogue, context.locale);
    // What is already in the house, read **here** and not with the profile at
    // the top: the cupboard shortens the shop and changes no pick (the owner,
    // 2026-10-23), so it is read after everything that chooses a dish has
    // finished choosing. Nothing it carries can reach `promptPreferences` from
    // this far down the function, which is what makes PRD 022 criterion 5 a
    // property of the shape of this code rather than a promise about it.
    //
    // Only `holdings` and a count come back — never anybody's word.
    const pantry = await PantryController.forGeneration(userId);
    const seeded = seedFromPantry(shopping, pantry.holdings);
    const plates = pantryPlates(scheduled.assignment, new Set(pantry.holdings.map(holding => holding.slug)));
    // A plan that waits for its day may cut the one under way (project 015):
    // that plan's list is rebuilt from the days it keeps, saved with the cut.
    const cutShoppingItems = dates.start > dates.today ? await this.cutListFor(userId, dates.start, context) : undefined;

    // Past its job's deadline this generation has already been reported as
    // failed; saving now would hand somebody a plan after telling them to retry.
    if (deadline?.aborted) {
      throw new GenerationError('GENERATION_TIMED_OUT');
    }

    await markStep(STEPS.saving);

    const planId = await PlanJobController.persist(
      userId,
      {
        ...this.toDraft(
          scheduled.assignment,
          seeded,
          built,
          targets,
          context,
          jobId,
          rotation,
          {
            advisories: advisorySummary,
            fallback,
            kitchenShare,
            pantry: pantryRecord(pantry, seeded.coveredRows, shopping.items.length, plates),
            quality
          },
          start,
          loads,
          dates.today,
          pinned
        ),
        ...(cutShoppingItems && { cutShoppingItems })
      },
      byProfessional
    );

    await this.spendPantry(userId, deadline);

    return planId;
  }

  /**
   * Empties the cupboard, now that the plan it was typed for exists.
   *
   * **On success and only on success.** A generation that threw never reaches
   * this line, and one whose deadline passed is skipped by the same check that
   * refuses to save past it: that job has already been reported as failed, and
   * somebody told to retry must find their cupboard where they left it. Which
   * is also why `PantryController.clear` is idempotent — a retry, or a
   * generation that found nothing there, is not a failure.
   *
   * **And it can never fail the generation.** The plan is committed by the time
   * this runs; a cupboard that did not empty is one stale draft the next
   * generation spends anyway, while a throw here would hand somebody
   * `GENERATION_FAILED` for a plan they already have. The warning carries the
   * reason and **never a label**: the repository deliberately keeps Zod's
   * message out of its own error precisely so a failure over these rows cannot
   * quote somebody's word, and this is not where one starts.
   */
  private async spendPantry(userId: string, deadline?: AbortSignal): Promise<void> {
    if (deadline?.aborted) {
      return;
    }

    await PantryController.clear(userId).catch((error: unknown) => {
      this.logger.warn(`The cupboard was not cleared after the plan was saved: ${error instanceof Error ? error.message : 'unknown'}`);
    });
  }

  /**
   * The list the plan under way keeps when this one cuts it (project 015):
   * built from the days it keeps, for its id — or none, when nothing is cut.
   *
   * Checked as a generation checks its own plan: `buildShoppingList` skips a
   * food the catalogue does not hold, and this catalogue is today's, which may
   * be narrower than the one the old plan was built from. A list missing a line
   * for food the person still cooks is worse than one still listing the days
   * that were cut, so then the list is left as it stands, and that is logged.
   */
  private async cutListFor(userId: string, start: string, context: GenerationContext): Promise<PlanDraft['cutShoppingItems']> {
    const cut = await PlanController.cutComposition(userId, start);

    if (!cut) {
      return undefined;
    }

    const kept = { days: byDay(cut.meals) };
    const missing = unresolvedSlugs(kept, context.catalogue);

    if (missing.length > 0) {
      this.logger.warn(`Plan ${cut.planId} cut short; its list is left as it stands: ${missing.length} of its foods are not in today's catalogue`);

      return undefined;
    }

    return { items: toShoppingItems(buildShoppingList(kept, context.catalogue, context.locale)), planId: cut.planId };
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
    shopping: { readonly items: readonly SeededShoppingRow[] },
    built: Awaited<ReturnType<PoolBuilder['build']>>,
    targets: NutritionTargets,
    context: GenerationContext,
    jobId: string,
    rotation: Rotation,
    {
      advisories,
      fallback,
      kitchenShare,
      pantry,
      quality
    }: {
      readonly advisories: readonly string[];
      readonly fallback: Fallback;
      readonly kitchenShare: number | null;
      readonly pantry: PantryRecord | null;
      readonly quality: PlanQuality;
    },
    start: Date,
    loads: Loads,
    today: string,
    pinned: ReadonlyMap<number, ReadonlyMap<MealSlot, PinnedMeal>>
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
          // What goes beside the plate, one row per food; the macros below are the whole meal's.
          ...(meal.accompaniments && { accompaniments: accompanimentRows(meal.accompaniments, context.catalogue) }),
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
        // The standing rules **as they were when this plan was built**. A plan
        // that is rebuilt later — a day reloaded for an event — honours these
        // and not the rules as they stand then, so a fortnight cannot end up
        // with two Fridays serving different dishes because somebody changed
        // their rule in between. It is the same promise the removal already
        // keeps: a plan already generated keeps what it was generated with.
        //
        // It also makes the plan say why it served what it served, which is
        // what `poolSeed` is for and what the "this rule could not be honoured"
        // notice (`0099`) will need: what was asked for, beside what arrived.
        fixedMeals: [...pinned].flatMap(([dayIndex, day]) => [...day.values()].map(pin => ({ dayIndex, slot: pin.slot, slug: pin.slug }))),
        jobId,
        // What the kitchen's preference was narrowed to for the macros' sake,
        // and `null` when it was not — the figure `0102` asks a measurement of a
        // preference to count, since the bands that survive it say nothing about
        // what it cost to keep them.
        kitchenShare,
        locale: context.locale,
        // What the cupboard was asked with, and what it then did — stored the
        // way `kitchenShare` is and for the reason `fixedMeals` gives: a plan
        // already generated keeps what it was generated with, so a re-roll
        // pre-fills from `asked` and the record dies with the plan (PRD 022,
        // criterion 6). `null` is a generation nobody told anything to, which
        // is every plan before project 022.
        //
        // **Slugs and counts, never a word.** `asked` holds catalogue slugs,
        // the one part of an entry that may leave the product, and `unresolved`
        // says how many words the catalogue had no answer for without saying
        // which (PRD 022, criterion 7).
        pantry,
        poolSeed: rotation.seed,
        quality,
        scheduledAt: start.toISOString()
      },
      // Only dishes the plan actually uses are persisted — a generated dish the
      // scheduler never placed is not worth a row.
      locale: context.locale,
      newRecipes: built.generated.filter(dish => used.has(dish.slug)).map(dish => toRecipeDraft(dish, context)),
      shoppingItems: toShoppingItems(shopping),
      startDate: isoDate(start),
      strategy: { carbsG: targets.carbsG, fatG: targets.fatG, fiberG: targets.fiberG, kcal: targets.kcal, proteinG: targets.proteinG },
      today
    };
  }
}

/**
 * The assignment with each day's own date attached, which is what the shopping
 * list keys its per-day breakdown by (`0091`). The same arithmetic `toDraft`
 * uses for `plan_days`, so the list's days and the plan's days can never name
 * different dates.
 */
function withDates(assignment: PlanAssignment, start: Date) {
  return { days: assignment.days.map(day => ({ ...day, date: isoDate(addDays(start, day.dayIndex - 1)) })) };
}

/**
 * A built list as a plan stores it, the per-day breakdown a range is read from
 * included (`0091`), and what a cupboard already covers of each row seeded into
 * it (project 022 phase 2).
 *
 * `boughtGrams` and `checked` travel together because `seedFromPantry` derived
 * them from one `carriedBought` call, and the repository writes them in the
 * same insert for the same reason.
 */
function toShoppingItems(shopping: { readonly items: readonly MaybeSeededRow[] }): PlanDraft['shoppingItems'] {
  return shopping.items.map(item => ({
    // Absent for the list of the plan **being cut** (project 015), which the
    // repository rewrites through `replaceGeneratedItems`: that plan's shop is
    // already somebody's own and is carried from the stored rows, not seeded
    // from a cupboard that was spent a fortnight ago.
    ...(item.boughtGrams !== undefined && { boughtGrams: item.boughtGrams, checked: item.checked === true }),
    category: item.category,
    displayQuantity: item.displayQuantity,
    displayUnit: item.displayUnit,
    dryRounded: item.dryRounded,
    gramsPerUnit: item.gramsPerUnit,
    ingredientId: item.ingredientId,
    name: item.name,
    perDay: item.perDay,
    totalGrams: item.totalGrams
  }));
}

/**
 * A plan's meals, one entry per day with that day's own date, as the list
 * builder reads them. The date is what the breakdown is keyed by (`0091`), so a
 * day without one could not be filtered.
 */
function byDay<T extends { readonly date: string; readonly dayIndex: number }>(
  meals: readonly T[]
): readonly { readonly date: string; readonly meals: readonly T[] }[] {
  const days = new Map<number, { date: string; meals: T[] }>();

  for (const meal of meals) {
    const day = days.get(meal.dayIndex) ?? { date: meal.date, meals: [] };

    days.set(meal.dayIndex, { date: day.date, meals: [...day.meals, meal] });
  }

  return [...days.values()];
}

/** A built row, with the cupboard's seed on it or without — the cut plan's list has none. */
type MaybeSeededRow = Partial<Pick<SeededShoppingRow, 'boughtGrams' | 'checked'>> & ShoppingRow;

/**
 * How the plan came to be scheduled from something other than its first pool.
 * `full_library` is the rescue from no plan at all; `wider_rotation` is the
 * rescue from a plan that missed its macros (`0046`).
 */
type Fallback = 'full_library' | 'wider_rotation' | null;

/**
 * What a generation was asked from the cupboard, and the two figures the
 * sentence after the plan reads (PRD 022, criterion 4: *«9 de 42 comidas usan
 * solo lo que ya tenías. La compra baja de 38 a 27 cosas.»*).
 *
 * **Stored rather than recomputed**, because the sentence is about the moment
 * the plan was made: the cupboard is cleared immediately after, so by the time
 * a screen asks, there is nothing left to recompute it from.
 *
 * `rows` and `meals` are the denominators, so the sentence needs no second
 * read. `coveredRows` counts rows the cupboard hands back bought **in full** —
 * rows nobody has to visit — and not every row it merely named, because an
 * amount below the row's need leaves a remainder to buy. `wholeMeals` counts a
 * meal whose every item, its accompaniment included, was already in the house;
 * both are phase 0's own definitions, so what the screen says is what the
 * project was priced on.
 */
type PantryRecord = {
  readonly asked: readonly { readonly grams: number | null; readonly slug: string }[];
  readonly coveredRows: number;
  readonly meals: number;
  readonly rows: number;
  readonly unresolved: number;
  readonly wholeMeals: number;
};

/**
 * The cupboard's record, or `null` when there was no cupboard at all.
 *
 * `null` rather than a row of zeroes: a plan that was told nothing and a plan
 * told about a cupboard that covered nothing are different facts, and the
 * sentence in phase 3 may only be said about the second. An entry the catalogue
 * could not answer still counts as having been told something — it is in
 * `unresolved`, and phase 5 is what reads those.
 */
function pantryRecord(
  pantry: { readonly holdings: readonly { readonly grams: number | null; readonly slug: string }[]; readonly unresolved: number },
  coveredRows: number,
  rows: number,
  plates: { readonly meals: number; readonly wholeMeals: number }
): PantryRecord | null {
  if (pantry.holdings.length === 0 && pantry.unresolved === 0) {
    return null;
  }

  return {
    asked: pantry.holdings.map(holding => ({ grams: holding.grams, slug: holding.slug })),
    coveredRows,
    meals: plates.meals,
    rows,
    unresolved: pantry.unresolved,
    wholeMeals: plates.wholeMeals
  };
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
