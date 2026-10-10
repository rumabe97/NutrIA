import { toDry, withoutCooked } from 'core/domain/Yield';
import type { Catalogue, ShoppingDraftItem } from 'core/entities/Plan';

/**
 * One day of a plan as the list reads it: the meals eaten on it and, when the
 * caller has it, the day's own date.
 *
 * `date` is the plan's own `YYYY-MM-DD` string, never a `Date`: a range is
 * chosen by a reader who may be in another timezone than the one that generated
 * the plan, and a day that shifts by an hour is a day that buys the wrong food.
 *
 * It is optional because a caller that groups meals by `dayIndex` has no date to
 * give. Such a day is still counted into the row's total — the list is never
 * short — but it is filed under a key no range can choose, so it cannot be
 * filtered. Every writer should give its days a date.
 */
export type ShoppingSourceDay = {
  readonly date?: string;
  readonly dayIndex?: number;
  readonly meals: readonly { readonly ingredients: readonly { readonly grams: number; readonly slug: string }[] }[];
};

/** Anything shaped like a plan: days of meals, each with its scaled ingredients. A scheduled plan is one; a plan read back for a swap is another. */
export type ShoppingSource = { readonly days: readonly ShoppingSourceDay[] };

/**
 * What each day of the plan owes one row, keyed by the day's date — the
 * breakdown a range is computed from (`0091`).
 *
 * The grams are **unrounded** and already dry where `0078` applies: the
 * cooked-to-dry division is linear, so it may happen per day, but the 5 g
 * round-up may not — rounding fourteen days up and then adding them over-buys
 * by up to 70 g an ingredient. So this holds the raw numbers and
 * `rangeQuantity` rounds once, after the sum.
 */
export type ShoppingPerDay = Readonly<Record<string, number>>;

/**
 * A row carrying what any set of days needs of it: enough to compute a range's
 * quantity with no catalogue and no plan at hand, which is what lets the
 * supermarket screen filter with no signal (`0053`).
 *
 * `dryRounded` and `gramsPerUnit` are here because neither can be recovered
 * from the rest of the row. A merged couscous row is named and slugged after
 * the *dry* food, so nothing in it says its weight came off a cooked grain and
 * must be rounded up; and 3 eggs for 150 g does not say that an egg is 58 g.
 */
export type ShoppingRangeRow = {
  readonly displayQuantity: number;
  readonly displayUnit: ShoppingDraftItem['displayUnit'];
  /** Whether this row holds dry weight read off a cooked grain, so a range's sum is rounded up to the 5 g step (`0078`). */
  readonly dryRounded: boolean;
  readonly gramsPerUnit: number | null;
  readonly perDay: ShoppingPerDay;
  readonly totalGrams: number;
};

/** What a row shows for a chosen range: the same three numbers a stored row holds. */
export type RangeQuantity = Pick<ShoppingRangeRow, 'displayQuantity' | 'displayUnit' | 'totalGrams'>;

/** A row paired with what the chosen range needs of it. */
export type RangeRow<T extends ShoppingRangeRow> = T & { readonly range: RangeQuantity };

/** A built row: what a plan stores, plus the breakdown a range is read from. */
export type ShoppingRow = ShoppingDraftItem & ShoppingRangeRow;

/** A built list. Assignable to `ShoppingDraft`, so every caller that only stores rows is unchanged. */
export type ShoppingList = { readonly items: readonly ShoppingRow[] };

/** Aisle order, so the list reads the way a supermarket is walked. */
const CATEGORY_ORDER = ['produce', 'protein', 'dairy', 'bakery', 'frozen', 'pantry', 'beverages', 'other'] as const;

/**
 * Turns a fortnight of meals into one list.
 *
 * This is deterministic code, not a model call: three "tomate" lines across
 * fourteen days become one row of 450 g by addition. Asking a model to add up
 * grams is the clearest possible example of using the wrong tool
 * ([`0004`](../../../../../docs/decisions/0004-deterministic-safety-layer.md) § the split).
 *
 * `name` and `category` are snapshotted from the catalogue rather than referenced,
 * so a list stays readable after the catalogue moves on.
 *
 * Cooked grains and pastas are bought dry (`0078`): each is summed as its dry
 * weight, on the dry food's row when the catalogue has one — so cooked and dry
 * couscous in one plan are one line — or on its own row named "(en seco)" when
 * it does not. A row that took any of that is rounded up to 5 g: a yield is an
 * average, and a list that comes up short is the one way it can fail.
 *
 * Every row also carries what each day contributes to it (`0091`), and its
 * `totalGrams` is that breakdown summed by the very function a range uses — so
 * a range over the whole plan cannot drift from the stored total, not even by a
 * float's last bit.
 */
export function buildShoppingList(assignment: ShoppingSource, catalogue: Catalogue, locale = 'es-ES'): ShoppingList {
  const perDay = new Map<string, Map<string, number>>();
  // Rows that hold dry weight read off a cooked grain.
  const dried = new Set<string>();

  for (const [index, day] of assignment.days.entries()) {
    const key = dayKey(day, index);

    for (const meal of day.meals) {
      for (const item of meal.ingredients) {
        const dry = toDry(item.slug, item.grams);
        const slug = dry?.drySlug && catalogue.has(dry.drySlug) ? dry.drySlug : item.slug;
        const days = perDay.get(slug) ?? new Map<string, number>();

        days.set(key, (days.get(key) ?? 0) + (dry?.dryGrams ?? item.grams));
        perDay.set(slug, days);

        if (dry) {
          dried.add(slug);
        }
      }
    }
  }

  const items: ShoppingRow[] = [];

  for (const [slug, days] of perDay) {
    const ingredient = catalogue.get(slug);

    // A slug absent from the catalogue cannot be priced, bought or checked for
    // allergens. Skipping it would put an invisible hole in the list, so the
    // caller validates first — by here, every slug resolves.
    if (!ingredient) {
      continue;
    }

    const breakdown = Object.fromEntries(days);
    const quantity = quantityOf(sumDays(breakdown), dried.has(slug), ingredient.defaultUnit, ingredient.gramsPerUnit);

    items.push({
      category: ingredient.category,
      displayQuantity: quantity.displayQuantity,
      displayUnit: quantity.displayUnit,
      dryRounded: dried.has(slug),
      gramsPerUnit: ingredient.gramsPerUnit,
      ingredientId: ingredient.id,
      // Still the cooked food's row only when the catalogue has no dry one to merge into.
      name: dried.has(slug) && toDry(slug, 0) ? `${withoutCooked(ingredient.name)} ${dryLabel(locale)}` : ingredient.name,
      perDay: breakdown,
      slug,
      totalGrams: quantity.totalGrams
    });
  }

  return { items: items.sort(byAisleThenName(locale)) };
}

/**
 * What a chosen set of days needs of one row (`0091`): the days summed, *then*
 * rounded up to the 5 g step where the row is dry weight, *then* converted to
 * the unit the row is read in. In that order, and once — the round-up after the
 * sum, never per day.
 *
 * Two edges are defined rather than left to each caller, because the server and
 * the screen both call this and must not disagree:
 *
 * - **A row with no breakdown shows its stored quantity, whatever the range** —
 *   including a range of no days at all. A row somebody typed in themselves
 *   belongs to no day, and a row stored before the breakdown existed has none
 *   either. Neither may be hidden from a reader walking a supermarket, so both
 *   read as the whole plan's need.
 * - **No days chosen is nothing to buy**, for every row that *has* days. A plan
 *   whose rows carry no days offers none to choose, which is not the same as a
 *   reader choosing none, and the first rule above is what tells them apart.
 */
export function rangeQuantity(row: ShoppingRangeRow, days: Iterable<string>): RangeQuantity {
  const chosen = new Set(days);

  // A row with no breakdown is answered **first**, before the empty range, and
  // the order is the whole of this: a list stored before the breakdown existed
  // has no dated row, so its plan offers no days, so every range over it is
  // empty — and asking "did the reader choose nothing?" ahead of "does this row
  // belong to any day?" answered zero for every row and hid the entire list.
  // That shipped, and it emptied the shopping list of every account whose plan
  // predated the change (2026-10-10).
  if (Object.keys(row.perDay).length === 0) {
    return { displayQuantity: row.displayQuantity, displayUnit: row.displayUnit, totalGrams: row.totalGrams };
  }

  if (chosen.size === 0) {
    return { displayQuantity: 0, displayUnit: row.displayUnit, totalGrams: 0 };
  }

  return quantityOf(sumDays(row.perDay, chosen), row.dryRounded, row.displayUnit, row.gramsPerUnit);
}

/**
 * The rows a range shows, each with that range's quantity beside the whole
 * plan's — the screen needs both: one to read, one to cap a mark against.
 *
 * Rows the range does not need at all are dropped, as `0091` says: a day that
 * eats no tomato has no tomato line. The order is the one it was given, which
 * is each caller's own aisle order — a stored list is ordered by the database's
 * category enum, a freshly built one by `CATEGORY_ORDER`, and re-sorting here
 * would silently change one of them.
 */
export function rangeList<T extends ShoppingRangeRow>(list: { readonly items: readonly T[] }, days: Iterable<string>): readonly RangeRow<T>[] {
  const chosen = new Set(days);

  return list.items.map(item => ({ ...item, range: rangeQuantity(item, chosen) })).filter(item => item.range.totalGrams > 0);
}

/** What a row of dry weight is rounded up to. */
const DRY_STEP_G = 5;

/**
 * The three numbers a quantity of grams reads as: rounded to the gram's tenth
 * first, so 240.0000001 is not bought as 245.
 */
function quantityOf(grams: number, dryRounded: boolean, defaultUnit: ShoppingDraftItem['displayUnit'], gramsPerUnit: number | null): RangeQuantity {
  const totalGrams = dryRounded ? Math.ceil(roundTo(grams, 1) / DRY_STEP_G) * DRY_STEP_G : roundTo(grams, 1);
  const display = toDisplay(totalGrams, defaultUnit, gramsPerUnit);

  return { displayQuantity: display.quantity, displayUnit: display.unit, totalGrams };
}

/**
 * The grams a breakdown owes a set of days, unrounded — every day when no set
 * is given.
 *
 * It walks the breakdown and asks whether each day was chosen, rather than
 * walking the chosen days: so a date named twice is counted once, and so the
 * whole plan's sum adds its days in exactly the order a range does. Floating
 * point is not associative, and that order is what makes a row's stored total
 * and a range over all of its days the same number rather than nearly.
 */
function sumDays(perDay: ShoppingPerDay, chosen?: ReadonlySet<string>): number {
  let grams = 0;

  for (const [date, value] of Object.entries(perDay)) {
    if (!chosen || chosen.has(date)) {
      grams += value;
    }
  }

  return grams;
}

/**
 * The key a day's grams are filed under: its own date, or a placeholder for a
 * caller that has none. The placeholder cannot collide with a `YYYY-MM-DD`
 * date, so an undated day counts towards the total and is invisible to every
 * range — the list is never short, and never filtered wrong.
 */
function dayKey(day: ShoppingSourceDay, index: number): string {
  return day.date ?? `day-${index + 1}`;
}

/** What says a cooked food's row is weighed dry, in the list's language. */
function dryLabel(locale: string): string {
  return locale.startsWith('en') ? '(dry)' : '(en seco)';
}

/** Slugs in the assignment that the catalogue cannot resolve. Empty on a valid plan. */
export function unresolvedSlugs(assignment: ShoppingSource, catalogue: Catalogue): readonly string[] {
  const missing = new Set<string>();

  for (const day of assignment.days) {
    for (const meal of day.meals) {
      for (const item of meal.ingredients) {
        if (!catalogue.has(item.slug)) {
          missing.add(item.slug);
        }
      }
    }
  }

  return [...missing];
}

/**
 * Countables are shown as whole units, rounded **up** — you cannot buy 2.3 eggs,
 * and rounding down would leave a plan short. Everything else stays in its base
 * unit; formatting 1,200 g as "1,2 kg" is presentation, and belongs in the UI
 * rather than in a stored `measurement_unit` the enum has no `kg` member for.
 *
 * Exported because the screen needs it for a number this module does not
 * compute: what is **left** of a row that is partly bought (project 020 phase
 * 4). That remainder is a subtraction, not a range, so it takes no dry round-up
 * — the need was rounded once when the range was summed, and rounding the
 * leftover again would invent grams. One copy of the unit rules all the same,
 * which is `0091`'s point.
 */
export function toDisplay(totalGrams: number, defaultUnit: ShoppingDraftItem['displayUnit'], gramsPerUnit: number | null) {
  if ((defaultUnit === 'unit' || defaultUnit === 'slice') && gramsPerUnit && gramsPerUnit > 0) {
    return { quantity: Math.ceil(totalGrams / gramsPerUnit), unit: defaultUnit };
  }

  if (defaultUnit === 'ml') {
    return { quantity: totalGrams, unit: 'ml' as const };
  }

  return { quantity: totalGrams, unit: 'g' as const };
}

/**
 * Aisle order first, then the name — collated in the list's own language.
 *
 * The locale matters here: `localeCompare` with the wrong one puts accented
 * words in the wrong place, which on a list you read while walking a supermarket
 * is exactly where you will not look.
 */
function byAisleThenName(locale: string) {
  return (a: ShoppingDraftItem, b: ShoppingDraftItem): number => {
    const order = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);

    return order !== 0 ? order : a.name.localeCompare(b.name, locale);
  };
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
