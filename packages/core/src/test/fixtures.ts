import type { Goal, Preferences, Profile } from 'core/entities/Profile';
import type { SafetyProfile } from 'core/entities/Safety';
import type { User } from 'core/entities/User';
import { toCatalogue } from 'core/entities/Plan';
import { VARIETY_RULES } from 'core/domain/Variety';
import { DEFAULT_MEAL_SHAPE } from 'core/domain/MealShape';

import type { CandidateDish, Catalogue, CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { CheckedIngredient } from 'core/domain/Safety';
import type { NutritionTargets } from 'core/entities/Nutrition';

// Test fixtures (object-mother / test-data-builder pattern).
//
// Each `makeX` returns a complete, valid entity with sensible defaults. Pass
// `overrides` to set only the fields that matter to the test — the rest stay
// stable, so `makeAllergy({ severity: 'anaphylaxis' })` signals what the test is
// actually about.
//
// When adding an entity to packages/core/src/entities/, add a factory here.

const USER_ID = 'usr_2f8a1c4e9b3d';
const ALLERGEN_GLUTEN = 'aaaaaaaa-0000-4000-8000-000000000001';
const ALLERGEN_MILK = 'aaaaaaaa-0000-4000-8000-000000000002';
const ALLERGEN_PEANUTS = 'aaaaaaaa-0000-4000-8000-000000000003';

export const ALLERGEN_IDS = { gluten: ALLERGEN_GLUTEN, milk: ALLERGEN_MILK, peanuts: ALLERGEN_PEANUTS } as const;

export function makeUser(overrides?: Partial<User>): User {
  return {
    id: USER_ID,
    activatedAt: new Date('2026-01-15T10:00:00.000Z'),
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    email: 'ada@example.com',
    emailVerified: true,
    image: null,
    name: 'Ada Lovelace',
    role: 'user',
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    ...overrides
  };
}

export function makeProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: 'b7e9c8d1-9f3a-4b2c-8e5d-1a2b3c4d5e6f',
    birthDate: '1994-03-11',
    country: 'ES',
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    displayName: 'Ada',
    heightCm: 168,
    locale: 'es-ES',
    sex: 'female',
    timezone: 'Europe/Madrid',
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    userId: USER_ID,
    ...overrides
  };
}

export function makeGoal(overrides?: Partial<Goal>): Goal {
  return {
    id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    customGoal: null,
    paceKgPerWeek: -0.5,
    startingWeightKg: 72,
    targetWeightKg: 66,
    type: 'weight_loss',
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    userId: USER_ID,
    ...overrides
  };
}

export function makePreferences(overrides?: Partial<Preferences>): Preferences {
  return {
    id: 'd4e5f6a7-8b9c-4d0e-9f1a-2b3c4d5e6f70',
    activityLevel: 'moderate',
    breakfastStyle: null,
    budget: 'medium',
    cookingFrequency: 'often',
    cookingTimeMinutes: 30,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    mealShape: DEFAULT_MEAL_SHAPE,
    portionPreference: null,
    sleepEnd: null,
    sleepStart: null,
    trainingDaysPerWeek: 3,
    trainingTime: null,
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    userId: USER_ID,
    workScheduleNotes: null,
    ...overrides
  };
}

/** A user allergic to gluten, without trace sensitivity, and intolerant to milk. */
export function makeSafetyProfile(overrides?: Partial<SafetyProfile>): SafetyProfile {
  return {
    allergenIds: new Set([ALLERGEN_GLUTEN]),
    crossContaminationAllergenIds: new Set<string>(),
    excludedIngredientIds: new Set<string>(),
    intoleranceAllergenIds: new Set([ALLERGEN_MILK]),
    unenforceableLabels: [],
    ...overrides
  };
}

export function makeIngredient(overrides?: Partial<CheckedIngredient>): CheckedIngredient {
  return { id: 'ing-0001', allergens: [], name: 'Tomate', ...overrides };
}

// ── Plan generation fixtures (project 002) ────────────────────────────────

/**
 * A tiny catalogue with round numbers, so an expected macro total can be worked
 * out by hand in a test's head rather than copied from a previous run.
 */
export function makeCatalogueIngredient(overrides?: Partial<CatalogueIngredient>): CatalogueIngredient {
  return {
    id: 'ing-0001',
    allergens: [],
    // Macros deliberately in the same ratio as TARGETS below, so a day that lands
    // in the calorie band lands in the protein band too. A fixture whose ratio
    // fights the target makes every happy-path test fail for a reason that has
    // nothing to do with what it is testing.
    carbsPer100g: 20,
    category: 'pantry',
    classes: [],
    defaultUnit: 'g',
    fatPer100g: 6,
    fiberPer100g: 2,
    gramsPerUnit: null,
    kcalPer100g: 200,
    name: 'Base',
    nameLocale: 'es-ES',
    proteinPer100g: 12,
    slug: 'base',
    ...overrides
  };
}

export function makeCatalogue(ingredients: readonly CatalogueIngredient[] = [makeCatalogueIngredient()]): Catalogue {
  return toCatalogue(ingredients);
}

export function makeDish(overrides?: Partial<CandidateDish>): CandidateDish {
  return {
    cookMinutes: 10,
    cuisine: 'mediterranea',
    difficulty: 'easy',
    ingredients: [{ grams: 100, slug: 'base' }],
    name: 'Plato base',
    prepMinutes: 5,
    servings: 1,
    slots: ['lunch'],
    slug: 'plato-base',
    steps: [{ text: 'Mezclar' }],
    ...overrides
  };
}

/**
 * A pool wide enough for the variety rules, with each slot's dishes sized around
 * the energy that slot actually carries. That is what a real pool looks like —
 * a flat ramp of identical dishes across every slot is not, and it makes the
 * scheduler look broken when it is the fixture that is unrealistic.
 */
/** Fourteen days, matching the scheduler's own default. */
const PLAN_DAYS = 14;

/**
 * Enough dishes per slot to satisfy the variety rules, plus two for the ranker
 * to discriminate on.
 *
 * Derived rather than a literal, because a fixture that hardcodes the old floor
 * turns a deliberate tightening of `VARIETY_RULES` into two dozen red tests that
 * say nothing about the change.
 */
export const POOL_PER_SLOT = Math.ceil(PLAN_DAYS / VARIETY_RULES.maxOccurrencesPerPlan) + 2;

export function makePool(slots: readonly MealSlot[], perSlot = POOL_PER_SLOT): readonly CandidateDish[] {
  const SHARE: Record<MealSlot, number> = {
    afternoon_snack: 0.1,
    breakfast: 0.28,
    dinner: 0.34,
    lunch: 0.37,
    morning_snack: 0.09,
    supper: 0.11
  };

  return slots.flatMap(slot => {
    // The base ingredient is 200 kcal per 100 g, so grams = kcal / 2.
    const centre = (TARGETS.kcal * SHARE[slot]) / 2;

    return Array.from({ length: perSlot }, (_unused, index) =>
      makeDish({
            // Spread across the same 0.8–1.2 range whatever the pool size, so growing
        // the pool adds density rather than pushing the extremes further out.
        ingredients: [{ grams: Math.round(centre * (0.8 + (index / Math.max(perSlot - 1, 1)) * 0.4)), slug: 'base' }],
        name: `${slot} ${index}`,
        slots: [slot],
        slug: `${slot}-${index}`
      })
    );
  });
}

export const TARGETS: NutritionTargets = { carbsG: 200, fatG: 60, fiberG: 25, kcal: 2000, proteinG: 120 };
