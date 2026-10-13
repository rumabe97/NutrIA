import { Injectable } from '@nestjs/common';

import { daysFor } from 'core/entities/FixedMeal';
import { DEFAULT_MEAL_SHAPE, proteinWeightsFor, slotsIn, weightsFor } from 'core/domain/MealShape';
import { actionable, whyNotFixable } from 'core/domain/FixableReason';
import { ConflictError, InputParseError, QuotaExceededError } from 'core/entities/Error';
import { DishRequestController } from 'core/controllers/DishRequest';
import { dishVocabulary, MAX_DISH_REQUEST, storableName } from 'core/domain/DishRequest';
import { HealthController } from 'core/controllers/Health';
import { UserController } from 'core/controllers/User';
import { PoolBuilder } from '../../ai/services/PoolBuilder.service.js';
import { promptPreferences, toRecipeDraft } from '../../meal-plans/services/GenerationShared.js';
import { FixedMealController } from 'core/controllers/FixedMeal';
import { larderFor } from 'core/domain/Accompaniment';
import { minimumDailyKcal } from 'core/domain/Nutrition';
import { pinnable, PLAN_DAYS } from 'core/domain/Scheduler';
import { PlanController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';
import { SettingsController } from 'core/controllers/Settings';

import type { AddFixedMeal, FixedMeal, Weekday } from 'core/entities/FixedMeal';
import type { CandidateDish, MealSlot } from 'core/entities/Plan';
import type { FixedMealsView } from 'core/controllers/FixedMeal';
import type { NotFixable } from 'core/domain/FixableReason';

/** A dish a person could fix to a slot, as the picker lists them. */
export type FixableDish = { readonly id: string; readonly name: string; readonly slug: string };

/**
 * A dish the library has and the person was not offered, with the reason
 * (`0011` § 2).
 *
 * `actionable` is on the wire rather than left to the screen to infer: whether a
 * reason is something somebody can do about it decides whether they are shown a
 * way forward or told no, and that is a judgement the domain already made
 * (`FixableReason`). Two places deciding it is how they come to disagree.
 */
export type NotOfferedDish = { readonly actionable: boolean; readonly name: string; readonly slug: string; readonly why: NotFixable };

/**
 * Standing fixed meals: which dishes can be fixed, and the rules themselves
 * (`0098`, `0099`).
 *
 * **Judged against the plan that comes next, and that is a decision with a
 * cost** (owner, 2026-10-13). `pinnable` needs a day, because a day has targets
 * and — the part that bites — a *month*: fresh fruit and what goes beside a
 * plate are filtered by the season the day falls in (017 phase 2, project 016).
 * A standing rule has no day; it is for ever. So the question "can this dish be
 * fixed?" is answered against the fortnight the person would generate next, and
 * the known consequence is that a rule written in June with a summer dish stops
 * being honourable in December **without anybody being told**.
 *
 * That is accepted here and not forgotten: telling somebody a rule can no longer
 * be honoured is the next change, and it is one mechanism for three cases — the
 * season, a dish deleted from the catalogue, and an account that switches
 * language and keeps a rule pointing at a Spanish dish its pool will never hold.
 * Each of those produces the same silent symptom, and none of them is worth its
 * own machinery.
 *
 * **No model is called here.** The pool is the person's own safe library —
 * `reusablePool` with no rotation — because a picker that spent a generation's
 * worth of model calls to list dishes would be a picker nobody could open twice.
 */
/** How many reasons are worth showing at once; the list is sorted so the useful ones are first. */
const NOT_OFFERED_SHOWN = 5;

/** Lower-cased and unaccented, as the picker's own search is. */
function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** How many dishes the model is asked for when somebody requests one: the first that fits is taken. */
const REQUEST_CANDIDATES = 3;

@Injectable()
export class FixedMealsService {
  constructor(private readonly pool: PoolBuilder) {}

  /** Fixes a meal, after checking the dish is one this person could actually be served there. */
  async add(userId: string, rule: AddFixedMeal): Promise<FixedMeal> {
    const offered = await this.fixable(userId, rule.weekday, rule.slot);

    if (!offered.some(dish => dish.slug === rule.dishSlug)) {
      // Said before the rule exists rather than discovered once a fortnight for
      // ever, which is `0098`'s whole reason for `pinnable` being exported.
      throw new InputParseError('That dish cannot be fixed to that meal', { dishSlug: ['is not offered for this slot'] });
    }

    if ((await FixedMealController.taken(userId)).includes(rule.weekday)) {
      // The database refuses it too (`fixed_meals_user_weekday_unique`); this is
      // only so the ordinary case reads as a sentence rather than a 500.
      throw new ConflictError('A meal is already fixed to that day');
    }

    return FixedMealController.add(userId, rule);
  }

  /**
   * Which dishes this person could fix to `slot` on `weekday`.
   *
   * Everything a generation would assemble except the model's third: the
   * catalogue and safety context, the library pool, the day's targets and the
   * season — then `pinnable` answers.
   */
  async fixable(userId: string, weekday: Weekday, slot: MealSlot): Promise<readonly FixableDish[]> {
    return (await this.offerFor(userId, weekday, slot)).offered;
  }

  /**
   * Everything the two questions share: what this person may be served, and the
   * dishes `pinnable` offers for that day and meal.
   *
   * One assembly rather than two, because "what is offered" and "why this one is
   * not" have to be answers to the same question — computed apart they can
   * disagree, and the second's whole job is to explain the first.
   */
  private async offerFor(
    userId: string,
    weekday: Weekday,
    slot: MealSlot
  ): Promise<{
    readonly context: Awaited<ReturnType<typeof RecipeController.generationContext>>;
    readonly dayIndex: number | undefined;
    readonly input: Parameters<typeof pinnable>[0] | undefined;
    readonly offered: readonly FixableDish[];
    readonly profile: Awaited<ReturnType<typeof ProfileController.getFullProfile>>;
    readonly slots: readonly MealSlot[];
    readonly verdicts: Awaited<ReturnType<typeof RecipeController.verdicts>>;
  }> {
    const [profile, context, allowances, verdicts] = await Promise.all([
      ProfileController.getFullProfile(userId),
      RecipeController.generationContext(userId),
      PlanController.allowances(userId),
      RecipeController.verdicts(userId)
    ]);

    if (!profile.targets) {
      throw new InputParseError('Finish your profile before fixing a meal', { profile: ['is incomplete'] });
    }

    const shape = profile.preferences?.mealShape ?? DEFAULT_MEAL_SHAPE;
    const slots = slotsIn(shape);

    if (!slots.includes(slot)) {
      throw new InputParseError('You do not eat that meal', { slot: ['is not one of your meals'] });
    }

    // The day the rule would land on in the plan this person would generate
    // next — `defaultStart` is the day the chooser offers first (project 015).
    const [dayIndex] = daysFor(weekday, allowances.defaultStart, PLAN_DAYS);

    if (dayIndex === undefined) {
      return { context, dayIndex: undefined, input: undefined, offered: [], profile, slots, verdicts };
    }

    const disliked = new Set(verdicts.disliked.map(dish => dish.slug));
    const pool = (await RecipeController.reusablePool(slots, context)).filter(dish => !disliked.has(dish.slug));
    const start = new Date(`${allowances.defaultStart}T00:00:00Z`);

    const monthOf = (index: number): number => {
      const day = new Date(start);

      day.setUTCDate(day.getUTCDate() + index);

      return day.getUTCMonth() + 1;
    };

    const sides = (await SettingsController.accompaniments())
      ? { accompaniments: { larder: larderFor({ catalogue: context.catalogue, preferences: context.preferences, safety: context.safety }), monthOf } }
      : {};

    const input = {
      ...sides,
      catalogue: context.catalogue,
      minimumKcal: minimumDailyKcal(profile.profile?.sex ?? 'prefer_not_to_say'),
      monthOf,
      pool,
      proteinWeights: proteinWeightsFor(profile.goal?.type, weightsFor(shape)),
      targets: profile.targets.effective,
      weights: weightsFor(shape)
    };
    const offered = pinnable(input, dayIndex, slot);

    return {
      context,
      dayIndex,
      input,
      offered: [...offered]
        .map((dish: CandidateDish) => ({ id: dish.slug, name: dish.name, slug: dish.slug }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      profile,
      slots,
      verdicts
    };
  }

  /**
   * Dishes the library has, matching what somebody searched for, that are **not**
   * offered for this slot — each with the reason (`0011` § 2).
   *
   * The defect it exists for: the owner searched for a dish his library has and
   * the screen showed him a shorter list and said nothing. It was excluded for
   * taking 50 minutes against a profile that said 30 — one of four reasons a
   * person can act on in two taps.
   *
   * Only ever asked for a query somebody typed, and only for what the offered
   * list did not already answer, so the cost is a search over a library already
   * in memory for the fixable call that preceded it.
   */
  async notOffered(userId: string, weekday: Weekday, slot: MealSlot, query: string): Promise<readonly NotOfferedDish[]> {
    const needle = plain(query);

    if (needle.length < 3) {
      // Below three letters every dish matches and the answer says nothing.
      return [];
    }

    const { context, offered, slots, verdicts } = await this.offerFor(userId, weekday, slot);
    const offeredSlugs = new Set(offered.map(dish => dish.slug));
    const library = await RecipeController.libraryFor(slots, context);
    const seen = new Set<string>();
    const reasons: NotOfferedDish[] = [];

    for (const dish of library) {
      if (offeredSlugs.has(dish.slug) || seen.has(dish.slug) || !plain(dish.name).includes(needle)) {
        continue;
      }

      seen.add(dish.slug);

      const verdict = whyNotFixable(
        dish,
        slot,
        {
          catalogue: context.catalogue,
          disliked: new Set(verdicts.disliked.map(each => each.slug)),
          maxMinutes: context.preferences.maxMinutesPerDish,
          safety: context.safety
        },
        RecipeController.excludes({ ...dish, cuisine: dish.cuisine ?? null }, context),
        false
      );

      if (!verdict.fixable) {
        reasons.push({ actionable: actionable(verdict.why), name: dish.name, slug: dish.slug, why: verdict.why });
      }
    }

    // The ones they can do something about first: a screen that leads with a
    // refusal buries the two taps that would have fixed it.
    return reasons.sort((a, b) => Number(b.actionable) - Number(a.actionable) || a.name.localeCompare(b.name)).slice(0, NOT_OFFERED_SHOWN);
  }

  /**
   * Asks the model for a dish the library does not have, and stores it if what
   * comes back is a dish (`0011` § 4 a).
   *
   * **The only place a person's words reach a model**, under the five conditions
   * in `docs/legal/analysis.md` ("P0-3's status at 2026-10-13"). What they typed
   * goes to the prompt and nowhere else: it is never stored, never logged, never
   * put in an error, and never reaches the picture call. The name the model
   * writes back is gated by `storableName` before anything is kept, because the
   * library is shared and a dish's name travels verbatim to Google when its
   * picture is drawn.
   *
   * **Checked against the same gates as everything else**, by handing the
   * candidate to `pinnable` rather than to a second idea of what fits: a
   * requested dish earns its place exactly as a library one does, or it does not
   * get one.
   *
   * The allowance is read twice: once before the call, so nobody pays for a
   * request that cannot be honoured, and again inside the lock that stores the
   * dish — which is where it actually binds.
   */
  async request(userId: string, weekday: Weekday, slot: MealSlot, name: string): Promise<FixableDish> {
    const asked = name.trim();

    if (asked.length === 0 || asked.length > MAX_DISH_REQUEST || /[\n\r]/.test(asked)) {
      throw new InputParseError('Write the name of a dish', { name: [`one line, up to ${MAX_DISH_REQUEST} characters`] });
    }

    if (!(await DishRequestController.standing(userId)).allowed) {
      // Before the call, so nobody spends money on a request that cannot end in
      // a dish. It is read again inside the lock, which is where it binds.
      throw new QuotaExceededError('dish_request');
    }

    const { context, dayIndex, input, profile, slots } = await this.offerFor(userId, weekday, slot);

    if (!input || dayIndex === undefined) {
      throw new ConflictError('That meal does not fall in the fortnight you would generate next');
    }

    const built = await this.pool.build({
      context,
      feature: 'dish_request',
      libraryUsage: await RecipeController.libraryUsage([slot], context),
      needPerSlot: REQUEST_CANDIDATES,
      preferences: promptPreferences(
        profile,
        await RecipeController.verdicts(userId),
        [],
        input.targets,
        (await PlanController.allowances(userId)).defaultStart,
        null,
        null,
        [],
        // The one field a person writes into. It reaches here and stops here.
        asked
      ),
      reusable: [],
      session: `dish-request:${userId}`,
      slots: [slot]
    });

    const vocabulary = dishVocabulary(
      context.catalogue,
      (await RecipeController.libraryFor(slots, context)).map(dish => dish.name)
    );
    const health = await HealthController.get(userId);
    const person = {
      // Checked exactly, whatever the vocabulary says: a word that is somebody's
      // condition or medication must not come back as the name of their dinner.
      health: [
        ...health.conditions.map(each => each.label),
        ...health.medications.map(each => each.name),
        ...health.supplements.map(each => each.name)
      ],
      name: (await UserController.getUser({ id: userId })).name
    };

    for (const candidate of built.generated) {
      // The same gate the offered list uses, on a pool of exactly this dish.
      if (pinnable({ ...input, pool: [candidate] }, dayIndex, slot).length === 0) {
        continue;
      }

      if (!storableName(candidate.name, vocabulary, person).ok) {
        // The model echoed the request into the name, or wrote something that is
        // not a dish's name. Nothing is stored: the library is shared and the
        // name goes to Google with the picture.
        continue;
      }

      await DishRequestController.store(userId, toRecipeDraft(candidate, context), context.locale);

      return { id: candidate.slug, name: candidate.name, slug: candidate.slug };
    }

    throw new ConflictError('No dish we could serve came back for that');
  }

  async remove(userId: string, id: string): Promise<void> {
    return FixedMealController.remove(userId, id);
  }

  async standing(userId: string): Promise<FixedMealsView> {
    return FixedMealController.standing(userId);
  }
}
