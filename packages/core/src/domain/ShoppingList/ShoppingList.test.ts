import { describe, expect, it } from 'vitest';

import { buildShoppingList, unresolvedSlugs } from 'core/domain/ShoppingList';
import { makeCatalogue, makeCatalogueIngredient, makeDish } from '#test/fixtures';
import type { PlanAssignment, ScheduledMeal } from 'core/entities/Plan';

const catalogue = makeCatalogue([
  makeCatalogueIngredient({ id: 'ing-tomate', category: 'produce', name: 'Tomate', slug: 'tomate' }),
  makeCatalogueIngredient({ id: 'ing-huevo', category: 'protein', defaultUnit: 'unit', gramsPerUnit: 58, name: 'Huevo', slug: 'huevo' }),
  makeCatalogueIngredient({ id: 'ing-leche', category: 'dairy', defaultUnit: 'ml', name: 'Leche', slug: 'leche' }),
  makeCatalogueIngredient({ id: 'ing-arroz', category: 'pantry', name: 'Arroz', slug: 'arroz' }),
  makeCatalogueIngredient({ id: 'ing-pan', category: 'bakery', defaultUnit: 'slice', gramsPerUnit: 40, name: 'Pan', slug: 'pan' })
]);

function meal(ingredients: readonly { grams: number; slug: string }[]): ScheduledMeal {
  return { dish: makeDish(), ingredients, macros: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 }, servings: 1, slot: 'lunch', sortOrder: 0 };
}

function assignment(...meals: readonly ScheduledMeal[]): PlanAssignment {
  return { days: meals.map((entry, index) => ({ dayIndex: index + 1, meals: [entry], totals: entry.macros })) };
}

describe('buildShoppingList', () => {
  it('consolidates the same ingredient across days into one row', () => {
    const draft = buildShoppingList(
      assignment(meal([{ grams: 100, slug: 'tomate' }]), meal([{ grams: 150, slug: 'tomate' }]), meal([{ grams: 200, slug: 'tomate' }])),
      catalogue
    );

    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]).toMatchObject({ displayQuantity: 450, displayUnit: 'g', name: 'Tomate', totalGrams: 450 });
  });

  it('consolidates repeats within a single day too', () => {
    const draft = buildShoppingList(
      assignment(
        meal([
          { grams: 50, slug: 'arroz' },
          { grams: 70, slug: 'arroz' }
        ])
      ),
      catalogue
    );

    expect(draft.items[0]?.totalGrams).toBe(120);
  });

  it('shows countables in whole units, rounded up — you cannot buy part of an egg', () => {
    const draft = buildShoppingList(assignment(meal([{ grams: 150, slug: 'huevo' }])), catalogue);

    // 150 g / 58 g per egg = 2.59 → 3 eggs.
    expect(draft.items[0]).toMatchObject({ displayQuantity: 3, displayUnit: 'unit', totalGrams: 150 });
  });

  it('rounds a countable up even when it is barely over', () => {
    const draft = buildShoppingList(assignment(meal([{ grams: 59, slug: 'huevo' }])), catalogue);

    expect(draft.items[0]?.displayQuantity).toBe(2);
  });

  it('keeps sliced items in slices', () => {
    const draft = buildShoppingList(assignment(meal([{ grams: 100, slug: 'pan' }])), catalogue);

    expect(draft.items[0]).toMatchObject({ displayQuantity: 3, displayUnit: 'slice' });
  });

  it('keeps liquids in millilitres', () => {
    const draft = buildShoppingList(assignment(meal([{ grams: 250, slug: 'leche' }])), catalogue);

    expect(draft.items[0]).toMatchObject({ displayQuantity: 250, displayUnit: 'ml' });
  });

  it('stays in grams above a kilogram — formatting kg is the interface job, and the unit enum has no kg', () => {
    const draft = buildShoppingList(assignment(meal([{ grams: 2400, slug: 'arroz' }])), catalogue);

    expect(draft.items[0]).toMatchObject({ displayQuantity: 2400, displayUnit: 'g', totalGrams: 2400 });
  });

  it('groups by aisle, in the order a supermarket is walked', () => {
    const draft = buildShoppingList(
      assignment(
        meal([
          { grams: 100, slug: 'arroz' },
          { grams: 100, slug: 'pan' },
          { grams: 100, slug: 'tomate' },
          { grams: 100, slug: 'leche' },
          { grams: 100, slug: 'huevo' }
        ])
      ),
      catalogue
    );

    expect(draft.items.map(item => item.category)).toEqual(['produce', 'protein', 'dairy', 'bakery', 'pantry']);
  });

  it('snapshots name and category so a historical list survives the catalogue changing', () => {
    const draft = buildShoppingList(assignment(meal([{ grams: 100, slug: 'tomate' }])), catalogue);

    expect(draft.items[0]).toMatchObject({ category: 'produce', ingredientId: 'ing-tomate', name: 'Tomate' });
  });

  it('is empty for a plan with no meals', () => {
    expect(buildShoppingList({ days: [] }, catalogue).items).toEqual([]);
  });
});

describe('unresolvedSlugs', () => {
  it('finds nothing when every slug is in the catalogue', () => {
    expect(unresolvedSlugs(assignment(meal([{ grams: 100, slug: 'tomate' }])), catalogue)).toEqual([]);
  });

  it('names a slug the catalogue cannot resolve, so the caller fails rather than shipping a hole', () => {
    expect(unresolvedSlugs(assignment(meal([{ grams: 100, slug: 'unicornio' }])), catalogue)).toEqual(['unicornio']);
  });

  it('reports each missing slug once', () => {
    const found = unresolvedSlugs(assignment(meal([{ grams: 10, slug: 'x' }]), meal([{ grams: 10, slug: 'x' }])), catalogue);

    expect(found).toEqual(['x']);
  });
});

describe('buildShoppingList — cooked grains are bought dry (0078)', () => {
  const grains = makeCatalogue([
    makeCatalogueIngredient({ id: 'ing-cuscus-cocido', category: 'pantry', name: 'Cuscús cocido', slug: 'cuscus-cocido' }),
    makeCatalogueIngredient({ id: 'ing-cuscus-crudo', category: 'pantry', name: 'Cuscús', slug: 'cuscus-crudo' }),
    makeCatalogueIngredient({ id: 'ing-arroz-cocido', category: 'pantry', name: 'Arroz blanco cocido', slug: 'arroz-blanco-cocido' }),
    makeCatalogueIngredient({ id: 'ing-arroz-largo', category: 'pantry', name: 'Arroz largo', slug: 'arroz-largo-crudo' }),
    makeCatalogueIngredient({ id: 'ing-pasta-cocida', category: 'pantry', name: 'Pasta cocida', slug: 'pasta-cocida' }),
    makeCatalogueIngredient({ id: 'ing-quinoa-cocida', category: 'pantry', name: 'Quinoa cocida', slug: 'quinoa-cocida' }),
    makeCatalogueIngredient({ id: 'ing-lentejas', category: 'pantry', name: 'Lentejas cocidas', slug: 'lentejas-cocidas' })
  ]);

  it('lists 600 g of cooked couscous as 240 g of dry couscous', () => {
    const draft = buildShoppingList(assignment(meal([{ grams: 600, slug: 'cuscus-cocido' }])), grains);

    expect(draft.items).toEqual([
      expect.objectContaining({ ingredientId: 'ing-cuscus-crudo', name: 'Cuscús', slug: 'cuscus-crudo', totalGrams: 240 })
    ]);
  });

  it('merges cooked and dry couscous in one plan into one line', () => {
    const draft = buildShoppingList(assignment(meal([{ grams: 600, slug: 'cuscus-cocido' }]), meal([{ grams: 100, slug: 'cuscus-crudo' }])), grains);

    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]).toMatchObject({ slug: 'cuscus-crudo', totalGrams: 340 });
  });

  it('buys cooked white rice as long-grain rice', () => {
    const draft = buildShoppingList(assignment(meal([{ grams: 300, slug: 'arroz-blanco-cocido' }])), grains);

    expect(draft.items[0]).toMatchObject({ ingredientId: 'ing-arroz-largo', name: 'Arroz largo', slug: 'arroz-largo-crudo', totalGrams: 100 });
  });

  it('keeps a pasta with no dry food on its own row, named dry, rounded up to 5 g', () => {
    // 250 g cooked at 2.3 is 108.7 g dry.
    const draft = buildShoppingList(assignment(meal([{ grams: 250, slug: 'pasta-cocida' }])), grains);

    expect(draft.items).toEqual([
      expect.objectContaining({
        displayQuantity: 110,
        ingredientId: 'ing-pasta-cocida',
        name: 'Pasta (en seco)',
        slug: 'pasta-cocida',
        totalGrams: 110
      })
    ]);
  });

  it('says "dry" in an English list', () => {
    const draft = buildShoppingList(assignment(meal([{ grams: 230, slug: 'pasta-cocida' }])), grains, 'en-GB');

    expect(draft.items[0]?.name).toBe('Pasta (dry)');
  });

  it('keeps a cooked grain on its own row when the catalogue lacks its dry food', () => {
    // `quinoa-cruda` is not in this catalogue: 275 g cooked at 2.75 is 100 g dry.
    const draft = buildShoppingList(assignment(meal([{ grams: 275, slug: 'quinoa-cocida' }])), grains);

    expect(draft.items[0]).toMatchObject({ ingredientId: 'ing-quinoa-cocida', name: 'Quinoa (en seco)', slug: 'quinoa-cocida', totalGrams: 100 });
  });

  it('leaves lentils as they are bought: cooked, and to the gram', () => {
    const draft = buildShoppingList(assignment(meal([{ grams: 213, slug: 'lentejas-cocidas' }])), grains);

    expect(draft.items[0]).toMatchObject({ name: 'Lentejas cocidas', slug: 'lentejas-cocidas', totalGrams: 213 });
  });
});
