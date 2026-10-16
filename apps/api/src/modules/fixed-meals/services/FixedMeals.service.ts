import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { daysFor, MAX_FIXED_MEALS_PER_DAY } from 'core/entities/FixedMeal';
import { DEFAULT_MEAL_SHAPE, proteinWeightsFor, slotsIn, weightsFor } from 'core/domain/MealShape';
import { acceptable, actionable, whyNotFixable } from 'core/domain/FixableReason';
import { dayHoldsPin, pinnable, PLAN_DAYS } from 'core/domain/Scheduler';
import { FixedMealController, unhonouredFrom } from 'core/controllers/FixedMeal';
import { ConflictError, FixedMealDayFullError, FixedMealWarningError, InputParseError, QuotaExceededError } from 'core/entities/Error';
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
import type { AcceptableReason, FixableVerdict, NotFixable } from 'core/domain/FixableReason';

/** A dish a person could fix to a slot, as the picker lists them. */
export type FixableDish = { readonly id: string; readonly name: string; readonly slug: string };

/**
 * What fixing **one** dish to one meal of one weekday would cost, read before
 * anybody commits (`0103`).
 *
 * The same vocabulary as everything else here — `whyNotFixable`'s verdict — with
 * `acceptable` beside it, because a warning and a refusal differ in what the
 * caller may *do* about them and not in what they are called. That is what
 * stopped `FixableReason` fragmenting, and it is why there is no second list of
 * warning kinds. One reason is acceptable today, `clashes_with_fixed`: the dish
 * is served and the day comes out of band, which is what was asked for.
 * `too_big_or_small` is arithmetic too and is **not** acceptable, because
 * `honouredPin` drops that pin and the meal would never arrive.
 *
 * It is asked of the dish somebody chose, which is the whole of `0103`'s saving:
 * the day's arithmetic costs about 20 ms for one dish and four seconds for the
 * library.
 */
export type FixedMealConsequence = { readonly acceptable: boolean; readonly fixable: false; readonly why: NotFixable } | { readonly fixable: true };

/**
 * A dish the library has and the person was not offered, with the reason
 * (report `0011` § 2).
 *
 * `actionable` is on the wire rather than left to the screen to infer: whether a
 * reason is something somebody can do about it decides whether they are shown a
 * way forward or told no, and that is a judgement the domain already made
 * (`FixableReason`). Two places deciding it is how they come to disagree.
 *
 * **It carries no `acceptable`, deliberately** (`0103`): no reason this list can
 * give could ever be one. `clashes_with_fixed` is offered rather than refused,
 * and `too_big_or_small` is settled as a refusal because `honouredPin` drops
 * that pin. A boolean that cannot be true invites a screen to build a branch
 * nobody can reach, and this one is computed by a total function we own — unlike
 * a vocabulary value such as `unknown_dish`, where the wire's type is worth
 * defending even for a case today's producer never sends.
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
 * **What is told, and when** (021 phase 5b, split in `0103`): `honourability`
 * asks the same question of the rules this person already wrote, and one
 * mechanism answers every cause — `whyNotFixable`, the same one the picker
 * explains itself with — but it answers **two different facts**, which now
 * travel in two lists. A rule the plan will not carry is `unhonoured`; a day the
 * plan carries and that will miss its four macros is `outOfBand`.
 * The causes that produce a sentence are a cooking time lowered under the dish
 * (`too_slow`), a kitchen that says it has no oven (`missing_equipment`,
 * `0102`), a dish dropped from the catalogue or an account that switched
 * language and keeps a rule its pool will never hold again (`unknown_dish`), a
 * meal the person stopped eating (`wrong_slot`). None of them was worth its own
 * machinery, which is why there is still only one. Two rules one day cannot hold
 * together used to be in that list and is not: nothing is dropped, so nothing is
 * unhonoured (`0103`).
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

  /**
   * Fixes a meal, after checking the dish is one this person could actually be
   * served there — and, since `0103`, after checking they said they accept
   * whatever the day's arithmetic costs.
   *
   * **Two bounds it does not own.** The tier's allowance and the day's cap are
   * both re-counted inside the repository's lock, in that order, and neither is
   * pre-checked here: a count read outside the lock is a race, and a sentence
   * chosen outside it is the wrong sentence for an account that has spent its
   * allowance *and* filled the day.
   *
   * **The gate, and the only one.** `consequence` exists so the sentence is read
   * before this request is sent; this is what makes it true that nothing is
   * written unwarned. It asks the question again rather than trusting the
   * client's `accept`, and it checks the reason it found against the reasons they
   * named — a named reason rather than a bare "yes", so that the day a second
   * warning exists an acceptance of the first cannot stand in for it.
   */
  async add(userId: string, rule: AddFixedMeal, accept: readonly AcceptableReason[] = []): Promise<FixedMeal> {
    const offer = await this.offerFor(userId, rule.weekday, rule.slot);

    if (offer.dayIndex === undefined) {
      // Unreachable while a plan is a fortnight: every weekday falls in it.
      throw new ConflictError('That meal does not fall in the fortnight you would generate next');
    }

    // **A full day is not refused here, and that is deliberate** (`0103`,
    // `warn-e2e`, 2026-10-16). Both bounds that can refuse this live in one
    // lock — the tier's allowance and `MAX_FIXED_MEALS_PER_DAY` — and that lock
    // asks them in the order the record fixes: "you have used all three" before
    // "that day is full", because the first is the truer sentence when both are
    // true. A fast path here would jump that order and answer 409 to a premium
    // account whose real answer is 429. There is nothing for it to buy either:
    // the repository refuses with the same domain error, not a 500, which is
    // what the sibling pre-check below exists to avoid.
    //
    // The dish is not judged for such a day for the same reason it is not
    // offered one: the offer is empty, so every verdict would read
    // `too_big_or_small`, which would be a lie about the dish.
    if (!offer.dayFull) {
      const dish = offer.library.find(each => each.slug === rule.dishSlug);
      const verdict = dish ? this.judge(offer, dish) : ({ fixable: false, why: 'unknown_dish' } as const);

      if (!verdict.fixable) {
        if (!acceptable(verdict.why)) {
          // Said before the rule exists rather than discovered once a fortnight
          // for ever, which is `0098`'s whole reason for `pinnable` being
          // exported. The reason travels in the field error so the screen says
          // which of the seven it was without asking a second route.
          throw new InputParseError('That dish cannot be fixed to that meal', { dishSlug: [verdict.why] });
        }

        if (!accept.includes(verdict.why)) {
          // Theirs to overrule, and they have not. 409 with the reason, not a
          // 422: nothing about the request was wrong (`FixedMealWarningError`).
          throw new FixedMealWarningError(verdict.why);
        }
      }
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
   *
   * **It answers what the plate allows, not what the day's numbers prefer**
   * (`0103`). A dish the day cannot hold beside the rule it already has is in
   * this list, with a warning the picker reads from `consequence` when somebody
   * touches it. That is what took the list from four seconds to about eighty
   * milliseconds on a day that already holds a rule.
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

      return { judged: false, outOfBand: [], unhonoured: [] };
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

    /** The rules the plan really will carry, by the day index they land on. */
    const served = new Map<number, { readonly rule: FixedMeal; readonly slug: string }[]>();
    /** One verdict per rule, computed once: `unhonouredFrom` reads it rather than recomputing. */
    const verdictOf = new Map<string, FixableVerdict>();

    for (const rule of rules) {
      verdictOf.set(rule.id, { fixable: true });

      if (!slots.includes(rule.slot)) {
        // They stopped eating that meal. The rule still exists and the plan
        // has no slot to honour it in.
        verdictOf.set(rule.id, { fixable: false, why: 'wrong_slot' });
        continue;
      }

      // The library is read in this person's own locale and holds what the
      // catalogue holds today, so a dish missing from it is one of the two
      // causes that take the dish away rather than the person: deleted, or
      // left behind by a change of language.
      const dish = library.find(each => each.slug === rule.dishSlug);

      if (!dish) {
        verdictOf.set(rule.id, { fixable: false, why: 'unknown_dish' });
        continue;
      }

      const [dayIndex] = daysFor(rule.weekday, defaultStart, PLAN_DAYS);

      if (dayIndex === undefined) {
        // Unreachable while a plan is a fortnight: every weekday falls in it.
        continue;
      }

      // **Without the day's arithmetic**, which is the split (`0103`): every
      // reason this can answer is one `honouredPin` really drops the pin for —
      // the dish gone from the pool, the meal they stopped eating, a plate it
      // cannot be sized into. The day's own numbers are asked below, once per
      // day, and are not a fault in any rule.
      const verdict = whyNotFixable(
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
        fitting(dayIndex, rule.slot).has(dish.slug)
      );

      verdictOf.set(rule.id, verdict);

      if (verdict.fixable) {
        served.set(dayIndex, [...(served.get(dayIndex) ?? []), { rule, slug: dish.slug }]);
      }
    }

    const outOfBand: { readonly id: string; readonly weekday: Weekday }[] = [];

    for (const [dayIndex, held] of served) {
      const [first, ...rest] = held;

      // **Once per day, and only for a day carrying more than one rule.** A lone
      // pin always holds — `honouredPin`'s three bounds are the pool, the slot
      // and the plate, all three already answered above — so there is nothing to
      // ask. The pair is one question, asked of the first against the others:
      // two calls could disagree and would cost twice (14–20 ms each, measured
      // 2026-10-16; the whole-pool form of it is 4.05 s).
      //
      // Only the rules the plan **carries** count. One whose dish left the pool
      // is not on that day at all, so including it would judge the day against a
      // meal nobody is served.
      if (
        !first ||
        rest.length === 0 ||
        dayHoldsPin(
          input,
          dayIndex,
          { slot: first.rule.slot, slug: first.slug },
          new Map(rest.map(each => [each.rule.slot, { slot: each.rule.slot, slug: each.slug }]))
        )
      ) {
        continue;
      }

      // Every rule of the day, because every one of them is served and every one
      // contributes to the miss — including the one nobody made a trade about.
      outOfBand.push(...held.map(each => ({ id: each.rule.id, weekday: each.rule.weekday })));
    }

    return { judged: true, outOfBand, unhonoured: unhonouredFrom(rules, rule => verdictOf.get(rule.id) ?? { fixable: true }) };
  }

  /**
   * Everything the two questions share: what this person may be served, and the
   * dishes `pinnable` offers for that day and meal.
   *
   * One assembly rather than two, because "what is offered" and "why this one is
   * not" have to be answers to the same question — computed apart they can
   * disagree, and the second's whole job is to explain the first.
   *
   * **The offer is the plate fit and nothing more** (`0103`). It used to be
   * narrowed by whatever the day already held, which meant `dayHolds` per
   * candidate: measured here on 2026-10-16 against the real local library — 851
   * pool dishes, 200 of them fitting the plate — that was **4.05 s**, against 16
   * ms for the plate fit alone. And what those four seconds bought was exactly
   * the refusal the owner asked to have replaced by a warning. So the day's
   * arithmetic is no longer asked of the library here; it is asked of the dish
   * somebody chose, in `judge`, and answered as something they may accept.
   *
   * `held`, `input` and `dayIndex` are still returned, because that is what
   * asking it of one dish needs.
   */
  private async offerFor(
    userId: string,
    weekday: Weekday,
    slot: MealSlot
  ): Promise<{
    readonly context: Awaited<ReturnType<typeof RecipeController.generationContext>>;
    /** That weekday already holds `MAX_FIXED_MEALS_PER_DAY`, so nothing is offered and nothing may be written (`0103`). */
    readonly dayFull: boolean;
    readonly dayIndex: number | undefined;
    /** What this weekday already has fixed, by slot — what one chosen dish is judged beside (`0101`, `0103`). */
    readonly held: ReadonlyMap<MealSlot, { readonly slot: MealSlot; readonly slug: string }>;
    readonly input: Parameters<typeof pinnable>[0] | undefined;
    /** Everything the library holds for these slots, from the same read the pool came out of. */
    readonly library: readonly CandidateDish[];
    readonly offered: readonly FixableDish[];
    readonly profile: Awaited<ReturnType<typeof ProfileController.getFullProfile>>;
    readonly slot: MealSlot;
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
      return {
        context,
        dayFull: false,
        dayIndex: undefined,
        held: new Map(),
        input: undefined,
        library,
        offered: [],
        profile,
        slot,
        slots,
        verdicts
      };
    }

    const held = heldOn(rules, weekday, slot);
    // Nothing can be fixed to a day that already holds its two, so nothing is
    // offered for it (`0103`). The offer must never list what `add` would then
    // refuse, and before `0103` it never did: the arithmetic filter collapsed a
    // third rule's offer on its own, which is why `0101` set no number.
    const offered = held.size >= MAX_FIXED_MEALS_PER_DAY ? [] : pinnable(input, dayIndex, slot);

    return {
      context,
      dayFull: held.size >= MAX_FIXED_MEALS_PER_DAY,
      dayIndex,
      held,
      input,
      library,
      offered: [...offered]
        .map((dish: CandidateDish) => ({ id: dish.slug, name: dish.name, slug: dish.slug }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      profile,
      slot,
      slots,
      verdicts
    };
  }

  /**
   * Whether this person can be served **this** dish at this meal of this
   * weekday, and why not when they cannot.
   *
   * The one oracle: the picker's explanation, the warning read before anybody
   * commits and the gate on `add` are all this function, so the three can never
   * disagree about a dish. `whyNotFixable` says the reasons in the order a
   * person would have to deal with them, and the day's arithmetic is last
   * because it is the only one that costs anything — about 20 ms, paid once,
   * and only for a dish that already fits the plate on a day that already holds
   * a rule.
   */
  private judge(offer: Awaited<ReturnType<typeof this.offerFor>>, dish: CandidateDish): FixableVerdict {
    const { context, dayIndex, held, input, offered, slot, verdicts } = offer;
    const fits = offered.some(each => each.slug === dish.slug);

    return whyNotFixable(
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
      fits,
      // Not asked when an earlier reason already answered, when the day holds
      // nothing, or when the dish does not fit the plate: in each case the day's
      // arithmetic is moot and paying for it is paying for nothing.
      !fits || held.size === 0 || !input || dayIndex === undefined ? true : dayHoldsPin(input, dayIndex, { slot, slug: dish.slug }, held)
    );
  }

  /**
   * What fixing this dish to this meal would cost, before anybody commits
   * (`0103`).
   *
   * **The shape the record's one constraint chose.** The warning has to be read
   * before the rule is written, and it must not be a dialog people learn to tap
   * through — so it is not on `POST /fixed-meals`'s refusal (read *after* they
   * committed) and not on every dish of the offer (which is the four seconds
   * this change exists to remove). It is one read of the one dish they touched,
   * which the screen can put on the row itself, the way `0102`'s appliances sit
   * on a dish.
   *
   * It is not the gate. `add` asks the same question again and refuses a warning
   * nobody accepted, so a client that skips this route cannot write a rule
   * nobody was warned about.
   *
   * A dish this person's library does not hold is answered `unknown_dish` rather
   * than an error: it is one of the nine reasons, and a screen whose search
   * raced a catalogue change should say so rather than break.
   */
  async consequence(userId: string, weekday: Weekday, slot: MealSlot, dishSlug: string): Promise<FixedMealConsequence> {
    const offer = await this.offerFor(userId, weekday, slot);

    if (offer.dayFull) {
      // Refused rather than answered with a reason, because `NotFixable` says
      // why a *dish* is not offered and a full day is not a fact about any
      // dish. Giving it a tenth reason is what would fragment the one
      // vocabulary this feature keeps.
      throw new FixedMealDayFullError(MAX_FIXED_MEALS_PER_DAY);
    }

    const dish = offer.library.find(each => each.slug === dishSlug);

    if (!dish) {
      return { acceptable: false, fixable: false, why: 'unknown_dish' };
    }

    const verdict = this.judge(offer, dish);

    return verdict.fixable ? verdict : { acceptable: acceptable(verdict.why), fixable: false, why: verdict.why };
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

    const offer = await this.offerFor(userId, weekday, slot);

    if (offer.dayFull) {
      // The reason nothing is offered is the day and not any of these dishes,
      // and this answer may only say things about dishes. The screen has that
      // day's rules already (`FixedMealsView.maxPerDay` beside them) and says
      // it without a request.
      return [];
    }

    const offeredSlugs = new Set(offer.offered.map(dish => dish.slug));
    const seen = new Set<string>();
    const reasons: NotOfferedDish[] = [];

    for (const dish of offer.library) {
      if (offeredSlugs.has(dish.slug) || seen.has(dish.slug) || !plain(dish.name).includes(needle)) {
        continue;
      }

      seen.add(dish.slug);

      // Through the same oracle as the offer and the warning, which here costs
      // nothing extra: a dish left out of the plate-fit list never reaches the
      // day's arithmetic, so `judge` stops at an earlier reason without building
      // a day. The second whole-pool `pinnable` this used to need to tell
      // `clashes_with_fixed` from `too_big_or_small` is gone with the narrowing
      // itself — a clashing dish is now **offered**, with a warning (`0103`).
      const verdict = this.judge(offer, dish);

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

    const { context, dayFull, dayIndex, input, library, profile } = await this.offerFor(userId, weekday, slot);

    if (dayFull) {
      // Before the model call, for the reason the allowance is read before it:
      // nobody pays for a dish that could not be fixed where they asked for it.
      throw new FixedMealDayFullError(MAX_FIXED_MEALS_PER_DAY);
    }

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
      // The same gate the offered list uses, on a pool of exactly this dish: it
      // has to be sizeable into that meal's plate, or it is not a dish we could
      // serve there for anybody.
      //
      // **Not judged against what the day already holds, and that is a fix**
      // (`0103`, measured 2026-10-16). `0101` passed `held` here, which made
      // `dayHolds` build the day's free slots out of a pool of two dishes — the
      // candidate and the rule's own — so it could never succeed: measured, the
      // offer came back empty for **every** candidate on a weekday holding
      // another rule, which is to say this route was dead on exactly the days
      // `0103` is about. The day's arithmetic is now asked once, of the dish
      // somebody fixes, and answered as a warning they may accept.
      if (pinnable({ ...input, pool: [candidate] }, dayIndex, slot).length === 0) {
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
