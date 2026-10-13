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
export type KindRule = {
  readonly apart: boolean;
  /**
   * Whether a meal somebody fixed spends this rule's cap (`0099`). Required, so
   * a new rule has to say which kind it is rather than inherit an answer.
   *
   * **True for PRD 019's health maximums**: red meat twice a fortnight is about
   * what a person eats, and a Friday they chose is still a Friday they eat.
   * **False for the variety preferences** (`STARCH_RULES`, `LEGUME_RULES`,
   * `SNACK_RULES`), which exist to stop the generator reaching for pasta a fifth
   * time — charging those for a fixed Friday measures the person instead of the
   * generator, and a weekly rule would spend two of four before a dish was
   * picked.
   *
   * Either way, `apart` counts every meal: two days running is about what the
   * plate looks like two days in a row, which a fixed meal is as much a part of
   * as any other.
   */
  readonly fixedSpendsCap: boolean;
  readonly perFortnight: number;
};

/**
 * A meal as a kind rule reads it: only the meals that have the kind it counts.
 *
 * `fixed` is a meal somebody fixed to that day and slot (`0098`), and it
 * changes what the rule charges for it: see `excessOfKind`.
 */
export type KindMeal = { readonly dayIndex: number; readonly fixed?: true; readonly kind: string };

/** How often one kind may appear in a plan of `days` days — `perFortnight` in fourteen, scaled, one at least. */
export function kindCap(rule: KindRule, days: number): number {
  return Math.max(1, Math.ceil((rule.perFortnight * days) / 14));
}

/**
 * Meals counted by kind, then by day: what `kindExcess` reads of them.
 *
 * Two counts per day, because the two halves of a kind rule charge differently
 * for a meal somebody fixed (`excessOfKind`): `all` is every meal of that kind,
 * `chosen` only the ones the generator picked.
 */
export type KindDayCount = { readonly all: number; readonly chosen: number };
export type KindTally = ReadonlyMap<string, ReadonlyMap<number, KindDayCount>>;

/** These meals as a `KindTally`. */
export function kindTally(meals: readonly KindMeal[]): KindTally {
  const byKind = new Map<string, Map<number, KindDayCount>>();

  for (const meal of meals) {
    const byDay = byKind.get(meal.kind) ?? new Map<number, KindDayCount>();
    const at = byDay.get(meal.dayIndex) ?? { all: 0, chosen: 0 };

    byDay.set(meal.dayIndex, { all: at.all + 1, chosen: at.chosen + (meal.fixed ? 0 : 1) });
    byKind.set(meal.kind, byDay);
  }

  return byKind;
}

/**
 * `kindExcess` of one kind's meals, by day — and the one place that spends a
 * cap, so `KindRule.fixedSpendsCap` is read here and nowhere else that matters
 * (`0099`).
 *
 * The days-running half counts every meal whatever the rule says: the penalty
 * for a day beside a fixed one lands on the day the generator can still move,
 * so the search can act on it. Nobody asked for rice on the Thursday before
 * their rice Friday.
 */
function excessOfKind(byDay: ReadonlyMap<number, KindDayCount>, cap: number, rule: KindRule): number {
  let spent = 0;
  let excess = 0;

  for (const [dayIndex, count] of byDay) {
    spent += rule.fixedSpendsCap ? count.all : count.chosen;

    if (rule.apart) {
      excess += count.all - 1 + (byDay.has(dayIndex - 1) ? 1 : 0);
    }
  }

  return excess + Math.max(0, spent - cap);
}

/**
 * How many meals break `rule` in these: each past the plan's cap and, for a
 * rule that keeps a kind apart, each second one on a day and each day that
 * follows a day of the same kind. Counted by the meal, as `PROTEIN_RULES`'
 * excess is.
 */
export function kindExcess(meals: readonly KindMeal[], days: number, rule: KindRule): number {
  const cap = kindCap(rule, days);
  let excess = 0;

  for (const byDay of kindTally(meals).values()) {
    excess += excessOfKind(byDay, cap, rule);
  }

  return excess;
}

/**
 * `kindExcess` of `tally`'s meals and `extra` together, given `kindExcess` of
 * `tally`'s alone (`base`): the excess is a sum over kinds, so only the kinds
 * `extra` brings are counted again. For a search that prices many days against
 * one unchanging rest of the plan.
 */
export function kindExcessWith(tally: KindTally, base: number, extra: readonly KindMeal[], days: number, rule: KindRule): number {
  if (extra.length === 0) {
    return base;
  }

  const cap = kindCap(rule, days);
  let excess = base;

  for (const [kind, added] of kindTally(extra)) {
    const before = tally.get(kind);
    const byDay = new Map(before);

    for (const [dayIndex, count] of added) {
      const at = byDay.get(dayIndex) ?? { all: 0, chosen: 0 };

      byDay.set(dayIndex, { all: at.all + count.all, chosen: at.chosen + count.chosen });
    }

    excess += excessOfKind(byDay, cap, rule) - (before ? excessOfKind(before, cap, rule) : 0);
  }

  return excess;
}

/**
 * How many meals in these are past `rule`'s cap, counted per kind — the cap
 * alone, not the days running (`kindExcess` counts both). A fixed meal does not
 * count, as it does not in `excessOfKind`.
 */
export function kindPastCap(meals: readonly KindMeal[], days: number, rule: KindRule): number {
  const totals = new Map<string, number>();

  for (const meal of meals) {
    if (rule.fixedSpendsCap || !meal.fixed) {
      totals.set(meal.kind, (totals.get(meal.kind) ?? 0) + 1);
    }
  }

  const cap = kindCap(rule, days);

  return [...totals.values()].reduce((sum, total) => sum + Math.max(0, total - cap), 0);
}

/** Whether a meal of `kind` would take it past `rule`'s cap over `meals`: the cap alone, wherever the meal lands. Fixed meals do not count (`excessOfKind`). */
export function kindAtCap(kind: string | null | undefined, meals: readonly KindMeal[], days: number, rule: KindRule): boolean {
  return (
    kind !== null && kind !== undefined && meals.filter(meal => meal.kind === kind && (rule.fixedSpendsCap || !meal.fixed)).length >= kindCap(rule, days)
  );
}

/**
 * Whether a meal of `kind` on `dayIndex` would add to `kindExcess` over `meals`:
 * past its cap or, kept apart, beside one of its kind. A meal that counts
 * `weight` times (`KindCheck.weight`) passes the cap when it adds that many.
 */
export function kindCrowded(
  kind: string | null | undefined,
  dayIndex: number,
  meals: readonly KindMeal[],
  days: number,
  rule: KindRule,
  weight = 1
): boolean {
  if (kind === null || kind === undefined) {
    return false;
  }

  let spent = 0;

  for (const meal of meals) {
    if (meal.kind === kind) {
      if (rule.apart && Math.abs(meal.dayIndex - dayIndex) <= 1) {
        return true;
      }

      spent += !rule.fixedSpendsCap && meal.fixed ? 0 : 1;
    }
  }

  return spent + weight > kindCap(rule, days);
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
  /**
   * How many times a meal counts towards the cap, one when absent: the eggs
   * on a plate count by the egg (019 phase 3), a three-egg omelette as
   * three. Only for a rule that keeps no kind apart, since a meal counted
   * twice would read as two on one day.
   */
  readonly weight?: (placement: Placement) => number;
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
      const times = check.weight?.(placement) ?? 1;

      for (let time = 0; time < times; time += 1) {
        meals.push(placement.fixed ? { dayIndex: placement.dayIndex, fixed: true, kind } : { dayIndex: placement.dayIndex, kind });
      }
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
    const weight = check.weight?.({ dayIndex, dishSlug: slug, slot }) ?? 1;

    if (countsFor(check, slug, slot) && kindCrowded(check.index.get(slug), dayIndex, elsewhere[position] ?? [], days, check.rule, weight)) {
      crowded += 1;
    }
  }

  return crowded;
}

/** `kindExcess` summed over the checks, each over these placements. */
export function kindsExcess(placements: readonly Placement[], checks: readonly KindCheck[], days: number): number {
  return checks.reduce((sum, check) => sum + kindExcess(kindMeals(placements, check), days, check.rule), 0);
}
