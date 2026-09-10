import type { Catalogue, ShoppingDraft, ShoppingDraftItem } from 'core/entities/Plan';

/** Anything shaped like a plan: days of meals, each with its scaled ingredients. A scheduled plan is one; a plan read back for a swap is another. */
export type ShoppingSource = {
  readonly days: readonly { readonly meals: readonly { readonly ingredients: readonly { readonly grams: number; readonly slug: string }[] }[] }[];
};

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
 */
export function buildShoppingList(assignment: ShoppingSource, catalogue: Catalogue, locale = 'es-ES'): ShoppingDraft {
  const totals = new Map<string, number>();

  for (const day of assignment.days) {
    for (const meal of day.meals) {
      for (const item of meal.ingredients) {
        totals.set(item.slug, (totals.get(item.slug) ?? 0) + item.grams);
      }
    }
  }

  const items: ShoppingDraftItem[] = [];

  for (const [slug, grams] of totals) {
    const ingredient = catalogue.get(slug);

    // A slug absent from the catalogue cannot be priced, bought or checked for
    // allergens. Skipping it would put an invisible hole in the list, so the
    // caller validates first — by here, every slug resolves.
    if (!ingredient) {
      continue;
    }

    const totalGrams = roundTo(grams, 1);
    const display = toDisplay(totalGrams, ingredient.defaultUnit, ingredient.gramsPerUnit);

    items.push({
      category: ingredient.category,
      displayQuantity: display.quantity,
      displayUnit: display.unit,
      ingredientId: ingredient.id,
      name: ingredient.name,
      slug,
      totalGrams
    });
  }

  return { items: items.sort(byAisleThenName(locale)) };
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
 */
function toDisplay(totalGrams: number, defaultUnit: ShoppingDraftItem['displayUnit'], gramsPerUnit: number | null) {
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
