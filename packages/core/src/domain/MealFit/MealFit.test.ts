import { describe, expect, it } from 'vitest';

import { toCatalogue } from 'core/entities/Plan';
import { makeCatalogueIngredient } from '#test/fixtures';

import { DISHES_NEEDED_PER_SLOT } from 'core/domain/Variety';

import { belongsTo, CATALOGUE_SAMPLE_SIZE, fitSlots, inSeason, libraryUsage, mealCatalogue, offersPulses } from './MealFit';

import type { CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { LibraryRecipe } from './MealFit';

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

describe('offersPulses — whether a meal has the plant proteins lunch has', () => {
  const ingredients = [...catalogue.values()];

  it('says lunch always does', () => {
    expect(offersPulses(ingredients, 'lunch', OMNIVORE)).toBe(true);
  });

  it('says an omnivore’s dinner and breakfast do not, once the lists keep the pulses at lunch', () => {
    expect(offersPulses(ingredients, 'dinner', OMNIVORE)).toBe(false);
    expect(offersPulses(ingredients, 'breakfast', OMNIVORE)).toBe(false);
  });

  it('says a vegan’s or a vegetarian’s dinner does (0062 § 4)', () => {
    expect(offersPulses(ingredients, 'dinner', VEGAN)).toBe(true);
    expect(offersPulses(ingredients, 'dinner', VEGETARIAN)).toBe(true);
  });

  it('says every meal does when every list is empty', () => {
    const empty = ingredients.map(ingredient => ({ ...ingredient, mealSlots: [] }));

    for (const slot of EVERY_SLOT) {
      expect(offersPulses(empty, slot, OMNIVORE)).toBe(true);
    }
  });

  it('ignores a plant protein that is not a lunch food in the first place', () => {
    const powder = makeCatalogueIngredient({
      category: 'protein',
      classes: [],
      mealSlots: ['breakfast', 'afternoon_snack'],
      slug: 'proteina-vegetal'
    });

    expect(offersPulses([oil, powder], 'dinner', OMNIVORE)).toBe(true);
  });
});

describe('libraryUsage — what the library cooks each meal from, for one person', () => {
  function recipe(slots: MealSlot[], ...foods: CatalogueIngredient[]): LibraryRecipe {
    return { ingredients: foods.map(food => ({ id: food.id, slug: food.slug })), slots };
  }

  function times(count: number, make: () => LibraryRecipe): LibraryRecipe[] {
    return Array.from({ length: count }, make);
  }

  const MIN = DISHES_NEEDED_PER_SLOT;
  const ids = (set: ReadonlySet<string> | undefined) => [...(set ?? [])].sort();

  it('reads each recipe at the meals it fits for this person, never at its stored ones', () => {
    // Stored as a dinner too — narrowed for a vegan who generated it — and a lunch only for an omnivore.
    const library = [...times(MIN, () => recipe(['lunch', 'dinner'], lentils, onion)), ...times(MIN, () => recipe(['dinner'], chicken, oil))];
    const omnivore = libraryUsage(library, ['lunch', 'dinner'], catalogue, OMNIVORE);
    const vegan = libraryUsage(library, ['lunch', 'dinner'], catalogue, VEGAN);

    expect(ids(omnivore.get('lunch'))).toEqual(['i-cebolla', 'i-lentejas']);
    expect(ids(omnivore.get('dinner'))).toEqual(['i-aceite', 'i-pollo']);
    expect(ids(vegan.get('dinner'))).toEqual(['i-aceite', 'i-cebolla', 'i-lentejas', 'i-pollo']);
  });

  it('leaves out a meal the library says too little about, so it is not cut at all', () => {
    const library = [...times(MIN - 1, () => recipe(['lunch'], chicken)), ...times(MIN, () => recipe(['dinner'], chicken))];
    const usage = libraryUsage(library, ['lunch', 'dinner'], catalogue, OMNIVORE);

    expect(usage.has('lunch')).toBe(false);
    expect(usage.has('dinner')).toBe(true);
    expect(libraryUsage([], ['lunch', 'dinner'], catalogue, OMNIVORE).size).toBe(0);
  });

  it('counts only the dishes that fit the meal for this person towards it', () => {
    // Enough stews stored as dinners, none of them a dinner for an omnivore.
    const library = times(MIN, () => recipe(['lunch', 'dinner'], lentils));

    expect(libraryUsage(library, ['dinner'], catalogue, OMNIVORE).has('dinner')).toBe(false);
    expect(libraryUsage(library, ['dinner'], catalogue, VEGAN).has('dinner')).toBe(true);
  });

  it('answers only for the meals it is asked about', () => {
    const library = times(MIN, () => recipe(['lunch', 'dinner'], chicken));

    expect([...libraryUsage(library, ['dinner'], catalogue, OMNIVORE).keys()]).toEqual(['dinner']);
  });
});

describe('mealCatalogue — the rows one meal’s request is shown', () => {
  // Ten foods no recipe uses and in no season list, so only the sample can bring them in.
  const spare = Array.from({ length: 10 }, (_, index) =>
    makeCatalogueIngredient({ id: `i-spare-${index}`, category: 'pantry', slug: `spare-${String(index).padStart(2, '0')}` })
  );
  const pepper = makeCatalogueIngredient({ id: 'i-pimiento', category: 'produce', seasonMonths: [7, 8, 9], slug: 'pimiento' });
  const orange = makeCatalogueIngredient({ id: 'i-naranja', category: 'produce', seasonMonths: [1, 2, 3], slug: 'naranja' });
  const rows = [lentils, chicken, oil, onion, salt, tomato, pepper, orange, energyDrink, ...spare];
  const used = new Set(['i-pollo', 'i-aceite', 'i-sal']);
  const cut = (seed: string, month = 1) => ({ month, seed, used });
  const slugs = (list: readonly CatalogueIngredient[]) => list.map(ingredient => ingredient.slug);
  const many = [
    oil,
    ...Array.from({ length: CATALOGUE_SAMPLE_SIZE * 3 }, (_, index) =>
      makeCatalogueIngredient({ id: `i-x-${index}`, category: 'pantry', slug: `x-${String(index).padStart(3, '0')}` })
    )
  ];
  const oilOnly = (seed: string) => ({ month: 1, seed, used: new Set(['i-aceite']) });

  it('without a cut, is the first cut alone: what belongs at the meal, in the order given', () => {
    expect(slugs(mealCatalogue(rows, 'dinner', OMNIVORE))).toEqual(slugs(rows.filter(row => belongsTo(row, 'dinner', OMNIVORE))));
  });

  it('keeps breakfast and the snacks to the first cut even when given one', () => {
    for (const slot of ['breakfast', 'morning_snack', 'afternoon_snack', 'supper'] as const) {
      expect(mealCatalogue(rows, slot, OMNIVORE, cut('job-1'))).toEqual(mealCatalogue(rows, slot, OMNIVORE));
    }
  });

  it('keeps at lunch and dinner what the library cooks there, and the produce in season this month', () => {
    const january = slugs(mealCatalogue(many.concat(rows), 'dinner', OMNIVORE, cut('job-1', 1)));
    const july = slugs(mealCatalogue(many.concat(rows), 'dinner', OMNIVORE, cut('job-1', 7)));

    for (const slug of ['pollo', 'aceite-de-oliva', 'sal', 'cebolla']) {
      expect(january).toContain(slug);
      expect(july).toContain(slug);
    }

    expect(january).toContain('naranja');
    expect(july).toContain('pimiento');
    expect(july).toContain('tomate');
  });

  it('adds a sample of the rest: all of it when it is smaller than the constant, the constant’s size when it is not', () => {
    expect(mealCatalogue(rows, 'lunch', OMNIVORE, cut('job-1')).filter(row => row.id.startsWith('i-spare'))).toHaveLength(spare.length);
    expect(mealCatalogue(many, 'lunch', OMNIVORE, oilOnly('job-1'))).toHaveLength(CATALOGUE_SAMPLE_SIZE + 1);
  });

  it('draws the same sample from the same seed whatever order the rows come in, and another from another', () => {
    const first = slugs(mealCatalogue(many, 'lunch', OMNIVORE, oilOnly('job-1')));

    expect(slugs(mealCatalogue([...many].reverse(), 'lunch', OMNIVORE, oilOnly('job-1'))).sort()).toEqual([...first].sort());
    expect(slugs(mealCatalogue(many, 'lunch', OMNIVORE, oilOnly('job-2')))).not.toEqual(first);
    // The lunch and the dinner of one generation draw apart.
    expect(slugs(mealCatalogue(many, 'dinner', OMNIVORE, oilOnly('job-1')))).not.toEqual(first);
  });

  it('never brings back a row the first cut removed, however much it is used', () => {
    const withLentils = { month: 1, seed: 'job-1', used: new Set(['i-lentejas', 'i-energetica']) };

    expect(slugs(mealCatalogue(rows, 'dinner', OMNIVORE, withLentils))).not.toContain('lentejas-cocidas');
    expect(slugs(mealCatalogue(rows, 'lunch', OMNIVORE, withLentils))).not.toContain('bebida-energetica');
    expect(slugs(mealCatalogue(rows, 'dinner', VEGAN, withLentils))).toContain('lentejas-cocidas');
  });

  it('only ever removes rows, and keeps the order it was given them', () => {
    const shown = mealCatalogue(many, 'lunch', OMNIVORE, oilOnly('job-3'));

    expect(shown.every(row => many.includes(row))).toBe(true);
    expect(shown).toEqual(many.filter(row => shown.includes(row)));
  });
});
