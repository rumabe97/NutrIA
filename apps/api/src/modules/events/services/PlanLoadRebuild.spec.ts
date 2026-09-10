import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { NO_PREFERENCE_EXCLUSIONS } from 'core/domain/Preference';
import { PlanController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';
import { ageInYears, resolveTargets } from 'core/domain/Nutrition';
import { loadedDates, loadedTargets } from 'core/domain/Event';
import { addDays } from 'core/domain/Vacation';
import { shapeFor } from 'core/domain/MealShape';
import { toCatalogue } from 'core/entities/Plan';
import { VARIETY_RULES, varietyViolations } from 'core/domain/Variety';

import { PlanLoadRebuildService } from './PlanLoadRebuild.service.js';

import type { CandidateDish, CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { EventView } from 'core/controllers/Event';
import type { MealCompositionView } from 'core/controllers/Plan';

const GLUTEN = 'allergen-gluten';
const SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner'];
const START = '2026-09-08';
const TODAY = '2026-09-10';
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

const CATALOGUE = toCatalogue([ingredient('arroz', [{ allergenId: GLUTEN, presence: 'contains' }])]);
const POOL_PER_SLOT = Math.ceil(14 / VARIETY_RULES.maxOccurrencesPerPlan) + 2;

/** The library: enough per slot for the variety rules, sized near each slot's share. */
const LIBRARY: readonly CandidateDish[] = SLOTS.flatMap(slot => {
  const SHARE: Record<string, number> = { breakfast: 0.28, dinner: 0.34, lunch: 0.37 };

  return Array.from({ length: POOL_PER_SLOT }, (_unused, index) => ({
    cookMinutes: 10,
    cuisine: null,
    difficulty: 'easy' as const,
    ingredients: [
      {
        grams: Math.round(((TARGETS.kcal * (SHARE[slot] ?? 0.3)) / (KCAL_PER_100G / 100)) * (0.8 + (index / Math.max(POOL_PER_SLOT - 1, 1)) * 0.4)),
        slug: 'arroz'
      }
    ],
    name: `${slot} ${index}`,
    prepMinutes: 5,
    servings: 1,
    slots: [slot],
    slug: `${slot}-${index}`,
    steps: [{ text: 'Mezclar' }]
  }));
});

/** The fortnight as lived: every day eats the library in rotation, so it is varied and every dish resolves. */
const COMPOSITION: readonly MealCompositionView[] = Array.from({ length: 14 }, (_unused, offset) => offset + 1).flatMap(dayIndex =>
  SLOTS.map((slot, sortOrder) => {
    const dish = LIBRARY.find(candidate => candidate.slug === `${slot}-${(dayIndex - 1) % POOL_PER_SLOT}`) as CandidateDish;

    return {
      id: `meal-${dayIndex}-${slot}`,
      dayIndex,
      ingredients: dish.ingredients,
      macros: { carbsG: 60, fatG: 20, fiberG: 8, kcal: 660, proteinG: 40 },
      recipeSlug: dish.slug,
      servings: 1,
      slot,
      sortOrder
    };
  })
);

const PLAN = {
  id: 'plan-1',
  days: Array.from({ length: 14 }, (_unused, offset) => ({
    date: addDays(START, offset),
    dayIndex: offset + 1,
    loadedFor: null,
    meals: [],
    targets: TARGETS,
    totals: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 }
  })),
  endDate: addDays(START, 13),
  startDate: START,
  status: 'active',
  strategy: TARGETS,
  version: 2
};

const PROFILE = {
  allergies: [],
  cuisines: [],
  dietaryPatterns: [],
  foodPreferences: [],
  goal: { id: 'g1', customGoal: null, paceKgPerWeek: null, startingWeightKg: 72, targetWeightKg: 70, type: 'maintenance' as const },
  intolerances: [],
  preferences: { activityLevel: 'moderate' as const, mealShape: shapeFor(3, false) },
  profile: { birthDate: '1994-03-11', heightCm: 168, sex: 'female' as const },
  targets: RESOLVED
};

/** A race the day after tomorrow, eating for today and tomorrow. */
function race(on = '2026-09-12', daysBefore = 2): EventView {
  const shape = { carbs: 'up' as const, daysBefore, fat: 'same' as const, on, protein: 'same' as const };

  return { id: 'event-1', ...shape, loadedDates: loadedDates(shape), loading: false, name: 'Media maratón' };
}

type Written = Parameters<typeof PlanController.rebuildLoadedDays>;

function build(overrides: { allowed?: boolean; safety?: Set<string> } = {}) {
  const rebuild = jest.spyOn(PlanController, 'rebuildLoadedDays').mockResolvedValue(undefined);
  const reusable = jest.spyOn(RecipeController, 'reusablePool').mockResolvedValue(LIBRARY);

  const premium = overrides.allowed !== false;

  jest
    .spyOn(PlanController, 'allowances')
    .mockResolvedValue({
      events: { limit: premium ? 10 : 3, midPlan: premium ? { limit: 3, remaining: 3 } : null, remaining: premium ? 9 : 2 },
      mealSwaps: { allowed: true, limit: premium ? 20 : 5, remaining: premium ? 20 : 5, used: 0 },
      planRedo: { allowed: true, kind: 'redo', limit: premium ? 3 : 1, nextAt: null, used: 0 },
      tier: premium ? 'premium' : 'free'
    });
  jest.spyOn(PlanController, 'getActivePlan').mockResolvedValue(PLAN as never);
  jest.spyOn(PlanController, 'composition').mockResolvedValue(COMPOSITION);
  jest.spyOn(ProfileController, 'getFullProfile').mockResolvedValue(PROFILE as never);
  jest
    .spyOn(RecipeController, 'generationContext')
    .mockResolvedValue({
      catalogue: CATALOGUE,
      locale: 'es-ES',
      preferences: NO_PREFERENCE_EXCLUSIONS,
      safety: {
        allergenIds: overrides.safety ?? new Set(),
        crossContaminationAllergenIds: new Set(),
        excludedIngredientIds: new Set(),
        intoleranceAllergenIds: new Set(),
        unenforceableLabels: []
      }
    });
  jest.spyOn(RecipeController, 'verdicts').mockResolvedValue({ disliked: [], liked: [] });

  return { rebuild, reusable, service: new PlanLoadRebuildService() };
}

describe('PlanLoadRebuildService — a fortnight rebuilt for an event (0044)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rebuilds only the loaded days strictly after today, and says which', async () => {
    const { rebuild, service } = build();
    const event = race();

    // The load is today and tomorrow. Today may already be eaten; only tomorrow is remade.
    await expect(service.forEvent('usr-1', event, TODAY)).resolves.toEqual(['2026-09-11']);

    const [, planId, days] = rebuild.mock.calls[0] as Written;

    expect(planId).toBe('plan-1');
    expect(days.map(day => day.dayIndex)).toEqual([4]);
    expect(days[0]).toMatchObject({ loadedFor: 'Media maratón', targets: loadedTargets(TARGETS, event) });
    expect(days[0]?.meals.map(meal => meal.slot)).toEqual(SLOTS);
  });

  it('leaves a free account’s plan alone: the event waits for the next generation', async () => {
    const { rebuild, reusable, service } = build({ allowed: false });

    await expect(service.forEvent('usr-1', race(), TODAY)).resolves.toEqual([]);
    expect(reusable).not.toHaveBeenCalled();
    expect(rebuild).not.toHaveBeenCalled();
  });

  it('does nothing when every loaded day is today or earlier', async () => {
    const { rebuild, service } = build();

    await expect(service.forEvent('usr-1', race('2026-09-11', 1), TODAY)).resolves.toEqual([]);
    expect(rebuild).not.toHaveBeenCalled();
  });

  /*
   * The whole point of the feature's economics. Three proofs, from structure to
   * behaviour: the service has nothing injected, so there is no builder to ask;
   * its source names nothing from the AI module; and every dish it writes came
   * from the one library call, made without a rotation — the whole shelf.
   */
  it('never asks the model: the library is the only pool', async () => {
    expect(PlanLoadRebuildService.length).toBe(0);

    const source = readFileSync(fileURLToPath(new URL('./PlanLoadRebuild.service.ts', import.meta.url)), 'utf8');

    expect(source).not.toMatch(/PoolBuilder|\/ai\//);

    const { rebuild, reusable, service } = build();

    await service.forEvent('usr-1', race(), TODAY);

    expect(reusable).toHaveBeenCalledTimes(1);
    expect(reusable.mock.calls[0]).toHaveLength(2);

    const [, , days] = rebuild.mock.calls[0] as Written;
    const shelf = new Set(LIBRARY.map(dish => dish.slug));

    expect(days.flatMap(day => day.meals.map(meal => meal.recipeSlug)).every(slug => shelf.has(slug))).toBe(true);
  });

  it('holds the variety rules against the days it keeps', async () => {
    const { rebuild, service } = build();

    await service.forEvent('usr-1', race(), TODAY);

    const [, , days] = rebuild.mock.calls[0] as Written;
    const kept = COMPOSITION.filter(meal => meal.dayIndex !== 4);
    const merged = [...new Map(kept.map(meal => [meal.dayIndex, kept.filter(other => other.dayIndex === meal.dayIndex)])).entries()]
      .map(([dayIndex, meals]) => ({ dayIndex, meals: meals.map(meal => ({ dish: { slug: meal.recipeSlug }, slot: meal.slot })) }))
      .concat(days.map(day => ({ dayIndex: day.dayIndex, meals: day.meals.map(meal => ({ dish: { slug: meal.recipeSlug }, slot: meal.slot })) })))
      .sort((a, b) => a.dayIndex - b.dayIndex);

    expect(varietyViolations(merged as never)).toEqual([]);
  });

  it('refuses to write a day the allergy gate rejects, even from the library', async () => {
    // The library came back with a gluten dish for somebody allergic to gluten:
    // exactly the upstream slip the second gate exists for.
    const { rebuild, service } = build({ safety: new Set([GLUTEN]) });

    await expect(service.forEvent('usr-1', race(), TODAY)).resolves.toEqual([]);
    expect(rebuild).not.toHaveBeenCalled();
  });

  it('rebuilds the shopping list from the whole plan, not from the rebuilt days alone', async () => {
    const { rebuild, service } = build();

    await service.forEvent('usr-1', race(), TODAY);

    const [, , , items] = rebuild.mock.calls[0] as Written;
    const keptGrams = COMPOSITION.filter(meal => meal.dayIndex !== 4).reduce((sum, meal) => sum + meal.ingredients[0]!.grams, 0);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ ingredientId: 'ing-arroz' });
    expect(items[0]!.totalGrams).toBeGreaterThan(keptGrams);
  });
});
