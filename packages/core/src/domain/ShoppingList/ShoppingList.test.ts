import { describe, expect, it } from 'vitest';

import { buildShoppingList, rangeList, rangeQuantity, unresolvedSlugs } from 'core/domain/ShoppingList';
import { makeCatalogue, makeCatalogueIngredient, makeDish } from '#test/fixtures';
import type { PlanAssignment, ScheduledMeal } from 'core/entities/Plan';
import type { ShoppingRangeRow } from 'core/domain/ShoppingList';

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

/** The plan's first day is 2026-03-01, so the dates read as a fortnight's would. */
function dated(...meals: readonly ScheduledMeal[]) {
  return { days: meals.map((entry, index) => ({ date: day(index + 1), dayIndex: index + 1, meals: [entry], totals: entry.macros })) };
}

function day(index: number): string {
  return `2026-03-${String(index).padStart(2, '0')}`;
}

/** Every day the plan has, which is what an unfiltered list covers. */
function allDays(row: ShoppingRangeRow): readonly string[] {
  return Object.keys(row.perDay);
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

describe("buildShoppingList — every day's share travels with the row (0091)", () => {
  it("files each day's grams under the day's own date", () => {
    const draft = buildShoppingList(dated(meal([{ grams: 100, slug: 'tomate' }]), meal([{ grams: 150, slug: 'tomate' }])), catalogue);

    expect(draft.items[0]?.perDay).toEqual({ '2026-03-01': 100, '2026-03-02': 150 });
  });

  it("adds a day's repeats into that day's one entry", () => {
    const draft = buildShoppingList(
      dated(
        meal([
          { grams: 50, slug: 'arroz' },
          { grams: 70, slug: 'arroz' }
        ])
      ),
      catalogue
    );

    expect(draft.items[0]?.perDay).toEqual({ '2026-03-01': 120 });
  });

  it('files a day with no date under a key no range can choose, and still counts it into the total', () => {
    const draft = buildShoppingList(assignment(meal([{ grams: 100, slug: 'tomate' }]), meal([{ grams: 150, slug: 'tomate' }])), catalogue);
    const row = draft.items[0];

    expect(row?.perDay).toEqual({ 'day-1': 100, 'day-2': 150 });
    expect(row?.totalGrams).toBe(250);
    expect(row && rangeQuantity(row, [day(1), day(2)]).totalGrams).toBe(0);
  });

  it('marks the rows that hold dry weight, and only those', () => {
    const grains = makeCatalogue([
      makeCatalogueIngredient({ id: 'ing-pasta-cocida', category: 'pantry', name: 'Pasta cocida', slug: 'pasta-cocida' }),
      makeCatalogueIngredient({ id: 'ing-lentejas', category: 'pantry', name: 'Lentejas cocidas', slug: 'lentejas-cocidas' })
    ]);
    const draft = buildShoppingList(
      dated(
        meal([
          { grams: 250, slug: 'pasta-cocida' },
          { grams: 200, slug: 'lentejas-cocidas' }
        ])
      ),
      grains
    );

    expect(draft.items.map(item => [item.slug, item.dryRounded])).toEqual([
      ['lentejas-cocidas', false],
      ['pasta-cocida', true]
    ]);
  });

  it('carries the grams per unit a countable is read in, which the quantity alone cannot say', () => {
    const draft = buildShoppingList(dated(meal([{ grams: 150, slug: 'huevo' }]), meal([{ grams: 100, slug: 'tomate' }])), catalogue);

    expect(draft.items.map(item => [item.slug, item.gramsPerUnit])).toEqual([
      ['tomate', null],
      ['huevo', 58]
    ]);
  });
});

describe('rangeQuantity', () => {
  const grains = makeCatalogue([
    makeCatalogueIngredient({ id: 'ing-cuscus-cocido', category: 'pantry', name: 'Cuscús cocido', slug: 'cuscus-cocido' }),
    makeCatalogueIngredient({ id: 'ing-cuscus-crudo', category: 'pantry', name: 'Cuscús', slug: 'cuscus-crudo' }),
    makeCatalogueIngredient({ id: 'ing-pasta-cocida', category: 'pantry', name: 'Pasta cocida', slug: 'pasta-cocida' })
  ]);

  it('over every day of the plan is the stored total, for every kind of row', () => {
    const everything = buildShoppingList(
      dated(
        meal([
          { grams: 150, slug: 'huevo' },
          { grams: 100, slug: 'pan' },
          { grams: 250, slug: 'leche' },
          { grams: 2400, slug: 'arroz' },
          { grams: 100, slug: 'tomate' }
        ]),
        meal([
          { grams: 59, slug: 'huevo' },
          { grams: 137, slug: 'tomate' }
        ])
      ),
      catalogue
    );
    const dry = buildShoppingList(
      dated(
        meal([
          { grams: 600, slug: 'cuscus-cocido' },
          { grams: 250, slug: 'pasta-cocida' }
        ]),
        meal([
          { grams: 100, slug: 'cuscus-crudo' },
          { grams: 50, slug: 'pasta-cocida' }
        ])
      ),
      grains
    );

    for (const row of [...everything.items, ...dry.items]) {
      expect(rangeQuantity(row, allDays(row))).toEqual({
        displayQuantity: row.displayQuantity,
        displayUnit: row.displayUnit,
        totalGrams: row.totalGrams
      });
    }
  });

  it("holds the owner's case: 500 g in week 1, 700 g in week 2, 1.2 kg over the fortnight", () => {
    // 100 g on days 1–5 and on days 8–14; nothing on days 6 and 7.
    const plan = {
      days: Array.from({ length: 14 }, (_, index) => ({
        date: day(index + 1),
        meals: [meal(index < 5 || index >= 7 ? [{ grams: 100, slug: 'tomate' }] : [])]
      }))
    };
    const row = buildShoppingList(plan, catalogue).items[0];
    const week1 = Array.from({ length: 7 }, (_, index) => day(index + 1));
    const week2 = Array.from({ length: 7 }, (_, index) => day(index + 8));

    expect(row?.totalGrams).toBe(1200);
    expect(row && rangeQuantity(row, week1)).toEqual({ displayQuantity: 500, displayUnit: 'g', totalGrams: 500 });
    expect(row && rangeQuantity(row, week2)).toEqual({ displayQuantity: 700, displayUnit: 'g', totalGrams: 700 });
    expect(row && rangeQuantity(row, [...week1, ...week2]).totalGrams).toBe(1200);
  });

  it('rounds dry weight up once, after the range is summed — never per day (0078)', () => {
    // 50 g of cooked pasta a day is 21.74 g dry: three days are 65.2 g → 70 g,
    // where rounding each day to 25 g first would buy 75 g.
    const row = buildShoppingList(dated(...Array.from({ length: 3 }, () => meal([{ grams: 50, slug: 'pasta-cocida' }]))), grains).items[0];

    expect(row?.totalGrams).toBe(70);
    expect(row && rangeQuantity(row, [day(1)]).totalGrams).toBe(25);
    expect(row && rangeQuantity(row, [day(1), day(2)]).totalGrams).toBe(45);
  });

  it('rounds a countable up for the range, not for the plan', () => {
    const row = buildShoppingList(dated(...Array.from({ length: 3 }, () => meal([{ grams: 50, slug: 'huevo' }]))), catalogue).items[0];

    expect(row?.displayQuantity).toBe(3);
    // 100 g of the range's own need is still two eggs.
    expect(row && rangeQuantity(row, [day(1), day(2)]).displayQuantity).toBe(2);
  });

  it('counts a day named twice once', () => {
    const row = buildShoppingList(dated(meal([{ grams: 100, slug: 'tomate' }])), catalogue).items[0];

    expect(row && rangeQuantity(row, [day(1), day(1)]).totalGrams).toBe(100);
  });

  it('is nothing to buy when no day is chosen', () => {
    const row = buildShoppingList(dated(meal([{ grams: 150, slug: 'huevo' }])), catalogue).items[0];

    expect(row && rangeQuantity(row, [])).toEqual({ displayQuantity: 0, displayUnit: 'unit', totalGrams: 0 });
  });

  it('shows a row with no breakdown as the whole plan needs it — a hand-added row belongs to no day', () => {
    const manual: ShoppingRangeRow = { displayQuantity: 2, displayUnit: 'unit', dryRounded: false, gramsPerUnit: 58, perDay: {}, totalGrams: 116 };

    expect(rangeQuantity(manual, [day(1)])).toEqual({ displayQuantity: 2, displayUnit: 'unit', totalGrams: 116 });
  });

  it('keeps ml in ml and grams in grams for a range', () => {
    const draft = buildShoppingList(dated(meal([{ grams: 250, slug: 'leche' }]), meal([{ grams: 100, slug: 'leche' }])), catalogue);
    const row = draft.items[0];

    expect(row && rangeQuantity(row, [day(2)])).toEqual({ displayQuantity: 100, displayUnit: 'ml', totalGrams: 100 });
  });
});

describe('rangeList', () => {
  it("shows only the rows the chosen days need, each with that range beside the plan's own", () => {
    const draft = buildShoppingList(dated(meal([{ grams: 100, slug: 'tomate' }]), meal([{ grams: 200, slug: 'arroz' }])), catalogue);
    const rows = rangeList(draft, [day(1)]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ range: { displayQuantity: 100, displayUnit: 'g', totalGrams: 100 }, slug: 'tomate', totalGrams: 100 });
  });

  it("keeps the order it was given, which is the caller's own aisle order", () => {
    const draft = buildShoppingList(
      dated(
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

    expect(rangeList(draft, [day(1)]).map(item => item.category)).toEqual(draft.items.map(item => item.category));
  });

  it('is empty when no day is chosen', () => {
    const draft = buildShoppingList(dated(meal([{ grams: 100, slug: 'tomate' }])), catalogue);

    expect(rangeList(draft, [])).toEqual([]);
  });

  it('keeps a row with no breakdown under every range', () => {
    const manual: ShoppingRangeRow = { displayQuantity: 1, displayUnit: 'g', dryRounded: false, gramsPerUnit: null, perDay: {}, totalGrams: 300 };

    expect(rangeList({ items: [manual] }, [day(1)])).toEqual([{ ...manual, range: { displayQuantity: 1, displayUnit: 'g', totalGrams: 300 } }]);
  });
});
