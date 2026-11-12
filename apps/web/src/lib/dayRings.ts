/**
 * What Inicio's rings measure (project 024, PRD § "What changes from the sheets", 8).
 *
 * The day's meals **marked «Hecha»** (`status === 'completed'`), summed, against the
 * day's targets. Only what the person said they ate: a skipped meal and a meal still
 * planned add nothing, and nothing here is called "eaten" or "intake" — the product
 * knows what was marked, not what was swallowed.
 *
 * A meal's figures already carry what goes beside the plate (`MealView.kcal` and its
 * macros include the accompaniments, project 016), so a marked meal counts once, whole,
 * and its sides are never added a second time.
 */

/** The four figures a ring is drawn for. */
export type Macros = { readonly carbsG: number; readonly fatG: number; readonly kcal: number; readonly proteinG: number };

type MarkedMeal = Macros & { readonly id: string; readonly status: string };

export const NOTHING: Macros = { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 };

/**
 * The sum of the meals marked done. `statuses` overrides a meal's own status by id —
 * the mark a person has just made, before the server has answered.
 */
export function completedTotals(meals: readonly MarkedMeal[], statuses: Readonly<Record<string, string>> = {}): Macros {
  return meals.reduce<Macros>((sum, meal) => {
    if ((statuses[meal.id] ?? meal.status) !== 'completed') {
      return sum;
    }

    return { carbsG: sum.carbsG + meal.carbsG, fatG: sum.fatG + meal.fatG, kcal: sum.kcal + meal.kcal, proteinG: sum.proteinG + meal.proteinG };
  }, NOTHING);
}

/** How many of the day's meals are marked done, with the same overrides. */
export function completedCount(
  meals: readonly { readonly id: string; readonly status: string }[],
  statuses: Readonly<Record<string, string>> = {}
): number {
  return meals.filter(meal => (statuses[meal.id] ?? meal.status) === 'completed').length;
}

/**
 * A figure's share of its target as a whole percentage, for words ("30 % del día").
 * Not capped: a dish that is 120 % of the day says so, while its ring stops full.
 * No target, no share.
 */
export function shareOf(value: number, target: number): number | null {
  if (!(target > 0) || !Number.isFinite(value)) {
    return null;
  }

  return Math.round((value / target) * 100);
}
