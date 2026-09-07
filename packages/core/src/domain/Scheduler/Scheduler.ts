import { composePerServing, scaleIngredients, scaleMacros, sumMacros } from 'core/domain/Composition';
import { canPlace } from 'core/domain/Variety';
import { MEAL_SLOTS } from 'core/entities/Plan';
import type { Placement } from 'core/domain/Variety';
import type { CandidateDish, Catalogue, Macros, MealSlot, PlanAssignment, PlanDayAssignment, ScheduledMeal } from 'core/entities/Plan';
import type { NutritionTargets } from 'core/entities/Nutrition';

export const PLAN_DAYS = 14;

/**
 * Share of the day's energy each slot carries, before normalising over whichever
 * slots the user actually eats. Snacks are deliberately small: they exist to
 * bridge gaps, and a 600 kcal "snack" is a meal wearing a disguise.
 */
const SLOT_WEIGHT: Record<MealSlot, number> = {
  afternoon_snack: 0.09,
  breakfast: 0.25,
  dinner: 0.3,
  lunch: 0.33,
  morning_snack: 0.08,
  supper: 0.1
};

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

export type SchedulerInput = {
  readonly catalogue: Catalogue;
  readonly days?: number;
  readonly includesSnacks: boolean;
  readonly mealsPerDay: number;
  readonly pool: readonly CandidateDish[];
  readonly targets: NutritionTargets;
};

export type SchedulerShortfall = {
  readonly available: number;
  readonly dayIndex: number;
  readonly reason: 'insufficient_pool';
  readonly slot: MealSlot;
};

export type ScheduleResult = { readonly assignment: PlanAssignment; readonly ok: true } | { readonly ok: false; readonly shortfall: SchedulerShortfall };

/**
 * Which slots a day has, given how many meals the user wants and whether they
 * snack. Order follows `MEAL_SLOTS`, so a day always reads chronologically.
 */
export function slotsFor(mealsPerDay: number, includesSnacks: boolean): readonly MealSlot[] {
  const core: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
  const extras: MealSlot[] = includesSnacks ? ['afternoon_snack', 'morning_snack', 'supper'] : ['supper'];

  const chosen = new Set<MealSlot>(core.slice(0, Math.max(1, Math.min(mealsPerDay, core.length))));

  for (const slot of extras) {
    if (chosen.size >= mealsPerDay) {break;}

    chosen.add(slot);
  }

  return MEAL_SLOTS.filter(slot => chosen.has(slot));
}

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
  const slots = slotsFor(input.mealsPerDay, input.includesSnacks);
  const budgets = slotBudgets(slots, input.targets);
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

      if (replacement) {placed[index] = { dayIndex, dishSlug: replacement.dish.slug, slot: replacement.slot };}
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

/**
 * Normalised budget per slot, so the weights work for any slot subset.
 *
 * Protein is budgeted alongside energy because validation checks both. Scaling a
 * portion changes a dish's calories and its protein by the same factor, so a
 * plan's protein is decided entirely at *selection* time — an energy-only
 * scheduler cannot correct for a carb-heavy pool afterwards, and every plan it
 * builds from one is rejected.
 */
function slotBudgets(slots: readonly MealSlot[], targets: NutritionTargets): ReadonlyMap<MealSlot, SlotBudget> {
  const total = slots.reduce((sum, slot) => sum + SLOT_WEIGHT[slot], 0);

  return new Map(
    slots.map(slot => [slot, { kcal: (targets.kcal * SLOT_WEIGHT[slot]) / total, proteinG: (targets.proteinG * SLOT_WEIGHT[slot]) / total }])
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

    if (composed.ok) {index.set(dish.slug, composed.macros);}
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

  for (const placement of placed) {usage.set(placement.dishSlug, (usage.get(placement.dishSlug) ?? 0) + 1);}

  return [...eligible]
    .sort((a, b) => {
      const used = (usage.get(a.slug) ?? 0) - (usage.get(b.slug) ?? 0);

      if (used !== 0) {return used;}

      const first = perServing.get(a.slug);
      const second = perServing.get(b.slug);
      const distance = (first ? scaledFitCost(first, budget) : Number.MAX_VALUE) - (second ? scaledFitCost(second, budget) : Number.MAX_VALUE);

      return distance !== 0 ? distance : a.slug.localeCompare(b.slug);
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
      const siblings = current.filter((_entry, position) => position !== index).map(entry => ({ dayIndex, dishSlug: entry.dish.slug, slot: entry.slot }));
      const budget = budgets.get(pick.slot) ?? { kcal: 0, proteinG: 0 };

      for (const candidate of input.pool) {
        if (!candidate.slots.includes(pick.slot) || candidate.slug === pick.dish.slug) {continue;}

        const base = perServing.get(candidate.slug);

        if (!base || !canPlace(candidate.slug, pick.slot, dayIndex, [...others, ...siblings])) {continue;}

        const servings = servingsFor(base, budget);
        const swapped = current.map((entry, position) => (position === index ? { base, dish: candidate, servings, slot: entry.slot, sortOrder: entry.sortOrder } : entry));
        const cost = dayFitCost(swapped, input.targets);

        if (cost < bestCost) {
          bestCost = cost;
          bestIndex = index;
          bestPick = swapped[index];
        }
      }
    }

    if (bestIndex < 0 || !bestPick) {break;}

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
