import { describe, expect, it } from 'vitest';

import { ALLERGEN_SEED } from './allergens';
import { INGREDIENT_NAMES_EN_GB } from './ingredient-names';
import { INGREDIENT_SEED } from './ingredients';

import type { FoodClass, IngredientSeed } from './ingredients';
import { SUBSTITUTION_EXTRAS, SUBSTITUTION_GROUPS, substitutionPairs } from './substitutions';

const ALLERGEN_KEYS = new Set(ALLERGEN_SEED.map(a => a.key));

/** Wide enough to clear the honest table-vs-model spread, tight enough to catch a decimal slip. */
const RATIO_BAND = { max: 1.6, min: 0.6 } as const;

/** Below this the ratio is noise — a 5 kcal herb swings wildly on a rounding difference. */
const ESTIMATE_FLOOR_KCAL = 15;

describe('INGREDIENT_SEED', () => {
  it('references only allergen keys that exist in ALLERGEN_SEED', () => {
    for (const ingredient of INGREDIENT_SEED) {
      for (const link of ingredient.allergens ?? []) {
        expect(ALLERGEN_KEYS.has(link.key), `"${ingredient.slug}" references unknown allergen key "${link.key}"`).toBe(true);
      }
    }
  });

  it('has no duplicate slugs', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const ingredient of INGREDIENT_SEED) {
      if (seen.has(ingredient.slug)) {
        duplicates.push(ingredient.slug);
      }

      seen.add(ingredient.slug);
    }

    expect(duplicates).toEqual([]);
  });

  it('has only non-negative macros', () => {
    for (const ingredient of INGREDIENT_SEED) {
      expect(ingredient.carbs, `"${ingredient.slug}" carbs`).toBeGreaterThanOrEqual(0);
      expect(ingredient.fat, `"${ingredient.slug}" fat`).toBeGreaterThanOrEqual(0);
      expect(ingredient.kcal, `"${ingredient.slug}" kcal`).toBeGreaterThanOrEqual(0);
      expect(ingredient.protein, `"${ingredient.slug}" protein`).toBeGreaterThanOrEqual(0);

      if (ingredient.fiber !== undefined) {
        expect(ingredient.fiber, `"${ingredient.slug}" fiber`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // A sanity band, not a physics check.
  //
  // Its job is to catch transcription errors — a misplaced decimal, a figure
  // copied from the wrong row — which are off by 2x or 10x, not by 30%. Real
  // composition tables disagree with an Atwater estimate by considerably more
  // than 30% for legitimate reasons: they differ on whether carbohydrate is
  // reported total or available, fibre is only partly metabolised, and spices and
  // some vegetables sit well outside the model. Measured across this catalogue
  // the honest spread is [0.84, 1.43].
  //
  // A tighter band would not find more typos; it would push the data away from
  // its sources to satisfy the formula, which is the opposite of the point.
  // Entries below the floor are skipped: for a 5 kcal herb the ratio is noise.
  it('has a kcal in a sane ratio to its macros for every entry', () => {
    for (const ingredient of INGREDIENT_SEED) {
      const fiber = ingredient.fiber ?? 0;
      const availableCarbs = Math.max(ingredient.carbs - fiber, 0);
      const estimate = 4 * ingredient.protein + 4 * availableCarbs + 9 * ingredient.fat + 2 * fiber;

      if (estimate < ESTIMATE_FLOOR_KCAL) {continue;}

      const ratio = ingredient.kcal / estimate;

      expect(
        ratio,
        `"${ingredient.slug}" kcal=${ingredient.kcal} against a macro estimate of ${estimate.toFixed(1)} (ratio ${ratio.toFixed(2)}) — check for a transcription error`
      ).toBeGreaterThanOrEqual(RATIO_BAND.min);
      expect(ratio, `"${ingredient.slug}" kcal=${ingredient.kcal} against a macro estimate of ${estimate.toFixed(1)} (ratio ${ratio.toFixed(2)})`).toBeLessThanOrEqual(
        RATIO_BAND.max
      );
    }
  });
});

/**
 * The catalogue is bilingual, and a gap in either direction is a bug someone
 * only finds by reading their shopping list in the wrong language.
 */
describe('INGREDIENT_NAMES_EN_GB', () => {
  it('translates every seeded ingredient', () => {
    const missing = INGREDIENT_SEED.filter(ingredient => INGREDIENT_NAMES_EN_GB[ingredient.slug] === undefined).map(ingredient => ingredient.slug);

    expect(missing).toEqual([]);
  });

  it('translates nothing that is not seeded', () => {
    // An orphan entry is a slug that was renamed, and the rename left a
    // translation behind that now silently applies to nothing.
    const slugs = new Set(INGREDIENT_SEED.map(ingredient => ingredient.slug));

    expect(Object.keys(INGREDIENT_NAMES_EN_GB).filter(slug => !slugs.has(slug))).toEqual([]);
  });

  it('has no blank name', () => {
    expect(Object.entries(INGREDIENT_NAMES_EN_GB).filter(([, name]) => name.trim() === '')).toEqual([]);
  });

  it('does not leave a name untranslated', () => {
    // Not a spell check — plenty of names are genuinely the same in both (Kiwi,
    // Tempeh, Hummus, Pak choi, Skyr, Ricotta). This catches the copy-paste that
    // leaves a whole Spanish phrase sitting in the English column: an identical
    // name is a problem when it reads as Spanish — an accent, a Spanish
    // connective, or a Spanish kitchen word.
    const readsAsSpanish = /[áéíóúñü]|\b(?:al|con|de|del|en|para|y)\b|cocid|congelad|fresc|picad|rallad|salsa|queso/iu;
    const identical = INGREDIENT_SEED.filter(ingredient => INGREDIENT_NAMES_EN_GB[ingredient.slug] === ingredient.name)
      .filter(ingredient => readsAsSpanish.test(ingredient.name))
      .map(ingredient => ingredient.slug);

    expect(identical).toEqual([]);
  });
});

describe('SUBSTITUTION_GROUPS and SUBSTITUTION_EXTRAS', () => {
  const slugs = new Set(INGREDIENT_SEED.map(entry => entry.slug));
  const pairs = substitutionPairs();

  it('name only seeded ingredients, so every alternative has macros and allergen links', () => {
    for (const group of SUBSTITUTION_GROUPS) {
      for (const member of group.members) {expect(slugs.has(member), `${group.name}: ${member}`).toBe(true);}
    }

    for (const extra of SUBSTITUTION_EXTRAS) {
      expect(slugs.has(extra.from), extra.from).toBe(true);
      expect(slugs.has(extra.to), extra.to).toBe(true);
    }
  });

  it('never offer an ingredient as its own alternative, and never the same pair twice', () => {
    const keys = pairs.map(pair => `${pair.ingredient}→${pair.substitute}`);

    expect(pairs.every(pair => pair.ingredient !== pair.substitute)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('scale by a ratio a cook could follow', () => {
    for (const pair of pairs) {
      expect(pair.ratio, `${pair.ingredient} → ${pair.substitute}`).toBeGreaterThanOrEqual(0.25);
      expect(pair.ratio, `${pair.ingredient} → ${pair.substitute}`).toBeLessThanOrEqual(4);
    }
  });

  /**
   * The rule that keeps a vegetarian, pescatarian or halal plan intact without the
   * code knowing the person's pattern: a swap may leave a class of food, never
   * enter one. Dietary patterns are enforced only in the prompt, so this is the
   * one place a substitute could otherwise undo them. The classes come from the
   * rows themselves — `foodClasses` — so a new pork cut or a new fish is covered
   * the moment it is seeded, not when someone remembers to extend a list here.
   */
  it('never introduce a class of food the dish did not already have', () => {
    const classesOf = new Map(INGREDIENT_SEED.map(entry => [entry.slug, foodClasses(entry)]));

    for (const pair of pairs) {
      const from = classesOf.get(pair.ingredient) ?? new Set<FoodClass>();
      const to = classesOf.get(pair.substitute) ?? new Set<FoodClass>();

      for (const cls of to) {
        expect(from.has(cls), `${pair.ingredient} → ${pair.substitute} introduces ${cls}`).toBe(true);
      }
    }
  });
});

/**
 * Every class a row belongs to: what it tags, what its allergens reveal, and
 * what those imply — pork is meat, and all of them are animal.
 */
function foodClasses(entry: IngredientSeed): ReadonlySet<FoodClass> {
  const classes = new Set<FoodClass>(entry.classes ?? []);
  const allergens = new Set((entry.allergens ?? []).filter(link => (link.presence ?? 'contains') === 'contains').map(link => link.key));

  if (allergens.has('milk') || allergens.has('lactose')) {classes.add('dairy');}

  if (allergens.has('eggs')) {classes.add('egg');}

  if (allergens.has('fish')) {classes.add('fish');}

  if (allergens.has('crustaceans') || allergens.has('molluscs')) {classes.add('shellfish');}

  if (classes.has('pork')) {classes.add('meat');}

  if (classes.size > 0) {classes.add('animal');}

  return classes;
}
