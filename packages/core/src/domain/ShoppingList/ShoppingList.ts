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
/**
 * What somebody typed, in grams: the inverse of `toDisplay`, and the only place
 * the two are allowed to disagree about a unit (`0096`).
 *
 * Rounded, never rounded **up**. `0078`'s 5 g step is applied once, when a
 * range is summed into what a shop still owes; applying it again to a figure
 * somebody read off a scale would invent grams they did not buy. Capped at the
 * plan's whole need, as the server caps it, so what the screen shows before the
 * round trip is what the round trip will agree with.
 *
 * Three eggs typed are 174 g stored and three eggs read back, because
 * `toDisplay` divides by the same `gramsPerUnit` it multiplied by here.
 */
export function fromDisplay(
  quantity: number,
  defaultUnit: ShoppingDraftItem['displayUnit'],
  gramsPerUnit: number | null,
  totalGrams: number
): number {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }

  const perUnit = (defaultUnit === 'unit' || defaultUnit === 'slice') && gramsPerUnit && gramsPerUnit > 0 ? gramsPerUnit : 1;

  return Math.min(Math.round(quantity * perUnit), Math.max(totalGrams, 0));
}

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
 * What a rebuild carries onto a row it rewrites (`0091`): the amount already
 * bought, never more than what the plan now needs of it, with the tick derived
 * from the two.
 *
 * Capped because a swap or an event can shrink a row — a fortnight that needed
 * 1.2 kg of chicken may need 800 g after it, and leaving 1.2 kg bought would
 * say somebody has more than the plan asks for. Floored because a stored
 * amount is never negative and this is the one place a rebuild could introduce
 * one. Pure, so the rule is provable without a database — the SQL around it
 * (the list rebuilt in one transaction) is covered end to end, while an
 * **amount** through HTTP is not yet: project 020 phase 5 owns those cases.
 *
 * Here rather than in `PlanRepository`, where it was written, because it is no
 * longer only a rebuild's rule and it never was the repository's: `seedFromPantry`
 * below hands a **brand-new** list the amounts somebody already has, and a
 * cupboard has to be clamped by exactly the arithmetic a rebuild is clamped by
 * (project 022 phase 2). One clamp, two callers, and neither of them owns it.
 */
export function carriedBought(bought: number | undefined, totalGrams: number): { readonly boughtGrams: number; readonly checked: boolean } {
  const carried = Math.min(Math.max(bought ?? 0, 0), totalGrams);

  // `totalGrams > 0` for the same reason the write derives it that way: a row
  // that needs nothing is untouched, not bought.
  return { boughtGrams: carried, checked: carried >= totalGrams && totalGrams > 0 };
}

/**
 * One thing in the cupboard, as the list reads it (project 022 phase 2).
 *
 * Only an entry the catalogue **resolved** reaches here: a list row is keyed by
 * `ingredientId`, and a word nothing in the catalogue answers has no row to
 * seed — kept in the cupboard, guessed at nowhere.
 *
 * `grams` is null for *"I have some"*, the honest answer for a bag of rice
 * nobody weighed; `seedFromPantry` says what that is taken to mean and why.
 * `slug` rides beside the id for `pantryPlates` alone, which reads a meal's own
 * ingredients and those carry slugs.
 *
 * **The person's own word is not in this type**, in any form. Nothing a
 * generation does with a cupboard can reach a prompt, a log or an error
 * (PRD 022, criterion 7).
 */
export type PantryHolding = { readonly grams: number | null; readonly ingredientId: string; readonly slug: string };

/** A built row with what the cupboard already covers of it, ready for the list's first insert. */
export type SeededShoppingRow = ShoppingRow & { readonly boughtGrams: number; readonly checked: boolean };

/**
 * A fortnight's list handed back with what somebody already has marked bought,
 * at the moment the list is first written (project 022 phase 2, `0091`).
 *
 * Every amount goes through `carriedBought`, the same arithmetic a rebuild
 * carries a shop across with, so the cap at the row's own need and the derived
 * tick cannot drift between the two paths. A row the cupboard does not name is
 * returned untouched rather than left out, so the caller writes one shape.
 *
 * **An entry with no amount seeds the whole row, ticked.** It reads as *"I have
 * all of this"* rather than *"I have some"*, and the reason is a measurement:
 * **phase 0 priced this entire feature with no amounts at all** — its cupboards
 * were slug lists, and the 17.7% of a fortnight's rows it measured counted a
 * row as held because the cupboard *named* the ingredient. The unit of the
 * promise is rows (PRD criterion 4: *«la compra baja de 38 a 27 cosas»*), and
 * `0091` gives a tick exactly two meanings — the whole plan's need, or none of
 * it — so there is no *"some"* state in this data model to put a half-held row
 * into, and inventing one is a schema change. Somebody who has half a bag types
 * the half.
 *
 * `coveredRows` is the figure that sentence reads: rows nobody has to visit,
 * which is a row whose seed covers its **whole** need — not merely a row the
 * cupboard named, because an amount below the need leaves the row on the list
 * with a remainder on it.
 */
export function seedFromPantry(
  list: ShoppingList,
  holdings: readonly PantryHolding[]
): { readonly coveredRows: number; readonly items: readonly SeededShoppingRow[] } {
  // Two cupboard entries resolving to one catalogue row are one claim about one
  // row, not two: the last wins, as the catalogue's own id → slug map keeps the
  // last of equal rows.
  const held = new Map(holdings.map(holding => [holding.ingredientId, holding.grams]));
  const items = list.items.map(item => {
    if (!held.has(item.ingredientId)) {
      return { ...item, boughtGrams: 0, checked: false };
    }

    return { ...item, ...carriedBought(held.get(item.ingredientId) ?? item.totalGrams, item.totalGrams) };
  });

  return { coveredRows: items.filter(item => item.checked).length, items };
}

/**
 * What the cupboard reached on the plates: *«9 de 42 comidas usan solo lo que ya
 * tenías»* (PRD 022, criterion 4).
 *
 * Read off a meal's own `ingredients` — the plate **as it is served**, its
 * accompaniment included — and not off the dish's: a side is bought like
 * everything else, so a meal is only *"what I already had"* when the side was
 * too. This is phase 0's own definition (`evaluate-plans.mjs`,
 * `pantryPlateMetrics.whole`), so the number the screen says is the number the
 * project was priced on.
 *
 * Presence and never amount, also as phase 0 measured it: a meal using 40 g of
 * the rice somebody has is a meal cooked from the cupboard whether or not the
 * bag was ever weighed.
 *
 * **A plate of a cooked grain is never counted, and this figure undercounts for
 * anybody who owns rice, pasta or dry pulses.** The cupboard and the *list*
 * agree on the dry row — *«tengo arroz»* resolves to the dry food and
 * `buildShoppingList` buys a cooked grain dry (`0078`), so `seedFromPantry`
 * does pre-buy it — while a plate carries the **cooked** slug, which no
 * cupboard holds. It is left that way deliberately: `pantryPlateMetrics.whole`
 * in `evaluate-plans.mjs` has the identical asymmetry, so phase 0's *≈9 of 54*
 * was measured with it, and closing it here would make this figure larger than
 * anything the project was ever priced on. Closing it is a re-measurement, not a
 * one-line fix: it means mapping a plate's slug through
 * `toDry(slug, 0)?.drySlug ?? slug` **here and in the instrument together** —
 * `drySlug` is nullable, because a cooked food whose dry counterpart the
 * catalogue lacks goes on its own "(en seco)" row. Found by `tests` while
 * writing the end-to-end suite; the owner's call, through phase 3.
 */
export function pantryPlates(assignment: ShoppingSource, slugs: ReadonlySet<string>): { readonly meals: number; readonly wholeMeals: number } {
  const meals = assignment.days.flatMap(day => day.meals);

  return {
    meals: meals.length,
    // A meal with nothing on it is not a meal cooked from the cupboard, and an
    // empty cupboard cooked none of them: `every` over an empty list says yes
    // to both.
    wholeMeals:
      slugs.size === 0 ? 0 : meals.filter(meal => meal.ingredients.length > 0 && meal.ingredients.every(item => slugs.has(item.slug))).length
  };
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
