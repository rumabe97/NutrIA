import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { NO_PREFERENCE_EXCLUSIONS } from 'core/domain/Preference';
import { OnboardingIncompleteError, ProfileConsentRequiredError } from 'core/entities/Error';
import { CheckInController } from 'core/controllers/CheckIn';
import { EventController } from 'core/controllers/Event';
import { OnboardingController } from 'core/controllers/Onboarding';
import { PlanController, PlanJobController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';
import { SettingsController } from 'core/controllers/Settings';

import { ageInYears, resolveTargets } from 'core/domain/Nutrition';
import { loadedDates, loadedTargets } from 'core/domain/Event';
import { addDays } from 'core/domain/Vacation';
import { toCatalogue } from 'core/entities/Plan';
import { VARIETY_RULES } from 'core/domain/Variety';

import { shapeFor } from 'core/domain/MealShape';

import type { CandidateDish, Catalogue, CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { PreferenceExclusions } from 'core/domain/Preference';
import type { EventView } from 'core/controllers/Event';
import type { NutritionTargets } from 'core/entities/Nutrition';
import type { PlanQuality } from 'core/domain/PlanValidation';
import type { PoolBuilder, PoolResult } from '../../ai/services/PoolBuilder.service.js';
import type * as Scheduler from 'core/domain/Scheduler';

/*
 * The service's `schedulePlan` is a named import of a CommonJS export, fixed at
 * link time, so a spy on the module object would never be seen. Mocked at the
 * module seam instead, wrapping the real scheduler: every case still runs it,
 * and the event cases can read what it was handed.
 */
const scheduler = jest.requireActual<typeof Scheduler>('core/domain/Scheduler');
const schedulePlan = jest.fn<typeof scheduler.schedulePlan>(scheduler.schedulePlan);

jest.unstable_mockModule('core/domain/Scheduler', () => ({ ...scheduler, schedulePlan }));

const { PlanGenerationService, STEPS } = await import('./PlanGeneration.service.js');

const GLUTEN = 'allergen-gluten';
const SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner'];

/** What the library cooks lunch and dinner from, as `RecipeController.libraryUsage` would answer. */
const USAGE = new Map<MealSlot, ReadonlySet<string>>([['lunch', new Set(['ing-arroz'])]]);

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
    mealSlots: [],
    name: slug,
    nameLocale: 'es-ES',
    proteinPer100g: share(TARGETS.proteinG),
    seasonMonths: [],
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
          grams: Math.round(((TARGETS.kcal * (SHARE[slot] ?? 0.3)) / (KCAL_PER_100G / 100)) * (0.8 + (index / Math.max(POOL_PER_SLOT - 1, 1)) * 0.4)),
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
  goal: { id: 'g1', paceKgPerWeek: null, startingWeightKg: 72, targetWeightKg: 70, type: 'maintenance' as const },
  intolerances: [],
  preferences: { activityLevel: 'moderate' as const, mealShape: shapeFor(3, false) },
  profile: { birthDate: '1994-03-11', heightCm: 168, sex: 'female' as const },
  targets: RESOLVED
};

type Mocks = {
  /** The `accompaniments` flag (project 016); off when absent. */
  accompaniments: boolean;
  catalogue: Catalogue;
  events: readonly EventView[];
  onboarding: unknown;
  persist: jest.Mock;
  /** What the context's way of eating and free-from foods rule out, as `buildContext` merges them. */
  preferences: PreferenceExclusions;
  profile: unknown;
  reusable: CandidateDish[];
  safety: Set<string>;
  /** The day the job says the plan starts (project 015); the UTC today when absent. */
  start: string;
};

/** What `persist` is handed, as far as these cases read it. */
type Draft = {
  days: { dayIndex: number; loadedFor: string | null; targets: NutritionTargets }[];
  endDate: string;
  generationMetadata: { advisories: readonly string[]; quality: PlanQuality };
  startDate: string;
  strategy: NutritionTargets;
  today: string;
};

/** An event five days out that eats for two: days 4 and 5 of a plan laid out from today. */
function race(on: string): EventView {
  const shape = { carbs: 'up' as const, daysBefore: 2, fat: 'same' as const, on, protein: 'same' as const };

  return { id: 'event-1', ...shape, loadedDates: loadedDates(shape), loading: false, name: 'Media maratón' };
}

function build(overrides: Partial<Mocks> = {}) {
  const persist = overrides.persist ?? (jest.fn(async () => Promise.resolve('plan-1')) as jest.Mock);
  const reusable = overrides.reusable ?? pool();
  const safety = overrides.safety ?? new Set<string>();

  jest
    .spyOn(OnboardingController, 'getState')
    .mockResolvedValue({
      completedAt: '2026-09-01',
      completedSteps: [],
      currentStep: 9,
      isComplete: true,
      missingSteps: [],
      totalSteps: 10,
      ...(overrides.onboarding as object)
    } as never);
  jest.spyOn(ProfileController, 'getFullProfile').mockResolvedValue({ ...PROFILE, ...(overrides.profile as object) } as never);
  jest
    .spyOn(RecipeController, 'generationContext')
    .mockResolvedValue({
      catalogue: overrides.catalogue ?? CATALOGUE,
      dietaryPatterns: [],
      locale: 'es-ES',
      preferences: overrides.preferences ?? NO_PREFERENCE_EXCLUSIONS,
      safety: {
        allergenIds: safety,
        crossContaminationAllergenIds: new Set(),
        excludedIngredientIds: new Set(),
        intoleranceAllergenIds: new Set(),
        unenforceableLabels: []
      }
    });
  jest
    .spyOn(PlanController, 'generationHistory')
    .mockResolvedValue({ nextVersion: 3, recentDishes: [{ name: 'Pollo al limón', slug: 'pollo-al-limon' }] });
  jest.spyOn(RecipeController, 'reusablePool').mockResolvedValue(reusable);
  jest.spyOn(RecipeController, 'libraryUsage').mockResolvedValue(USAGE);
  jest.spyOn(RecipeController, 'verdicts').mockResolvedValue({ disliked: [], liked: [] });
  // The accompaniments flag, off unless a test turns it on (project 016).
  jest.spyOn(SettingsController, 'accompaniments').mockResolvedValue(overrides.accompaniments ?? false);
  jest.spyOn(CheckInController, 'latestForGeneration').mockResolvedValue(null);
  jest.spyOn(EventController, 'list').mockResolvedValue(overrides.events ?? []);
  jest.spyOn(PlanJobController, 'persist').mockImplementation(persist as never);
  // Nothing under way to cut unless a case says so (project 015).
  jest.spyOn(PlanController, 'cutComposition').mockResolvedValue(null);
  jest
    .spyOn(PlanJobController, 'dates')
    .mockResolvedValue({ start: overrides.start ?? new Date().toISOString().slice(0, 10), today: new Date().toISOString().slice(0, 10) });

  const buildPool = jest.fn<(input: unknown) => Promise<PoolResult>>(async () =>
    Promise.resolve({
      dishes: reusable,
      generated: [],
      metadata: {
        aiCalls: [],
        attempts: 0,
        backfilled: 0,
        calls: 0,
        inputTokens: 0,
        model: 'none',
        outputTokens: 0,
        promptVersion: '1.0.0',
        providerUsed: false,
        rejected: 0,
        reused: reusable.length
      }
    })
  );
  const poolBuilder = { build: buildPool } as unknown as PoolBuilder;

  return { buildPool, persist, service: new PlanGenerationService(poolBuilder) };
}

describe('PlanGenerationService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    schedulePlan.mockClear();
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
   * The fortnight's month decides which produce the prompt marks as in season
   * (`0062` § 6); the library's usage and the job's id decide what a lunch and
   * a dinner are shown (`0063`) — the id so the sample can be rebuilt from it.
   */
  it('tells the pool builder the month the fortnight starts, what the library cooks, and the job to seed its sample with', async () => {
    const { buildPool, service } = build();

    await service.generate('user-1', 'job-1', async () => Promise.resolve());

    const input = buildPool.mock.calls[0]?.[0] as
      { feature: string; libraryUsage: unknown; preferences: { month: number }; session: string } | undefined;

    // Its model calls are a plan's, on every `ai_call` (`0071`).
    expect(input?.feature).toBe('plan');
    expect(input?.preferences.month).toBe(new Date().getUTCMonth() + 1);
    expect(RecipeController.libraryUsage).toHaveBeenCalledWith(SLOTS, expect.anything());
    expect(input?.libraryUsage).toBe(USAGE);
    expect(input?.session).toBe('job-1');
  });

  /*
   * A verdict is the one thing a person says about a dish after eating it, and
   * it must reach both halves of generation: reuse, deterministically — a
   * disliked dish is held back like last fortnight's, a liked one goes first —
   * and the model, by name, so it designs towards one and never recreates the other.
   */
  it('holds back disliked dishes, puts liked ones first, and names both to the model', async () => {
    const { buildPool, service } = build();

    jest
      .spyOn(RecipeController, 'verdicts')
      .mockResolvedValue({
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

  it("tells the model how the last fortnight went, in the person's terms", async () => {
    const { buildPool, service } = build();

    jest
      .spyOn(CheckInController, 'latestForGeneration')
      .mockResolvedValue({ comments: 'Las cenas eran enormes', difficulty: 'hard', hunger: 'too_much', satisfaction: 3 });

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

    const draft = persist.mock.calls[0]?.[1] as Draft;

    expect(draft.generationMetadata.advisories.length).toBeGreaterThan(0);
    expect(draft.generationMetadata.advisories.join(' ')).toContain('protein_below_target');

    // The same drift as counts (`0071`): the plan's length, the days it missed protein on,
    // and nothing of what the person eats — no target, no figure.
    const { quality } = draft.generationMetadata;

    expect(quality.days).toBe(14);
    expect(quality.missesByMacro.protein).toBeGreaterThan(0);
    expect(quality.daysInBand).toBeLessThanOrEqual(14 - quality.missesByMacro.protein);
    expect(quality.advisoriesByKind.protein_below_target).toBe(quality.missesByMacro.protein);
    expect(JSON.stringify(quality)).not.toContain(String(TARGETS.proteinG));
  });

  it('records a plan with nothing to say as fourteen days in band, from its first pool', async () => {
    const { persist, service } = build();

    await service.generate('user-1', 'job-1', async () => Promise.resolve());

    const { quality } = (persist.mock.calls[0]?.[1] as Draft).generationMetadata;

    expect(Object.keys(quality).sort()).toEqual([
      'advisoriesByKind',
      'days',
      'daysFloorNarrowed',
      'daysFloorNarrowedOutOfBand',
      'daysInBand',
      'eventDays',
      'eventDaysInBand',
      'fallback',
      'loadsRefused',
      'missesByMacro'
    ]);
    expect(quality).toMatchObject({ days: 14, eventDays: 0, loadsRefused: 0 });
  });

  /*
   * The rotation hands the scheduler about a dozen library dishes per slot, held
   * short on purpose so the model writes the fresh third (`0013`). On a real
   * plan that was too few to keep the macros: the dishes carrying the
   * carbohydrate were spent in the first week and days ten to fourteen missed
   * fat by up to half. When a plan misses a band, it is scheduled once more from
   * what it had plus the rest of the rotation, and the better plan is kept
   * (`0046`). A pool of pure fat stands in for the thin rotation here; the
   * balanced library is what the uncapped rotation reaches.
   */
  describe('when the rotated pool misses its macros (0046)', () => {
    const skewed = toCatalogue([
      ingredient('arroz'),
      ingredient('pan', [{ allergenId: GLUTEN, presence: 'contains' }]),
      // All of its energy as fat: a day built from it misses every band but energy.
      { ...ingredient('graso'), carbsPer100g: 0, fatPer100g: Math.round((KCAL_PER_100G / 9) * 10) / 10, fiberPer100g: 0, proteinPer100g: 0 }
    ]);
    // Two fifths of each dish's energy as pure fat, the rest in the target's
    // ratio: about twice the fat a day wants, with carbohydrate and protein
    // short. Pure fat would be too much — the scheduler, fitting all four,
    // would shrink the plates to contain it and trip the calorie floor.
    const fatty = pool('arroz').map(dish => {
      const grams = dish.ingredients[0]?.grams ?? 0;

      return {
        ...dish,
        ingredients: [
          { grams: Math.round(grams * 0.6), slug: 'arroz' },
          { grams: Math.round(grams * 0.4), slug: 'graso' }
        ],
        name: `graso ${dish.name}`,
        slug: `graso-${dish.slug}`
      };
    });
    const bands = new Set(['carbs_out_of_band', 'fat_out_of_band', 'kcal_out_of_band', 'protein_below_target']);
    const bandAdvisories = (advisories: readonly string[]) => advisories.filter(line => bands.has(line.split(' ')[0] ?? ''));

    function withSkewedCatalogue(rotated: CandidateDish[], library: CandidateDish[]) {
      const mocks = build({ reusable: rotated });

      jest
        .spyOn(RecipeController, 'generationContext')
        .mockResolvedValue({
          catalogue: skewed,
          dietaryPatterns: [],
          locale: 'es-ES',
          preferences: NO_PREFERENCE_EXCLUSIONS,
          safety: {
            allergenIds: new Set(),
            crossContaminationAllergenIds: new Set(),
            excludedIngredientIds: new Set(),
            intoleranceAllergenIds: new Set(),
            unenforceableLabels: []
          }
        });
      jest
        .spyOn(RecipeController, 'reusablePool')
        .mockImplementation(async (_slots, _context, rotation) => Promise.resolve(rotation ? rotated : library));

      return mocks;
    }

    it('reschedules from the uncapped rotation and keeps the plan that misses by less', async () => {
      const { buildPool, persist, service } = withSkewedCatalogue(fatty, pool('arroz'));

      await service.generate('user-1', 'job-1', async () => Promise.resolve());

      const draft = persist.mock.calls[0]?.[1] as {
        days: readonly { meals: readonly { recipeSlug: string }[] }[];
        generationMetadata: { advisories: readonly string[]; fallback: string | null };
      };

      expect(draft.generationMetadata.fallback).toBe('wider_rotation');
      expect(bandAdvisories(draft.generationMetadata.advisories)).toEqual([]);
      // Built from the balanced dishes the cap had held back, not the fat.
      expect(draft.days.flatMap(day => day.meals.map(meal => meal.recipeSlug)).some(slug => slug.startsWith('graso-'))).toBe(false);
      // The second schedule costs no model call: the library is only read.
      expect(buildPool).toHaveBeenCalledTimes(1);
      expect(schedulePlan).toHaveBeenCalledTimes(2);
    });

    it('keeps the first plan when the wider pool does not do better', async () => {
      // Nothing wider to reach: the uncapped rotation is the same fat.
      const { persist, service } = withSkewedCatalogue(fatty, fatty);

      await service.generate('user-1', 'job-1', async () => Promise.resolve());

      const draft = persist.mock.calls[0]?.[1] as { generationMetadata: { advisories: readonly string[]; fallback: string | null } };

      expect(draft.generationMetadata.fallback).toBeNull();
      // And it still says where it missed, rather than hiding it.
      expect(bandAdvisories(draft.generationMetadata.advisories).length).toBeGreaterThan(0);
    });
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
      metadata: {
        aiCalls: [],
        attempts: 1,
        backfilled: 0,
        calls: 1,
        inputTokens: 0,
        model: 'gemini',
        outputTokens: 0,
        promptVersion: '2.4.2',
        providerError: 'You exceeded your current quota',
        providerUsed: true,
        rejected: 0,
        reused: thin.length
      }
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

  /*
   * The rescue from an empty fortnight read the library with no rotation, so it
   * could serve a dish the person had marked as disliked — the one thing `0014`
   * says never comes back. Last fortnight's dishes may return in a rescue; a
   * refused one may not.
   */
  it('never serves a disliked dish, even in the full-library rescue', async () => {
    const full = pool('arroz');
    const thin = full.slice(0, 1);
    // One dish per slot: the rest still covers a fortnight under the variety rules.
    const refused = full.filter(dish => dish.slug.endsWith('-0'));
    const { buildPool, persist, service } = build({ reusable: full });

    jest.spyOn(RecipeController, 'reusablePool').mockImplementation(async (_slots, _context, rotation) => Promise.resolve(rotation ? thin : full));
    jest.spyOn(RecipeController, 'verdicts').mockResolvedValue({ disliked: refused.map(dish => ({ name: dish.name, slug: dish.slug })), liked: [] });
    buildPool.mockResolvedValueOnce({
      dishes: thin,
      generated: [],
      metadata: {
        aiCalls: [],
        attempts: 1,
        backfilled: 0,
        calls: 1,
        inputTokens: 0,
        model: 'gemini',
        outputTokens: 0,
        promptVersion: '2.4.2',
        providerError: 'You exceeded your current quota',
        providerUsed: true,
        rejected: 0,
        reused: thin.length
      }
    });

    await service.generate('user-1', 'job-1', async () => Promise.resolve());

    const draft = persist.mock.calls[0]?.[1] as {
      days: readonly { meals: readonly { recipeSlug: string }[] }[];
      generationMetadata: { fallback: string | null };
    };
    const served = new Set(draft.days.flatMap(day => day.meals.map(meal => meal.recipeSlug)));

    expect(draft.generationMetadata.fallback).toBe('full_library');
    expect(refused.some(dish => served.has(dish.slug))).toBe(false);
    // Still one model attempt: the rescue reads the library, it does not ask again.
    expect(buildPool).toHaveBeenCalledTimes(1);
  });

  it('answers with the honest error rather than a refused plate when the dislikes leave too little', async () => {
    const full = pool('arroz');
    const thin = full.slice(0, 1);
    // A third of every slot refused: what is left cannot cover fourteen days
    // under the variety rules, so there is no plan to give without them.
    const refused = full.filter((_dish, index) => index % 3 === 0);
    const { buildPool, persist, service } = build({ reusable: full });

    jest.spyOn(RecipeController, 'reusablePool').mockImplementation(async (_slots, _context, rotation) => Promise.resolve(rotation ? thin : full));
    jest.spyOn(RecipeController, 'verdicts').mockResolvedValue({ disliked: refused.map(dish => ({ name: dish.name, slug: dish.slug })), liked: [] });
    buildPool.mockResolvedValueOnce({
      dishes: thin,
      generated: [],
      metadata: {
        aiCalls: [],
        attempts: 1,
        backfilled: 0,
        calls: 1,
        inputTokens: 0,
        model: 'gemini',
        outputTokens: 0,
        promptVersion: '2.4.2',
        providerError: 'You exceeded your current quota',
        providerUsed: true,
        rejected: 0,
        reused: thin.length
      }
    });

    await expect(service.generate('user-1', 'job-1', async () => Promise.resolve())).rejects.toMatchObject({ code: 'GENERATION_AI_UNAVAILABLE' });
    expect(persist).not.toHaveBeenCalled();
    expect(buildPool).toHaveBeenCalledTimes(1);
  });

  it('still fails when even the full library cannot fill a fortnight', async () => {
    const thin = pool('arroz').slice(0, 1);
    const { buildPool, service } = build({ reusable: thin });

    jest.spyOn(RecipeController, 'reusablePool').mockResolvedValue(thin);
    buildPool.mockResolvedValueOnce({
      dishes: thin,
      generated: [],
      metadata: {
        aiCalls: [],
        attempts: 1,
        backfilled: 0,
        calls: 1,
        inputTokens: 0,
        model: 'gemini',
        outputTokens: 0,
        promptVersion: '2.4.2',
        providerError: 'quota',
        providerUsed: true,
        rejected: 0,
        reused: 1
      }
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

  /* Project 015: the job carries the day the person chose; the fortnight is laid out from it. */
  it('lays the fortnight out from the day the job chose, and hands persist the day it was made', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const start = addDays(today, 3);
    const { persist, service } = build({ start });
    const list = jest.spyOn(EventController, 'list');

    await service.generate('usr-1', 'job-1', async () => Promise.resolve());

    const draft = persist.mock.calls[0]?.[1] as Draft;

    expect(draft.startDate).toBe(start);
    expect(draft.endDate).toBe(addDays(start, 13));
    expect(draft.today).toBe(today);
    // Events are read as of that day, so their loaded days land on its dates.
    expect(list).toHaveBeenCalledWith('usr-1', start);
  });

  /* Project 015: a plan that waits for its day may cut the one under way; that one's list keeps only the days it keeps. */
  it('rebuilds the cut plan’s list from the days it keeps, and hands it to persist for that plan', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const start = addDays(today, 2);
    const { persist, service } = build({ start });
    const kept = (dayIndex: number, grams: number) => ({
      id: `kept-${dayIndex}`,
      date: addDays(today, dayIndex - 1),
      dayIndex,
      ingredients: [{ grams, slug: 'arroz' }],
      macros: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 },
      recipeSlug: 'arroz-1',
      servings: 1,
      slot: 'lunch' as const,
      sortOrder: 0
    });
    const cut = jest.spyOn(PlanController, 'cutComposition').mockResolvedValue({ meals: [kept(1, 100), kept(2, 150)], planId: 'plan-a' });

    await service.generate('usr-1', 'job-1', async () => Promise.resolve());

    const draft = persist.mock.calls[0]?.[1] as Draft & { cutShoppingItems?: { items: { totalGrams: number }[]; planId: string } };

    expect(cut).toHaveBeenCalledWith('usr-1', start);
    expect(draft.cutShoppingItems?.planId).toBe('plan-a');
    // Two days of rice, one line: what the days it keeps need, and nothing from the days it lost.
    expect(draft.cutShoppingItems?.items).toHaveLength(1);
    expect(draft.cutShoppingItems?.items[0]?.totalGrams).toBe(250);
  });

  it('leaves the cut plan’s list as it stands when a food it keeps is not in today’s catalogue — never a shorter list', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { persist, service } = build({ start: addDays(today, 2) });

    jest.spyOn(PlanController, 'cutComposition').mockResolvedValue({
      meals: [
        {
          id: 'kept-1',
          date: today,
          dayIndex: 1,
          ingredients: [
            { grams: 100, slug: 'arroz' },
            { grams: 80, slug: 'no-longer-in-the-catalogue' }
          ],
          macros: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 },
          recipeSlug: 'arroz-1',
          servings: 1,
          slot: 'lunch',
          sortOrder: 0
        }
      ],
      planId: 'plan-a'
    });

    await service.generate('usr-1', 'job-1', async () => Promise.resolve());

    expect(persist.mock.calls[0]?.[1]).not.toHaveProperty('cutShoppingItems');
  });

  it('asks for no cut when the plan starts today: the plan under way is completed, as always', async () => {
    const { persist, service } = build();
    const cut = jest.spyOn(PlanController, 'cutComposition');

    await service.generate('usr-1', 'job-1', async () => Promise.resolve());

    expect(cut).not.toHaveBeenCalled();
    expect(persist.mock.calls[0]?.[1]).not.toHaveProperty('cutShoppingItems');
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

  it.each([
    [new ProfileConsentRequiredError(), 'GENERATION_PROFILE_CONSENT_REQUIRED'],
    [new OnboardingIncompleteError(), 'GENERATION_ONBOARDING_INCOMPLETE']
  ])('turns a refusal at the context door into its stable code, and writes nothing', async (error, code) => {
    const { persist, service } = build();

    jest.spyOn(RecipeController, 'generationContext').mockRejectedValue(error);

    await expect(service.generate('usr-1', 'job-1', async () => Promise.resolve())).rejects.toMatchObject({ code });
    expect(persist).not.toHaveBeenCalled();
  });

  it('refuses a profile whose consent was withdrawn while the job waited, and writes nothing', async () => {
    const { persist, service } = build({ onboarding: { isComplete: true, profileConsentRequired: true } });

    await expect(service.generate('usr-1', 'job-1', async () => Promise.resolve())).rejects.toMatchObject({
      code: 'GENERATION_PROFILE_CONSENT_REQUIRED'
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

  /*
   * A day that eats for something (0043). The events are read as of the very
   * date the plan is laid out from, so an event's days become day indices with
   * nothing in between to be a day off; the scheduler is handed exactly those
   * days, with their own targets; and the draft stamps them, by name.
   */
  it('hands the scheduler the days that eat for an event, and stamps them on the draft', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const event = race(addDays(today, 5));
    const { persist, service } = build({ events: [event] });
    const list = jest.spyOn(EventController, 'list');

    await service.generate('user-1', 'job-1', async () => Promise.resolve());

    const draft = persist.mock.calls[0]?.[1] as Draft;

    expect(list).toHaveBeenCalledWith('user-1', draft.startDate);

    const loaded = loadedTargets(TARGETS, event);
    const dayTargets = schedulePlan.mock.calls[0]?.[0].dayTargets;

    expect([...(dayTargets?.keys() ?? [])]).toEqual([4, 5]);
    expect(dayTargets?.get(4)).toEqual(loaded);
    expect(dayTargets?.get(5)).toEqual(loaded);

    expect(draft.days.filter(day => day.loadedFor !== null).map(day => day.dayIndex)).toEqual([4, 5]);
    expect(draft.days[3]).toMatchObject({ loadedFor: 'Media maratón', targets: loaded });
    expect(draft.days[5]).toMatchObject({ loadedFor: null, targets: draft.strategy });

    // Counted, never named: the quality knows two days ate for something, not what.
    expect(draft.generationMetadata.quality).toMatchObject({ days: 14, eventDays: 2, loadsRefused: 0 });
    expect(JSON.stringify(draft.generationMetadata.quality)).not.toContain('maratón');
  });

  /*
   * The bounds are the safety, and there is no other rule (0043, 0008). A load
   * the profile's own bounds refuse is not applied: the day is built to the
   * plan's targets like any other, carries no name, and the plan's record says
   * what was refused and why.
   */
  it('leaves a day ordinary when the bounds refuse its load, and records the refusal', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const event = race(addDays(today, 5));
    const { persist, service } = build({
      events: [event],
      profile: { targets: { ...RESOLVED, bounds: { ...RESOLVED.bounds, ceilingKcal: TARGETS.kcal } } }
    });

    await service.generate('user-1', 'job-1', async () => Promise.resolve());

    expect(schedulePlan.mock.calls[0]?.[0].dayTargets?.size).toBe(0);

    const draft = persist.mock.calls[0]?.[1] as Draft;

    expect(draft.days.every(day => day.loadedFor === null)).toBe(true);
    expect(draft.days.every(day => day.targets.kcal === draft.strategy.kcal)).toBe(true);
    expect(draft.generationMetadata.advisories.join(' ')).toContain('kcal_above_ceiling');
    expect(draft.generationMetadata.quality).toMatchObject({ eventDays: 0, eventDaysInBand: 0, loadsRefused: 2 });
  });

  /*
   * Project 016 phase 4: what goes beside a big lunch or dinner comes from the
   * person's larder, built from the very context generation reads — its merged
   * preferences (free-from foods only for whoever needs them) and its safety.
   */
  describe('accompaniments (016)', () => {
    const bread = (slug: string, gluten: boolean): CatalogueIngredient => ({
      ...ingredient(slug, gluten ? [{ allergenId: GLUTEN, presence: 'contains' }] : []),
      category: 'bakery'
    });
    const WITH_BREAD = toCatalogue([...CATALOGUE.values(), bread('pan-blanco', true), bread('pan-integral', true), bread('pan-sin-gluten', false)]);
    // Two big meals, so lunch and dinner are each well past 700 kcal.
    const TWO_MEALS = {
      preferences: {
        activityLevel: 'moderate' as const,
        mealShape: { ...shapeFor(3, false), breakfast: 'off' as const }
      }
    };
    const twoMealPool = (): CandidateDish[] =>
      pool().filter(dish => dish.slots.includes('lunch') || dish.slots.includes('dinner'));
    type SidedDraft = { days: { meals: { accompaniments?: { accompanimentKey: string; ingredientId: string; kcal: number }[]; kcal: number }[] }[] };
    const sideKeys = (persist: jest.Mock): string[] =>
      (persist.mock.calls[0]?.[1] as SidedDraft).days.flatMap(day => day.meals.flatMap(meal => (meal.accompaniments ?? []).map(row => row.accompanimentKey)));

    it('stores nothing beside the plate while the flag is off', async () => {
      const { persist, service } = build({ catalogue: WITH_BREAD, profile: TWO_MEALS, reusable: twoMealPool() });

      await service.generate('usr-1', 'job-1', async () => Promise.resolve());

      const draft = persist.mock.calls[0]?.[1] as SidedDraft;

      expect(draft.days.flatMap(day => day.meals).some(meal => 'accompaniments' in meal)).toBe(false);
    });

    it('never gives gluten-free bread to somebody who does not need it', async () => {
      // The context's free-from exclusion is all that stands between them and
      // it: the only bread the catalogue holds is the gluten-free one, which a
      // coeliac below is given.
      const freeFrom = new Set(['ing-pan-sin-gluten']);
      const onlyGlutenFree = toCatalogue([...CATALOGUE.values(), bread('pan-sin-gluten', false)]);
      const { persist, service } = build({
        accompaniments: true,
        catalogue: onlyGlutenFree,
        preferences: { ...NO_PREFERENCE_EXCLUSIONS, excludedIngredientIds: freeFrom },
        profile: TWO_MEALS,
        reusable: twoMealPool()
      });

      await service.generate('usr-1', 'job-1', async () => Promise.resolve());

      expect(sideKeys(persist)).not.toContain('pan-sin-gluten');
    });

    it('gives a coeliac gluten-free bread and no other', async () => {
      const { persist, service } = build({
        accompaniments: true,
        catalogue: WITH_BREAD,
        profile: TWO_MEALS,
        reusable: twoMealPool(),
        safety: new Set([GLUTEN])
      });

      await service.generate('usr-1', 'job-1', async () => Promise.resolve());

      const keys = sideKeys(persist);

      expect(keys).toContain('pan-sin-gluten');
      expect(keys.filter(key => key.startsWith('pan-') && key !== 'pan-sin-gluten')).toEqual([]);
    });

    it('stores the sides as rows, the meal\'s kcal the whole meal\'s', async () => {
      const { persist, service } = build({ accompaniments: true, catalogue: WITH_BREAD, profile: TWO_MEALS, reusable: twoMealPool() });

      await service.generate('usr-1', 'job-1', async () => Promise.resolve());

      const scheduled = schedulePlan.mock.results.at(-1)?.value as ReturnType<typeof scheduler.schedulePlan>;
      const draft = persist.mock.calls[0]?.[1] as SidedDraft;
      const meals = scheduled.ok ? scheduled.assignment.days.flatMap(day => day.meals) : [];
      const stored = draft.days.flatMap(day => day.meals);

      expect(stored).toHaveLength(meals.length);

      for (const [index, meal] of meals.entries()) {
        const rows = stored[index]?.accompaniments ?? [];

        expect(stored[index]?.kcal).toBe(meal.macros.kcal);
        expect(rows.map(row => row.ingredientId)).toEqual((meal.accompaniments ?? []).flatMap(side => side.ingredients.map(item => `ing-${item.slug}`)));
      }
    });

    it('blocks a meal whose side the final gate refuses, and writes nothing', async () => {
      // As if the larder had been bypassed: the scheduler hands back a coeliac's
      // lunch with wheat bread beside it. The gate reads the meal, sides included.
      schedulePlan.mockImplementationOnce(input => {
        const result = scheduler.schedulePlan(input);

        if (!result.ok) {
          return result;
        }

        const [first, ...rest] = result.assignment.days;
        const [meal, ...others] = first?.meals ?? [];

        if (!first || !meal) {
          return result;
        }

        const side = { ingredients: [{ grams: 60, slug: 'pan-blanco' }], key: 'pan-blanco', macros: meal.macros };
        const sided = { ...meal, accompaniments: [side], ingredients: [...meal.ingredients, ...side.ingredients] };

        return { ...result, assignment: { days: [{ ...first, meals: [sided, ...others] }, ...rest] } };
      });

      const { persist, service } = build({
        accompaniments: true,
        catalogue: WITH_BREAD,
        profile: TWO_MEALS,
        reusable: twoMealPool(),
        safety: new Set([GLUTEN])
      });

      await expect(service.generate('usr-1', 'job-1', async () => Promise.resolve())).rejects.toMatchObject({ code: 'GENERATION_UNSAFE_CONTENT' });
      expect(persist).not.toHaveBeenCalled();
    });
  });
});
