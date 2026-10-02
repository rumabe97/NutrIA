import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeCatalogueIngredient } from '#test/fixtures';

import { AdminQualityController } from './AdminQualityController';

import type { QualityRecipeRow } from '#repositories/Admin';

const repository = vi.hoisted(() => ({ mealsOutsideServingBounds: vi.fn(), picturesFailed: vi.fn(), qualityRecipes: vi.fn() }));
const generations = vi.hoisted(() => ({ rejectionsPerDay: vi.fn() }));
const runs = vi.hoisted(() => ({ rewriteRunsPerDay: vi.fn() }));
const spend = vi.hoisted(() => ({ featurePerDay: vi.fn() }));
const loadCatalogue = vi.hoisted(() => vi.fn());

vi.mock('#repositories/Admin', () => ({
  AdminAiRepository: spend,
  AdminCatalogueRepository: repository,
  AdminGenerationsRepository: generations,
  AdminRepository: {},
  AdminSystemRepository: runs,
  JOB_STATUSES: [],
  PLAN_STATUSES: []
}));
vi.mock('#repositories/Recipe', () => ({ FALLBACK_LOCALE: 'es-ES', RecipeRepository: { loadCatalogue } }));

const STEPS = '2.8.0';
const NOW = new Date('2026-09-29T10:00:00Z');

function row(overrides: Partial<QualityRecipeRow>): QualityRecipeRow {
  return {
    id: 'r-ok',
    cuisine: null,
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
  runs.rewriteRunsPerDay.mockResolvedValue([]);
  spend.featurePerDay.mockResolvedValue([]);
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

  it('lays the sweep’s runs and spend on the period’s days: a quiet day is 0, a day with no run has no pending', async () => {
    repository.qualityRecipes.mockResolvedValue([]);
    runs.rewriteRunsPerDay.mockResolvedValue([
      { day: '2026-09-27', heldByCap: 0, pending: 40, rewritten: 3, runs: 1, skipped: 1, unreached: 36 },
      { day: '2026-09-28', heldByCap: 1, pending: null, rewritten: 0, runs: 1, skipped: 0, unreached: 0 }
    ]);
    spend.featurePerDay.mockResolvedValue([{ calls: 4, costUsd: 0.0123456789, day: '2026-09-27' }]);

    const { sweepHistory } = await AdminQualityController.quality(7, STEPS, NOW);

    expect(spend.featurePerDay).toHaveBeenCalledWith('rewrite', new Date('2026-09-22T22:00:00Z'), NOW);
    expect(sweepHistory.days).toHaveLength(7);
    expect(sweepHistory.runs).toEqual([0, 0, 0, 0, 1, 1, 0]);
    expect(sweepHistory.rewritten).toEqual([0, 0, 0, 0, 3, 0, 0]);
    expect(sweepHistory.skipped).toEqual([0, 0, 0, 0, 1, 0, 0]);
    expect(sweepHistory.unreached).toEqual([0, 0, 0, 0, 36, 0, 0]);
    expect(sweepHistory.heldByCap).toEqual([0, 0, 0, 0, 0, 1, 0]);
    expect(sweepHistory.pending).toEqual([null, null, null, null, 40, null, null]);
    expect(sweepHistory.calls).toEqual([0, 0, 0, 0, 4, 0, 0]);
    expect(sweepHistory.costUsd).toEqual([0, 0, 0, 0, 0.012346, 0, 0]);
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
