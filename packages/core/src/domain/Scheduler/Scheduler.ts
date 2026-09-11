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
  | { readonly assignment: PlanAssignment; readonly ok: true }
  | { readonly ok: false; readonly shortfall: SchedulerShortfall };

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
  const indexes = input.dayIndexes ?? Array.from({ length: days }, (_none, offset) => offset + 1);

  // The days that are not being laid out go in first, so every `canPlace` below
  // sees the whole plan rather than only the part of it this call is building.
  const placed: Placement[] = [...(input.placed ?? [])];
  const assignedDays: PlanDayAssignment[] = [];

  for (const dayIndex of indexes) {
    // Per day rather than once: a day that eats for an event has its own targets
    // (`0043`), and the budgets are what turn targets into a plate.
    const targets = targetsOn(input, dayIndex);
    const budgets = slotBudgets(input.weights, targets);
    const meals: ScheduledMeal[] = [];

    const picks: { base: Macros; dish: CandidateDish; servings: number; slot: MealSlot; sortOrder: number }[] = [];

    for (const [sortOrder, slot] of slots.entries()) {
      const budget = budgets.get(slot) ?? { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 };
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

    for (const pick of balanceDay(improved, targets, budgets)) {
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
function balanceDay(picks: readonly Pick[], targets: NutritionTargets, budgets: ReadonlyMap<MealSlot, SlotBudget>): readonly Pick[] {
  return balancedDay(picks, targets, budgets).picks;
}

/** `balanceDay`, and what the day costs once sized — the number a swap is judged by. */
function balancedDay(
  picks: readonly Pick[],
  targets: NutritionTargets,
  budgets: ReadonlyMap<MealSlot, SlotBudget>
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

        if (smallerKcal > biggerKcal) {
          inversions += 1 + (smallerKcal - biggerKcal) / biggerBudget;
        }
      }
    }

    return (
      fitCost(totals, { carbsG: targets.carbsG, fatG: targets.fatG, kcal: targets.kcal, proteinG: targets.proteinG }) +
      inversions * SHARE_INVERSION_WEIGHT
    );
  };

  // The sizes each dish may take: its own, and up to the window either side,
  // never past what a person can be served.
  const options = picks.map(pick => {
    const sizes: number[] = [];

    for (let step = -BALANCE_WINDOW_STEPS; step <= BALANCE_WINDOW_STEPS; step += 1) {
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
  budgets: ReadonlyMap<MealSlot, SlotBudget>
): readonly Pick[] {
  const perServing = perServingIndex(input.pool, input.catalogue);
  const others = placed.filter(placement => placement.dayIndex !== dayIndex);

  const targets = targetsOn(input, dayIndex);
  let current = [...picks];

  for (let round = 0; round < MAX_SWAP_ROUNDS; round += 1) {
    // Priced the same way the candidates will be, or a swap could "win" against
    // a day that was never sized.
    let bestCost = balancedDay(current, targets, budgets).cost;
    let bestDay: readonly Pick[] | undefined;
    const shortlist: { readonly cost: number; readonly swapped: readonly Pick[] }[] = [];

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

        const servings = servingsFor(base, budget);
        const swapped = current.map((entry, position) =>
          position === index ? { base, dish: candidate, servings, slot: entry.slot, sortOrder: entry.sortOrder } : entry
        );

        shortlist.push({ cost: dayFitCost(swapped, targets), swapped });
      }
    }

    // Stable: a tie on the cheap cost keeps pool order, which is the user's own
    // rotation (`0009`), and the shortlist is then priced in that order.
    const priced = shortlist
      .sort((a, b) => a.cost - b.cost)
      .slice(0, SWAP_SHORTLIST)
      .map(entry => ({ cost: balancedDay(entry.swapped, targets, budgets).cost, swapped: entry.swapped }));

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

  return fitCost(totals, { carbsG: targets.carbsG, fatG: targets.fatG, kcal: targets.kcal, proteinG: targets.proteinG });
}

/** Quarter-serving arithmetic in floats needs snapping, or 0.75 + 0.25 drifts. */
function roundServings(value: number): number {
  return Math.round(value / SERVING_STEP) * SERVING_STEP;
}

function quantiseServings(raw: number): number {
  const clamped = Math.min(Math.max(raw, SERVING_BOUNDS.min), SERVING_BOUNDS.max);

  return Math.max(SERVING_BOUNDS.min, Math.round(clamped / SERVING_STEP) * SERVING_STEP);
}
