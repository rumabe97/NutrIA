import { describe, expect, it } from 'vitest';

import { toCatalogue } from 'core/entities/Plan';
import { makeCatalogueIngredient } from '#test/fixtures';

import { belongsTo, fitSlots, inSeason } from './MealFit';

import type { MealSlot } from 'core/entities/Plan';

// Fixtures shaped like the phase 2 lists (`seed/ingredients/meals.ts`): a
// stewed pulse is lunch only, a raw meat cut lunch and dinner, the staples
// carry no list at all.
const lentils = makeCatalogueIngredient({ id: 'i-lentejas', category: 'protein', classes: [], mealSlots: ['lunch'], slug: 'lentejas-cocidas' });
const chorizo = makeCatalogueIngredient({
  id: 'i-chorizo',
  category: 'protein',
  classes: ['animal', 'meat', 'pork'],
  mealSlots: ['morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'],
  slug: 'chorizo'
});
const chicken = makeCatalogueIngredient({
  id: 'i-pollo',
  category: 'protein',
  classes: ['animal', 'meat'],
  mealSlots: ['lunch', 'dinner'],
  slug: 'pollo'
});
const eggs = makeCatalogueIngredient({ id: 'i-huevo', category: 'protein', classes: ['animal', 'egg'], mealSlots: ['lunch'], slug: 'huevo' });
const chickpeaFlour = makeCatalogueIngredient({ id: 'i-harina', category: 'pantry', classes: [], mealSlots: ['lunch'], slug: 'harina-de-garbanzo' });
const energyDrink = makeCatalogueIngredient({
  id: 'i-energetica',
  category: 'beverages',
  classes: [],
  mealSlots: ['none'],
  slug: 'bebida-energetica'
});
const plantNone = makeCatalogueIngredient({ id: 'i-none', category: 'protein', classes: [], mealSlots: ['none'], slug: 'proteina-en-ninguna' });
const oil = makeCatalogueIngredient({ id: 'i-aceite', category: 'pantry', mealSlots: [], slug: 'aceite-de-oliva' });
const onion = makeCatalogueIngredient({ id: 'i-cebolla', category: 'produce', mealSlots: [], slug: 'cebolla' });
const salt = makeCatalogueIngredient({ id: 'i-sal', category: 'pantry', mealSlots: [], slug: 'sal' });
const tomato = makeCatalogueIngredient({ id: 'i-tomate', category: 'produce', seasonMonths: [6, 7, 8, 9], slug: 'tomate' });

const catalogue = toCatalogue([lentils, chorizo, chicken, eggs, chickpeaFlour, energyDrink, plantNone, oil, onion, salt, tomato]);

const EVERY_SLOT: readonly MealSlot[] = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'];
const OMNIVORE: readonly string[] = [];
const VEGAN: readonly string[] = ['vegan'];
const VEGETARIAN: readonly string[] = ['vegetarian'];

function dish(slots: MealSlot[], ...slugs: string[]) {
  return { ingredients: slugs.map(slug => ({ grams: 100, slug })), slots };
}

describe('belongsTo — one food at one meal, for one person', () => {
  it('puts a food with an empty list at every meal', () => {
    for (const slot of EVERY_SLOT) {
      expect(belongsTo(oil, slot, OMNIVORE)).toBe(true);
    }
  });

  it('puts a listed food only at the meals it names', () => {
    expect(belongsTo(lentils, 'lunch', OMNIVORE)).toBe(true);
    expect(belongsTo(lentils, 'dinner', OMNIVORE)).toBe(false);
    expect(belongsTo(lentils, 'breakfast', OMNIVORE)).toBe(false);
    expect(belongsTo(chicken, 'dinner', OMNIVORE)).toBe(true);
    expect(belongsTo(chicken, 'afternoon_snack', OMNIVORE)).toBe(false);
  });

  it('puts a plant protein at every meal for a vegan or a vegetarian (0062 § 4)', () => {
    for (const slot of EVERY_SLOT) {
      expect(belongsTo(lentils, slot, VEGAN)).toBe(true);
      expect(belongsTo(lentils, slot, VEGETARIAN)).toBe(true);
    }
  });

  it('reads the exception among other ways of eating, and not from any other pattern', () => {
    expect(belongsTo(lentils, 'dinner', ['gluten_free', 'vegan'])).toBe(true);
    expect(belongsTo(lentils, 'dinner', ['halal'])).toBe(false);
    expect(belongsTo(lentils, 'dinner', ['pescatarian'])).toBe(false);
  });

  it('keeps the exception to the protein aisle, and to foods of no animal origin', () => {
    // A pulse flour in the pantry is not covered: the aisle is what `0062` § 4 reads.
    expect(belongsTo(chickpeaFlour, 'dinner', VEGAN)).toBe(false);
    // Eggs are in the protein aisle but animal: a vegetarian eats them, the exception does not move them.
    expect(belongsTo(eggs, 'dinner', VEGETARIAN)).toBe(false);
    expect(belongsTo(chorizo, 'breakfast', VEGAN)).toBe(false);
  });

  it('puts a food in no meal when its list is none, the plant-based exception included (0063 § 3)', () => {
    for (const slot of EVERY_SLOT) {
      expect(belongsTo(energyDrink, slot, OMNIVORE)).toBe(false);
      expect(belongsTo(energyDrink, slot, VEGAN)).toBe(false);
      expect(belongsTo(plantNone, slot, VEGAN)).toBe(false);
      expect(belongsTo(plantNone, slot, VEGETARIAN)).toBe(false);
    }
  });

  it('does not read none as a slot a list could also name', () => {
    const odd = makeCatalogueIngredient({ mealSlots: ['none', 'lunch'], slug: 'odd' });

    expect(belongsTo(odd, 'lunch', OMNIVORE)).toBe(false);
  });
});

describe('fitSlots — which of its own meals a dish may be served at', () => {
  it('serves a lentil stew tagged lunch-only at lunch and not at dinner', () => {
    expect(fitSlots(dish(['lunch', 'dinner'], 'lentejas-cocidas', 'cebolla', 'aceite-de-oliva'), catalogue, OMNIVORE)).toEqual(['lunch']);
  });

  it('serves the same stew at both for a vegan', () => {
    expect(fitSlots(dish(['lunch', 'dinner'], 'lentejas-cocidas', 'cebolla', 'aceite-de-oliva'), catalogue, VEGAN)).toEqual(['lunch', 'dinner']);
  });

  it('leaves a dish of staples exactly as it came', () => {
    const staples = dish(['breakfast', 'lunch', 'dinner', 'supper'], 'aceite-de-oliva', 'cebolla', 'sal', 'tomate');

    expect(fitSlots(staples, catalogue, OMNIVORE)).toEqual(['breakfast', 'lunch', 'dinner', 'supper']);
  });

  it('narrows to what every ingredient shares, never to what one of them allows', () => {
    // chicken: lunch, dinner; chorizo: everything but breakfast → lunch, dinner.
    expect(fitSlots(dish(['breakfast', 'lunch', 'dinner'], 'pollo', 'chorizo'), catalogue, OMNIVORE)).toEqual(['lunch', 'dinner']);
    // add lentils (lunch only) → lunch.
    expect(fitSlots(dish(['breakfast', 'lunch', 'dinner'], 'pollo', 'chorizo', 'lentejas-cocidas'), catalogue, OMNIVORE)).toEqual(['lunch']);
  });

  it('never adds a meal the dish did not claim, even where every ingredient belongs', () => {
    expect(fitSlots(dish(['dinner'], 'aceite-de-oliva'), catalogue, OMNIVORE)).toEqual(['dinner']);
    expect(fitSlots(dish(['dinner'], 'lentejas-cocidas'), catalogue, VEGAN)).toEqual(['dinner']);
  });

  it('returns nothing for a dinner that uses a lunch-only food, so the caller drops it', () => {
    expect(fitSlots(dish(['dinner'], 'lentejas-cocidas', 'cebolla'), catalogue, OMNIVORE)).toEqual([]);
  });

  it('returns nothing for a dish that uses a food in no meal, for anybody', () => {
    expect(fitSlots(dish([...EVERY_SLOT], 'bebida-energetica'), catalogue, OMNIVORE)).toEqual([]);
    expect(fitSlots(dish([...EVERY_SLOT], 'proteina-en-ninguna'), catalogue, VEGAN)).toEqual([]);
  });

  it('lets an ingredient the catalogue does not know narrow nothing — the unknown-ingredient gate answers for it', () => {
    expect(fitSlots(dish(['lunch', 'dinner'], 'no-existe', 'cebolla'), catalogue, OMNIVORE)).toEqual(['lunch', 'dinner']);
  });

  it('changes nothing when every list is empty', () => {
    const empty = toCatalogue([...catalogue.values()].map(ingredient => ({ ...ingredient, mealSlots: [] })));

    for (const slugs of [['lentejas-cocidas'], ['pollo', 'chorizo'], ['bebida-energetica', 'huevo']]) {
      expect(fitSlots(dish([...EVERY_SLOT], ...slugs), empty, OMNIVORE)).toEqual(EVERY_SLOT);
    }
  });
});

describe('inSeason — a month, never a prohibition', () => {
  it('counts a food with no months as in season all year', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(inSeason(onion, month)).toBe(true);
    }
  });

  it('counts a food in season only in the months it names', () => {
    expect(inSeason(tomato, 7)).toBe(true);
    expect(inSeason(tomato, 9)).toBe(true);
    expect(inSeason(tomato, 1)).toBe(false);
    expect(inSeason(tomato, 12)).toBe(false);
  });
});
