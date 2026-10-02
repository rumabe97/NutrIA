// Straight to the file, not 'core/domain/MealFit': MealFit reads this folder's
// rotation constants at load, and the index would make that a cycle.
import { dishGroups } from '../MealFit/Cuisine';

import type { FoodGroup } from '../MealFit/Cuisine';
import type { Placement } from './Variety';
import type { CandidateDish } from 'core/entities/Plan';

/**
 * What a dish is a plate *of*, on the starch side: pasta, rice, couscous or
 * another grain, potato or boniato, a legume, bread.
 *
 * Variety by dish and by protein was not enough. A real fortnight (owner,
 * 2026-10-02) served pasta at nine of its twenty-eight lunches and dinners —
 * different recipes, different proteins, the same plate of pasta — and on two
 * days running.
 *
 * Read with `0079`'s food groups and their grams (`dishGroups`), so a dish is
 * pasta here exactly when meal fit calls it pasta: the two never disagree. A
 * dish of two groups is named by the first of `PRECEDENCE` — rice with
 * chickpeas is a rice, pasta e fagioli a pasta, lentils with potato a legume.
 * Bread is not a `0079` group (it fits every meal); a dish is bread when it has
 * none of the five and `BREAD_GRAMS` of bread a serving. Null for the rest.
 */
export type StarchBase = 'bread' | 'grains' | 'legume' | 'pasta' | 'potato' | 'rice';

const PRECEDENCE: readonly FoodGroup[] = ['pasta', 'rice', 'grains', 'pulses', 'potato'];

const BASE_OF: Readonly<Record<FoodGroup, StarchBase>> = { grains: 'grains', pasta: 'pasta', potato: 'potato', pulses: 'legume', rice: 'rice' };

/** The catalogue's breads (checked 2026-10-02). Not crumbs, panko or fig cake. */
export const BREAD_SLUGS: ReadonlySet<string> = new Set([
  'bagel',
  'baguette',
  'chapata',
  'hogaza-de-pan',
  'mollete',
  'pan-bao',
  'pan-blanco',
  'pan-de-ajo-congelado',
  'pan-de-centeno',
  'pan-de-cristal',
  'pan-de-espelta',
  'pan-de-hamburguesa',
  'pan-de-hamburguesa-integral',
  'pan-de-leche',
  'pan-de-masa-madre',
  'pan-de-molde',
  'pan-de-molde-integral',
  'pan-de-perrito',
  'pan-de-pita',
  'pan-de-semillas',
  'pan-integral',
  'pan-naan',
  'pan-sin-gluten',
  'pan-tostado',
  'panecillos',
  'picos-de-pan',
  'regana',
  'tortilla-de-maiz',
  'tortilla-de-trigo',
  'tostas-de-centeno',
  'wrap-integral'
]);

/** Grams of bread a serving from which a dish is a bread: a roll, two slices — the grains' own 40 g. */
export const BREAD_GRAMS = 40;

type Dish = { readonly ingredients: readonly { readonly grams?: number; readonly slug: string }[]; readonly servings?: number };

export function starchBase(dish: Dish): StarchBase | null {
  const groups = dishGroups(dish);
  const group = PRECEDENCE.find(candidate => groups.has(candidate));

  if (group) {
    return BASE_OF[group];
  }

  const servings = dish.servings && dish.servings > 0 ? dish.servings : 1;
  const bread = dish.ingredients.filter(item => BREAD_SLUGS.has(item.slug));
  // As `dishGroups`: a row without grams counts as belonging.
  const grams = bread.reduce((sum, item) => sum + (item.grams ?? Number.POSITIVE_INFINITY), 0) / servings;

  return bread.length > 0 && grams >= BREAD_GRAMS ? 'bread' : null;
}

/**
 * **Four of pasta and four of rice a fortnight, never on two days running**
 * (owner, 2026-10-02; plan 016 phase 7).
 *
 * Only those two: they are what came back, and a plate of potato or a legume
 * stew is the ordinary shape of a Spanish week. Twice on one day counts as
 * running too. Like `PROTEIN_RULES`, a preference the scheduler keeps whenever
 * the pool lets it, priced at the same weight — never a reason to fail a plan.
 */
export const STARCH_RULES = { capped: ['pasta', 'rice'], perFortnight: 4 } as const satisfies {
  readonly capped: readonly StarchBase[];
  readonly perFortnight: number;
};

const CAPPED: ReadonlySet<StarchBase> = new Set(STARCH_RULES.capped);

/** Whether the rule counts this base: pasta or rice. */
export function isCappedStarch(base: StarchBase | null | undefined): boolean {
  return base !== null && base !== undefined && CAPPED.has(base);
}

/** How often pasta, or rice, may appear in a plan of `days` days — four in fourteen, scaled, one at least. */
export function starchCap(days: number): number {
  return Math.max(1, Math.ceil((STARCH_RULES.perFortnight * days) / 14));
}

/** A meal as the starch rule reads it. */
export type StarchMeal = { readonly base: StarchBase | null; readonly dayIndex: number };

/** Each pool dish's starch base, by slug. */
export type StarchIndex = ReadonlyMap<string, StarchBase | null>;

export function starchIndex(dishes: readonly Pick<CandidateDish, 'ingredients' | 'servings' | 'slug'>[]): StarchIndex {
  return new Map(dishes.map(dish => [dish.slug, starchBase(dish)]));
}

/**
 * Placements as the starch rule reads them, keeping only the capped bases —
 * the only ones it counts. A placement that names its base (`Placement.starch`,
 * what a swap or a rebuild knows of the meals already on the plan) is read as
 * named; any other by the index, and a dish outside it counts for nothing.
 */
export function starchMeals(placements: readonly Placement[], index: StarchIndex): StarchMeal[] {
  const meals: StarchMeal[] = [];

  for (const placement of placements) {
    const base = placement.starch === undefined ? (index.get(placement.dishSlug) ?? null) : placement.starch;

    if (isCappedStarch(base)) {
      meals.push({ base, dayIndex: placement.dayIndex });
    }
  }

  return meals;
}

/**
 * How many meals break `STARCH_RULES` in these: each past the plan's cap, each
 * second one on a day, each day that follows a day of the same base. Counted
 * by the meal, as `PROTEIN_RULES`' excess is.
 */
export function starchExcess(meals: readonly StarchMeal[], days: number): number {
  const cap = starchCap(days);
  let excess = 0;

  for (const base of CAPPED) {
    const byDay = new Map<number, number>();
    let total = 0;

    for (const meal of meals) {
      if (meal.base === base) {
        byDay.set(meal.dayIndex, (byDay.get(meal.dayIndex) ?? 0) + 1);
        total += 1;
      }
    }

    excess += Math.max(0, total - cap);

    for (const [dayIndex, count] of byDay) {
      excess += count - 1 + (byDay.has(dayIndex - 1) ? 1 : 0);
    }
  }

  return excess;
}

/** Whether a dish of `base` on `dayIndex` would add to `starchExcess` over `meals`: its base is on that day or the next or the one before, or at its cap. */
export function starchCrowded(base: StarchBase | null, dayIndex: number, meals: readonly StarchMeal[], days: number): boolean {
  if (!isCappedStarch(base)) {
    return false;
  }

  let total = 0;

  for (const meal of meals) {
    if (meal.base === base) {
      if (Math.abs(meal.dayIndex - dayIndex) <= 1) {
        return true;
      }

      total += 1;
    }
  }

  return total >= starchCap(days);
}
