import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeCatalogueIngredient } from '#test/fixtures';

import { AdminQualityController } from './AdminQualityController';

import type { QualityRecipeRow } from '#repositories/Admin';

const repository = vi.hoisted(() => ({ mealsOutsideServingBounds: vi.fn(), picturesFailed: vi.fn(), qualityRecipes: vi.fn() }));
const generations = vi.hoisted(() => ({ rejectionsPerDay: vi.fn() }));
const loadCatalogue = vi.hoisted(() => vi.fn());

vi.mock('#repositories/Admin', () => ({
  AdminCatalogueRepository: repository,
  AdminGenerationsRepository: generations,
  AdminRepository: {},
  JOB_STATUSES: [],
  PLAN_STATUSES: []
}));
vi.mock('#repositories/Recipe', () => ({ FALLBACK_LOCALE: 'es-ES', RecipeRepository: { loadCatalogue } }));

const STEPS = '2.8.0';
const NOW = new Date('2026-09-29T10:00:00Z');

function row(overrides: Partial<QualityRecipeRow>): QualityRecipeRow {
  return {
    id: 'r-ok',
    items: [{ grams: 100, slug: 'base' }],
    mealSlots: ['lunch'],
    pending: false,
    servings: 1,
    source: 'seed',
    stepsVersion: STEPS,
    ...overrides
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  loadCatalogue.mockResolvedValue([makeCatalogueIngredient({ slug: 'base' })]);
  repository.mealsOutsideServingBounds.mockResolvedValue(0);
  repository.picturesFailed.mockResolvedValue(0);
  generations.rejectionsPerDay.mockResolvedValue([]);
});

describe('AdminQualityController.quality', () => {
  it('counts each defect and the sweep’s state out of the catalogue, with the app’s helpers', async () => {
    repository.qualityRecipes.mockResolvedValue([
      row({}),
      row({ id: 'r-bound', items: [{ grams: 700, slug: 'base' }] }),
      row({ id: 'r-cap', items: [{ grams: 480, slug: 'base' }], source: 'ai' }),
      row({ id: 'r-cap-2', items: [{ grams: 480, slug: 'base' }], source: 'ai' }),
      row({ id: 'r-uncosted', items: [{ grams: 100, slug: 'inventado' }] }),
      row({ id: 'r-none', mealSlots: [] }),
      row({ id: 'r-given-up', stepsVersion: '2.8.0+3' }),
      row({ id: 'r-refused', pending: true, stepsVersion: '2.8.0+1' }),
      row({ id: 'r-old', pending: true, stepsVersion: '2.7.0' })
    ]);
    repository.mealsOutsideServingBounds.mockResolvedValue(4);
    repository.picturesFailed.mockResolvedValue(2);

    const view = await AdminQualityController.quality(30, STEPS, NOW);

    expect(view.recipes).toBe(9);
    expect(view.shouldBeZero).toEqual({ mealsOutsideServingBounds: 4, overBound: 1, refusalLimit: 1, uncosted: 1, unserved: 1 });
    expect(view.toLookAt.overCapBySource).toEqual([
      { n: 0, source: 'seed' },
      { n: 2, source: 'ai' },
      { n: 0, source: 'user' }
    ]);
    expect(view.toLookAt.picturesFailed).toBe(2);
    expect(view.sweep).toEqual({ attemptBound: 3, current: 6, givenUp: 1, pending: 2, stepsVersion: STEPS, withRefusals: 1 });
    // The sweep’s three states add up to the catalogue.
    expect(view.sweep.current + view.sweep.pending + view.sweep.givenUp).toBe(view.recipes);
  });

  it('fills the rejections per Madrid day, zeros included, over the period', async () => {
    repository.qualityRecipes.mockResolvedValue([]);
    generations.rejectionsPerDay.mockResolvedValue([{ day: '2026-09-28', n: 5 }]);

    const view = await AdminQualityController.quality(7, STEPS, NOW);

    expect(generations.rejectionsPerDay).toHaveBeenCalledWith('oversized', new Date('2026-09-22T22:00:00Z'), NOW);
    expect(view.toLookAt.oversizedRejections.days).toHaveLength(7);
    expect(view.toLookAt.oversizedRejections.values).toEqual([0, 0, 0, 0, 0, 5, 0]);
  });

  it('loads only the ingredients the catalogue’s recipes use', async () => {
    repository.qualityRecipes.mockResolvedValue([
      row({ items: [{ grams: 1, slug: 'a' }] }),
      row({
        items: [
          { grams: 1, slug: 'a' },
          { grams: 1, slug: 'b' }
        ]
      })
    ]);

    await AdminQualityController.quality(30, STEPS, NOW);

    expect(loadCatalogue).toHaveBeenCalledWith('es-ES', null, ['a', 'b']);
  });
});

describe('AdminQualityController.idsFailing', () => {
  it('answers with the same recipes the count counts', async () => {
    repository.qualityRecipes.mockResolvedValue([
      row({}),
      row({ id: 'r-bound', items: [{ grams: 700, slug: 'base' }] }),
      row({ id: 'r-given-up', stepsVersion: '2.8.0+3' })
    ]);

    expect(await AdminQualityController.idsFailing('over_bound', STEPS)).toEqual(['r-bound']);
    expect(await AdminQualityController.idsFailing('refusal_limit', STEPS)).toEqual(['r-given-up']);
    expect(await AdminQualityController.idsFailing('uncosted', STEPS)).toEqual([]);
  });
});
