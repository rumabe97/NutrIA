import type { Catalogue, PlanAssignment, ShoppingDraft, ShoppingDraftItem } from 'core/entities/Plan';

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
export function buildShoppingList(assignment: PlanAssignment, catalogue: Catalogue): ShoppingDraft {
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
    if (!ingredient) {continue;}

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

  return { items: items.sort(byAisleThenName) };
}

/** Slugs in the assignment that the catalogue cannot resolve. Empty on a valid plan. */
export function unresolvedSlugs(assignment: PlanAssignment, catalogue: Catalogue): readonly string[] {
  const missing = new Set<string>();

  for (const day of assignment.days) {
    for (const meal of day.meals) {
      for (const item of meal.ingredients) {
        if (!catalogue.has(item.slug)) {missing.add(item.slug);}
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

  if (defaultUnit === 'ml') {return { quantity: totalGrams, unit: 'ml' as const };}

  return { quantity: totalGrams, unit: 'g' as const };
}

function byAisleThenName(a: ShoppingDraftItem, b: ShoppingDraftItem): number {
  const order = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);

  return order !== 0 ? order : a.name.localeCompare(b.name, 'es');
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
