import type { Placement } from './Variety';
import type { MealSlot } from 'core/entities/Plan';

/**
 * One kind of food kept from coming back too often: so many times a fortnight
 * and, when `apart`, never on two days running nor twice on one day.
 *
 * Pasta, rice and grains (`STARCH_RULES`), the same legume (`LEGUME_RULES`) and
 * the same kind of snack (`SNACK_RULES`) are each one of these (017 phase 2):
 * a plate of chickpeas at six of fourteen lunches is the same complaint as
 * pasta on six days, and the scheduler prices both the same way. Like
 * `PROTEIN_RULES`, preferences kept whenever the pool lets them, never a
 * reason to fail a plan.
 */
export type KindRule = { readonly apart: boolean; readonly perFortnight: number };

/** A meal as a kind rule reads it: only the meals that have the kind it counts. */
export type KindMeal = { readonly dayIndex: number; readonly kind: string };

/** How often one kind may appear in a plan of `days` days — `perFortnight` in fourteen, scaled, one at least. */
export function kindCap(rule: KindRule, days: number): number {
  return Math.max(1, Math.ceil((rule.perFortnight * days) / 14));
}

/**
 * How many meals break `rule` in these: each past the plan's cap and, for a
 * rule that keeps a kind apart, each second one on a day and each day that
 * follows a day of the same kind. Counted by the meal, as `PROTEIN_RULES`'
 * excess is.
 */
export function kindExcess(meals: readonly KindMeal[], days: number, rule: KindRule): number {
  const cap = kindCap(rule, days);
  const byKind = new Map<string, Map<number, number>>();

  for (const meal of meals) {
    const byDay = byKind.get(meal.kind) ?? new Map<number, number>();

    byDay.set(meal.dayIndex, (byDay.get(meal.dayIndex) ?? 0) + 1);
    byKind.set(meal.kind, byDay);
  }

  let excess = 0;

  for (const byDay of byKind.values()) {
    let total = 0;

    for (const [dayIndex, count] of byDay) {
      total += count;

      if (rule.apart) {
        excess += count - 1 + (byDay.has(dayIndex - 1) ? 1 : 0);
      }
    }

    excess += Math.max(0, total - cap);
  }

  return excess;
}

/** Whether a meal of `kind` on `dayIndex` would add to `kindExcess` over `meals`: at its cap or, kept apart, beside one of its kind. */
export function kindCrowded(kind: string | null | undefined, dayIndex: number, meals: readonly KindMeal[], days: number, rule: KindRule): boolean {
  if (kind === null || kind === undefined) {
    return false;
  }

  let total = 0;

  for (const meal of meals) {
    if (meal.kind === kind) {
      if (rule.apart && Math.abs(meal.dayIndex - dayIndex) <= 1) {
        return true;
      }

      total += 1;
    }
  }

  return total >= kindCap(rule, days);
}

/** Each pool dish's kind under one rule, by slug; null for a dish the rule does not count. */
export type KindIndex = ReadonlyMap<string, string | null>;

/**
 * One rule as the scheduler applies it: the rule, each pool dish's kind, the
 * meals it counts at (every meal when absent), and the kind a placement names
 * itself — what a swap or a rebuild knows of a meal the pool does not hold
 * (`Placement.starch`, `Placement.legume`). Undefined there means "read the
 * index"; null means "none".
 */
export type KindCheck = {
  readonly index: KindIndex;
  readonly named?: (placement: Placement) => string | null | undefined;
  readonly rule: KindRule;
  readonly slots?: ReadonlySet<MealSlot>;
};

/** Placements as one check reads them, keeping only the meals with a kind it counts. */
export function kindMeals(placements: readonly Placement[], check: KindCheck): KindMeal[] {
  const meals: KindMeal[] = [];

  for (const placement of placements) {
    if (check.slots && !check.slots.has(placement.slot)) {
      continue;
    }

    const named = check.named?.(placement);
    const kind = named === undefined ? (check.index.get(placement.dishSlug) ?? null) : named;

    if (kind !== null) {
      meals.push({ dayIndex: placement.dayIndex, kind });
    }
  }

  return meals;
}

/** Whether a dish placed at `slot` has a kind this check counts. */
export function countsFor(check: KindCheck, slug: string, slot: MealSlot): boolean {
  return (!check.slots || check.slots.has(slot)) && (check.index.get(slug) ?? null) !== null;
}

/** How many of the checks `slug` at `slot` on `dayIndex` would break, against each check's meals elsewhere (`kindMeals`). */
export function kindsCrowded(
  slug: string,
  slot: MealSlot,
  dayIndex: number,
  elsewhere: readonly (readonly KindMeal[])[],
  checks: readonly KindCheck[],
  days: number
): number {
  let crowded = 0;

  for (const [position, check] of checks.entries()) {
    if (countsFor(check, slug, slot) && kindCrowded(check.index.get(slug), dayIndex, elsewhere[position] ?? [], days, check.rule)) {
      crowded += 1;
    }
  }

  return crowded;
}

/** `kindExcess` summed over the checks, each over these placements. */
export function kindsExcess(placements: readonly Placement[], checks: readonly KindCheck[], days: number): number {
  return checks.reduce((sum, check) => sum + kindExcess(kindMeals(placements, check), days, check.rule), 0);
}
