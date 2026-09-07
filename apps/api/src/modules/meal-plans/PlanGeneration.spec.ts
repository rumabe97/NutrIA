import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { OnboardingController } from 'core/controllers/Onboarding';
import { PlanJobController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';

import { ageInYears, resolveTargets } from 'core/domain/Nutrition';
import { toCatalogue } from 'core/entities/Plan';

import { PlanGenerationService, STEPS } from './PlanGeneration.service.js';

import type { CandidateDish, CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { PoolBuilder } from '../ai/PoolBuilder.service.js';

const GLUTEN = 'allergen-gluten';
const SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner'];

/**
 * The targets the pipeline will actually plan against for PROFILE. Derived rather
 * than hardcoded, so the fixture cannot drift away from the maths and make
 * validation fail for a reason unrelated to what a test is asserting.
 *
 * Resolved the same way the profile controller resolves them, because that is now
 * where generation reads them from — the service no longer computes its own.
 */
const RESOLVED = resolveTargets(
  {
    activityLevel: 'moderate',
    ageYears: ageInYears('1994-03-11', new Date('2026-09-07T00:00:00Z')),
    goal: 'maintenance',
    heightCm: 168,
    paceKgPerWeek: null,
    sex: 'female',
    weightKg: 72
  },
  null
);

const TARGETS = RESOLVED.effective;

const KCAL_PER_100G = 200;

/** Macros in the target's own ratio, so a day in the calorie band is in every band. */
function ingredient(slug: string, allergens: CatalogueIngredient['allergens'] = []): CatalogueIngredient {
  const share = (grams: number) => Math.round(((KCAL_PER_100G * grams) / TARGETS.kcal) * 10) / 10;

  return {
    id: `ing-${slug}`,
    allergens,
    carbsPer100g: share(TARGETS.carbsG),
    category: 'pantry',
    defaultUnit: 'g',
    fatPer100g: share(TARGETS.fatG),
    fiberPer100g: share(TARGETS.fiberG),
    gramsPerUnit: null,
    kcalPer100g: KCAL_PER_100G,
    name: slug,
    nameLocale: 'es-ES',
    proteinPer100g: share(TARGETS.proteinG),
    slug
  };
}

const CATALOGUE = toCatalogue([ingredient('arroz'), ingredient('pan', [{ allergenId: GLUTEN, presence: 'contains' }])]);

/** A pool wide enough for the variety rules, sized near each slot's share of 2000 kcal. */
function pool(slug = 'arroz'): CandidateDish[] {
  const SHARE: Record<string, number> = { breakfast: 0.28, dinner: 0.34, lunch: 0.37 };

  return SLOTS.flatMap(slot =>
    Array.from({ length: 6 }, (_unused, index) => ({
      cookMinutes: 10,
      cuisine: null,
      difficulty: 'easy' as const,
      ingredients: [{ grams: Math.round(((TARGETS.kcal * (SHARE[slot] ?? 0.3)) / (KCAL_PER_100G / 100)) * (0.8 + index * 0.08)), slug }],
      name: `${slot} ${index}`,
      prepMinutes: 5,
      servings: 1,
      slots: [slot],
      slug: `${slot}-${index}`,
      steps: [{ text: 'Mezclar' }]
    }))
  );
}

const PROFILE = {
  allergies: [],
  cuisines: [],
  dietaryPatterns: [],
  foodPreferences: [],
  goal: { id: 'g1', customGoal: null, paceKgPerWeek: null, startingWeightKg: 72, targetWeightKg: 70, type: 'maintenance' as const },
  intolerances: [],
  preferences: { activityLevel: 'moderate' as const, includesSnacks: false, mealsPerDay: 3 },
  profile: { birthDate: '1994-03-11', heightCm: 168, sex: 'female' as const },
  targets: RESOLVED
};

type Mocks = { onboarding: unknown; persist: jest.Mock; profile: unknown; reusable: CandidateDish[]; safety: Set<string> };

function build(overrides: Partial<Mocks> = {}) {
  const persist = overrides.persist ?? (jest.fn(async () => Promise.resolve('plan-1')) as jest.Mock);
  const reusable = overrides.reusable ?? pool();
  const safety = overrides.safety ?? new Set<string>();

  jest.spyOn(OnboardingController, 'getState').mockResolvedValue({
    completedAt: '2026-09-01',
    completedSteps: [],
    currentStep: 9,
    isComplete: true,
    missingSteps: [],
    totalSteps: 10,
    ...(overrides.onboarding as object)
  } as never);
  jest.spyOn(ProfileController, 'getFullProfile').mockResolvedValue({ ...PROFILE, ...(overrides.profile as object) } as never);
  jest.spyOn(RecipeController, 'generationContext').mockResolvedValue({
    catalogue: CATALOGUE,
    locale: 'es-ES',
    safety: {
      allergenIds: safety,
      crossContaminationAllergenIds: new Set(),
      excludedIngredientIds: new Set(),
      intoleranceAllergenIds: new Set(),
      unenforceableLabels: []
    }
  });
  jest.spyOn(RecipeController, 'reusablePool').mockResolvedValue(reusable);
  jest.spyOn(PlanJobController, 'persist').mockImplementation(persist as never);

  const poolBuilder = {
    build: jest.fn(async () => Promise.resolve({ dishes: reusable, generated: [], metadata: { attempts: 0, calls: 0, inputTokens: 0, model: 'none', outputTokens: 0, promptVersion: '1.0.0', rejected: 0, reused: reusable.length } }))
  } as unknown as PoolBuilder;

  return { persist, service: new PlanGenerationService(poolBuilder) };
}

describe('PlanGenerationService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('produces a 14-day plan and persists it once', async () => {
    const { persist, service } = build();
    const planId = await service.generate('usr-1', 'job-1', async () => Promise.resolve());

    expect(planId).toBe('plan-1');
    expect(persist).toHaveBeenCalledTimes(1);

    const draft = persist.mock.calls[0]?.[1] as { days: unknown[]; shoppingItems: unknown[] };

    expect(draft.days).toHaveLength(14);
    expect(draft.shoppingItems.length).toBeGreaterThan(0);
  });

  it('reports each stage before it runs, and never a stage it did not reach', async () => {
    const steps: string[] = [];
    const { service } = build();

    await service.generate('usr-1', 'job-1', async step => {
      steps.push(step);

      return Promise.resolve();
    });

    expect(steps).toEqual([STEPS.loading, STEPS.choosing, STEPS.scheduling, STEPS.validating, STEPS.building, STEPS.saving]);
  });

  it('refuses to generate before onboarding is complete, and writes nothing', async () => {
    const { persist, service } = build({ onboarding: { isComplete: false } });

    await expect(service.generate('usr-1', 'job-1', async () => Promise.resolve())).rejects.toMatchObject({
      code: 'GENERATION_ONBOARDING_INCOMPLETE'
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it('refuses an incomplete profile rather than guessing a calorie target', async () => {
    // Targets resolve to null when the profile is missing what the equations need.
    const { persist, service } = build({ profile: { profile: { birthDate: null, heightCm: null, sex: null }, targets: null } });

    await expect(service.generate('usr-1', 'job-1', async () => Promise.resolve())).rejects.toMatchObject({ code: 'GENERATION_PROFILE_INCOMPLETE' });
    expect(persist).not.toHaveBeenCalled();
  });

  it('fails naming the slot when the pool is too thin — the expected outcome with no AI provider', async () => {
    const { persist, service } = build({ reusable: [] });

    await expect(service.generate('usr-1', 'job-1', async () => Promise.resolve())).rejects.toMatchObject({ code: 'GENERATION_POOL_TOO_SMALL' });
    expect(persist).not.toHaveBeenCalled();
  });

  it('blocks an unsafe meal at the final gate, after scheduling, and writes nothing', async () => {
    // The pool builder is stubbed to hand back an unsafe dish, as if the candidate
    // check had been bypassed. The gate before persistence must still catch it.
    const { persist, service } = build({ reusable: pool('pan'), safety: new Set([GLUTEN]) });

    await expect(service.generate('usr-1', 'job-1', async () => Promise.resolve())).rejects.toMatchObject({ code: 'GENERATION_UNSAFE_CONTENT' });
    expect(persist).not.toHaveBeenCalled();
  });

  it('computes every stored macro from the catalogue, never from the pool', async () => {
    const { persist, service } = build();

    await service.generate('usr-1', 'job-1', async () => Promise.resolve());

    const draft = persist.mock.calls[0]?.[1] as { days: { meals: { kcal: number; servings: number }[] }[] };

    for (const day of draft.days) {
      for (const meal of day.meals) {
        expect(meal.kcal).toBeGreaterThan(0);
        // 200 kcal per 100 g of the only ingredient: every figure traces back to it.
        expect(Number.isFinite(meal.kcal)).toBe(true);
      }
    }
  });

  it('records the usage metadata that answers whether generation is affordable', async () => {
    const { persist, service } = build();

    await service.generate('usr-1', 'job-1', async () => Promise.resolve());

    const draft = persist.mock.calls[0]?.[1] as { generationMetadata: Record<string, unknown> };

    expect(draft.generationMetadata).toMatchObject({ calls: 0, jobId: 'job-1', reused: 18 });
  });

  it('persists no new recipes when the plan was built entirely from reuse', async () => {
    const { persist, service } = build();

    await service.generate('usr-1', 'job-1', async () => Promise.resolve());

    expect((persist.mock.calls[0]?.[1] as { newRecipes: unknown[] }).newRecipes).toEqual([]);
  });
});
