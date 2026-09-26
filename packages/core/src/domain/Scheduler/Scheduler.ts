import { composePerServing, scaleIngredients, scaleMacros, sumMacros } from 'core/domain/Composition';
import { canPlace, isPreferredDish, MAIN_SLOTS, mainProtein, nearestGap, PREFERRED_MAIN_GAP, PROTEIN_RULES, proteinCap } from 'core/domain/Variety';
import { PLAN_TOLERANCE } from 'core/domain/PlanValidation';
import type { Leaning, Placement } from 'core/domain/Variety';
import type { CandidateDish, Catalogue, Macros, MealSlot, PlanAssignment, PlanDayAssignment, ScheduledMeal, SwapAxis } from 'core/entities/Plan';
import type { NutritionTargets } from 'core/entities/Nutrition';

export const PLAN_DAYS = 14;

/**
 * Portions are quantised to quarters. A quarter portion is a thing a person can
 * serve; 1.37 servings is not, and printing it would make the plan look
 * machine-generated in the one place it most needs to look considered.
 */
const SERVING_STEP = 0.25;
// A high target over few meals needs large plates: 4,100 kcal across three meals
// is ~1,370 kcal each, and a model rarely proposes a dish that size. Refusing to
// scale past 2.5 meant refusing to plan for people who eat a lot.
export const SERVING_BOUNDS = { max: 4, min: 0.5 } as const;

/**
 * How far, in quarter servings, the portion search looks either side of the
 * size each dish was first scaled to.
 *
 * Four steps is a whole serving each way. The search is exhaustive over every
 * combination inside that window — four dishes at nine sizes each is 6,561
 * days to price, which costs nothing — so the day always leaves with the best
 * portions its dishes allow, not the first local minimum a greedy walk found
 * (`0045`). Wider than this and the sizes stop being the dish's own; narrower
 * and fat, which arrives in small grams inside a plate, cannot be steered.
 */
const BALANCE_WINDOW_STEPS = 4;

/**
 * How many portion combinations one day may price, at most.
 *
 * The search is exhaustive, so its cost is the product of every dish's sizes:
 * nine sizes each is 6,561 for four meals, 59,049 for five — and 531,441 for
 * six, which took 98 seconds to schedule one fortnight, a third of a serverless
 * function's five minutes before the model had written a dish, twice over when
 * a plan is scheduled again (`0046`). So the window
 * is shared out under a ceiling (`windowsFor`): every day of five meals or
 * fewer keeps the whole window it always had, and a sixth meal narrows the
 * light ones first, where a quarter serving moves the day least.
 */
const BALANCE_MAX_COMBOS = 59_049;

/**
 * The same ceiling inside the spread pass, which sizes two days for every
 * exchange it prices and may price hundreds. A four-meal day's whole search.
 */
const SPREAD_MAX_COMBOS = 6561;

/**
 * The portion search may size any meal freely, but may never make a meal
 * bigger than one the person said should be bigger (`0036`).
 *
 * A soft penalty on every meal's drift from its share was tried first, and it
 * traded the thing that matters: at a weight that kept a light dinner smaller
 * than lunch it also pulled protein and fat back outside 5% on a real library.
 * The promise is not "each meal within a few per cent of its share" — the
 * person did not ask for that — it is that a light dinner is lighter than a
 * normal lunch, a large lunch larger than a normal one. So the cost is a
 * hinge: nothing while the order holds, and steep once it breaks, so the
 * search is free inside the order and cannot leave it.
 *
 * Only pairs whose shares differ by more than `SHARE_ORDER_GAP` are ordered.
 * The default weights put lunch at 0.33 and dinner at 0.30, and nobody chose
 * that; light against normal is a factor of two, and that they did.
 *
 * The hinge is a step plus the gap, not the gap alone. Priced by the gap, an
 * inversion of twelve calories on a light dinner cost 0.016 and the search
 * paid it gladly for a slightly better fit — the end-to-end suite caught a
 * "light" dinner twelve calories over the lunch beside it. A fixed cost for
 * the fact of inverting, at this weight, is more than any few per cent of
 * macro fit can buy, so the best combination that keeps the order always wins
 * over any that breaks it.
 */
const SHARE_ORDER_GAP = 0.2;
const SHARE_INVERSION_WEIGHT = 2;

/**
 * How far one meal may stray from its share of the day, as a fraction of the
 * energy its share gives it (`0051`).
 *
 * The hinge above keeps a light meal lighter than a normal one, and only
 * where two shares differ by a fifth. Lunch and dinner at their default
 * weights do not, so between them the portion search was free, and a real
 * plan used all of it: a 388-kcal lunch beside a 1,247-kcal dinner, and
 * another day the other way round — every day on its macros, none of them the
 * day the person set. So a meal outside the band costs: nothing inside it, the
 * distance outside.
 *
 * The distance alone, not a step and the distance as the order's hinge has. A
 * step made the band a wall, and on a pool of a few plain dishes — the
 * end-to-end suite's — the wall held a day 10% off its energy rather than let
 * one plate a little past its share. The shape is how a day should feel; the
 * macros are the promise.
 */
export const SHARE_BAND = { max: 1.4, min: 0.7 } as const;

/**
 * What each point of a meal's share outside `SHARE_BAND` costs, in fit. A
 * meal at half its share costs 0.2 — far more than the few points of fit a
 * free portion search trades a day's shape for, so on a real library every
 * meal stays inside; less than a day several points off its macros, so a pool
 * that cannot land them in band lets a plate out instead. In the spread pass
 * it is further outranked by every macro band (`BAND_MISS_WEIGHT`).
 */
const SHARE_BAND_WEIGHT = 1;

/**
 * The fortnight pass that spreads what a day could not fix on its own across
 * the days that have room for it (`0048`).
 *
 * Days are built in order, and each dish may appear twice a plan, so the
 * dishes that fit a person best are spent in the first week and the last days
 * are built from what is left. On a real plan that was protein: days one to
 * ten inside a point of target, days eleven to fourteen 7–19% over — while the
 * fortnight's surplus, spread evenly, was under 4% a day. No choice inside one
 * day can move that; an exchange between two days can. So once every day is
 * built, the day furthest outside its bands trades a meal with the same meal
 * of another day, both re-sized, whenever that leaves the two days with fewer
 * macros outside their bands — or as many, less far outside (`bandMiss`).
 *
 * Rounds are bounded, and each is two-stage like the day's own swaps: every
 * exchange is screened at its first sizes, and only the most promising
 * `SPREAD_SHORTLIST` are re-sized properly.
 */
const MAX_SPREAD_ROUNDS = 60;
const SPREAD_SHORTLIST = 24;

/**
 * Inside the spread pass, what a day pays for each point a macro sits outside
 * its band, on top of its ordinary fit — so the portions of a day being
 * repaired are sized to bring every macro inside first, and to fit closely
 * second. Not used while days are first built: there, pricing the band made
 * each day take the dishes that fit best and left the last days nothing,
 * measured worse on a real library.
 */
const BAND_MISS_WEIGHT = 10;

/**
 * What an inverted meal costs while the spread pass sizes a day to its bands:
 * more than every band of the day together can.
 *
 * The bands are priced steeply there, and at the ordinary inversion weight
 * they won — the end-to-end suite caught a "light" dinner of 1,475 kcal
 * beside a large lunch of 738, a day brought inside its bands by serving the
 * person's day back to front. The size order is something they chose; the
 * bands are something we promised. Theirs comes first.
 */
const ORDER_OUTRANKS_BANDS = 1000;

/**
 * What a day under the energy floor costs while it is being sized: more than
 * anything else about the day can save, the order of its meals included.
 *
 * The floor was validation's alone, and the scheduler aimed at the target with
 * a band either side. For most people the two never meet. For somebody light
 * and sedentary who asks for a fast pace they are the same number — the target
 * is clamped *to* the floor — and a day at 1,190 against 1,200 is a fine fit
 * and a blocking violation at once. Measured on the real library: fourteen days
 * of fourteen inside 5% on every macro, nine of them thrown away, so the plan
 * was, and the full-library retry aimed the same way and failed the same way.
 *
 * So it is a wall and not a band: a meal out of order is a plan the person can
 * eat, a day under the floor is one they are never given. It costs nothing to a
 * day that is over the floor at every size it could take, which is every day of
 * every plan whose target is not within a few points of it.
 */
const FLOOR_OUTRANKS_ORDER = 1_000_000;

/** Swap rounds per day. Each takes the single best improvement; they converge fast. */
const MAX_SWAP_ROUNDS = 8;

/**
 * How close two fit costs must be to count as the same fit.
 *
 * `fitCost` sums relative errors, so this is five points of one — a difference
 * no eater could taste, and small enough that nutrition still decides whenever
 * it has anything to say.
 */
const FIT_TIE = 0.05;

/**
 * What serving a main protein again costs (`PROTEIN_RULES`), in the units of
 * fit — about three points of energy, or five of protein. Enough that another
 * dish wins whenever it fits nearly as well; never enough to hold a day off
 * its macros. Priced rather than refused because a pool can be a few proteins
 * throughout: refused, on the end-to-end suite's three-protein pool, the
 * repeats went and a day landed 10% off its energy with them.
 */
const PROTEIN_REPEAT_WEIGHT = 0.05;

/**
 * The same inside the spread pass, where a macro brought inside its band is
 * worth one: half that. An exchange that only moves a macro closer does not
 * buy a repeat; one that brings a macro inside does.
 */
const SPREAD_REPEAT_WEIGHT = 0.5;

/**
 * What choosing a dish already served elsewhere in the plan costs, in fit —
 * the same weight and the same reasoning as `PROTEIN_REPEAT_WEIGHT`: enough
 * that a new dish wins whenever it fits nearly as well, never enough to hold
 * a day off its macros (owner, 2026-09-26 — "a dish repeats only when the
 * pool has no fitting alternative that keeps the day inside 5%").
 *
 * Priced, not refused, because `pickBest`'s usage-first ordering already
 * keeps a first choice from repeating whenever the pool has an unused dish
 * to offer; this is what the *repair* passes (`improveDay`) were missing —
 * a swap toward a better-fitting dish already used twice elsewhere cost the
 * same as a swap toward one that had never been served, so on a fortnight
 * whose daily targets barely move, the search converged on the same handful
 * of best-fitting dishes for every day it touched (`0065`).
 */
const DISH_REPEAT_WEIGHT = 0.05;

/**
 * On top of `DISH_REPEAT_WEIGHT`, for every day short of `PREFERRED_MAIN_GAP`
 * a repeated main (`MAIN_SLOTS`) lands from its nearest other serving — small
 * on purpose: this only breaks a tie between two repeats of the *same* dish
 * at different distances, never between a repeat and a new dish, which
 * `DISH_REPEAT_WEIGHT` alone already decides.
 */
const MAIN_GAP_SHORTFALL_WEIGHT = 0.01;

/**
 * What placing this dish again costs: nothing for its first serving anywhere
 * in the plan, `DISH_REPEAT_WEIGHT` for a repeat, and more still the closer a
 * repeated main lands to its other serving (`MAIN_GAP_SHORTFALL_WEIGHT`).
 * `placed` is the rest of the plan, this dish's own day (if already chosen)
 * excluded by the caller the way every other repeat cost here is.
 */
function reuseCost(dishSlug: string, slot: MealSlot, dayIndex: number, placed: readonly Placement[]): number {
  const gap = nearestGap(dishSlug, dayIndex, placed);

  if (gap === null) {
    return 0;
  }

  const mainShortfall = MAIN_SLOTS.has(slot) ? Math.max(0, PREFERRED_MAIN_GAP - gap) * MAIN_GAP_SHORTFALL_WEIGHT : 0;

  return DISH_REPEAT_WEIGHT + mainShortfall;
}

/** `reuseCost`, summed over a whole day's picks against the rest of the plan. */
function dayReuseCost(picks: readonly Pick[], dayIndex: number, placed: readonly Placement[]): number {
  return picks.reduce((sum, pick) => sum + reuseCost(pick.dish.slug, pick.slot, dayIndex, placed), 0);
}

export type SchedulerInput = {
  readonly catalogue: Catalogue;
  /**
   * Which days to lay out. Defaults to the whole fortnight, `1..days`.
   *
   * Given a subset, only those days are built and returned — that is what a
   * mid-plan rebuild needs (`0044`): an event declared on Tuesday touches three
   * days of a plan whose other eleven are already being lived, and rebuilding
   * the eleven would throw away meals somebody had already shopped for.
   */
  readonly dayIndexes?: readonly number[];
  readonly days?: number;
  /**
   * Days that eat for something (`0043`), by day index, with the targets they
   * eat to. Every other day uses `targets`. Kept as an override map rather than
   * a per-day array so a caller with no events passes nothing and the fortnight
   * is what it always was.
   */
  readonly dayTargets?: ReadonlyMap<number, NutritionTargets>;
  /**
   * The energy no day may be sized under — `minimumDailyKcal` of the person's
   * sex, the number validation blocks on. Required, not defaulted: a caller
   * that forgot it would schedule plans validation then throws away, which is
   * the bug this field exists for (`FLOOR_OUTRANKS_ORDER`).
   */
  readonly minimumKcal: number;
  /**
   * What is already on the plate and is *not* being laid out again.
   *
   * The variety rules are enforced against these exactly as against the days
   * this call places, so a rebuilt Tuesday cannot serve the same dish the
   * untouched Monday does. Empty for a generation, which starts with nothing.
   */
  readonly placed?: readonly Placement[];
  readonly pool: readonly CandidateDish[];
  readonly targets: NutritionTargets;
  /** Each eaten slot's share of the day, unnormalised — see `weightsFor` (`0036`). */
  readonly weights: ReadonlyMap<MealSlot, number>;
};

/** What a given day is built to hit: its own targets if it eats for something, the plan's otherwise. */
function targetsOn(input: SchedulerInput, dayIndex: number): NutritionTargets {
  return input.dayTargets?.get(dayIndex) ?? input.targets;
}

export type SchedulerShortfall = {
  readonly available: number;
  readonly dayIndex: number;
  readonly reason: 'insufficient_pool';
  readonly slot: MealSlot;
};

export type ScheduleResult =
  { readonly assignment: PlanAssignment; readonly ok: true } | { readonly ok: false; readonly shortfall: SchedulerShortfall };

/**
 * Assigns pool dishes across the fortnight.
 *
 * Deterministic by construction: candidates are ranked by how close their
 * per-serving macros sit to the slot's budget — energy, protein, carbs and fat
 * all four — ties broken by usage then by the pool's own order (`0009`). The
 * same input always produces the same plan, which is what makes the scheduler
 * testable and a failed generation reproducible.
 *
 * Variety is *prevented*, not detected — `canPlace` gates every placement, so a
 * finished assignment cannot contain a violation.
 */
export function schedulePlan(input: SchedulerInput): ScheduleResult {
  const days = input.days ?? PLAN_DAYS;
  const slots = [...input.weights.keys()];
  const perServing = perServingIndex(input.pool, input.catalogue);
  const proteins = proteinIndex(input.pool, input.catalogue);
  // Over the whole fortnight, even when only some of its days are laid out here.
  const cap = proteinCap(slots.length * days);
  const indexes = input.dayIndexes ?? Array.from({ length: days }, (_none, offset) => offset + 1);

  // The days that are not being laid out go in first, so every `canPlace` below
  // sees the whole plan rather than only the part of it this call is building.
  const placed: Placement[] = [...(input.placed ?? [])];
  const built: BuiltDay[] = [];

  for (const dayIndex of indexes) {
    // Per day rather than once: a day that eats for an event has its own targets
    // (`0043`), and the budgets are what turn targets into a plate.
    const targets = targetsOn(input, dayIndex);
    const budgets = slotBudgets(input.weights, targets);

    const picks: { base: Macros; dish: CandidateDish; servings: number; slot: MealSlot; sortOrder: number }[] = [];

    for (const [sortOrder, slot] of slots.entries()) {
      const budget = budgets.get(slot) ?? { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 };
      const eligible = input.pool
        .filter(dish => dish.slots.includes(slot))
        .filter(dish => perServing.has(dish.slug))
        .filter(dish => canPlace(dish.slug, slot, dayIndex, placed));

      const chosen = pickBest(eligible, budget, perServing, placed, dayIndex, slot, slug => crowded(slug, { dayIndex, slot }, placed, proteins, cap));

      if (!chosen) {
        return {
          ok: false,
          shortfall: { available: input.pool.filter(dish => dish.slots.includes(slot)).length, dayIndex, reason: 'insufficient_pool', slot }
        };
      }

      const base = perServing.get(chosen.slug) as NonNullable<ReturnType<typeof perServing.get>>;

      picks.push({ base, dish: chosen, servings: servingsFor(base, budget), slot, sortOrder });
      placed.push({ dayIndex, dishSlug: chosen.slug, slot });
    }

    const improved = improveDay(picks, input, dayIndex, placed, budgets, { cap, proteins });

    // Swapping changed what this day holds, so the placement record must follow or
    // later days would enforce variety against dishes that are no longer served.
    for (let index = placed.length - picks.length; index < placed.length; index += 1) {
      const replacement = improved[index - (placed.length - picks.length)];

      if (replacement) {
        placed[index] = { dayIndex, dishSlug: replacement.dish.slug, slot: replacement.slot };
      }
    }

    built.push({ budgets, dayIndex, picks: balanceDay(improved, targets, budgets, input.minimumKcal), targets });
  }

  const spread = spreadAcrossDays(built, input.placed ?? [], proteins, input.minimumKcal);
  const distinct = enforceDistinctDays(spread, input, input.placed ?? [], proteins, cap);

  const assignedDays: PlanDayAssignment[] = distinct.map(day => {
    const meals: ScheduledMeal[] = day.picks.map(pick => ({
      dish: pick.dish,
      ingredients: scaleIngredients(pick.dish.ingredients, pick.servings / pick.dish.servings),
      macros: scaleMacros(pick.base, pick.servings),
      servings: pick.servings,
      slot: pick.slot,
      sortOrder: pick.sortOrder
    }));

    return { dayIndex: day.dayIndex, meals, totals: sumMacros(meals.map(meal => meal.macros)) };
  });

  return { assignment: { days: assignedDays }, ok: true };
}

export type SlotBudget = { readonly carbsG: number; readonly fatG: number; readonly kcal: number; readonly proteinG: number };

export type Replacement = {
  readonly dish: CandidateDish;
  readonly ingredients: readonly { readonly grams: number; readonly slug: string }[];
  readonly macros: Macros;
  readonly servings: number;
};

/**
 * A favourite goes first only if it lands near the budget — this much fit cost
 * is roughly 20 % off on energy alone, or a smaller miss spread across energy
 * and composition. Past that, a favourite is the wrong dish for this slot
 * however much the person likes it, and the fit decides.
 */
const PREFERRED_FIT_TOLERANCE = 0.35;

/**
 * The best dish in `pool` for one slot of one day, judged exactly as the
 * scheduler judges: scaled to the budget, then by how close its macros land.
 * `placed` is the rest of the plan with the meal being replaced taken out, so the
 * variety rules hold after the swap as they did before it. Undefined when nothing
 * fits — the caller then asks the model for something new
 * ([`0015`](../../../../docs/decisions/0015-one-redo-a-fortnight-five-swaps-a-plan.md)).
 */
export function pickReplacement(input: {
  readonly budget: SlotBudget;
  readonly catalogue: Catalogue;
  readonly dayIndex: number;
  /** What the person asked of the swap, as a test every candidate must pass — see `axisFilter`. */
  readonly filter?: (dish: CandidateDish, perServing: Macros) => boolean;
  /** What they lean towards: dishes by name, kitchens, foods they like (0026). */
  readonly leaning?: Leaning;
  readonly placed: readonly Placement[];
  /**
   * The least energy this plate may carry: the person's floor, less what the
   * day's other meals deliver. Zero or less for a day the rest of which clears
   * the floor alone, which is nearly everybody's. Required, like the scheduler's
   * `minimumKcal`, and for the same reason.
   *
   * A swap sizes the new dish to the old plate in quarter servings, so it lands a
   * little under or over it. For a day built just over the floor — which is where
   * `FLOOR_OUTRANKS_ORDER` leaves the days of somebody whose target *is* the
   * floor — a little under is under the floor: 1,203.5 became 1,163.5 on a
   * 400-kcal plate swapped for a dish of 360 a serving, and nothing validates a
   * day after generation. So the plate is served a quarter larger until the day
   * clears, and a dish that cannot get there at any size a person can be served
   * is not a candidate.
   */
  readonly plateMinimumKcal: number;
  readonly pool: readonly CandidateDish[];
  readonly slot: MealSlot;
}): Replacement | undefined {
  const perServing = perServingIndex(input.pool, input.catalogue);

  const passes = (dish: CandidateDish): boolean => {
    const base = perServing.get(dish.slug);

    return base !== undefined && plateKcal(base, SERVING_BOUNDS.max) >= input.plateMinimumKcal && (input.filter?.(dish, base) ?? true);
  };

  const costOf = (slug: string): number => {
    const base = perServing.get(slug);

    return base ? scaledFitCost(base, input.budget) : Number.MAX_VALUE;
  };

  const rank = (dish: CandidateDish): number =>
    input.leaning !== undefined && isPreferredDish(dish, input.leaning) && costOf(dish.slug) <= PREFERRED_FIT_TOLERANCE ? 0 : 1;

  const dish = input.pool
    .filter(
      candidate => candidate.slots.includes(input.slot) && passes(candidate) && canPlace(candidate.slug, input.slot, input.dayIndex, input.placed)
    )
    .sort((a, b) => rank(a) - rank(b) || costOf(a.slug) - costOf(b.slug) || a.slug.localeCompare(b.slug))
    .at(0);
  const base = dish ? perServing.get(dish.slug) : undefined;

  if (!dish || !base) {
    return undefined;
  }

  let servings = servingsFor(base, input.budget);

  // Ends: `passes` kept only dishes that reach it at the largest size.
  while (plateKcal(base, servings) < input.plateMinimumKcal && servings < SERVING_BOUNDS.max) {
    servings = roundServings(servings + SERVING_STEP);
  }

  return { dish, ingredients: scaleIngredients(dish.ingredients, servings / dish.servings), macros: scaleMacros(base, servings), servings };
}

/** One plate's energy as it is stored and summed — `scaleMacros`' rounding, see `deliveredKcal`. */
function plateKcal(perServing: Macros, servings: number): number {
  return Math.round(perServing.kcal * servings * 10) / 10;
}

/** "More protein" means this much more protein per calorie than the dish being replaced. */
const MORE_PROTEIN_FACTOR = 1.2;

/** What "vegetarian" takes off a plate. Eggs and dairy are not on this list, on purpose. */
const MEATY: ReadonlySet<string> = new Set(['fish', 'meat', 'pork', 'shellfish']);

/**
 * The test a candidate must pass for what the person asked of the swap
 * (0022), judged against the dish being replaced. Undefined when nothing was
 * asked — every candidate passes.
 *
 * - `quicker`: less time in total, prep and cooking, than the current dish.
 * - `no_cooking`: no cooking at all.
 * - `more_protein`: clearly more protein per calorie, so that scaled to the
 *   same energy the plate carries more protein.
 * - `vegetarian`: no meat, no fish, no shellfish — read from the catalogue's
 *   classes, never from the dish's name. Eggs and dairy stay, which is what the
 *   word means; someone who wants neither says so on their profile.
 */
export function axisFilter(
  axis: SwapAxis | undefined,
  current: { readonly cookMinutes: number; readonly macros: Macros; readonly prepMinutes: number },
  catalogue?: Catalogue
): ((dish: CandidateDish, perServing: Macros) => boolean) | undefined {
  if (axis === undefined) {
    return undefined;
  }

  const currentMinutes = current.prepMinutes + current.cookMinutes;
  const currentDensity = current.macros.kcal > 0 ? current.macros.proteinG / current.macros.kcal : 0;

  switch (axis) {
    case 'quicker':
      return dish => dish.prepMinutes + dish.cookMinutes < currentMinutes;
    case 'no_cooking':
      return dish => dish.cookMinutes === 0;
    case 'more_protein':
      return (_dish, perServing) => perServing.kcal > 0 && perServing.proteinG / perServing.kcal >= currentDensity * MORE_PROTEIN_FACTOR;
    case 'vegetarian':
      // No catalogue, no claim: without it nothing can be told apart, and a
      // filter that lets everything through would answer the request with meat.
      return catalogue === undefined
        ? () => false
        : dish =>
            dish.ingredients.every(item => {
              const ingredient = catalogue.get(item.slug);

              return ingredient !== undefined && !ingredient.classes.some(cls => MEATY.has(cls));
            });
  }
}

/**
 * Normalised budget per slot, so the weights work for any slot subset.
 *
 * Protein is budgeted alongside energy because validation checks both. Scaling a
 * portion changes a dish's calories and its protein by the same factor, so a
 * plan's protein is decided entirely at *selection* time — an energy-only
 * scheduler cannot correct for a carb-heavy pool afterwards, and every plan it
 * builds from one is rejected.
 *
 * Carbs and fat are budgeted the same way, for the reason protein was: a real
 * dish's energy is not free to land wherever, it comes as some mix of carbs,
 * protein and fat, and scaling a portion moves all four together. A scheduler
 * that only watched kcal and protein could hit both while carbs and fat drifted
 * however the pool happened to be built — which is exactly what real Spanish
 * dishes did, meat- and fish-heavy and starch-light, delivering a day short on
 * carbohydrate and over on fat by up to half, with nothing anywhere to catch it
 * because validation never checked the split either. Found on a real plan, not
 * in a test (`0045`).
 */
function slotBudgets(weights: ReadonlyMap<MealSlot, number>, targets: NutritionTargets): ReadonlyMap<MealSlot, SlotBudget> {
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0) || 1;

  return new Map(
    [...weights].map(([slot, weight]) => [
      slot,
      {
        carbsG: (targets.carbsG * weight) / total,
        fatG: (targets.fatG * weight) / total,
        kcal: (targets.kcal * weight) / total,
        proteinG: (targets.proteinG * weight) / total
      }
    ])
  );
}

/**
 * How well a dish fits a slot **once scaled to it**.
 *
 * Judging a candidate at one serving compares its raw size to the budget, and size
 * is the one thing scaling fixes for free — so that ranking preferred a
 * wrong-ratio dish of the right size over a right-ratio dish of the wrong size,
 * which is precisely backwards. Scaling first neutralises size and leaves the
 * comparison to be about composition, which is what cannot be fixed later.
 */
function scaledFitCost(perServing: Macros, budget: SlotBudget): number {
  return fitCost(scaleMacros(perServing, servingsFor(perServing, budget)), budget);
}

/** The portion that best meets the slot's energy, within what a person can be served. */
function servingsFor(perServing: Macros, budget: SlotBudget): number {
  return quantiseServings(perServing.kcal > 0 ? budget.kcal / perServing.kcal : 1);
}

/** How far a dish sits from a budget, as a sum of relative errors. */
function fitCost(macros: Macros, budget: SlotBudget): number {
  const energy = budget.kcal > 0 ? Math.abs(macros.kcal - budget.kcal) / budget.kcal : 0;
  const protein = budget.proteinG > 0 ? Math.abs(macros.proteinG - budget.proteinG) / budget.proteinG : 0;
  const carbs = budget.carbsG > 0 ? Math.abs(macros.carbsG - budget.carbsG) / budget.carbsG : 0;
  const fat = budget.fatG > 0 ? Math.abs(macros.fatG - budget.fatG) / budget.fatG : 0;

  // Energy and protein keep their weights (10%/15% tolerance → 1.5/1, by
  // 1/tolerance normalised on protein's). Carbs and fat are new (`0045`) and
  // looser — 20% tolerance each, the same scale gives 0.75 — because a day's
  // carb/fat split is more a matter of what dishes exist than protein is, and
  // this is meant to steer the split, not police it to the gram. Before this,
  // carbs and fat were not fitted at all: two dishes tying on kcal and protein
  // were indistinguishable here however differently they spent that energy,
  // which is what let a whole pool's fat-heavy lean pass through every check
  // unnoticed.
  return energy * 1.5 + protein + carbs * 0.75 + fat * 0.75;
}

/**
 * Per-serving macros for every dish whose ingredients all resolve. A dish
 * referencing an unknown slug is silently absent rather than crashing the
 * scheduler — the pool builder in phase 3 is what rejects and retries those, and
 * by the time a pool reaches here it should contain none.
 */
function perServingIndex(pool: readonly CandidateDish[], catalogue: Catalogue) {
  const index = new Map<string, ReturnType<typeof scaleMacros>>();

  for (const dish of pool) {
    const composed = composePerServing(dish, catalogue);

    if (composed.ok) {
      index.set(dish.slug, composed.macros);
    }
  }

  return index;
}

/** Each pool dish's main protein, by slug — see `mainProtein`. */
type ProteinIndex = ReadonlyMap<string, string | null>;

function proteinIndex(pool: readonly CandidateDish[], catalogue: Catalogue): ProteinIndex {
  return new Map(pool.map(dish => [dish.slug, mainProtein(dish, catalogue)]));
}

/** A day's meal as the protein rules see it: its main protein, and which meal it is. */
type ProteinMeal = { readonly protein: string | null; readonly slot: MealSlot };

/** Meals per main protein over a plan, and within each meal of it, keyed `slot:protein`. */
type ProteinCounts = { readonly bySlot: ReadonlyMap<string, number>; readonly plan: ReadonlyMap<string, number> };

const NO_PROTEIN_COUNTS: ProteinCounts = { bySlot: new Map(), plan: new Map() };

/** Meals per main protein in these placements. A dish from outside the pool counts for nothing. */
function proteinCounts(placements: readonly Placement[], proteins: ProteinIndex): ProteinCounts {
  const plan = new Map<string, number>();
  const bySlot = new Map<string, number>();

  for (const placement of placements) {
    const protein = proteins.get(placement.dishSlug);

    if (protein) {
      plan.set(protein, (plan.get(protein) ?? 0) + 1);
      bySlot.set(`${placement.slot}:${protein}`, (bySlot.get(`${placement.slot}:${protein}`) ?? 0) + 1);
    }
  }

  return { bySlot, plan };
}

/**
 * How many of one day's meals break `PROTEIN_RULES`, given the rest of the
 * plan — each meal once per rule it breaks: a repeat inside the day, a meal
 * past the fortnight's cap, a meal past the three its slot may have.
 *
 * Counted by the meal, never by how far the plan is already over. Summed as the
 * overshoot, a slot six hake dinners past its line made one more hake cost as
 * much as four repeats — enough to buy a day 10% off its energy on the
 * end-to-end suite's three-protein dinners. A meal over the line is one meal.
 */
function proteinExcess(day: readonly ProteinMeal[], elsewhere: ProteinCounts, cap: number): number {
  const counts = new Map<string, number>();
  let excess = 0;

  for (const { protein, slot } of day) {
    if (protein) {
      counts.set(protein, (counts.get(protein) ?? 0) + 1);
      // A day has one meal per slot, so this meal is the slot's only addition.
      excess += (elsewhere.bySlot.get(`${slot}:${protein}`) ?? 0) >= PROTEIN_RULES.perSlot ? 1 : 0;
    }
  }

  for (const [protein, count] of counts) {
    const room = Math.max(0, cap - (elsewhere.plan.get(protein) ?? 0));

    excess += Math.max(0, count - PROTEIN_RULES.perDay) + Math.max(0, count - room);
  }

  return excess;
}

/** Whether this dish would repeat a main protein the day already has, or pass its fortnight's or its meal's allowance. */
function crowded(
  slug: string,
  at: { readonly dayIndex: number; readonly slot: MealSlot },
  placed: readonly Placement[],
  proteins: ProteinIndex,
  cap: number
): boolean {
  const protein = proteins.get(slug);

  if (!protein) {
    return false;
  }

  let today = 0;
  let inPlan = 0;
  let inSlot = 0;

  for (const placement of placed) {
    if (proteins.get(placement.dishSlug) === protein) {
      inPlan += 1;
      today += placement.dayIndex === at.dayIndex ? 1 : 0;
      inSlot += placement.slot === at.slot ? 1 : 0;
    }
  }

  return today >= PROTEIN_RULES.perDay || inPlan >= cap || inSlot >= PROTEIN_RULES.perSlot;
}

/**
 * Least-used first, then closest fit, then slug.
 *
 * Ranking on fit alone is the obvious implementation and it is wrong: it spends
 * the best-fitting dishes in the first few days and leaves the fortnight's tail
 * to whatever is left, so day 14 misses its target by hundreds of calories. A
 * test caught exactly that. Usage-first spreads the pool evenly, which both
 * keeps late days in band and makes the plan read as varied rather than
 * front-loaded.
 */
function pickBest(
  eligible: readonly CandidateDish[],
  budget: SlotBudget,
  perServing: ReadonlyMap<string, Macros>,
  placed: readonly Placement[],
  dayIndex: number,
  slot: MealSlot,
  crowds: (slug: string) => boolean
): CandidateDish | undefined {
  // A dish that would repeat a main protein is priced as fitting that much
  // worse (`PROTEIN_REPEAT_WEIGHT`): another dish wins if it fits nearly as
  // well, and the repeat is served when nothing does. A dish already served
  // elsewhere in the plan carries the same kind of cost (`DISH_REPEAT_WEIGHT`)
  // — usage already sorts a first-served dish ahead of a repeat, so this only
  // ever breaks a tie between two dishes at the same usage count, one of
  // which sits closer to `PREFERRED_MAIN_GAP` than the other.
  const repeatCost = new Map(
    eligible.map(dish => [dish.slug, (crowds(dish.slug) ? PROTEIN_REPEAT_WEIGHT : 0) + reuseCost(dish.slug, slot, dayIndex, placed)])
  );
  const usage = new Map<string, number>();
  // Where each dish sat in the pool handed to the scheduler, which is the order
  // rotation shuffled for this user.
  const order = new Map(eligible.map((dish, index) => [dish.slug, index]));

  for (const placement of placed) {
    usage.set(placement.dishSlug, (usage.get(placement.dishSlug) ?? 0) + 1);
  }

  return [...eligible]
    .sort((a, b) => {
      const used = (usage.get(a.slug) ?? 0) - (usage.get(b.slug) ?? 0);

      if (used !== 0) {
        return used;
      }

      const first = perServing.get(a.slug);
      const second = perServing.get(b.slug);
      const costA = (first ? scaledFitCost(first, budget) : Number.MAX_VALUE) + (repeatCost.get(a.slug) ?? 0);
      const costB = (second ? scaledFitCost(second, budget) : Number.MAX_VALUE) + (repeatCost.get(b.slug) ?? 0);

      /*
       * Two dishes that fit this budget equally well are decided by the order
       * the pool arrived in — which is this user's own seeded shuffle (`0009`).
       *
       * It used to be the alphabet, and that was the bug two users reported as
       * "we got the same plan": the pool is shuffled per person, but sorting it
       * again by fit and then by slug threw that away, so the best-fitting dish
       * on the shelf landed on day one of everybody drawing from it. Their
       * fortnights differed; their first days did not.
       */
      return Math.abs(costA - costB) > FIT_TIE ? costA - costB : (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0);
    })
    .at(0);
}

type Pick = { readonly base: Macros; readonly dish: CandidateDish; readonly servings: number; readonly slot: MealSlot; readonly sortOrder: number };

/**
 * Each dish's window, in quarter steps, under a ceiling on the combinations
 * the day will price — see `BALANCE_MAX_COMBOS`.
 *
 * Grown a step at a time, biggest meal first, round after round, until the
 * next step would pass the ceiling or every window is whole. So the windows
 * stay even, and when they cannot all be whole it is the lighter meals that
 * are sized more coarsely. Deterministic: ties keep slot order.
 */
function windowsFor(picks: readonly Pick[], budgets: ReadonlyMap<MealSlot, SlotBudget>, maxCombos: number): number[] {
  const order = picks.map((pick, index) => ({ index, kcal: budgets.get(pick.slot)?.kcal ?? 0 })).sort((a, b) => b.kcal - a.kcal || a.index - b.index);
  const windows = picks.map(() => 0);
  let combos = 1;
  let grew = true;

  while (grew) {
    grew = false;

    for (const { index } of order) {
      const window = windows[index] ?? 0;
      const next = (combos / (2 * window + 1)) * (2 * window + 3);

      if (window < BALANCE_WINDOW_STEPS && next <= maxCombos) {
        windows[index] = window + 1;
        combos = next;
        grew = true;
      }
    }
  }

  return windows;
}

/**
 * How far a day's portions break the order of its meals' sizes — zero while a
 * meal the person said should be bigger is bigger (`SHARE_ORDER_GAP`). At the
 * sizes given, or each pick's own.
 */
function inversionsOf(picks: readonly Pick[], budgets: ReadonlyMap<MealSlot, SlotBudget>, servings: readonly number[] = []): number {
  let inversions = 0;

  for (const [i, bigger] of picks.entries()) {
    const biggerBudget = budgets.get(bigger.slot)?.kcal ?? 0;

    for (const [j, smaller] of picks.entries()) {
      const smallerBudget = budgets.get(smaller.slot)?.kcal ?? 0;

      if (i === j || biggerBudget <= 0 || biggerBudget < smallerBudget * (1 + SHARE_ORDER_GAP)) {
        continue;
      }

      const biggerKcal = bigger.base.kcal * (servings[i] ?? bigger.servings);
      const smallerKcal = smaller.base.kcal * (servings[j] ?? smaller.servings);

      // Level counts as out of order: a light dinner the size of the normal
      // breakfast is not lighter. With `SHARE_BAND` pulling every meal towards
      // its share, two meals of one dish landed on exactly the same size.
      if (smallerKcal >= biggerKcal) {
        inversions += 1 + (smallerKcal - biggerKcal) / biggerBudget;
      }
    }
  }

  return inversions;
}

/**
 * How far a day's portions take its meals outside `SHARE_BAND` — zero while
 * every meal is inside. At the sizes given, or each pick's own.
 */
function straysOf(picks: readonly Pick[], budgets: ReadonlyMap<MealSlot, SlotBudget>, servings: readonly number[] = []): number {
  let strays = 0;

  for (const [index, pick] of picks.entries()) {
    const budget = budgets.get(pick.slot)?.kcal ?? 0;

    if (budget <= 0) {
      continue;
    }

    const share = (pick.base.kcal * (servings[index] ?? pick.servings)) / budget;

    if (share < SHARE_BAND.min) {
      strays += SHARE_BAND.min - share;
    } else if (share > SHARE_BAND.max) {
      strays += share - SHARE_BAND.max;
    }
  }

  return strays;
}

/**
 * Sizes a day's portions to its targets, a quarter serving at a time — every
 * combination, not a walk.
 *
 * Each slot's serving is first quantised independently against its own share
 * of the day, so four slots each rounding a little the same way can put the
 * day well outside its band. This used to correct that greedily: one quarter
 * step per pass, whichever helped most, until a pass helped nothing. Greedy
 * stops at the first local minimum, and with four macros to satisfy at once
 * there are many — a day that could have landed inside 5% on everything sat at
 * 8% on fat because no single quarter step improved the sum, though a pair of
 * opposite steps on two dishes would have. So the search is now exhaustive
 * inside a window around each dish's starting size (`BALANCE_WINDOW_STEPS`),
 * and the day takes the combination with the lowest cost.
 *
 * Deterministic: combinations are visited in slot order, and a tie keeps the
 * earlier one, so the same day always sizes the same way.
 */
function balanceDay(
  picks: readonly Pick[],
  targets: NutritionTargets,
  budgets: ReadonlyMap<MealSlot, SlotBudget>,
  minimumKcal: number
): readonly Pick[] {
  return balancedDay(picks, targets, budgets, minimumKcal).picks;
}

/** `balanceDay`, and what the day costs once sized — the number a swap is judged by. */
function balancedDay(
  picks: readonly Pick[],
  targets: NutritionTargets,
  budgets: ReadonlyMap<MealSlot, SlotBudget>,
  minimumKcal: number,
  banded = false
): { readonly cost: number; readonly picks: readonly Pick[] } {
  const dayCost = (servings: readonly number[]): number => {
    const totals = picks.reduce<Macros>(
      (sum, pick, index) => {
        const factor = servings[index] ?? pick.servings;

        return {
          carbsG: sum.carbsG + pick.base.carbsG * factor,
          fatG: sum.fatG + pick.base.fatG * factor,
          fiberG: sum.fiberG + pick.base.fiberG * factor,
          kcal: sum.kcal + pick.base.kcal * factor,
          proteinG: sum.proteinG + pick.base.proteinG * factor
        };
      },
      { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 }
    );
    // A meal the person said should be bigger must stay bigger — see
    // `SHARE_ORDER_GAP`. Priced as a hinge on every ordered pair.
    const inversions = inversionsOf(picks, budgets, servings);

    return (
      fitCost(totals, { carbsG: targets.carbsG, fatG: targets.fatG, kcal: targets.kcal, proteinG: targets.proteinG }) +
      (banded ? bandMiss(totals, targets) * BAND_MISS_WEIGHT : 0) +
      inversions * (banded ? ORDER_OUTRANKS_BANDS : SHARE_INVERSION_WEIGHT) +
      straysOf(picks, budgets, servings) * SHARE_BAND_WEIGHT +
      floorMiss(deliveredKcal(picks, servings), minimumKcal) * FLOOR_OUTRANKS_ORDER
    );
  };

  // The sizes each dish may take: its own, and up to its window either side,
  // never past what a person can be served.
  const windows = windowsFor(picks, budgets, banded ? SPREAD_MAX_COMBOS : BALANCE_MAX_COMBOS);
  const options = picks.map((pick, index) => {
    const sizes: number[] = [];
    const window = windows[index] ?? 0;

    for (let step = -window; step <= window; step += 1) {
      const servings = roundServings(pick.servings + step * SERVING_STEP);

      if (servings >= SERVING_BOUNDS.min && servings <= SERVING_BOUNDS.max) {
        sizes.push(servings);
      }
    }

    return sizes;
  });

  let best: readonly number[] = picks.map(pick => pick.servings);
  let bestCost = dayCost(best);

  const visit = (index: number, chosen: number[]): void => {
    if (index === picks.length) {
      const cost = dayCost(chosen);

      if (cost < bestCost) {
        bestCost = cost;
        best = [...chosen];
      }

      return;
    }

    for (const servings of options[index] ?? []) {
      chosen.push(servings);
      visit(index + 1, chosen);
      chosen.pop();
    }
  };

  visit(0, []);

  return { cost: bestCost, picks: picks.map((pick, index) => ({ ...pick, servings: best[index] ?? pick.servings })) };
}

/**
 * How many candidate swaps per round are priced properly — sized by the
 * exhaustive portion search — after a cheap first pass over the whole pool.
 *
 * The cheap pass judges a swap with the dish at the size it was first scaled
 * to; the expensive one asks what the day would cost once every portion is
 * re-fitted around it, which is the question that matters and the one the
 * greedy version never asked. A swap that only helps once the other plates
 * shrink a quarter to make room for it was invisible before, and fat — small
 * grams inside a plate, unreachable by scaling alone — is exactly what such
 * swaps fix. Twenty-four, measured on a real library: eight left one day of
 * fourteen at 7% on fat, twenty-four brought every day inside 5% on all four
 * macros, and the whole fortnight still prices in about four seconds.
 */
const SWAP_SHORTLIST = 24;

/**
 * Swaps whole dishes to improve the day as a whole.
 *
 * Choosing each slot independently optimises three separate fits and can still
 * miss the day: with a pool of both rice dishes and chicken dishes, every slot's
 * *individual* best fit on energy is a rice dish, and the day then lands on
 * calories and half a protein target short. Scaling portions cannot rescue that —
 * a portion changes a dish's size, never its composition — so the repair has to
 * happen at selection.
 *
 * Bounded and greedy over rounds: each takes the single best-improving swap and
 * stops when nothing improves. Within a round it is two-stage — see
 * `SWAP_SHORTLIST`. Variety is re-checked against the other days and the rest
 * of this one, so a swap can never introduce a violation.
 */
function improveDay(
  picks: readonly Pick[],
  input: SchedulerInput,
  dayIndex: number,
  placed: readonly Placement[],
  budgets: ReadonlyMap<MealSlot, SlotBudget>,
  protein: { readonly cap: number; readonly proteins: ProteinIndex }
): readonly Pick[] {
  const perServing = perServingIndex(input.pool, input.catalogue);
  const others = placed.filter(placement => placement.dayIndex !== dayIndex);
  const elsewhere = proteinCounts(others, protein.proteins);
  const proteinOf = (slug: string): string | null => protein.proteins.get(slug) ?? null;

  const targets = targetsOn(input, dayIndex);
  let current = [...picks];

  for (let round = 0; round < MAX_SWAP_ROUNDS; round += 1) {
    // A repeated main protein is priced, not refused (`PROTEIN_REPEAT_WEIGHT`);
    // so is a dish already served elsewhere in the plan (`DISH_REPEAT_WEIGHT`) —
    // without it, a swap toward a better-fitting dish already used twice cost
    // the same as one toward a dish never served, and on a fortnight whose
    // daily targets barely move, this search kept spending the same handful of
    // best-fitting dishes on every day it touched (`0065`).
    const today = current.map(entry => ({ protein: proteinOf(entry.dish.slug), slot: entry.slot }));
    const repeatsOf = (day: readonly ProteinMeal[]): number => proteinExcess(day, elsewhere, protein.cap) * PROTEIN_REPEAT_WEIGHT;
    // Priced the same way the candidates will be, or a swap could "win" against
    // a day that was never sized.
    let bestCost = balancedDay(current, targets, budgets, input.minimumKcal).cost + repeatsOf(today) + dayReuseCost(current, dayIndex, others);
    let bestDay: readonly Pick[] | undefined;
    const shortlist: { readonly cost: number; readonly extra: number; readonly swapped: readonly Pick[] }[] = [];

    for (const [index, pick] of current.entries()) {
      // Everything already on the plate today except the one being replaced.
      const siblings = current
        .filter((_entry, position) => position !== index)
        .map(entry => ({ dayIndex, dishSlug: entry.dish.slug, slot: entry.slot }));
      const budget = budgets.get(pick.slot) ?? { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 };

      for (const candidate of input.pool) {
        if (!candidate.slots.includes(pick.slot) || candidate.slug === pick.dish.slug) {
          continue;
        }

        const base = perServing.get(candidate.slug);

        if (!base || !canPlace(candidate.slug, pick.slot, dayIndex, [...others, ...siblings])) {
          continue;
        }

        const repeats = repeatsOf(
          today.map((entry, position) => (position === index ? { protein: proteinOf(candidate.slug), slot: entry.slot } : entry))
        );
        const servings = servingsFor(base, budget);
        const swapped = current.map((entry, position) =>
          position === index ? { base, dish: candidate, servings, slot: entry.slot, sortOrder: entry.sortOrder } : entry
        );
        const extra = repeats + dayReuseCost(swapped, dayIndex, others);

        shortlist.push({ cost: dayFitCost(swapped, targets) + extra, extra, swapped });
      }
    }

    // Stable: a tie on the cheap cost keeps pool order, which is the user's own
    // rotation (`0009`), and the shortlist is then priced in that order.
    const priced = shortlist
      .sort((a, b) => a.cost - b.cost)
      .slice(0, SWAP_SHORTLIST)
      .map(entry => ({ cost: balancedDay(entry.swapped, targets, budgets, input.minimumKcal).cost + entry.extra, swapped: entry.swapped }));

    for (const entry of priced) {
      if (entry.cost < bestCost) {
        bestCost = entry.cost;
        bestDay = entry.swapped;
      }
    }

    if (!bestDay) {
      break;
    }

    current = [...bestDay];
  }

  return current;
}

/** A day's macros at the sizes its picks carry. */
function totalsOf(picks: readonly Pick[]): Macros {
  return picks.reduce<Macros>(
    (sum, pick) => ({
      carbsG: sum.carbsG + pick.base.carbsG * pick.servings,
      fatG: sum.fatG + pick.base.fatG * pick.servings,
      fiberG: sum.fiberG + pick.base.fiberG * pick.servings,
      kcal: sum.kcal + pick.base.kcal * pick.servings,
      proteinG: sum.proteinG + pick.base.proteinG * pick.servings
    }),
    { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 }
  );
}

/** The day's totals measured against the day's targets. */
function dayFitCost(picks: readonly Pick[], targets: NutritionTargets): number {
  return fitCost(totalsOf(picks), { carbsG: targets.carbsG, fatG: targets.fatG, kcal: targets.kcal, proteinG: targets.proteinG });
}

/**
 * How far a day sits from `PLAN_TOLERANCE` — the same bands validation
 * reports, so what the spread pass removes is exactly what a plan would
 * otherwise be delivered with as advice.
 *
 * Macros outside first, how far outside second: each macro outside its band
 * counts one, plus the fraction it is out by. Priced by distance alone, a day
 * whose fat could not reach its band pushed carbohydrate and protein a point
 * outside theirs to pull the fat a few points closer — less total distance,
 * two more numbers the person sees missed. Zero for a day inside every band.
 */
function bandMiss(totals: Macros, targets: NutritionTargets): number {
  const outside = (actual: number, target: number, under: number, over: number): number => {
    if (target <= 0) {
      return 0;
    }

    const error = (actual - target) / target;

    return error < 0 ? Math.max(0, -error - under) : Math.max(0, error - over);
  };

  return [
    outside(totals.kcal, targets.kcal, PLAN_TOLERANCE.kcal, PLAN_TOLERANCE.kcal),
    outside(totals.proteinG, targets.proteinG, PLAN_TOLERANCE.proteinUnder, PLAN_TOLERANCE.proteinOver),
    outside(totals.carbsG, targets.carbsG, PLAN_TOLERANCE.carbs, PLAN_TOLERANCE.carbs),
    outside(totals.fatG, targets.fatG, PLAN_TOLERANCE.fat, PLAN_TOLERANCE.fat)
  ].reduce((sum, excess) => sum + excess + (excess > SPREAD_EPSILON ? 1 : 0), 0);
}

/**
 * A day's energy as the plan will carry it, not as the search sums it.
 *
 * Every meal's macros are rounded to a decimal when the plan is assembled
 * (`scaleMacros`) and the day's total is the sum of those, so a day the search
 * holds at 1,200.02 can be delivered — and validated — at 1,199.9. The floor is
 * judged on the delivered number, so it is judged on the same one here.
 */
function deliveredKcal(picks: readonly Pick[], servings: readonly number[] = []): number {
  const tenths = picks.reduce((sum, pick, index) => sum + Math.round(pick.base.kcal * (servings[index] ?? pick.servings) * 10), 0);

  return tenths / 10;
}

/**
 * How far under the floor a day's energy sits: nothing at or over it, otherwise
 * one for being under plus the fraction it is under by — the shape of
 * `bandMiss`, so the spread pass can add the two.
 */
function floorMiss(kcal: number, minimumKcal: number): number {
  return kcal >= minimumKcal ? 0 : 1 + (minimumKcal - kcal) / minimumKcal;
}

type BuiltDay = {
  readonly budgets: ReadonlyMap<MealSlot, SlotBudget>;
  readonly dayIndex: number;
  readonly picks: readonly Pick[];
  readonly targets: NutritionTargets;
};

/** Small enough to be rounding; an exchange has to buy more than this to be made. */
const SPREAD_EPSILON = 1e-6;

/**
 * Exchanges meals between days until no exchange brings the fortnight closer
 * to its bands — see `MAX_SPREAD_ROUNDS`.
 *
 * An exchange is the same meal on two days, each dish moving to the other
 * day. It can never break variety: a dish keeps its count, and each move is
 * checked with `canPlace` against everything else on the plan, including the
 * days a mid-plan rebuild is not touching. Deterministic: days and meals are
 * visited in order and a tie keeps the first.
 */
function spreadAcrossDays(days: readonly BuiltDay[], fixed: readonly Placement[], proteins: ProteinIndex, minimumKcal: number): readonly BuiltDay[] {
  const current = [...days];
  // A day under the floor is a day outside, whatever its bands say, so it is
  // repaired like one. That prices the floor at one band's worth, which is not
  // enough to protect it: an exchange that brought three macros inside and left
  // the day under the floor would read as a gain, and turn a plan delivered with
  // advice into one thrown away. So the floor is also a condition, like the
  // order of the meals — see `keepsFloor`.
  const missOf = (picks: readonly Pick[], day: BuiltDay): number =>
    bandMiss(totalsOf(picks), day.targets) + floorMiss(deliveredKcal(picks), minimumKcal);
  // No repair may leave a day further under the floor than it already was.
  const keepsFloor = (picks: readonly Pick[], day: BuiltDay): boolean =>
    floorMiss(deliveredKcal(picks), minimumKcal) <= floorMiss(deliveredKcal(day.picks), minimumKcal) + SPREAD_EPSILON;
  // No repair may leave a day's meals further out of the order the person set
  // than the day already was — see `ORDER_OUTRANKS_BANDS`.
  const keepsOrder = (picks: readonly Pick[], day: BuiltDay): boolean =>
    inversionsOf(picks, day.budgets) <= inversionsOf(day.picks, day.budgets) + SPREAD_EPSILON;
  // An exchange that brings one main protein into a day twice pays for it
  // (`SPREAD_REPEAT_WEIGHT`). It moves dishes between days, so the fortnight's
  // counts cannot change; only a day's own repeats can.
  const repeatsIn = (picks: readonly Pick[]): number =>
    proteinExcess(
      picks.map(pick => ({ protein: proteins.get(pick.dish.slug) ?? null, slot: pick.slot })),
      NO_PROTEIN_COUNTS,
      Number.POSITIVE_INFINITY
    );
  const resized = (day: BuiltDay, index: number, replacement: Pick): Pick[] =>
    day.picks.map((pick, position) =>
      position === index
        ? {
            ...pick,
            base: replacement.base,
            dish: replacement.dish,
            servings: servingsFor(replacement.base, day.budgets.get(pick.slot) ?? { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 })
          }
        : pick
    );

  // First the cheapest repair: the same dishes, sized to the bands.
  for (const [position, day] of current.entries()) {
    const before = missOf(day.picks, day);

    if (before > SPREAD_EPSILON) {
      const picks = balancedDay(day.picks, day.targets, day.budgets, minimumKcal, true).picks;

      if (missOf(picks, day) < before - SPREAD_EPSILON && keepsOrder(picks, day) && keepsFloor(picks, day)) {
        current[position] = { ...day, picks };
      }
    }
  }

  for (let round = 0; round < MAX_SPREAD_ROUNDS; round += 1) {
    const outside = current
      .map((day, position) => ({ miss: missOf(day.picks, day), position }))
      .filter(entry => entry.miss > SPREAD_EPSILON)
      .sort((a, b) => b.miss - a.miss || a.position - b.position);
    let exchanged = false;

    for (const { miss, position: worstAt } of outside) {
      const worst = current[worstAt] as BuiltDay;
      const placements: Placement[] = [
        ...fixed,
        ...current.flatMap(day => day.picks.map(pick => ({ dayIndex: day.dayIndex, dishSlug: pick.dish.slug, slot: pick.slot })))
      ];
      const screened: { before: number; otherAt: number; quick: number; toOther: Pick[]; toWorst: Pick[] }[] = [];

      for (const [otherAt, other] of current.entries()) {
        if (otherAt === worstAt) {
          continue;
        }

        const before = miss + missOf(other.picks, other);

        for (const [worstIndex, mine] of worst.picks.entries()) {
          const otherIndex = other.picks.findIndex(pick => pick.slot === mine.slot);
          const theirs = other.picks[otherIndex];

          if (!theirs || theirs.dish.slug === mine.dish.slug) {
            continue;
          }

          const rest = placements.filter(
            placement => placement.slot !== mine.slot || (placement.dayIndex !== worst.dayIndex && placement.dayIndex !== other.dayIndex)
          );

          if (!canPlace(theirs.dish.slug, mine.slot, worst.dayIndex, rest) || !canPlace(mine.dish.slug, mine.slot, other.dayIndex, rest)) {
            continue;
          }

          const toWorst = resized(worst, worstIndex, theirs);
          const toOther = resized(other, otherIndex, mine);

          screened.push({ before, otherAt, quick: missOf(toWorst, worst) + missOf(toOther, other) - before, toOther, toWorst });
        }
      }

      let best: { gain: number; otherAt: number; toOther: readonly Pick[]; toWorst: readonly Pick[] } | undefined;

      // Stable: a tie on the screen keeps the order the exchanges were found in.
      for (const entry of screened.sort((a, b) => a.quick - b.quick).slice(0, SPREAD_SHORTLIST)) {
        const other = current[entry.otherAt] as BuiltDay;
        const toWorst = balancedDay(entry.toWorst, worst.targets, worst.budgets, minimumKcal, true).picks;
        const toOther = balancedDay(entry.toOther, other.targets, other.budgets, minimumKcal, true).picks;
        const added = Math.max(0, repeatsIn(toWorst) - repeatsIn(worst.picks)) + Math.max(0, repeatsIn(toOther) - repeatsIn(other.picks));
        const gain = entry.before - missOf(toWorst, worst) - missOf(toOther, other) - added * SPREAD_REPEAT_WEIGHT;

        if (!keepsOrder(toWorst, worst) || !keepsOrder(toOther, other) || !keepsFloor(toWorst, worst) || !keepsFloor(toOther, other)) {
          continue;
        }

        if (gain > SPREAD_EPSILON && (!best || gain > best.gain + SPREAD_EPSILON)) {
          best = { gain, otherAt: entry.otherAt, toOther, toWorst };
        }
      }

      if (best) {
        current[worstAt] = { ...worst, picks: best.toWorst };
        current[best.otherAt] = { ...(current[best.otherAt] as BuiltDay), picks: best.toOther };
        exchanged = true;
        break;
      }
    }

    if (!exchanged) {
      break;
    }
  }

  return current;
}

/**
 * A day's set of dishes, as a single key — the same notion `varietyViolations`
 * audits: which slot each sits in does not matter, only the set (owner,
 * 2026-09-26) — paella at lunch and lentils at dinner is the same day as
 * lentils at lunch and paella at dinner.
 */
function daySignature(picks: readonly Pick[]): string {
  return [...picks]
    .map(pick => pick.dish.slug)
    .sort()
    .join('|');
}

/** The same signature, one per day, for a flat placement list — what a rebuild's untouched days are given as. */
function daySignaturesOf(placed: readonly Placement[]): readonly string[] {
  const byDay = new Map<number, string[]>();

  for (const placement of placed) {
    byDay.set(placement.dayIndex, [...(byDay.get(placement.dayIndex) ?? []), placement.dishSlug]);
  }

  return [...byDay.values()].map(slugs => [...slugs].sort().join('|'));
}

/**
 * No two days may serve exactly the same dishes (owner, 2026-09-26) — a hard
 * rule, checked once every other pass has run: two days built to nearly the
 * same targets from the same pool can still converge on the same handful of
 * dishes with every cost above in place, and `spreadAcrossDays` trades whole
 * meals between days for reasons that have nothing to do with which dishes
 * end up sharing a day, so either pass can produce — or remove — the
 * collision.
 *
 * The repair is the smallest one that clears it: for the later of two
 * identical days, the one slot cheapest to change is swapped to the
 * best-fitting eligible dish that is not already on this day and does not
 * recreate *another* collision. Guarded exactly the way `spreadAcrossDays`
 * guards its own exchanges — a repair may never leave the day's macros
 * further outside their bands, its meals further out of the order the person
 * set, or its energy further under the floor than it already was: this pass
 * runs *after* the spread pass has spent its own budget bringing a day
 * inside 5%, and repricing without the same bands (`balancedDay`'s plain,
 * unbanded cost) undid that work wholesale in testing — a day at 1% on
 * protein came back at 11%. Never refused: a thin pool serving the same
 * three dishes on two days is still a plan, and `varietyViolations` is what
 * tells the difference between "prevented" and "the pool left no choice".
 */
function enforceDistinctDays(
  days: readonly BuiltDay[],
  input: SchedulerInput,
  fixed: readonly Placement[],
  proteins: ProteinIndex,
  cap: number
): readonly BuiltDay[] {
  const perServing = perServingIndex(input.pool, input.catalogue);
  const current = [...days];
  // A mid-plan rebuild (`0044`) hands `fixed` the days it is *not* laying out
  // again — untouched, already on the plate. Their signatures go in before
  // the loop below runs, or a rebuild could recreate a day identical to one
  // of them and this pass would never see it, because it only ever compares
  // the days it is itself building.
  const seen = new Set<string>(daySignaturesOf(fixed));

  const missOf = (picks: readonly Pick[], day: BuiltDay): number =>
    bandMiss(totalsOf(picks), day.targets) + floorMiss(deliveredKcal(picks), input.minimumKcal);
  const keepsFloor = (picks: readonly Pick[], day: BuiltDay): boolean =>
    floorMiss(deliveredKcal(picks), input.minimumKcal) <= floorMiss(deliveredKcal(day.picks), input.minimumKcal) + SPREAD_EPSILON;
  const keepsOrder = (picks: readonly Pick[], day: BuiltDay): boolean =>
    inversionsOf(picks, day.budgets) <= inversionsOf(day.picks, day.budgets) + SPREAD_EPSILON;

  for (const [index, day] of current.entries()) {
    const signature = daySignature(day.picks);

    if (!seen.has(signature)) {
      seen.add(signature);
      continue;
    }

    // Every other day already in `current`, repaired ones included — this is a
    // single forward pass, so a day fixed earlier is what a later day sees.
    const elsewhere = current.flatMap((other, otherIndex) =>
      otherIndex === index ? [] : other.picks.map(pick => ({ dayIndex: other.dayIndex, dishSlug: pick.dish.slug, slot: pick.slot }))
    );
    const before = missOf(day.picks, day);

    let repaired: readonly Pick[] | undefined;
    let bestCost = Number.POSITIVE_INFINITY;

    for (const [position, pick] of day.picks.entries()) {
      const budget = day.budgets.get(pick.slot) ?? { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 };
      const siblings = day.picks
        .filter((_entry, at) => at !== position)
        .map(entry => ({ dayIndex: day.dayIndex, dishSlug: entry.dish.slug, slot: entry.slot }));
      const placedElsewhere = [...fixed, ...elsewhere, ...siblings];

      for (const candidate of input.pool) {
        if (!candidate.slots.includes(pick.slot) || candidate.slug === pick.dish.slug) {
          continue;
        }

        const base = perServing.get(candidate.slug);

        if (!base || crowded(candidate.slug, { dayIndex: day.dayIndex, slot: pick.slot }, placedElsewhere, proteins, cap)) {
          continue;
        }

        if (!canPlace(candidate.slug, pick.slot, day.dayIndex, placedElsewhere)) {
          continue;
        }

        const servings = servingsFor(base, budget);
        const swapped = day.picks.map((entry, at) => (at === position ? { ...entry, base, dish: candidate, servings } : entry));

        // A repair that only trades this collision for another helps nobody.
        if (seen.has(daySignature(swapped))) {
          continue;
        }

        const priced = balancedDay(swapped, day.targets, day.budgets, input.minimumKcal, true);

        if (missOf(priced.picks, day) > before + SPREAD_EPSILON || !keepsOrder(priced.picks, day) || !keepsFloor(priced.picks, day)) {
          continue;
        }

        if (priced.cost < bestCost) {
          bestCost = priced.cost;
          repaired = priced.picks;
        }
      }
    }

    if (repaired) {
      current[index] = { ...day, picks: repaired };
      seen.add(daySignature(repaired));
    } else {
      // The pool left no choice — recorded by `varietyViolations`, not thrown away.
      seen.add(signature);
    }
  }

  return current;
}

/** Quarter-serving arithmetic in floats needs snapping, or 0.75 + 0.25 drifts. */
function roundServings(value: number): number {
  return Math.round(value / SERVING_STEP) * SERVING_STEP;
}

function quantiseServings(raw: number): number {
  const clamped = Math.min(Math.max(raw, SERVING_BOUNDS.min), SERVING_BOUNDS.max);

  return Math.max(SERVING_BOUNDS.min, Math.round(clamped / SERVING_STEP) * SERVING_STEP);
}
