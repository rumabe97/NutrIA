import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { daysFor } from 'core/entities/FixedMeal';
import { DEFAULT_MEAL_SHAPE, proteinWeightsFor, slotsIn, weightsFor } from 'core/domain/MealShape';
import { actionable, whyNotFixable } from 'core/domain/FixableReason';
import { dayHoldsPin, pinnable, PLAN_DAYS } from 'core/domain/Scheduler';
import { FixedMealController, unhonouredFrom } from 'core/controllers/FixedMeal';
import { ConflictError, InputParseError, QuotaExceededError } from 'core/entities/Error';
import { DishRequestController } from 'core/controllers/DishRequest';
import { dishVocabulary, MAX_DISH_REQUEST, storableName, storableProse, typedName } from 'core/domain/DishRequest';
import { HealthController } from 'core/controllers/Health';
import { UserController } from 'core/controllers/User';
import { PoolBuilder } from '../../ai/services/PoolBuilder.service.js';
import { promptPreferences, toRecipeDraft } from '../../meal-plans/services/GenerationShared.js';
import { larderFor } from 'core/domain/Accompaniment';
import { minimumDailyKcal } from 'core/domain/Nutrition';
import { PlanController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';
import { SettingsController } from 'core/controllers/Settings';

import type { AddFixedMeal, FixedMeal, Weekday } from 'core/entities/FixedMeal';
import type { CandidateDish, MealSlot } from 'core/entities/Plan';
import type { FixedMealHonourability, FixedMealsView } from 'core/controllers/FixedMeal';
import type { NotFixable } from 'core/domain/FixableReason';

/** A dish a person could fix to a slot, as the picker lists them. */
export type FixableDish = { readonly id: string; readonly name: string; readonly slug: string };

/**
 * A dish the library has and the person was not offered, with the reason
 * (report `0011` § 2).
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
 * fixed?" is answered against the fortnight the person would generate next.
 *
 * **The season is not one of the things that breaks a rule, and this header
 * said for two phases that it was** (measured and read, 021 phase 5b). A lone
 * pin outranks the season: `honouredPin` is consulted at the top of the slot
 * loop (`Scheduler.ts`) and nothing below it runs, while the season predicate
 * lives in the day search under it — and neither `servable` nor `pinnable`
 * filters by month. A June dish fixed to a December Monday is **still served**.
 * The season bites only when another rule shares the day, through `dayHolds`,
 * and the sentence said then is `clashes_with_fixed` — **a mislabel**, since the
 * cause was the month and not the other rule. It is left recorded here rather
 * than machined around: narrow, and naming it costs a second mechanism
 * (`FixableDishDto` records the same thing about the picker's second offer).
 *
 * **What is told, and when** (021 phase 5b): `honourability` asks the same
 * question of the rules this person already wrote, and one mechanism answers
 * every cause — `whyNotFixable`, the same one the picker explains itself with.
 * The causes that produce a sentence are a cooking time lowered under the dish
 * (`too_slow`), a kitchen that says it has no oven (`missing_equipment`,
 * `0102`), a dish dropped from the catalogue or an account that switched
 * language and keeps a rule its pool will never hold again (`unknown_dish`), a
 * meal the person stopped eating (`wrong_slot`), and two rules one day cannot
 * hold together (`clashes_with_fixed`). None of them was worth its own
 * machinery, which is why there is still only one.
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

/**
 * What a weekday already carries, by slot, with `slot` itself left out.
 *
 * It is what makes both answers honest: a dish that fits the plate on its own
 * can still leave the day unable to reach four macros beside the rule already
 * there (`0101`). Only the rules of *that* weekday count, and never the slot in
 * question — replacing a rule is removing it and writing another, and a rule
 * does not clash with itself.
 */
function heldOn(
  rules: readonly FixedMeal[],
  weekday: Weekday,
  slot: MealSlot
): ReadonlyMap<MealSlot, { readonly slot: MealSlot; readonly slug: string }> {
  return new Map(
    rules.filter(rule => rule.weekday === weekday && rule.slot !== slot).map(rule => [rule.slot, { slot: rule.slot, slug: rule.dishSlug }])
  );
}

@Injectable()
export class FixedMealsService {
  private readonly logger = new Logger(FixedMealsService.name);

  constructor(private readonly pool: PoolBuilder) {}

  /** Fixes a meal, after checking the dish is one this person could actually be served there. */
  async add(userId: string, rule: AddFixedMeal): Promise<FixedMeal> {
    const offered = await this.fixable(userId, rule.weekday, rule.slot);

    if (!offered.some(dish => dish.slug === rule.dishSlug)) {
      // Said before the rule exists rather than discovered once a fortnight for
      // ever, which is `0098`'s whole reason for `pinnable` being exported.
      throw new InputParseError('That dish cannot be fixed to that meal', { dishSlug: ['is not offered for this slot'] });
    }

    if ((await FixedMealController.taken(userId)).some(held => held.weekday === rule.weekday && held.slot === rule.slot)) {
      // The database refuses it too (`fixed_meals_user_weekday_slot_unique`);
      // this is only so the ordinary case reads as a sentence rather than a 500.
      // A *day* may hold more than one rule since `0101` — a meal may not.
      throw new ConflictError('That meal of that day is already fixed');
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
   * Everything a judgement about this person's food needs, read once and
   * without a weekday or a meal in it: the catalogue and safety context, their
   * library and the pool it leaves, their rules, and the scheduler input every
   * day of the fortnight shares.
   *
   * **Nothing in `input` depends on the weekday or the slot** — the targets, the
   * weights, the pool and the season's `monthOf` are the plan's, and the day is
   * an argument to `pinnable`. That is what lets the three questions this
   * service answers (what is offered, why a dish is not, and which rules are no
   * longer honoured) share one assembly instead of building one each.
   */
  private async assemble(userId: string): Promise<{
    readonly context: Awaited<ReturnType<typeof RecipeController.generationContext>>;
    readonly defaultStart: string;
    readonly input: Parameters<typeof pinnable>[0];
    /** Everything the library holds for these slots, from the same read the pool came out of. */
    readonly library: readonly CandidateDish[];
    readonly profile: Awaited<ReturnType<typeof ProfileController.getFullProfile>>;
    readonly rules: readonly FixedMeal[];
    readonly slots: readonly MealSlot[];
    readonly verdicts: Awaited<ReturnType<typeof RecipeController.verdicts>>;
  }> {
    const [profile, context, allowances, verdicts, rules] = await Promise.all([
      ProfileController.getFullProfile(userId),
      RecipeController.generationContext(userId),
      PlanController.allowances(userId),
      RecipeController.verdicts(userId),
      FixedMealController.forPlan(userId)
    ]);

    if (!profile.targets) {
      throw new InputParseError('Finish your profile before fixing a meal', { profile: ['is incomplete'] });
    }

    const shape = profile.preferences?.mealShape ?? DEFAULT_MEAL_SHAPE;
    const slots = slotsIn(shape);
    // One read for both: the dishes this person may be served and everything the
    // library holds for those slots. Asked apart they were the same thousand
    // recipes read twice, on every pause in somebody's typing.
    const { library, pool: servable } = await RecipeController.libraryAndPool(slots, context);
    const disliked = new Set(verdicts.disliked.map(dish => dish.slug));
    const pool = servable.filter(dish => !disliked.has(dish.slug));
    const start = new Date(`${allowances.defaultStart}T00:00:00Z`);

    const monthOf = (index: number): number => {
      const day = new Date(start);

      day.setUTCDate(day.getUTCDate() + index);

      return day.getUTCMonth() + 1;
    };

    const sides = (await SettingsController.accompaniments())
      ? { accompaniments: { larder: larderFor({ catalogue: context.catalogue, preferences: context.preferences, safety: context.safety }), monthOf } }
      : {};

    return {
      context,
      defaultStart: allowances.defaultStart,
      input: {
        ...sides,
        catalogue: context.catalogue,
        minimumKcal: minimumDailyKcal(profile.profile?.sex ?? 'prefer_not_to_say'),
        monthOf,
        pool,
        proteinWeights: proteinWeightsFor(profile.goal?.type, weightsFor(shape)),
        targets: profile.targets.effective,
        weights: weightsFor(shape)
      },
      library,
      profile,
      rules,
      slots,
      verdicts
    };
  }

  /**
   * Which of this account's standing rules the plan it would generate next can
   * no longer honour, and why (021 phase 5b).
   *
   * **The same mechanism as the picker's**, asked of a dish somebody already
   * fixed rather than one they searched for: `whyNotFixable`, in the order it
   * says reasons. A rule whose dish the person's own filters now refuse is not
   * in the pool the generation restores pins from, so the day is built as though
   * the rule did not exist — correctly (`0097`) and, until this, silently.
   *
   * **Its own request, and that is the cost decision this phase owes**
   * (measured here, 2026-10-16, against the local library of 1,148 recipes):
   * `standing()` is 2 ms and this assembly is 75–90 ms, so folding it into the
   * rules screen's own read would have made opening the profile forty times
   * slower for an answer that is empty for almost everybody. Stored at
   * generation time instead it would go stale exactly when it matters — every
   * cause of it changes *after* a plan was built. So the screen asks for it
   * once the rules are on it.
   *
   * It never throws: a profile the equations reject and a consent withdrawn
   * between the two requests are answered with `judged: false`, because a
   * screen that lists somebody's rules must not become an error page over the
   * footnote beside them.
   */
  async honourability(userId: string): Promise<FixedMealHonourability> {
    let assembly: Awaited<ReturnType<typeof this.assemble>>;

    try {
      assembly = await this.assemble(userId);
    } catch (error) {
      this.logger.warn(`Honourability of the standing fixed meals could not be judged: ${error instanceof Error ? error.message : 'unknown'}`);

      return { judged: false, unhonoured: [] };
    }

    const { context, defaultStart, input, library, rules, slots, verdicts } = assembly;
    const disliked = new Set(verdicts.disliked.map(dish => dish.slug));
    // `pinnable`'s plate fit, per day and meal, kept for the rules that share
    // one: three rules on one weekday ask the same list three times.
    const offered = new Map<string, ReadonlySet<string>>();

    const fitting = (dayIndex: number, slot: MealSlot): ReadonlySet<string> => {
      const key = `${dayIndex}:${slot}`;
      const known = offered.get(key);

      if (known) {
        return known;
      }

      const slugs = new Set(pinnable(input, dayIndex, slot).map(dish => dish.slug));

      offered.set(key, slugs);

      return slugs;
    };

    return {
      judged: true,
      unhonoured: unhonouredFrom(rules, rule => {
        if (!slots.includes(rule.slot)) {
          // They stopped eating that meal. The rule still exists and the plan
          // has no slot to honour it in.
          return { fixable: false, why: 'wrong_slot' };
        }

        // The library is read in this person's own locale and holds what the
        // catalogue holds today, so a dish missing from it is one of the two
        // causes that take the dish away rather than the person: deleted, or
        // left behind by a change of language.
        const dish = library.find(each => each.slug === rule.dishSlug);

        if (!dish) {
          return { fixable: false, why: 'unknown_dish' };
        }

        const [dayIndex] = daysFor(rule.weekday, defaultStart, PLAN_DAYS);

        if (dayIndex === undefined) {
          // Unreachable while a plan is a fortnight: every weekday falls in it.
          return { fixable: true };
        }

        const fits = fitting(dayIndex, rule.slot).has(dish.slug);
        const held = heldOn(rules, rule.weekday, rule.slot);

        return whyNotFixable(
          dish,
          rule.slot,
          {
            catalogue: context.catalogue,
            disliked,
            kitchen: context.preferences.kitchen,
            maxMinutes: context.preferences.maxMinutesPerDish,
            safety: context.safety
          },
          RecipeController.excludes({ ...dish, cuisine: dish.cuisine ?? null }, context),
          fits,
          // Asked of this one dish and only when it fits the plate alone — the
          // whole-pool form of the same question is 2.7 s (`dayHoldsPin`), and
          // an earlier reason makes the answer moot anyway.
          !fits || held.size === 0 || dayHoldsPin(input, dayIndex, { slot: rule.slot, slug: dish.slug }, held)
        );
      })
    };
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
    /** What this weekday already has fixed, by slot — what the offer is narrowed against (`0101`). */
    readonly held: ReadonlyMap<MealSlot, { readonly slot: MealSlot; readonly slug: string }>;
    readonly input: Parameters<typeof pinnable>[0] | undefined;
    /** Everything the library holds for these slots, from the same read the pool came out of. */
    readonly library: readonly CandidateDish[];
    readonly offered: readonly FixableDish[];
    readonly profile: Awaited<ReturnType<typeof ProfileController.getFullProfile>>;
    readonly slots: readonly MealSlot[];
    readonly verdicts: Awaited<ReturnType<typeof RecipeController.verdicts>>;
  }> {
    const { context, defaultStart, input, library, profile, rules, slots, verdicts } = await this.assemble(userId);

    if (!slots.includes(slot)) {
      throw new InputParseError('You do not eat that meal', { slot: ['is not one of your meals'] });
    }

    // The day the rule would land on in the plan this person would generate
    // next — `defaultStart` is the day the chooser offers first (project 015).
    const [dayIndex] = daysFor(weekday, defaultStart, PLAN_DAYS);

    if (dayIndex === undefined) {
      return { context, dayIndex: undefined, held: new Map(), input: undefined, library, offered: [], profile, slots, verdicts };
    }

    const held = heldOn(rules, weekday, slot);
    const offered = pinnable(input, dayIndex, slot, held);

    return {
      context,
      dayIndex,
      held,
      input,
      library,
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
   * offered for this slot — each with the reason (report `0011` § 2).
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

    const { context, dayIndex, held, input, library, offered, verdicts } = await this.offerFor(userId, weekday, slot);
    const offeredSlugs = new Set(offered.map(dish => dish.slug));
    // What the day would offer if it held nothing. The difference between the
    // two lists is exactly the dishes refused for clashing with a rule already
    // there, which is its own sentence and not "too big for that plate".
    const alone = held.size > 0 && input && dayIndex !== undefined ? new Set(pinnable(input, dayIndex, slot).map(dish => dish.slug)) : offeredSlugs;
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
          kitchen: context.preferences.kitchen,
          maxMinutes: context.preferences.maxMinutesPerDish,
          safety: context.safety
        },
        RecipeController.excludes({ ...dish, cuisine: dish.cuisine ?? null }, context),
        alone.has(dish.slug),
        offeredSlugs.has(dish.slug)
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
   * comes back is a dish (report `0011` § 4 a).
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

    if (!typedName(asked)) {
      throw new InputParseError('Write the name of a dish', { name: [`one line, no quotes, up to ${MAX_DISH_REQUEST} characters`] });
    }

    if (!(await DishRequestController.standing(userId)).allowed) {
      // Before the call, so nobody spends money on a request that cannot end in
      // a dish. It is read again inside the lock, which is where it binds.
      throw new QuotaExceededError('dish_request');
    }

    const { context, dayIndex, held, input, library, profile } = await this.offerFor(userId, weekday, slot);
    // The pool a requested dish is judged in has to carry the day's own rules:
    // `dayHolds` looks their dishes up in it, and a pool of one dish would make
    // every pin on that day unhonourable and the day trivially solvable.
    const heldDishes = [...held.values()].flatMap(pin => library.filter(dish => dish.slug === pin.slug));

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
      // Never the account's id: a session label reaches a log line and, behind a
      // gateway, a provider's own log, where an id would be a per-account
      // correlator. Every other caller labels an entity (a job, a meal, a
      // recipe) and a request has none, so this is random.
      session: `dish-request:${randomUUID()}`,
      slots: [slot]
    });

    const vocabulary = dishVocabulary(
      context.catalogue,
      library.map(dish => dish.name)
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
      // The same gate the offered list uses, on a pool of exactly this dish —
      // and beside whatever that day already holds, because a dish nobody could
      // be served there is not worth storing (`0101`).
      if (pinnable({ ...input, pool: [candidate, ...heldDishes] }, dayIndex, slot, held).length === 0) {
        continue;
      }

      if (!storableName(candidate.name, vocabulary, person).ok) {
        // The model echoed the request into the name, or wrote something that is
        // not a dish's name. Nothing is stored: the library is shared and the
        // name goes to Google with the picture.
        continue;
      }

      if (!storableProse([...candidate.steps.flatMap(step => [step.text, step.cue ?? '']), candidate.cuisine ?? ''], person).ok) {
        // The name is a tenth of what is stored. The method is written by the
        // same model under a prompt quoting the person's words, and it is kept
        // verbatim in the same shared row — so it is read by the same gate
        // (`invariant-reviewer`, 2026-10-13).
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
