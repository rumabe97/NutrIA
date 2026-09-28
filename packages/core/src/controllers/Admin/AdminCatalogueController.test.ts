import { beforeEach, describe, expect, it, vi } from 'vitest';

import { composePerServing } from 'core/domain/Composition';
import { ingredientCatalogueQuerySchema, recipeCatalogueQuerySchema } from 'core/entities/AdminQuery';
import { ALLERGEN_IDS, makeCatalogue, makeCatalogueIngredient, makeDish } from '#test/fixtures';

import { AdminCatalogueController, allergensOf, byFigure, perServing } from './AdminCatalogueController';

import type { AdminCatalogueRepository as Catalogue, CatalogueRecipeRow } from '#repositories/Admin';
import type { CatalogueRecipeView } from './AdminCatalogueController';

const catalogue = vi.hoisted(() => ({
  compositions: vi.fn<(typeof Catalogue)['compositions']>(),
  ingredientAllergens: vi.fn<(typeof Catalogue)['ingredientAllergens']>(),
  ingredientPage: vi.fn<(typeof Catalogue)['ingredientPage']>(),
  matchingRecipes: vi.fn<(typeof Catalogue)['matchingRecipes']>(),
  recipeCounts: vi.fn<(typeof Catalogue)['recipeCounts']>(),
  recipePage: vi.fn<(typeof Catalogue)['recipePage']>()
}));
const loadCatalogue = vi.hoisted(() => vi.fn());
const listAllergens = vi.hoisted(() => vi.fn());

vi.mock('#repositories/Admin', () => ({ AdminCatalogueRepository: catalogue, AdminRepository: {}, JOB_STATUSES: [], PLAN_STATUSES: [] }));
vi.mock('#repositories/Recipe', () => ({ FALLBACK_LOCALE: 'es-ES', RecipeRepository: { loadCatalogue } }));
vi.mock('#repositories/Safety', () => ({ SafetyRepository: { listAllergens } }));

const BREAD = makeCatalogueIngredient({
  id: 'ing-bread',
  allergens: [
    { allergenId: ALLERGEN_IDS.gluten, presence: 'contains' },
    { allergenId: ALLERGEN_IDS.peanuts, presence: 'may_contain' }
  ],
  carbsPer100g: 50,
  fatPer100g: 3,
  kcalPer100g: 250,
  proteinPer100g: 9,
  slug: 'pan'
});
const CHEESE = makeCatalogueIngredient({
  id: 'ing-cheese',
  allergens: [{ allergenId: ALLERGEN_IDS.milk, presence: 'contains' }],
  carbsPer100g: 1.3,
  fatPer100g: 33,
  kcalPer100g: 402,
  proteinPer100g: 25,
  slug: 'queso'
});
const OIL = makeCatalogueIngredient({ id: 'ing-oil', carbsPer100g: 0, fatPer100g: 100, kcalPer100g: 884, proteinPer100g: 0, slug: 'aceite' });
const KEYS = new Map([
  [ALLERGEN_IDS.gluten, 'gluten'],
  [ALLERGEN_IDS.milk, 'milk'],
  [ALLERGEN_IDS.peanuts, 'peanuts']
]);

function recipe(overrides: Partial<CatalogueRecipeRow>): CatalogueRecipeRow {
  return {
    id: 'r-1',
    locale: 'es-ES',
    mealSlots: ['lunch'],
    name: 'Bocadillo',
    picture: 'none',
    servings: 1,
    slug: 'bocadillo',
    source: 'seed',
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadCatalogue.mockResolvedValue([BREAD, CHEESE, OIL]);
  listAllergens.mockResolvedValue([...KEYS].map(([id, key]) => ({ id, isEuMandatory: true, key, labelEs: key })));
  catalogue.recipeCounts.mockResolvedValue({
    bySlot: [
      { n: 3, slot: 'lunch' },
      { n: 1, slot: 'breakfast' }
    ],
    bySource: [{ n: 4, source: 'seed' }],
    total: 4,
    withoutImage: 3
  });
  catalogue.compositions.mockResolvedValue([
    { grams: 120, recipeId: 'r-1', slug: 'pan' },
    { grams: 60, recipeId: 'r-1', slug: 'queso' },
    { grams: 10, recipeId: 'r-2', slug: 'aceite' },
    { grams: 300, recipeId: 'r-3', slug: 'pan' }
  ]);
});

describe('perServing', () => {
  it('is the app’s own composePerServing, to the decimal, for any number of servings', () => {
    const table = makeCatalogue([BREAD, CHEESE, OIL]);
    const items = [
      { grams: 173.4, slug: 'pan' },
      { grams: 61.7, slug: 'queso' },
      { grams: 9.9, slug: 'aceite' }
    ];

    for (const servings of [1, 2, 3, 0.5]) {
      const composed = composePerServing(makeDish({ ingredients: items, servings }), table);

      expect(composed.ok).toBe(true);

      if (composed.ok) {
        const { carbsG, fatG, kcal, proteinG } = composed.macros;

        expect(perServing(items, servings, table)).toEqual({ carbsG, fatG, kcal, proteinG });
      }
    }
  });

  it('is uncosted — null, never a guess — for a recipe with no servings or an ingredient the catalogue lacks', () => {
    const uncosted = { carbsG: null, fatG: null, kcal: null, proteinG: null };

    expect(perServing([{ grams: 100, slug: 'pan' }], 0, makeCatalogue([BREAD]))).toEqual(uncosted);
    expect(perServing([{ grams: 100, slug: 'unknown' }], 1, makeCatalogue([BREAD]))).toEqual(uncosted);
  });
});

describe('allergensOf', () => {
  it('lists what a served ingredient contains, and a trace only where nothing contains it', () => {
    const table = makeCatalogue([BREAD, CHEESE, OIL]);

    expect(allergensOf(['queso', 'pan', 'aceite'], table, KEYS)).toEqual({ allergens: ['gluten', 'milk'], mayContain: ['peanuts'] });

    const peanutBread = makeCatalogueIngredient({ allergens: [{ allergenId: ALLERGEN_IDS.peanuts, presence: 'contains' }], slug: 'pan-cacahuete' });

    expect(allergensOf(['pan', 'pan-cacahuete'], makeCatalogue([BREAD, peanutBread]), KEYS)).toEqual({
      allergens: ['gluten', 'peanuts'],
      mayContain: []
    });
  });
});

describe('byFigure', () => {
  const view = (name: string, kcal: number | null, slug = name): CatalogueRecipeView => ({
    allergens: [],
    carbsG: null,
    fatG: null,
    kcal,
    locale: 'es-ES',
    mayContain: [],
    mealSlots: [],
    name,
    picture: 'none',
    proteinG: null,
    slug,
    source: 'seed'
  });

  it('puts the uncosted last either way, and breaks a tie by name then slug', () => {
    const rows = [view('b', 300), view('z', null), view('a', 300, 'a-2'), view('a', 300, 'a-1'), view('c', 100)];

    expect([...rows].sort(byFigure('kcal', 'asc')).map(row => row.slug)).toEqual(['c', 'a-1', 'a-2', 'b', 'z']);
    expect([...rows].sort(byFigure('kcal', 'desc')).map(row => row.slug)).toEqual(['a-1', 'a-2', 'b', 'c', 'z']);
  });
});

describe('AdminCatalogueController.recipes', () => {
  it('by name, pages in SQL and costs only the page', async () => {
    catalogue.recipePage.mockResolvedValue({ rows: [recipe({})], total: 57 });

    const view = await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({ offset: '25', size: '25' }));

    expect(catalogue.matchingRecipes).not.toHaveBeenCalled();
    expect(catalogue.compositions).toHaveBeenCalledWith(['r-1']);
    expect(loadCatalogue).toHaveBeenCalledWith('es-ES', null, ['pan', 'queso', 'aceite']);
    expect(view.offset).toBe(25);
    expect(view.total).toBe(57);
    expect(view.rows).toEqual([
      {
        allergens: ['gluten', 'milk'],
        carbsG: 60.8,
        fatG: 23.4,
        kcal: 541.2,
        locale: 'es-ES',
        mayContain: ['peanuts'],
        mealSlots: ['lunch'],
        name: 'Bocadillo',
        picture: 'none',
        proteinG: 25.8,
        slug: 'bocadillo',
        source: 'seed'
      }
    ]);
  });

  it('by a macro, costs every match with the app’s composition, sorts, then cuts the page — the total is every match', async () => {
    catalogue.matchingRecipes.mockResolvedValue([
      recipe({ id: 'r-1', name: 'Bocadillo', slug: 'bocadillo' }),
      recipe({ id: 'r-2', name: 'Aliño', slug: 'alino' }),
      recipe({ id: 'r-3', name: 'Pan para dos', servings: 2, slug: 'pan-para-dos' })
    ]);

    const view = await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({ dir: 'desc', size: '2', sort: 'kcal' }));

    expect(catalogue.recipePage).not.toHaveBeenCalled();
    expect(view.total).toBe(3);
    expect(view.rows.map(row => [row.slug, row.kcal])).toEqual([
      ['bocadillo', 541.2],
      ['pan-para-dos', 375]
    ]);

    const protein = await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({ offset: '1', size: '2', sort: 'protein' }));

    expect(protein.rows.map(row => [row.slug, row.proteinG])).toEqual([
      ['pan-para-dos', 13.5],
      ['bocadillo', 25.8]
    ]);
  });

  it('counts every slot and every source, zeros included, in their own order', async () => {
    catalogue.recipePage.mockResolvedValue({ rows: [], total: 0 });

    const { counts } = await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({}));

    expect(counts).toEqual({
      bySlot: [
        { n: 1, slot: 'breakfast' },
        { n: 0, slot: 'morning_snack' },
        { n: 3, slot: 'lunch' },
        { n: 0, slot: 'afternoon_snack' },
        { n: 0, slot: 'dinner' },
        { n: 0, slot: 'supper' }
      ],
      bySource: [
        { n: 4, source: 'seed' },
        { n: 0, source: 'ai' },
        { n: 0, source: 'user' }
      ],
      total: 4,
      withoutImage: 3
    });
  });

  it('carries nothing that names a person: no id, no created_by, no user', async () => {
    catalogue.recipePage.mockResolvedValue({ rows: [recipe({})], total: 1 });

    const [row] = (await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({}))).rows;

    expect(Object.keys(row ?? {}).sort()).toEqual(
      ['allergens', 'carbsG', 'fatG', 'kcal', 'locale', 'mayContain', 'mealSlots', 'name', 'picture', 'proteinG', 'slug', 'source'].sort()
    );
  });
});

describe('AdminCatalogueController.ingredients', () => {
  it('pages the ingredients with their allergens, the claim apart from the trace', async () => {
    catalogue.ingredientPage.mockResolvedValue({
      rows: [
        {
          carbsPer100g: 50,
          category: 'bakery',
          countries: [],
          fatPer100g: 3,
          kcalPer100g: 250,
          mealSlots: [],
          name: 'Pan',
          proteinPer100g: 9,
          slug: 'pan'
        }
      ],
      total: 930
    });
    catalogue.ingredientAllergens.mockResolvedValue([
      { key: 'gluten', presence: 'contains', slug: 'pan' },
      { key: 'sesame', presence: 'may_contain', slug: 'pan' },
      { key: 'milk', presence: 'contains', slug: 'otro' }
    ]);

    const view = await AdminCatalogueController.ingredients(ingredientCatalogueQuerySchema.parse({}));

    expect(catalogue.ingredientAllergens).toHaveBeenCalledWith(['pan']);
    expect(view).toEqual({
      offset: 0,
      rows: [
        {
          allergens: ['gluten'],
          carbsPer100g: 50,
          category: 'bakery',
          countries: [],
          fatPer100g: 3,
          kcalPer100g: 250,
          mayContain: ['sesame'],
          mealSlots: [],
          name: 'Pan',
          proteinPer100g: 9,
          slug: 'pan'
        }
      ],
      size: 25,
      total: 930
    });
  });
});
