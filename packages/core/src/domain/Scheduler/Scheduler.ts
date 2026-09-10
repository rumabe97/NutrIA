import { composePerServing, scaleIngredients, scaleMacros, sumMacros } from 'core/domain/Composition';
import { canPlace, isPreferredDish } from 'core/domain/Variety';
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
 * The band the balancing pass aims for. Deliberately tighter than
 * `PLAN_TOLERANCE.kcal`, so a plan leaves the scheduler comfortably inside what
 * validation will later demand rather than on its edge.
 */
const BALANCE_TARGET = 0.05;

/** Enough passes to walk any day into band from a quarter-portion start. */
const MAX_BALANCE_STEPS = 24;

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

export type SchedulerInput = {
  readonly catalogue: Catalogue;
  readonly days?: number;
  readonly pool: readonly CandidateDish[];
  readonly targets: NutritionTargets;
  /** Each eaten slot's share of the day, unnormalised — see `weightsFor` (`0036`). */
  readonly weights: ReadonlyMap<MealSlot, number>;
};

export type SchedulerShortfall = {
  readonly available: number;
  readonly dayIndex: number;
  readonly reason: 'insufficient_pool';
  readonly slot: MealSlot;
};

export type ScheduleResult =
  | { readonly assignment: PlanAssignment; readonly ok: true }
  | { readonly ok: false; readonly shortfall: SchedulerShortfall };

/**
 * Assigns pool dishes across the fortnight.
 *
 * Deterministic by construction: candidates are ranked by how close their
 * per-serving energy sits to the slot's budget, ties broken on slug. The same
 * input always produces the same plan, which is what makes the scheduler
 * testable and a failed generation reproducible.
 *
 * Variety is *prevented*, not detected — `canPlace` gates every placement, so a
 * finished assignment cannot contain a violation.
 */
export function schedulePlan(input: SchedulerInput): ScheduleResult {
  const days = input.days ?? PLAN_DAYS;
  const slots = [...input.weights.keys()];
  const budgets = slotBudgets(input.weights, input.targets);
  const perServing = perServingIndex(input.pool, input.catalogue);

  const placed: Placement[] = [];
  const assignedDays: PlanDayAssignment[] = [];

  for (let dayIndex = 1; dayIndex <= days; dayIndex += 1) {
    const meals: ScheduledMeal[] = [];

    const picks: { base: Macros; dish: CandidateDish; servings: number; slot: MealSlot; sortOrder: number }[] = [];

    for (const [sortOrder, slot] of slots.entries()) {
      const budget = budgets.get(slot) ?? { kcal: 0, proteinG: 0 };
      const eligible = input.pool
        .filter(dish => dish.slots.includes(slot))
        .filter(dish => perServing.has(dish.slug))
        .filter(dish => canPlace(dish.slug, slot, dayIndex, placed));

      const chosen = pickBest(eligible, budget, perServing, placed);

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

    const improved = improveDay(picks, input, dayIndex, placed, budgets);

    // Swapping changed what this day holds, so the placement record must follow or
    // later days would enforce variety against dishes that are no longer served.
    for (let index = placed.length - picks.length; index < placed.length; index += 1) {
      const replacement = improved[index - (placed.length - picks.length)];

      if (replacement) {
        placed[index] = { dayIndex, dishSlug: replacement.dish.slug, slot: replacement.slot };
      }
    }

    for (const pick of balanceDay(improved, input.targets)) {
      meals.push({
        dish: pick.dish,
        ingredients: scaleIngredients(pick.dish.ingredients, pick.servings / pick.dish.servings),
        macros: scaleMacros(pick.base, pick.servings),
        servings: pick.servings,
        slot: pick.slot,
        sortOrder: pick.sortOrder
      });
    }

    assignedDays.push({ dayIndex, meals, totals: sumMacros(meals.map(meal => meal.macros)) });
  }

  return { assignment: { days: assignedDays }, ok: true };
}

export type SlotBudget = { readonly kcal: number; readonly proteinG: number };

export type Replacement = {
  readonly dish: CandidateDish;
  readonly ingredients: readonly { readonly grams: number; readonly slug: string }[];
  readonly macros: Macros;
  readonly servings: number;
};

/**
 * A favourite goes first only if it lands near the budget — this much fit cost
 * is roughly 20 % off on energy. Past that, a favourite is the wrong dish for
 * this slot however much the person likes it, and the fit decides.
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
  readonly pool: readonly CandidateDish[];
  readonly slot: MealSlot;
}): Replacement | undefined {
  const perServing = perServingIndex(input.pool, input.catalogue);

  const passes = (dish: CandidateDish): boolean => {
    const base = perServing.get(dish.slug);

    return base !== undefined && (input.filter?.(dish, base) ?? true);
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

  const servings = servingsFor(base, input.budget);

  return { dish, ingredients: scaleIngredients(dish.ingredients, servings / dish.servings), macros: scaleMacros(base, servings), servings };
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
 */
function slotBudgets(weights: ReadonlyMap<MealSlot, number>, targets: NutritionTargets): ReadonlyMap<MealSlot, SlotBudget> {
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0) || 1;

  return new Map(
    [...weights].map(([slot, weight]) => [slot, { kcal: (targets.kcal * weight) / total, proteinG: (targets.proteinG * weight) / total }])
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

  // Energy is weighted higher: its tolerance is tighter (10% against 15%), and a
  // day that misses on calories misses on the thing the goal depends on.
  return energy * 1.5 + protein;
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
  placed: readonly Placement[]
): CandidateDish | undefined {
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
      const costA = first ? scaledFitCost(first, budget) : Number.MAX_VALUE;
      const costB = second ? scaledFitCost(second, budget) : Number.MAX_VALUE;

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
 * Walks a day's portions into band, a quarter serving at a time.
 *
 * Each slot's serving is quantised independently against its own share of the
 * day, so three slots each rounding a little the same way can put the day 10%
 * out — which is exactly the tolerance validation rejects at. Rather than
 * loosening the quantum (and printing 1.37 servings) or loosening the band,
 * this corrects afterwards: at each step it applies the single quarter-serving
 * change that moves the day's total closest to target, and stops when it is
 * inside `BALANCE_TARGET` or when no change helps.
 *
 * Deterministic: ties break on slot order, so the same day always balances the
 * same way.
 */
function balanceDay(picks: readonly Pick[], targets: NutritionTargets): readonly Pick[] {
  const dayCost = (entries: readonly Pick[]): number =>
    fitCost(
      entries.reduce<Macros>(
        (sum, pick) => ({
          carbsG: sum.carbsG + pick.base.carbsG * pick.servings,
          fatG: sum.fatG + pick.base.fatG * pick.servings,
          fiberG: sum.fiberG + pick.base.fiberG * pick.servings,
          kcal: sum.kcal + pick.base.kcal * pick.servings,
          proteinG: sum.proteinG + pick.base.proteinG * pick.servings
        }),
        { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 }
      ),
      { kcal: targets.kcal, proteinG: targets.proteinG }
    );

  let current = [...picks];

  for (let step = 0; step < MAX_BALANCE_STEPS; step += 1) {
    const cost = dayCost(current);

    // `fitCost` weights energy at 1.5 against protein's 1, so this threshold keeps
    // both comfortably inside the tolerances validation applies.
    if (cost <= BALANCE_TARGET * 2.5) {
      break;
    }

    let bestIndex = -1;
    let bestServings = 0;
    let bestCost = cost;

    for (const [index, pick] of current.entries()) {
      for (const delta of [SERVING_STEP, -SERVING_STEP]) {
        const servings = roundServings(pick.servings + delta);

        if (servings < SERVING_BOUNDS.min || servings > SERVING_BOUNDS.max) {
          continue;
        }

        const candidateCost = dayCost(current.map((entry, position) => (position === index ? { ...entry, servings } : entry)));

        if (candidateCost < bestCost) {
          bestCost = candidateCost;
          bestIndex = index;
          bestServings = servings;
        }
      }
    }

    if (bestIndex < 0) {
      break;
    }

    current = current.map((pick, index) => (index === bestIndex ? { ...pick, servings: bestServings } : pick));
  }

  return current;
}

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
 * Bounded and greedy: it takes the single best-improving swap each round and stops
 * when nothing improves. Variety is re-checked against the other days and the rest
 * of this one, so a swap can never introduce a violation.
 */
function improveDay(
  picks: readonly Pick[],
  input: SchedulerInput,
  dayIndex: number,
  placed: readonly Placement[],
  budgets: ReadonlyMap<MealSlot, SlotBudget>
): readonly Pick[] {
  const perServing = perServingIndex(input.pool, input.catalogue);
  const others = placed.filter(placement => placement.dayIndex !== dayIndex);

  let current = [...picks];

  for (let round = 0; round < MAX_SWAP_ROUNDS; round += 1) {
    let bestCost = dayFitCost(current, input.targets);
    let bestIndex = -1;
    let bestPick: Pick | undefined;

    for (const [index, pick] of current.entries()) {
      // Everything already on the plate today except the one being replaced.
      const siblings = current
        .filter((_entry, position) => position !== index)
        .map(entry => ({ dayIndex, dishSlug: entry.dish.slug, slot: entry.slot }));
      const budget = budgets.get(pick.slot) ?? { kcal: 0, proteinG: 0 };

      for (const candidate of input.pool) {
        if (!candidate.slots.includes(pick.slot) || candidate.slug === pick.dish.slug) {
          continue;
        }

        const base = perServing.get(candidate.slug);

        if (!base || !canPlace(candidate.slug, pick.slot, dayIndex, [...others, ...siblings])) {
          continue;
        }

        const servings = servingsFor(base, budget);
        const swapped = current.map((entry, position) =>
          position === index ? { base, dish: candidate, servings, slot: entry.slot, sortOrder: entry.sortOrder } : entry
        );
        const cost = dayFitCost(swapped, input.targets);

        if (cost < bestCost) {
          bestCost = cost;
          bestIndex = index;
          bestPick = swapped[index];
        }
      }
    }

    if (bestIndex < 0 || !bestPick) {
      break;
    }

    current = current.map((entry, index) => (index === bestIndex ? bestPick : entry));
  }

  return current;
}

/** The day's totals measured against the day's targets. */
function dayFitCost(picks: readonly Pick[], targets: NutritionTargets): number {
  const totals = picks.reduce<Macros>(
    (sum, pick) => ({
      carbsG: sum.carbsG + pick.base.carbsG * pick.servings,
      fatG: sum.fatG + pick.base.fatG * pick.servings,
      fiberG: sum.fiberG + pick.base.fiberG * pick.servings,
      kcal: sum.kcal + pick.base.kcal * pick.servings,
      proteinG: sum.proteinG + pick.base.proteinG * pick.servings
    }),
    { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 }
  );

  return fitCost(totals, { kcal: targets.kcal, proteinG: targets.proteinG });
}

/** Quarter-serving arithmetic in floats needs snapping, or 0.75 + 0.25 drifts. */
function roundServings(value: number): number {
  return Math.round(value / SERVING_STEP) * SERVING_STEP;
}

function quantiseServings(raw: number): number {
  const clamped = Math.min(Math.max(raw, SERVING_BOUNDS.min), SERVING_BOUNDS.max);

  return Math.max(SERVING_BOUNDS.min, Math.round(clamped / SERVING_STEP) * SERVING_STEP);
}
