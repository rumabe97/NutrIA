import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { DEFAULT_KITCHEN } from 'core/entities/Kitchen';
import { FixedMealController } from 'core/controllers/FixedMeal';
import { NO_PREFERENCE_EXCLUSIONS } from 'core/domain/Preference';
import { outOfSeasonFruit } from 'core/domain/MealFit';
import { PlanController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';
import { SettingsController } from 'core/controllers/Settings';
import { toCatalogue } from 'core/entities/Plan';

import { FixedMealsService } from './FixedMeals.service.js';

import type { Appliance, Kitchen } from 'core/entities/Kitchen';
import type { CandidateDish, CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { FixedMeal, Weekday } from 'core/entities/FixedMeal';
import type { PoolBuilder } from '../../ai/services/PoolBuilder.service.js';

/*
 * What `honourability` says about a standing rule the next plan can no longer
 * honour (021 phase 5b). One mechanism answers every cause — `whyNotFixable` —
 * so what each case here fixes is the *reason*, not whether something is said.
 */

const USER = 'usr-1';

function ingredient(slug: string, overrides: Partial<CatalogueIngredient> = {}): CatalogueIngredient {
  return {
    id: `i-${slug}`,
    allergens: [],
    carbsPer100g: 10,
    category: 'pantry',
    classes: [],
    defaultUnit: 'g',
    fatPer100g: 2,
    fiberPer100g: 1,
    gramsPerUnit: null,
    kcalPer100g: 130,
    mealSlots: [],
    name: slug,
    nameLocale: 'es-ES',
    proteinPer100g: 8,
    seasonMonths: [],
    slug,
    ...overrides
  };
}

const CATALOGUE: readonly CatalogueIngredient[] = [
  ingredient('rice'),
  ingredient('lentils', { kcalPer100g: 116, proteinPer100g: 9 }),
  // A summer fruit, by a slug `FRESH_FRUIT_SLUGS` really knows — the season is
  // the one filter that reads a list of slugs rather than a category.
  ingredient('nectarina', { category: 'produce', kcalPer100g: 44, proteinPer100g: 1, seasonMonths: [6, 7, 8] })
];

const SAFETY = {
  allergenIds: new Set<string>(),
  crossContaminationAllergenIds: new Set<string>(),
  excludedIngredientIds: new Set<string>(),
  intoleranceAllergenIds: new Set<string>(),
  unenforceableLabels: []
};

function dish(slug: string, overrides: Partial<CandidateDish> = {}): CandidateDish {
  return {
    cookMinutes: 10,
    cuisine: null,
    difficulty: 'easy',
    equipment: [],
    ingredients: [
      { grams: 150, slug: 'lentils' },
      { grams: 120, slug: 'rice' }
    ],
    name: slug,
    prepMinutes: 5,
    servings: 1,
    slots: ['lunch'],
    slug,
    steps: [{ text: 'Cocer 10 minutos' }, { text: 'Servir' }],
    ...overrides
  };
}

const FIXED = dish('lentil-stew');

function rule(overrides: Partial<FixedMeal> = {}): FixedMeal {
  return { id: 'rule-1', dishName: 'Lentil stew', dishSlug: FIXED.slug, slot: 'lunch' as MealSlot, weekday: 0 as Weekday, ...overrides } as FixedMeal;
}

function harness(
  options: {
    readonly kitchen?: Kitchen | null;
    readonly library?: readonly CandidateDish[];
    readonly maxMinutes?: number | null;
    readonly pool?: readonly CandidateDish[];
    readonly rules?: readonly FixedMeal[];
    /** `null` is a profile whose targets the equations reject — nothing can be judged. */
    readonly targets?: null;
  } = {}
): FixedMealsService {
  const library = options.library ?? [FIXED];

  jest.spyOn(FixedMealController, 'forPlan').mockResolvedValue(options.rules ?? [rule()]);
  jest
    .spyOn(RecipeController, 'generationContext')
    .mockResolvedValue({
      catalogue: toCatalogue(CATALOGUE),
      dietaryPatterns: [],
      locale: 'es-ES',
      preferences: {
        ...NO_PREFERENCE_EXCLUSIONS,
        kitchen: options.kitchen === undefined ? DEFAULT_KITCHEN : options.kitchen,
        maxMinutesPerDish: options.maxMinutes ?? null
      },
      safety: SAFETY
    } as never);
  jest.spyOn(RecipeController, 'verdicts').mockResolvedValue({ disliked: [], liked: [] });
  jest.spyOn(RecipeController, 'libraryAndPool').mockResolvedValue({ library, pool: options.pool ?? library });
  jest.spyOn(SettingsController, 'accompaniments').mockResolvedValue(false);
  // A January fortnight: the season is a January one for every case below.
  jest.spyOn(PlanController, 'allowances').mockResolvedValue({ defaultStart: '2027-01-04' } as never);
  jest
    .spyOn(ProfileController, 'getFullProfile')
    .mockResolvedValue({
      cuisines: [],
      dietaryPatterns: [],
      foodPreferences: [],
      goal: { type: 'maintenance' },
      preferences: null,
      profile: { sex: 'female' },
      targets: options.targets === null ? null : { effective: { carbsG: 230, fatG: 65, fiberG: 30, kcal: 2000, proteinG: 110 } }
    } as never);

  return new FixedMealsService({ build: jest.fn() } as unknown as PoolBuilder);
}

/** A kitchen missing one appliance, everything else as a silent person's. */
function without(appliance: Appliance): Kitchen {
  return { ...DEFAULT_KITCHEN, [appliance]: 'missing' };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('FixedMealsService.honourability', () => {
  it('says nothing about a rule the next plan can still honour', async () => {
    await expect(harness().honourability(USER)).resolves.toEqual({ judged: true, unhonoured: [] });
  });

  it('names the cooking time when it was lowered under the dish', async () => {
    // Fifteen minutes of dish against a limit of five, which `timeAllowance`
    // rounds to ten — a limit of ten would still admit it.
    await expect(harness({ maxMinutes: 5 }).honourability(USER)).resolves.toEqual({
      judged: true,
      unhonoured: [{ id: 'rule-1', actionable: true, why: 'too_slow' }]
    });
  });

  it('names the appliance when the kitchen no longer has it', async () => {
    const service = harness({ kitchen: without('oven'), library: [dish(FIXED.slug, { equipment: ['oven'] })] });

    await expect(service.honourability(USER)).resolves.toEqual({
      judged: true,
      unhonoured: [{ id: 'rule-1', actionable: true, why: 'missing_equipment' }]
    });
  });

  it('says the dish is unknown when the library no longer holds it at all', async () => {
    // A dish dropped from the catalogue, and an account that changed language:
    // the library is read in the person's own locale, so both arrive here as an
    // absence.
    await expect(harness({ library: [] }).honourability(USER)).resolves.toEqual({
      judged: true,
      unhonoured: [{ id: 'rule-1', actionable: false, why: 'unknown_dish' }]
    });
  });

  it('says the meal is not theirs when they stopped eating it', async () => {
    const service = harness({ rules: [rule({ slot: 'supper' as MealSlot })] });

    await expect(service.honourability(USER)).resolves.toEqual({
      judged: true,
      unhonoured: [{ id: 'rule-1', actionable: false, why: 'wrong_slot' }]
    });
  });

  it('still honours a rule whose dish is out of season, because a pin outranks the season', async () => {
    // `honouredPin` is consulted before the day search's season filter
    // (`Scheduler`), and neither `servable` nor `pinnable` filters by month, so
    // a summer dish fixed to a January Monday is still served. The silence the
    // phase was written for is real for the other causes, not for this one.
    const summer = dish(FIXED.slug, {
      ingredients: [
        { grams: 150, slug: 'lentils' },
        { grams: 80, slug: 'nectarina' }
      ]
    });

    // Asserted rather than assumed: the fixture really is out of season in
    // January, so this case cannot stop proving anything in silence.
    expect(outOfSeasonFruit(summer, toCatalogue(CATALOGUE), 1)).toBe('nectarina');
    await expect(harness({ library: [summer] }).honourability(USER)).resolves.toEqual({ judged: true, unhonoured: [] });
  });

  it('names the other rule when a day cannot reach its macros with both', async () => {
    // Two rules on one Monday, and a library with nothing for the three meals
    // they leave free: `dayHoldsPin` — `pinnable`'s own last filter, asked of
    // one dish rather than of the pool — refuses both, and the sentence is the
    // other rule rather than the plate.
    const dinner = dish('rice-bowl', { slots: ['dinner'] });
    const service = harness({ library: [FIXED, dinner], rules: [rule(), rule({ id: 'rule-2', dishSlug: dinner.slug, slot: 'dinner' as MealSlot })] });

    await expect(service.honourability(USER)).resolves.toEqual({
      judged: true,
      unhonoured: [
        { id: 'rule-1', actionable: true, why: 'clashes_with_fixed' },
        { id: 'rule-2', actionable: true, why: 'clashes_with_fixed' }
      ]
    });
  });

  it('leads with the rules the person can do something about', async () => {
    const service = harness({
      kitchen: without('oven'),
      library: [dish('gone-dish'), dish('oven-dish', { equipment: ['oven'] })],
      rules: [rule({ id: 'rule-gone', dishSlug: 'missing-dish' }), rule({ id: 'rule-oven', dishSlug: 'oven-dish', weekday: 2 as Weekday })]
    });

    await expect(service.honourability(USER)).resolves.toEqual({
      judged: true,
      unhonoured: [
        { id: 'rule-oven', actionable: true, why: 'missing_equipment' },
        { id: 'rule-gone', actionable: false, why: 'unknown_dish' }
      ]
    });
  });

  it('answers that it could not judge rather than that every rule is fine', async () => {
    // A profile whose targets the equations reject, or a consent withdrawn
    // between the two requests: the rules screen must not become an error page.
    await expect(harness({ targets: null }).honourability(USER)).resolves.toEqual({ judged: false, unhonoured: [] });
  });
});
