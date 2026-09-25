import { DISHES_NEEDED_PER_SLOT, seededShuffle } from 'core/domain/Variety';

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
 * Nothing here reports a violation or removes a food from anyone's catalogue:
 * a meal is a question of what somebody would eat at that hour, not of what is
 * safe for them. The allergy gate (`domain/Safety`) and the preferences
 * (`domain/Preference`) run before and apart from it; this only takes meals
 * away from a dish they have already let through, and rows away from what one
 * meal's request is shown (`mealCatalogue`) out of what they already allowed.
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
 * prompt; it never takes a food away on its own (`0062` § 6). The one other
 * reader is `mealCatalogue`'s second cut, which *keeps* in-season produce
 * beside what the library cooks (`0063` § 1) — a reason to show a row, never
 * a reason to hide one.
 */
export function inSeason(ingredient: CatalogueIngredient, month: number): boolean {
  return ingredient.seasonMonths.length === 0 || ingredient.seasonMonths.includes(month);
}

/**
 * Whether this meal offers the plant proteins lunch does: every one that
 * belongs at lunch for this person belongs here too.
 *
 * The lists keep the stewed and dry pulses — lentils, chickpeas, beans — at
 * lunch (`seed/ingredients/meals.ts`, rule 1), and the catalogue has no class
 * that says "pulse", so this is how a meal is found to have lost them: a
 * plant protein lunch has and this meal does not. An omnivore's dinner has
 * lost them; a vegan's has not (`0062` § 4); with every list empty nothing has.
 * The pool prompt names legumes among a meal's main proteins only where this
 * holds, so it never asks for what the catalogue it shows does not offer.
 */
export function offersPulses(ingredients: readonly CatalogueIngredient[], slot: MealSlot, dietaryPatterns: readonly string[]): boolean {
  return ingredients.every(
    ingredient => !isPlantProtein(ingredient) || !belongsTo(ingredient, 'lunch', dietaryPatterns) || belongsTo(ingredient, slot, dietaryPatterns)
  );
}

// --- The second cut: lunch and dinner (`0063`) --------------------------------

/**
 * The meals whose catalogue is cut a second time (`0063` § 1–2). Nearly every
 * food belongs at lunch and at dinner, so their lists alone took 13% and 16%
 * off; breakfast and the snacks were already halved by theirs, and are where a
 * new idea is easiest to lose.
 */
export const SECOND_CUT_SLOTS: ReadonlySet<MealSlot> = new Set<MealSlot>(['lunch', 'dinner']);

/**
 * How many of a lunch's or a dinner's remaining rows — neither cooked by the
 * library there nor in-season produce — one request is shown, drawn afresh
 * for each generation (`0063` § 1). The only way a food no recipe uses yet
 * reaches those meals: if their variety drops, this grows.
 *
 * 30, tuned down from the plan's 60 against PRD 2 on the dev library
 * (2026-09-25): the standard lunch prompt must be at most 55% of 3.4.0's, and
 * at 60 it was 57.4% in its worst month (January, when most produce is in
 * season); at 30 it is 54.8% at worst over every month and eight seeds
 * (project 005, phase 4 in `LOG.md`). The library's own usage grows as it
 * does, and pushes the other way: re-measure with `catalogue-by-meal.mjs`
 * before raising this.
 */
export const CATALOGUE_SAMPLE_SIZE = 30;

/**
 * Fewer dishes than this at a meal and the library says too little about what
 * that meal is cooked from: its catalogue is not cut a second time. The number
 * a fortnight needs per slot (`DISHES_NEEDED_PER_SLOT`), so "the library cooks
 * this meal" means at least as much as one plan eats of it — and an empty
 * database, as an end-to-end run starts from, cuts nothing.
 */
const USAGE_MIN_DISHES = DISHES_NEEDED_PER_SLOT;

/** A library recipe as its usage is read: where it is served as stored, and what it is made of. */
export type LibraryRecipe = { readonly ingredients: readonly { readonly id: string; readonly slug: string }[]; readonly slots: readonly MealSlot[] };

/** Per meal, the ids of the ingredients the library cooks it from. A meal it says too little about is absent. */
export type LibraryUsage = ReadonlyMap<MealSlot, ReadonlySet<string>>;

/**
 * Which ingredients the library cooks each of these meals from, for this
 * person (`0063` § 1).
 *
 * Every recipe is placed at the meals `fitSlots` gives it for *this* person,
 * never at the stored `meal_slots`: a generated dish is stored with the meals
 * it was narrowed to for whoever generated it (project 005, phase 3), so a
 * vegan's lentil dinner is stored as a dinner and must not make lentils a
 * dinner food for an omnivore — nor an omnivore's narrowing hide them from a
 * vegan.
 *
 * The whole library, in every language — not only the person's, as `0063`
 * first said. An ingredient's id is the same in every language and the
 * catalogue it is matched against is already this person's, so a Spanish
 * lentil stew says as much about an English dinner as an English one would.
 * And the person's own language can say almost nothing: on 2026-09-25 the
 * English library was 44 dishes, 20 of them dinners made from two ingredients
 * between them, which would have shown an English dinner those two, the
 * produce in season and the sample — no meat, no fish, no starch. A meal the
 * whole library says too little about is left out, and not cut at all.
 */
export function libraryUsage(
  recipes: readonly LibraryRecipe[],
  slots: readonly MealSlot[],
  catalogue: Catalogue,
  dietaryPatterns: readonly string[]
): LibraryUsage {
  const fitted = recipes.map(recipe => ({ recipe, slots: fitSlots(recipe, catalogue, dietaryPatterns) }));
  const usage = new Map<MealSlot, ReadonlySet<string>>();

  for (const slot of slots) {
    const there = fitted.filter(entry => entry.slots.includes(slot)).map(entry => entry.recipe);

    if (there.length >= USAGE_MIN_DISHES) {
      usage.set(slot, new Set(there.flatMap(recipe => recipe.ingredients.map(ingredient => ingredient.id))));
    }
  }

  return usage;
}

/** What the second cut needs: the month the fortnight starts, what the library cooks at the meal, and the generation's own seed. */
export type CatalogueCut = {
  /** 1–12: the fortnight's first day, or the day a swap replaces. */
  readonly month: number;
  /** Anything stable per generation and different across them — a job's id. The same seed always draws the same sample. */
  readonly seed: string;
  /** The ids `libraryUsage` gives for this meal. */
  readonly used: ReadonlySet<string>;
};

function bySlug(a: CatalogueIngredient, b: CatalogueIngredient): number {
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

/**
 * The rows one meal's request is shown, from rows already safe and wanted.
 *
 * First `0062`'s cut: the rows that belong at the meal for this person. Then,
 * for lunch and dinner with a `cut`, `0063`'s: of those, only what the
 * library cooks there, the produce in season this month, and a sample of the
 * rest — `CATALOGUE_SAMPLE_SIZE` rows, shuffled from slug order by the seed
 * and the meal, so a job's prompt can be rebuilt from its id and the next
 * job's shows other foods. Breakfast, the snacks, and a meal with no `cut`
 * keep the first cut alone.
 *
 * Only ever removes rows: every row returned was in `ingredients`, in the same
 * order. The allergy gate and the preferences run before this and are not
 * touched by it.
 */
export function mealCatalogue<T extends CatalogueIngredient>(
  ingredients: readonly T[],
  slot: MealSlot,
  dietaryPatterns: readonly string[],
  cut: CatalogueCut | null = null
): T[] {
  const belonging = ingredients.filter(ingredient => belongsTo(ingredient, slot, dietaryPatterns));

  if (!cut || !SECOND_CUT_SLOTS.has(slot)) {
    return belonging;
  }

  const kept = new Set(
    belonging
      .filter(ingredient => cut.used.has(ingredient.id) || (ingredient.category === 'produce' && inSeason(ingredient, cut.month)))
      .map(ingredient => ingredient.id)
  );
  const rest = belonging.filter(ingredient => !kept.has(ingredient.id)).sort(bySlug);

  for (const ingredient of seededShuffle(rest, `${cut.seed}:${slot}`).slice(0, CATALOGUE_SAMPLE_SIZE)) {
    kept.add(ingredient.id);
  }

  return belonging.filter(ingredient => kept.has(ingredient.id));
}
