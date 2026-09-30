import { beforeEach, describe, expect, it, vi } from 'vitest';

import { composePerServing } from 'core/domain/Composition';
import { ingredientCatalogueQuerySchema, recipeCatalogueQuerySchema } from 'core/entities/AdminQuery';
import { ALLERGEN_IDS, makeCatalogue, makeCatalogueIngredient, makeDish } from '#test/fixtures';

import { AdminCatalogueController, allergensOf, byFigure, candidateFlagsOf, perServing, pictureFailure } from './AdminCatalogueController';

import type { AdminCatalogueRepository as Catalogue, CatalogueRecipeRow } from '#repositories/Admin';
import type { CatalogueRecipeView } from './AdminCatalogueController';

const catalogue = vi.hoisted(() => ({
  compositions: vi.fn<(typeof Catalogue)['compositions']>(),
  ingredientAllergens: vi.fn<(typeof Catalogue)['ingredientAllergens']>(),
  ingredientPage: vi.fn<(typeof Catalogue)['ingredientPage']>(),
  matchingRecipes: vi.fn<(typeof Catalogue)['matchingRecipes']>(),
  qualityRecipes: vi.fn<(typeof Catalogue)['qualityRecipes']>(),
  recipe: vi.fn<(typeof Catalogue)['recipe']>(),
  recipeCounts: vi.fn<(typeof Catalogue)['recipeCounts']>(),
  recipePage: vi.fn<(typeof Catalogue)['recipePage']>()
}));
const STEPS = '2.8.0';
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
    pictureAt: null,
    pictureFailed: false,
    pictureProvenance: null,
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
    id: name,
    allergens: [],
    carbsG: null,
    fatG: null,
    kcal,
    locale: 'es-ES',
    mayContain: [],
    mealSlots: [],
    name,
    picture: 'none',
    pictureCandidate: null,
    pictureReason: null,
    proteinG: null,
    retryableAt: null,
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
  it('narrows the table to the recipes a quality check finds, and only asks the check when it is given', async () => {
    catalogue.qualityRecipes.mockResolvedValue([
      { id: 'r-ok', items: [{ grams: 100, slug: 'aceite' }], mealSlots: ['lunch'], pending: false, servings: 1, source: 'seed', stepsVersion: STEPS },
      { id: 'r-big', items: [{ grams: 900, slug: 'aceite' }], mealSlots: ['lunch'], pending: false, servings: 1, source: 'seed', stepsVersion: STEPS }
    ]);
    catalogue.recipePage.mockResolvedValue({ rows: [], total: 0 });
    loadCatalogue.mockResolvedValue([OIL]);

    await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({ check: 'over_bound' }), STEPS);

    expect(catalogue.qualityRecipes).toHaveBeenCalledWith(STEPS);
    expect(catalogue.recipePage).toHaveBeenCalledWith(expect.objectContaining({ check: 'over_bound' }), ['r-big']);

    catalogue.qualityRecipes.mockClear();
    await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({}), STEPS);

    expect(catalogue.qualityRecipes).not.toHaveBeenCalled();
    expect(catalogue.recipePage).toHaveBeenLastCalledWith(expect.anything(), undefined);
  });

  it('by name, pages in SQL and costs only the page', async () => {
    catalogue.recipePage.mockResolvedValue({ rows: [recipe({})], total: 57 });

    const view = await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({ offset: '25', size: '25' }), STEPS);

    expect(catalogue.matchingRecipes).not.toHaveBeenCalled();
    expect(catalogue.compositions).toHaveBeenCalledWith(['r-1']);
    expect(loadCatalogue).toHaveBeenCalledWith('es-ES', null, ['pan', 'queso', 'aceite']);
    expect(view.offset).toBe(25);
    expect(view.total).toBe(57);
    expect(view.rows).toEqual([
      {
        id: 'r-1',
        allergens: ['gluten', 'milk'],
        carbsG: 60.8,
        fatG: 23.4,
        kcal: 541.2,
        locale: 'es-ES',
        mayContain: ['peanuts'],
        mealSlots: ['lunch'],
        name: 'Bocadillo',
        picture: 'none',
        pictureCandidate: null,
        pictureReason: null,
        proteinG: 25.8,
        retryableAt: null,
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

    const view = await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({ dir: 'desc', size: '2', sort: 'kcal' }), STEPS);

    expect(catalogue.recipePage).not.toHaveBeenCalled();
    expect(view.total).toBe(3);
    expect(view.rows.map(row => [row.slug, row.kcal])).toEqual([
      ['bocadillo', 541.2],
      ['pan-para-dos', 375]
    ]);

    const protein = await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({ offset: '1', size: '2', sort: 'protein' }), STEPS);

    expect(protein.rows.map(row => [row.slug, row.proteinG])).toEqual([
      ['pan-para-dos', 13.5],
      ['bocadillo', 25.8]
    ]);
  });

  it('counts every slot and every source, zeros included, in their own order', async () => {
    catalogue.recipePage.mockResolvedValue({ rows: [], total: 0 });

    const { counts } = await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({}), STEPS);

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

  it('carries nothing that names a person: no created_by, no user', async () => {
    catalogue.recipePage.mockResolvedValue({ rows: [recipe({})], total: 1 });

    const [row] = (await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({}), STEPS)).rows;

    expect(Object.keys(row ?? {}).sort()).toEqual(
      [
        'allergens',
        'carbsG',
        'fatG',
        'id',
        'kcal',
        'locale',
        'mayContain',
        'mealSlots',
        'name',
        'picture',
        'pictureCandidate',
        'pictureReason',
        'proteinG',
        'retryableAt',
        'slug',
        'source'
      ].sort()
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

/* The owner sees why a picture failed, and when a view would draw it again; a released one has no wait. */
describe('pictureFailure', () => {
  const NOW = new Date('2026-09-30T12:00:00Z');
  const failed = (hoursAgo: number, pictureProvenance: Record<string, unknown> | null) => ({
    pictureAt: new Date(NOW.getTime() - hoursAgo * 3_600_000),
    pictureFailed: true,
    pictureProvenance
  });

  it('says nothing for a picture that did not fail', () => {
    expect(pictureFailure({ pictureAt: NOW, pictureFailed: false, pictureProvenance: null }, NOW)).toEqual({
      pictureReason: null,
      retryableAt: null
    });
  });

  it('names the reason and the end of the 7-day cool-off for a fresh failure', () => {
    expect(pictureFailure(failed(24, { notes: ['1:unkeepable:no C2PA manifest (image/jpeg)'] }), NOW)).toEqual({
      pictureReason: 'no_provenance',
      retryableAt: '2026-10-06T12:00:00.000Z'
    });
  });

  it('is retryable now, with no date, once the cool-off is over', () => {
    expect(pictureFailure(failed(24 * 8, { reason: 'call_failed' }), NOW)).toEqual({ pictureReason: 'call_failed', retryableAt: null });
  });

  it('has no wait for a picture that was given back', () => {
    expect(pictureFailure(failed(1, { reason: 'cap_reached', released: 'the month’s cap is reached' }), NOW)).toEqual({
      pictureReason: 'cap_reached',
      retryableAt: null
    });
  });
});

/* 0072: the owner sees what the judge flagged, in our own closed words, and until when — never where the file is. */
describe('a dish’s candidate on the table', () => {
  const NOW = new Date('2026-09-30T12:00:00Z');
  const PATH = 'dish-picture-candidates/6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg';
  const held = (hoursAgo: number, extras: readonly { foreignAllergens: string[]; mappedTo: string[] }[]) => ({
    picture: 'failed' as const,
    pictureAt: new Date(NOW.getTime() - hoursAgo * 3_600_000),
    pictureFailed: true,
    pictureProvenance: {
      candidate: { extras, model: 'stub/picture', path: PATH, promptVersion: '2.0.0' },
      notes: ['3:rejected:extra_allergen:x'],
      reason: 'judge_allergen'
    }
  });
  const PRAWNS = [
    { foreignAllergens: ['milk', 'crustaceans'], mappedTo: ['queso', 'gambas'] },
    { foreignAllergens: ['milk'], mappedTo: ['queso'] }
  ];

  it('reads the flags each once and sorted, and the expiry as the end of the cool-off', () => {
    expect(candidateFlagsOf(held(24, PRAWNS), NOW)).toEqual({
      allergens: ['crustaceans', 'milk'],
      expiresAt: '2026-10-06T12:00:00.000Z',
      ingredients: ['gambas', 'queso']
    });
  });

  it.each<[string, Parameters<typeof candidateFlagsOf>[0]]>([
    ['expired, though the cleanup has not deleted it yet', held(24 * 7, PRAWNS)],
    ['on a row that is not failed', { ...held(24, PRAWNS), pictureFailed: false }],
    ['absent from a failed row', { pictureAt: NOW, pictureFailed: true, pictureProvenance: { reason: 'call_failed' } }],
    ['on a row with nothing stored', { pictureAt: NOW, pictureFailed: true, pictureProvenance: null }]
  ])('shows no candidate %s', (_case, row) => {
    expect(candidateFlagsOf(row, NOW)).toBeNull();
  });

  it('puts it on the row with the catalogue’s own names, the slug where the catalogue has none — and the failure’s reason beside it', async () => {
    catalogue.recipePage.mockResolvedValue({ rows: [recipe(held(24, PRAWNS))], total: 1 });

    const [row] = (await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({}), STEPS, NOW)).rows;

    // The flagged ingredients are named in the same catalogue read as the dish's own.
    expect(loadCatalogue).toHaveBeenCalledWith('es-ES', null, ['pan', 'queso', 'aceite', 'gambas']);
    expect(row?.pictureCandidate).toEqual({
      allergens: ['crustaceans', 'milk'],
      expiresAt: '2026-10-06T12:00:00.000Z',
      ingredients: [
        { name: 'gambas', slug: 'gambas' },
        { name: CHEESE.name, slug: 'queso' }
      ]
    });
    expect(row).toMatchObject({ picture: 'failed', pictureReason: 'judge_allergen', retryableAt: '2026-10-06T12:00:00.000Z' });
  });

  it('never lets the file’s path, or anything else the row stored, out', async () => {
    catalogue.recipePage.mockResolvedValue({ rows: [recipe(held(24, PRAWNS))], total: 1 });
    catalogue.matchingRecipes.mockResolvedValue([recipe(held(24, PRAWNS))]);

    for (const query of [{}, { sort: 'kcal' }]) {
      const answer = JSON.stringify(await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse(query), STEPS, NOW));

      expect(answer).not.toContain('dish-picture-candidates');
      expect(answer).not.toContain('0b7e3f2a');
      expect(answer).not.toContain('extra_allergen');
      expect(answer).not.toContain('stub/picture');
    }

    const [row] = (await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({}), STEPS, NOW)).rows;

    expect(Object.keys(row?.pictureCandidate ?? {}).sort()).toEqual(['allergens', 'expiresAt', 'ingredients']);
  });
});

/* Project 009, step 4 as amended: one recipe by id with its ingredients — what a rejected picture is reviewed against. */
describe('AdminCatalogueController.recipe', () => {
  const ID = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
  const NOW = new Date('2026-09-30T12:00:00Z');
  const PATH = `dish-picture-candidates/${ID}/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg`;

  beforeEach(() => {
    catalogue.compositions.mockResolvedValue([
      { grams: 60, recipeId: ID, slug: 'queso' },
      { grams: 120, recipeId: ID, slug: 'pan' },
      { grams: 5, recipeId: ID, slug: 'sin-nombre' }
    ]);
  });

  it('answers the table’s own row and the served ingredients, heaviest first, named by the catalogue — the slug where it has none', async () => {
    catalogue.recipe.mockResolvedValue(recipe({ id: ID }));
    catalogue.recipePage.mockResolvedValue({ rows: [recipe({ id: ID })], total: 1 });

    const view = await AdminCatalogueController.recipe(ID, NOW);
    const [listed] = (await AdminCatalogueController.recipes(recipeCatalogueQuerySchema.parse({}), STEPS, NOW)).rows;
    const { ingredients, ...row } = view;

    expect(catalogue.recipe).toHaveBeenCalledWith(ID);
    expect(row).toEqual(listed);
    expect(ingredients).toEqual([
      { grams: 120, name: BREAD.name, slug: 'pan' },
      { grams: 60, name: CHEESE.name, slug: 'queso' },
      { grams: 5, name: 'sin-nombre', slug: 'sin-nombre' }
    ]);
  });

  it('carries the dish’s candidate as the table does, and never where its file is', async () => {
    catalogue.recipe.mockResolvedValue(
      recipe({
        id: ID,
        picture: 'failed',
        pictureAt: new Date(NOW.getTime() - 86_400_000),
        pictureFailed: true,
        pictureProvenance: {
          candidate: { extras: [{ foreignAllergens: ['milk'], mappedTo: ['queso'] }], model: 'stub/picture', path: PATH, promptVersion: '2.0.0' },
          notes: ['3:rejected:extra_allergen:cheddar=milk'],
          reason: 'judge_allergen'
        }
      })
    );

    const view = await AdminCatalogueController.recipe(ID, NOW);

    expect(view.pictureCandidate).toEqual({
      allergens: ['milk'],
      expiresAt: '2026-10-06T12:00:00.000Z',
      ingredients: [{ name: CHEESE.name, slug: 'queso' }]
    });
    expect(JSON.stringify(view)).not.toMatch(/dish-picture-candidates|0b7e3f2a|cheddar|stub\/picture|https?:/);
  });

  it('names nobody: the row’s keys and `ingredients`, nothing else', async () => {
    catalogue.recipe.mockResolvedValue(recipe({ id: ID }));

    const view = await AdminCatalogueController.recipe(ID, NOW);

    expect(Object.keys(view).filter(key => /user|created|author|owner|email/i.test(key))).toEqual([]);
    expect(Object.keys(view)).toContain('ingredients');
    expect(Object.keys(view.ingredients[0] ?? {}).sort()).toEqual(['grams', 'name', 'slug']);
  });

  it('is not found for a recipe that does not exist, and for an id that is not one before anything is read — never echoing it', async () => {
    catalogue.recipe.mockResolvedValue(null);

    await expect(AdminCatalogueController.recipe(ID, NOW)).rejects.toMatchObject({ message: 'Recipe not found' });

    catalogue.recipe.mockClear();
    const error = (await AdminCatalogueController.recipe('not-a-uuid-zzq', NOW).catch((thrown: unknown) => thrown)) as Error;

    expect(error.name).toBe('NotFoundError');
    expect(error.message).toBe('Recipe not found');
    expect(catalogue.recipe).not.toHaveBeenCalled();
    expect(catalogue.compositions).not.toHaveBeenCalled();
  });
});
