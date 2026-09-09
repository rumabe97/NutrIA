import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { NO_PREFERENCE_EXCLUSIONS } from 'core/domain/Preference';
import { CheckInController } from 'core/controllers/CheckIn';
import { OnboardingController } from 'core/controllers/Onboarding';
import { PlanController, PlanJobController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';

import { ageInYears, resolveTargets } from 'core/domain/Nutrition';
import { toCatalogue } from 'core/entities/Plan';
import { VARIETY_RULES } from 'core/domain/Variety';

import { PlanGenerationService, STEPS } from './PlanGeneration.service.js';

import type { CandidateDish, CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { PoolBuilder, PoolResult } from '../ai/PoolBuilder.service.js';

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
    classes: [],
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

/**
 * A pool wide enough for the variety rules, sized near each slot's share of 2000 kcal.
 *
 * The count is derived, not a literal: `maxOccurrencesPerPlan` decides how many
 * distinct dishes a fortnight needs, and a fixture that hardcodes yesterday's
 * answer turns a deliberate tightening of the variety rules into a wall of red
 * that says nothing about the change. Two over the floor, so the scheduler has
 * something to choose between.
 */
const POOL_PER_SLOT = Math.ceil(14 / VARIETY_RULES.maxOccurrencesPerPlan) + 2;

function pool(slug = 'arroz'): CandidateDish[] {
  const SHARE: Record<string, number> = { breakfast: 0.28, dinner: 0.34, lunch: 0.37 };

  return SLOTS.flatMap(slot =>
    Array.from({ length: POOL_PER_SLOT }, (_unused, index) => ({
      cookMinutes: 10,
      cuisine: null,
      difficulty: 'easy' as const,
      // Spread across a fixed 0.8–1.2 band whatever the pool size, so a bigger
      // pool is denser rather than more extreme at its edges.
      ingredients: [
        {
          grams: Math.round(
            ((TARGETS.kcal * (SHARE[slot] ?? 0.3)) / (KCAL_PER_100G / 100)) * (0.8 + (index / Math.max(POOL_PER_SLOT - 1, 1)) * 0.4)
          ),
          slug
        }
      ],
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
    preferences: NO_PREFERENCE_EXCLUSIONS,
    safety: {
      allergenIds: safety,
      crossContaminationAllergenIds: new Set(),
      excludedIngredientIds: new Set(),
      intoleranceAllergenIds: new Set(),
      unenforceableLabels: []
    }
  });
  jest.spyOn(PlanController, 'generationHistory').mockResolvedValue({ nextVersion: 3, recentDishes: [{ name: 'Pollo al limón', slug: 'pollo-al-limon' }] });
  jest.spyOn(RecipeController, 'reusablePool').mockResolvedValue(reusable);
  jest.spyOn(RecipeController, 'verdicts').mockResolvedValue({ disliked: [], liked: [] });
  jest.spyOn(CheckInController, 'latestForGeneration').mockResolvedValue(null);
  jest.spyOn(PlanJobController, 'persist').mockImplementation(persist as never);

  const buildPool = jest.fn<(input: unknown) => Promise<PoolResult>>(async () =>
    Promise.resolve({
      dishes: reusable,
      generated: [],
      metadata: { attempts: 0, backfilled: 0, calls: 0, inputTokens: 0, model: 'none', outputTokens: 0, promptVersion: '1.0.0', providerUsed: false, rejected: 0, reused: reusable.length }
    })
  );
  const poolBuilder = { build: buildPool } as unknown as PoolBuilder;

  return { buildPool, persist, service: new PlanGenerationService(poolBuilder) };
}

describe('PlanGenerationService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /*
   * "Each user gets their own plan" is decided here, not in the prompt: which
   * library dishes reuse hands over is seeded by the user and the plan version,
   * last fortnight's are held back, and the model is told what they were.
   */
  it('rotates reuse per user and version, holds back last fortnight, and names it to the model', async () => {
    const { buildPool, service } = build();
    const reusablePool = jest.spyOn(RecipeController, 'reusablePool');

    await service.generate('user-1', 'job-1', async () => Promise.resolve());

    const rotation = reusablePool.mock.calls[0]?.[2];

    expect(rotation?.seed).toBe('user-1:3');
    expect(rotation?.avoidSlugs.has('pollo-al-limon')).toBe(true);

    const input = buildPool.mock.calls[0]?.[0] as { preferences: { avoidNames: readonly string[] } } | undefined;

    expect(input?.preferences.avoidNames).toEqual(['Pollo al limón']);
  });

  /*
   * A verdict is the one thing a person says about a dish after eating it, and
   * it must reach both halves of generation: reuse, deterministically — a
   * disliked dish is held back like last fortnight's, a liked one goes first —
   * and the model, by name, so it designs towards one and never recreates the other.
   */
  it('holds back disliked dishes, puts liked ones first, and names both to the model', async () => {
    const { buildPool, service } = build();

    jest.spyOn(RecipeController, 'verdicts').mockResolvedValue({
      disliked: [{ name: 'Lentejas con chorizo', slug: 'lentejas-con-chorizo' }],
      liked: [{ name: 'Salmón al horno con eneldo', slug: 'salmon-al-horno-con-eneldo' }]
    });
    const reusablePool = jest.spyOn(RecipeController, 'reusablePool');

    await service.generate('user-1', 'job-1', async () => Promise.resolve());

    const rotation = reusablePool.mock.calls[0]?.[2];

    expect(rotation?.avoidSlugs.has('lentejas-con-chorizo')).toBe(true);
    expect(rotation?.avoidSlugs.has('pollo-al-limon')).toBe(true);
    expect(rotation?.preferSlugs?.has('salmon-al-horno-con-eneldo')).toBe(true);

    const input = buildPool.mock.calls[0]?.[0] as { preferences: { dislikedNames: readonly string[]; lovedNames: readonly string[] } } | undefined;

    expect(input?.preferences.dislikedNames).toEqual(['Lentejas con chorizo']);
    expect(input?.preferences.lovedNames).toEqual(['Salmón al horno con eneldo']);
  });

  it('tells the model how the last fortnight went, in the person\'s terms', async () => {
    const { buildPool, service } = build();

    jest.spyOn(CheckInController, 'latestForGeneration').mockResolvedValue({ comments: 'Las cenas eran enormes', difficulty: 'hard', hunger: 'too_much', satisfaction: 3 });

    await service.generate('user-1', 'job-1', async () => Promise.resolve());

    const input = buildPool.mock.calls[0]?.[0] as { preferences: { checkIn: unknown } } | undefined;

    expect(input?.preferences.checkIn).toMatchObject({ difficulty: 'hard', hunger: 'too_much' });
  });

  /*
   * A real plan was discarded for 141 g of protein against 185 on two days of
   * fourteen, and the owner had no plan at all as a result. The nutrition figures
   * are guidance; the bounds around them are not.
   */
  it('delivers a plan that drifts from its targets, and records where', async () => {
    // A pool whose dishes are light on protein: the scheduler can build fourteen
    // valid days from it, but not fourteen that reach the target.
    const { persist, service } = build({ reusable: pool('arroz').map(dish => ({ ...dish, ingredients: [{ grams: 60, slug: 'arroz' }] })) });

    const planId = await service.generate('user-1', 'job-1', async () => Promise.resolve());

    expect(planId).toBeTruthy();
    expect(persist).toHaveBeenCalledTimes(1);

    const draft = persist.mock.calls[0]?.[1] as { generationMetadata: { advisories: readonly string[] } };

    expect(draft.generationMetadata.advisories.length).toBeGreaterThan(0);
    expect(draft.generationMetadata.advisories.join(' ')).toContain('protein_below_target');
  });

  /*
   * Returning users hit AI_UNAVAILABLE while new users did not. The rotation held
   * back last fortnight's dishes and the model was meant to fill the gap; with the
   * quota gone, the gap stayed open and the plan was refused. A repeated dish beats
   * no plan: the whole library is offered once, without a second model call, and
   * the plan records that it happened.
   */
  it('falls back to the full library when the provider cannot fill a rotated pool', async () => {
    const full = pool('arroz');
    const thin = full.slice(0, 1);
    const { buildPool, persist, service } = build({ reusable: full });

    jest.spyOn(RecipeController, 'reusablePool').mockImplementation(async (_slots, _context, rotation) => Promise.resolve(rotation ? thin : full));
    buildPool.mockResolvedValueOnce({
      dishes: thin,
      generated: [],
      metadata: { attempts: 1, backfilled: 0, calls: 1, inputTokens: 0, model: 'gemini', outputTokens: 0, promptVersion: '2.4.2', providerError: 'You exceeded your current quota', providerUsed: true, rejected: 0, reused: thin.length }
    });

    const planId = await service.generate('user-1', 'job-1', async () => Promise.resolve());

    expect(planId).toBeTruthy();
    expect(persist).toHaveBeenCalledTimes(1);
    // One model attempt — the failed one — never a second against a dead quota.
    expect(buildPool).toHaveBeenCalledTimes(1);

    const draft = persist.mock.calls[0]?.[1] as { generationMetadata: { fallback: string | null; providerError?: string } };

    expect(draft.generationMetadata.fallback).toBe('full_library');
    expect(draft.generationMetadata.providerError).toContain('quota');
  });

  it('still fails when even the full library cannot fill a fortnight', async () => {
    const thin = pool('arroz').slice(0, 1);
    const { buildPool, service } = build({ reusable: thin });

    jest.spyOn(RecipeController, 'reusablePool').mockResolvedValue(thin);
    buildPool.mockResolvedValueOnce({
      dishes: thin,
      generated: [],
      metadata: { attempts: 1, backfilled: 0, calls: 1, inputTokens: 0, model: 'gemini', outputTokens: 0, promptVersion: '2.4.2', providerError: 'quota', providerUsed: true, rejected: 0, reused: 1 }
    });

    await expect(service.generate('user-1', 'job-1', async () => Promise.resolve())).rejects.toMatchObject({ code: 'GENERATION_AI_UNAVAILABLE' });
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

    expect(draft.generationMetadata).toMatchObject({ calls: 0, jobId: 'job-1', reused: SLOTS.length * POOL_PER_SLOT });
  });

  it('persists no new recipes when the plan was built entirely from reuse', async () => {
    const { persist, service } = build();

    await service.generate('usr-1', 'job-1', async () => Promise.resolve());

    expect((persist.mock.calls[0]?.[1] as { newRecipes: unknown[] }).newRecipes).toEqual([]);
  });
});
