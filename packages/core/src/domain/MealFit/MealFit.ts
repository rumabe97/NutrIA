import type { Catalogue, CatalogueIngredient, MealSlot } from 'core/entities/Plan';

/**
 * Which meals a food, and so a dish, belongs to — and whether a food is in
 * season (`0062`, `0063`).
 *
 * The catalogue states both as exception lists: an empty `mealSlots` is every
 * meal and an empty `seasonMonths` is every month, the way an empty `countries`
 * is every country (`0034`). This is the one place those lists are read, so
 * the prompt's catalogue, the library's reuse and the gate on the model's
 * dishes cannot come to disagree about what "belongs at dinner" means.
 *
 * Nothing here removes a food from anyone's catalogue or reports a violation:
 * a meal is a question of what somebody would eat at that hour, not of what is
 * safe for them. The allergy gate (`domain/Safety`) and the preferences
 * (`domain/Preference`) run before and apart from it; this only takes meals
 * away from a dish they have already let through.
 */

/**
 * The ways of eating that see every plant protein at every meal (`0062` § 4).
 * Without it a vegan's or vegetarian's dinner protein would rest on tofu,
 * tempeh and seitan alone, since the pulses are lunch-only for everybody else.
 */
const PLANT_BASED_PATTERNS: ReadonlySet<string> = new Set(['vegan', 'vegetarian']);

/** A plant protein: the protein aisle, with nothing of animal origin (`animal` is implied by every other class). */
function isPlantProtein(ingredient: CatalogueIngredient): boolean {
  return ingredient.category === 'protein' && !ingredient.classes.includes('animal');
}

/**
 * Whether this food belongs at this meal, for this person.
 *
 * True when its list is empty (every meal) or names the meal. For somebody
 * vegan or vegetarian a plant protein also belongs to every meal whatever its
 * list says (`0062` § 4) — which is why the answer takes their ways of eating
 * and not only the food.
 *
 * `['none']` belongs to no meal at all, and the plant-based exception does
 * not reach it (`0063` § 3): a row the owner put in no meal is in no meal for
 * anybody. It is checked first so no later rule can bring it back.
 */
export function belongsTo(ingredient: CatalogueIngredient, slot: MealSlot, dietaryPatterns: readonly string[]): boolean {
  if (ingredient.mealSlots.includes('none')) {
    return false;
  }

  if (ingredient.mealSlots.length === 0 || ingredient.mealSlots.includes(slot)) {
    return true;
  }

  return isPlantProtein(ingredient) && dietaryPatterns.some(pattern => PLANT_BASED_PATTERNS.has(pattern));
}

/**
 * The meals a dish may be served at: its own `slots`, kept only where every one
 * of its ingredients belongs (`0062` § 5).
 *
 * Narrowed, never widened and never rewritten — the result is always a subset
 * of `dish.slots`, in the dish's own order. A lentil stew that called itself a
 * lunch and a dinner stays a lunch. An empty result means the dish is served
 * nowhere, and the caller drops it.
 *
 * An ingredient the catalogue does not know narrows nothing here: whether a
 * dish may use it at all is the unknown-ingredient gate's question
 * (`dishSafety`), answered before this is asked, and a second, quieter answer
 * here would hide a model inventing slugs behind a meal rule.
 */
export function fitSlots(
  dish: { readonly ingredients: readonly { readonly slug: string }[]; readonly slots: readonly MealSlot[] },
  catalogue: Catalogue,
  dietaryPatterns: readonly string[]
): MealSlot[] {
  return dish.slots.filter(slot =>
    dish.ingredients.every(item => {
      const ingredient = catalogue.get(item.slug);

      return ingredient === undefined || belongsTo(ingredient, slot, dietaryPatterns);
    })
  );
}

/**
 * Whether a food is in season in a month (1–12, Spain's calendar: `0062` § 2).
 *
 * An empty list is every month. A season orders and marks produce in the
 * prompt; it never takes a food away (`0062` § 6), so nothing may use this to
 * filter.
 */
export function inSeason(ingredient: CatalogueIngredient, month: number): boolean {
  return ingredient.seasonMonths.length === 0 || ingredient.seasonMonths.includes(month);
}
