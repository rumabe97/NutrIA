import { describe, expect, it } from 'vitest';

import {
  BALANCE_CAPS,
  balanceOf,
  balanceSupply,
  heldMaximums,
  isOilyFish,
  isProcessedMeat,
  isVegetable,
  isWholeGrain,
  legumeDryGrams,
  mealGroups,
  mealServings,
  meatColour,
  placementGroups,
  POOL_RESERVE,
  proteinPerKgBySlot,
  reserveGroups,
  scaledToMains
} from 'core/domain/Balance';
import { kindMeals, kindsCrowded, kindsExcess } from 'core/domain/Variety';
import { makeCatalogue, makeCatalogueIngredient, makeDish } from '#test/fixtures';

import type { CandidateDish, MealSlot, PlanDayAssignment, ScheduledMeal } from 'core/entities/Plan';

const catalogue = makeCatalogue([
  makeCatalogueIngredient({ id: 'i-lentejas', slug: 'lentejas-cocidas' }),
  makeCatalogueIngredient({ id: 'i-hummus', slug: 'hummus' }),
  makeCatalogueIngredient({ id: 'i-fabada', classes: ['animal', 'meat', 'pork'], slug: 'fabada-en-lata' }),
  makeCatalogueIngredient({ id: 'i-merluza', category: 'protein', classes: ['animal', 'fish'], slug: 'merluza' }),
  makeCatalogueIngredient({ id: 'i-salmon', category: 'protein', classes: ['animal', 'fish'], slug: 'salmon' }),
  makeCatalogueIngredient({ id: 'i-gambas', category: 'protein', classes: ['animal', 'shellfish'], slug: 'gambas' }),
  makeCatalogueIngredient({ id: 'i-pollo', category: 'protein', classes: ['animal', 'meat'], slug: 'pechuga-de-pollo' }),
  makeCatalogueIngredient({ id: 'i-ternera', category: 'protein', classes: ['animal', 'meat'], slug: 'filete-de-ternera' }),
  makeCatalogueIngredient({ id: 'i-lomo', category: 'protein', classes: ['animal', 'meat', 'pork'], slug: 'lomo-de-cerdo' }),
  makeCatalogueIngredient({ id: 'i-jamon', category: 'protein', classes: ['animal', 'meat', 'pork'], slug: 'jamon-serrano' }),
  makeCatalogueIngredient({ id: 'i-caldo', category: 'pantry', classes: ['animal', 'meat'], slug: 'caldo-de-pollo' }),
  makeCatalogueIngredient({ id: 'i-huevo', category: 'protein', classes: ['animal', 'egg'], slug: 'huevo' }),
  makeCatalogueIngredient({ id: 'i-arroz', slug: 'arroz-blanco-cocido' }),
  makeCatalogueIngredient({ id: 'i-integral', slug: 'arroz-integral-cocido' }),
  makeCatalogueIngredient({ id: 'i-pasta', slug: 'pasta-cocida' }),
  makeCatalogueIngredient({ id: 'i-tomate', category: 'produce', slug: 'tomate' }),
  makeCatalogueIngredient({ id: 'i-calabacin', category: 'produce', slug: 'calabacin' }),
  makeCatalogueIngredient({ id: 'i-patata', category: 'produce', slug: 'patata' }),
  makeCatalogueIngredient({ id: 'i-manzana', category: 'produce', slug: 'manzana' }),
  makeCatalogueIngredient({ id: 'i-limon', category: 'produce', slug: 'limon' }),
  makeCatalogueIngredient({ id: 'i-pisto', category: 'frozen', slug: 'pisto-congelado' }),
  makeCatalogueIngredient({ id: 'i-helado', category: 'frozen', slug: 'helado-de-vainilla' }),
  makeCatalogueIngredient({ id: 'i-croquetas', category: 'frozen', classes: ['animal', 'meat', 'pork'], slug: 'croquetas-de-jamon-congeladas' }),
  makeCatalogueIngredient({ id: 'i-tomate-lata', category: 'pantry', slug: 'tomate-triturado' }),
  makeCatalogueIngredient({ id: 'i-yogur', category: 'dairy', slug: 'yogur-natural-desnatado' }),
  makeCatalogueIngredient({ id: 'i-mantequilla', category: 'dairy', slug: 'mantequilla' })
]);

type Rows = readonly { readonly grams: number; readonly slug: string }[];

function meal(slot: MealSlot, plate: Rows, sides: Rows = [], proteinG = 30): ScheduledMeal {
  return {
    dish: makeDish({ ingredients: [...plate], slots: [slot] }),
    ingredients: [...plate, ...sides],
    macros: { carbsG: 50, fatG: 15, fiberG: 5, kcal: 500, proteinG },
    servings: 1,
    slot,
    sortOrder: 0
  };
}

function day(dayIndex: number, meals: readonly ScheduledMeal[], fiberG = 30): PlanDayAssignment {
  return { dayIndex, meals, totals: { carbsG: 200, fatG: 60, fiberG, kcal: 2000, proteinG: 100 } };
}

const VEGETABLES: Rows = [{ grams: 160, slug: 'calabacin' }];
const everything = { fish: true, legume: true, meat: true, processed: true };

describe('recognising a food group', () => {
  it('reads a legume dry: cooked ÷ 2.5, a stew tin and hummus ÷ 4; nothing else is one', () => {
    expect(legumeDryGrams('lentejas-cocidas', 100)).toBe(40);
    expect(legumeDryGrams('fabada-en-lata', 100)).toBe(25);
    expect(legumeDryGrams('hummus', 100)).toBe(25);
    expect(legumeDryGrams('tempeh', 100)).toBe(50);
    expect(legumeDryGrams('garbanzos-secos', 60)).toBe(60);
    expect(legumeDryGrams('judia-verde', 100)).toBeNull();
  });

  it('names oily fish, processed meat and whole grain by row', () => {
    expect(isOilyFish('sardina')).toBe(true);
    expect(isOilyFish('merluza')).toBe(false);
    expect(isProcessedMeat('jamon-serrano')).toBe(true);
    expect(isProcessedMeat('lomo-de-cerdo')).toBe(false);
    expect(isWholeGrain('arroz-integral-cocido')).toBe(true);
    expect(isWholeGrain('arroz-blanco-cocido')).toBe(false);
  });

  it('splits unprocessed meat into white and red, and a stock or a cured row into neither', () => {
    expect(meatColour('pechuga-de-pollo', catalogue)).toBe('white');
    expect(meatColour('filete-de-ternera', catalogue)).toBe('red');
    expect(meatColour('lomo-de-cerdo', catalogue)).toBe('red');
    expect(meatColour('jamon-serrano', catalogue)).toBeNull();
    expect(meatColour('caldo-de-pollo', catalogue)).toBeNull();
    expect(meatColour('merluza', catalogue)).toBeNull();
  });

  it('counts fresh and frozen vegetables and tinned tomato, never fruit, potato, lemon or ice cream', () => {
    expect(isVegetable('tomate', catalogue)).toBe(true);
    expect(isVegetable('pisto-congelado', catalogue)).toBe(true);
    expect(isVegetable('tomate-triturado', catalogue)).toBe(true);
    expect(isVegetable('manzana', catalogue)).toBe(false);
    expect(isVegetable('patata', catalogue)).toBe(false);
    expect(isVegetable('limon', catalogue)).toBe(false);
    expect(isVegetable('helado-de-vainilla', catalogue)).toBe(false);
    expect(isVegetable('croquetas-de-jamon-congeladas', catalogue)).toBe(false);
  });

  it('sums a meal by group, cereal read dry, dairy in portions and butter not at all', () => {
    const groups = mealGroups(
      [
        { grams: 150, slug: 'arroz-integral-cocido' },
        { grams: 150, slug: 'arroz-blanco-cocido' },
        { grams: 110, slug: 'huevo' },
        { grams: 125, slug: 'yogur-natural-desnatado' },
        { grams: 10, slug: 'mantequilla' },
        { grams: 300, slug: 'manzana' }
      ],
      catalogue
    );

    expect(groups.cerealDry).toBeCloseTo(110);
    expect(groups.wholeGrainDry).toBeCloseTo(60);
    expect(groups.eggs).toBeCloseTo(2);
    expect(groups.dairyPortions).toBeCloseTo(1);
    expect(groups.fruitPortions).toBeCloseTo(2);
  });

  it('serves a group only past half a serving, and oily fish only when it outweighs the rest of the seafood', () => {
    expect(mealServings(mealGroups([{ grams: 50, slug: 'lentejas-cocidas' }], catalogue)).legume).toBe(false);
    expect(mealServings(mealGroups([{ grams: 70, slug: 'lentejas-cocidas' }], catalogue)).legume).toBe(true);
    expect(mealServings(mealGroups([{ grams: 9, slug: 'jamon-serrano' }], catalogue)).processed).toBe(false);

    const mixed = mealServings(
      mealGroups(
        [
          { grams: 60, slug: 'salmon' },
          { grams: 80, slug: 'gambas' }
        ],
        catalogue
      )
    );

    expect(mixed).toMatchObject({ fish: true, fishOrShellfish: true, oilyFish: false });
    expect(mealServings(mealGroups([{ grams: 80, slug: 'gambas' }], catalogue))).toMatchObject({ fish: false, fishOrShellfish: true });
  });
});

describe('balanceSupply', () => {
  const dish = (slug: string, ingredients: CandidateDish['ingredients'], slots: MealSlot[] = ['lunch']) =>
    makeDish({ ingredients, servings: 2, slots, slug });

  it('reads what the pool can serve per serving, at lunch or dinner; processed meat at any meal', () => {
    const supply = balanceSupply(
      [
        dish('lentejas', [{ grams: 160, slug: 'lentejas-cocidas' }]),
        dish('merluza-desayuno', [{ grams: 300, slug: 'merluza' }], ['breakfast']),
        dish('tostada', [{ grams: 40, slug: 'jamon-serrano' }], ['breakfast'])
      ],
      catalogue
    );

    expect(supply).toEqual({ fish: false, legume: true, meat: false, processed: true });
  });
});

describe('balanceOf', () => {
  it('scores a fortnight that keeps the table as one', () => {
    const days = Array.from({ length: 14 }, (_, index) => {
      const dayIndex = index + 1;
      const lunch =
        dayIndex <= 8
          ? meal('lunch', [{ grams: 80, slug: 'lentejas-cocidas' }, ...VEGETABLES])
          : meal('lunch', [{ grams: 120, slug: 'pechuga-de-pollo' }, ...VEGETABLES]);
      const dinner =
        dayIndex % 2 === 0
          ? meal('dinner', [{ grams: 120, slug: dayIndex % 4 === 0 ? 'salmon' : 'merluza' }, ...VEGETABLES])
          : meal('dinner', [{ grams: 110, slug: 'huevo' }, { grams: 45, slug: 'arroz-integral-cocido' }, ...VEGETABLES]);
      const breakfast = meal('breakfast', [{ grams: 300, slug: 'manzana' }]);

      return day(dayIndex, [breakfast, lunch, dinner]);
    });

    const report = balanceOf({ catalogue, days, plantBased: false, supply: everything });

    expect(report.counts).toMatchObject({ eggs: 14, fish: 7, legumes: 8, mains: 28, meat: 6, oilyFish: 3 });
    // Fourteen eggs: the one rule this fortnight breaks.
    expect(Object.entries(report.rules).filter(([, rule]) => rule.applies && !rule.met)).toEqual([['eggs', expect.objectContaining({ value: 14 })]]);
    expect(report.score).toBeCloseTo(12 / 13);
    expect(balanceOf({ catalogue, days, plantBased: true, supply: everything }).score).toBe(1);
  });

  it('holds red meat and processed meat apart: two days running break the rule under the cap', () => {
    const days = [
      day(1, [meal('lunch', [{ grams: 120, slug: 'filete-de-ternera' }]), meal('breakfast', [{ grams: 30, slug: 'jamon-serrano' }])]),
      day(2, [meal('lunch', [{ grams: 120, slug: 'lomo-de-cerdo' }]), meal('breakfast', [{ grams: 30, slug: 'jamon-serrano' }])])
    ];
    const report = balanceOf({ catalogue, days, plantBased: false, supply: everything });

    expect(report.counts).toMatchObject({ processed: 2, processedRuns: 1, redMeat: 2, redMeatRuns: 1 });
    expect(report.rules.redMeat.met).toBe(false);
    expect(report.rules.processed.met).toBe(false);
  });

  it('counts a rice beside the plate against the rice cap, and the dish alone apart', () => {
    const days = Array.from({ length: 5 }, (_, index) =>
      day(index + 1, [meal('lunch', [{ grams: 120, slug: 'pechuga-de-pollo' }], [{ grams: 90, slug: 'arroz-blanco-cocido' }])])
    );
    const report = balanceOf({ catalogue, days, plantBased: false, supply: everything });

    expect(report.counts.starches.rice).toBe(5);
    expect(report.counts.starchesDishOnly.rice).toBe(0);
    expect(report.rules.starches).toMatchObject({ limit: 1, met: false });
  });

  it('judges vegetables at every main, the report’s 80% beside it and left out of the score', () => {
    const days = Array.from({ length: 5 }, (_, index) =>
      day(index + 1, [meal('lunch', [{ grams: 120, slug: 'pechuga-de-pollo' }, ...(index === 0 ? [] : VEGETABLES)])])
    );
    const { rules, score } = balanceOf({ catalogue, days, plantBased: false, supply: everything });
    const scored = Object.entries(rules).filter(([name, rule]) => rule.applies && name !== 'vegetablesMostMains');

    expect(rules.vegetables).toMatchObject({ met: false, value: 0.8 });
    expect(rules.vegetablesMostMains).toMatchObject({ met: true, value: 0.8 });
    expect(score).toBeCloseTo(scored.filter(([, rule]) => rule.met).length / scored.length);
  });

  it('applies no minimum the pool cannot supply, and doubles the meat cap with no fish', () => {
    const days = [day(1, [meal('lunch', [{ grams: 120, slug: 'pechuga-de-pollo' }])])];
    const report = balanceOf({ catalogue, days, plantBased: false, supply: { fish: false, legume: false, meat: true, processed: false } });

    expect(report.rules.fish.applies).toBe(false);
    expect(report.rules.oilyFish.applies).toBe(false);
    expect(report.rules.legumes.applies).toBe(false);
    expect(report.rules.processed.applies).toBe(false);
    expect(report.rules.meat.limit).toBe(scaledToMains(12, 1));
  });
});

describe('scaledToMains', () => {
  it('scales a fortnight figure to the plan’s mains, one at least', () => {
    expect(scaledToMains(8, 28)).toBe(8);
    expect(scaledToMains(8, 14)).toBe(4);
    expect(scaledToMains(2, 1)).toBe(1);
  });
});

describe('proteinPerKgBySlot', () => {
  it('reports each slot’s mean and lowest protein per kg', () => {
    const days = [
      day(1, [meal('lunch', [], [], 40), meal('breakfast', [], [], 20)]),
      day(2, [meal('lunch', [], [], 60), meal('breakfast', [], [], 10)])
    ];

    const bySlot = proteinPerKgBySlot(days, 100);

    expect(bySlot.breakfast?.mean).toBeCloseTo(0.15);
    expect(bySlot.breakfast?.min).toBeCloseTo(0.1);
    expect(bySlot.lunch?.mean).toBeCloseTo(0.5);
    expect(bySlot.lunch?.min).toBeCloseTo(0.4);
  });
});

describe('reserveGroups', () => {
  const lunch = (slug: string, ingredients: CandidateDish['ingredients']) => makeDish({ ingredients, slots: ['lunch', 'dinner'], slug });
  const lentils = Array.from({ length: 5 }, (_, index) => lunch(`lentejas-${index}`, [{ grams: 100, slug: 'lentejas-cocidas' }]));
  const hummus = lunch('hummus', [{ grams: 120, slug: 'hummus' }]);
  const fabada = lunch('fabada', [{ grams: 200, slug: 'fabada-en-lata' }]);
  const hake = Array.from({ length: 4 }, (_, index) => lunch(`merluza-${index}`, [{ grams: 120, slug: 'merluza' }]));
  const salmon = lunch('salmon', [{ grams: 120, slug: 'salmon' }]);
  const brown = lunch('arroz-integral', [{ grams: 150, slug: 'arroz-integral-cocido' }]);
  const chicken = lunch('pollo', [{ grams: 150, slug: 'pechuga-de-pollo' }]);
  const inSlot = [...lentils, hummus, fabada, ...hake, salmon, brown, chicken];

  it('reserves legumes one kind at a time, the oily fish first, then whole grain, at lunch', () => {
    const reserved = reserveGroups(inSlot, 'lunch', catalogue).map(dish => dish.slug);

    expect(reserved.slice(0, POOL_RESERVE.lunch.legumes)).toEqual(['lentejas-0', 'hummus', 'fabada', 'lentejas-1', 'lentejas-2', 'lentejas-3']);
    expect(reserved.slice(6, 9)).toEqual(['salmon', 'merluza-0', 'merluza-1']);
    expect(reserved).toContain('arroz-integral');
    expect(reserved).not.toContain('pollo');
  });

  it('reserves what an earlier slot did not take first, and nothing outside lunch and dinner', () => {
    const taken = new Set(['lentejas-0', 'salmon', 'merluza-0']);
    const reserved = reserveGroups(inSlot, 'dinner', catalogue, taken).map(dish => dish.slug);

    expect(reserved.slice(0, POOL_RESERVE.dinner.legumes)).toEqual(['lentejas-1', 'hummus']);
    expect(reserved).toContain('merluza-1');
    expect(reserveGroups(inSlot, 'breakfast', catalogue)).toEqual([]);
  });

  it('reserves no fish from a library with none, as for somebody who does not like it', () => {
    const reserved = reserveGroups([...lentils, chicken], 'lunch', catalogue);

    expect(reserved.every(dish => dish.slug.startsWith('lentejas'))).toBe(true);
  });
});

describe('heldMaximums', () => {
  const main = (slug: string, ingredients: CandidateDish['ingredients']) => makeDish({ ingredients, slots: ['lunch', 'dinner'], slug });
  const hake = main('merluza', [{ grams: 120, slug: 'merluza' }]);
  const prawns = main('gambas', [{ grams: 120, slug: 'gambas' }]);
  const chicken = main('pollo', [{ grams: 150, slug: 'pechuga-de-pollo' }]);
  const beef = main('ternera', [{ grams: 150, slug: 'filete-de-ternera' }]);
  const ham = makeDish({ ingredients: [{ grams: 40, slug: 'jamon-serrano' }], slots: ['breakfast'], slug: 'tostada-jamon' });
  const omelette = makeDish({ ingredients: [{ grams: 165, slug: 'huevo' }], slots: ['breakfast', 'dinner'], slug: 'tortilla' });
  const lentils = main('lentejas', [{ grams: 200, slug: 'lentejas-cocidas' }]);
  const byKind = (checks: ReturnType<typeof heldMaximums>) =>
    new Map(checks.map(check => [[...check.index.values()].find(kind => kind) ?? '', check]));
  const on = (slug: string, slot: MealSlot, ...days: number[]) => days.map(dayIndex => ({ dayIndex, dishSlug: slug, slot }));

  it('names each group as one kind, so the cap is the group’s: fish and shellfish together, red meat inside meat', () => {
    const checks = byKind(heldMaximums([hake, prawns, chicken, beef, ham, omelette, lentils], catalogue, 2));
    const seafood = checks.get('fishAndShellfish');
    const meat = checks.get('meat');

    expect([...checks.keys()]).toEqual(['fishAndShellfish', 'meat', 'redMeat', 'processed', 'eggs']);
    expect(seafood?.index.get('gambas')).toBe('fishAndShellfish');
    expect(seafood?.index.get('pollo')).toBeNull();
    expect(meat?.index.get('ternera')).toBe('meat');
    expect(checks.get('redMeat')?.index.get('pollo')).toBeNull();
    expect(checks.get('processed')?.slots).toBeUndefined();
    expect(meat?.rule.perFortnight).toBe(BALANCE_CAPS.meat);
  });

  it('holds red meat four times and never on days running; processed meat twice at any meal, apart', () => {
    const checks = [...heldMaximums([hake, chicken, beef, ham], catalogue, 2)];
    const beefOn = on('ternera', 'lunch', 1, 4, 7);

    expect(kindsExcess(beefOn, checks, 14)).toBe(0);
    expect(kindsExcess([...beefOn, ...on('ternera', 'dinner', 10)], checks, 14)).toBe(0);
    // A fifth, and a fifth beside the fourth: past the cap once, on days running once.
    expect(kindsExcess([...beefOn, ...on('ternera', 'dinner', 10, 11)], checks, 14)).toBe(2);
    expect(kindsExcess(on('ternera', 'lunch', 3, 4), checks, 14)).toBe(1);
    expect(kindsExcess(on('tostada-jamon', 'breakfast', 2, 9), checks, 14)).toBe(0);
    expect(kindsExcess(on('tostada-jamon', 'breakfast', 2, 3), checks, 14)).toBe(1);
  });

  it('counts eggs by the egg, and holds none for somebody whose pool has neither meat nor fish', () => {
    const eggs = byKind(heldMaximums([hake, chicken, omelette], catalogue, 2)).get('eggs');
    const twice = on('tortilla', 'dinner', 1, 5);

    expect(eggs?.weight?.({ dayIndex: 1, dishSlug: 'tortilla', slot: 'dinner' })).toBe(3);
    expect(
      kindsCrowded('tortilla', 'breakfast', 9, [kindMeals(twice, eggs as NonNullable<typeof eggs>)], [eggs as NonNullable<typeof eggs>], 14)
    ).toBe(1);
    expect(byKind(heldMaximums([lentils, omelette], catalogue, 2)).has('eggs')).toBe(false);
  });

  it('reads a kept meal by the groups it names, and scales the main-meal caps to one main a day', () => {
    const checks = [...heldMaximums([hake, chicken], catalogue, 1)];
    const kept = placementGroups([{ grams: 150, slug: 'filete-de-ternera' }], catalogue);
    const keptOn = (dayIndex: number) => ({ dayIndex, dishSlug: 'no-longer-in-the-pool', groups: kept, slot: 'lunch' as const });

    expect(kept).toEqual({ eggs: 0, fishOrShellfish: false, meat: true, processed: false, redMeat: true });
    expect(kindsExcess([keptOn(1), keptOn(4)], checks, 14)).toBe(0);
    expect(kindsExcess([keptOn(1), keptOn(4), keptOn(7)], checks, 14)).toBe(1);
    expect(byKind(checks).get('meat')?.rule.perFortnight).toBe(BALANCE_CAPS.meat / 2);
  });
});
