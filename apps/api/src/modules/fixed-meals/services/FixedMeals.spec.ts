import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { DEFAULT_KITCHEN } from 'core/entities/Kitchen';
import { DishRequestController } from 'core/controllers/DishRequest';
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
  ingredient('nectarina', { category: 'produce', kcalPer100g: 44, proteinPer100g: 1, seasonMonths: [6, 7, 8] }),
  // Carries milk, for the one reason that is never anybody's to overrule (`0004`).
  ingredient('queso', { allergens: [{ allergenId: 'milk', presence: 'contains' }], fatPer100g: 25, proteinPer100g: 25 })
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
    /** Allergen ids this person reacts to, matched against the catalogue's own. */
    readonly allergenIds?: readonly string[];
    readonly disliked?: readonly string[];
    /** Their way of eating ruling the dish out, which `RecipeController.excludes` answers. */
    readonly excluded?: boolean;
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

  jest.spyOn(RecipeController, 'excludes').mockReturnValue(options.excluded ?? false);

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
      safety: { ...SAFETY, allergenIds: new Set(options.allergenIds ?? []) }
    } as never);
  jest.spyOn(RecipeController, 'verdicts').mockResolvedValue({ disliked: (options.disliked ?? []).map(slug => ({ slug })), liked: [] } as never);
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
    await expect(harness().honourability(USER)).resolves.toEqual({ judged: true, outOfBand: [], unhonoured: [] });
  });

  it('names the cooking time when it was lowered under the dish', async () => {
    // Fifteen minutes of dish against a limit of five, which `timeAllowance`
    // rounds to ten — a limit of ten would still admit it.
    await expect(harness({ maxMinutes: 5 }).honourability(USER)).resolves.toEqual({
      judged: true,
      outOfBand: [],
      unhonoured: [{ id: 'rule-1', actionable: true, why: 'too_slow' }]
    });
  });

  it('names the appliance when the kitchen no longer has it', async () => {
    const service = harness({ kitchen: without('oven'), library: [dish(FIXED.slug, { equipment: ['oven'] })] });

    await expect(service.honourability(USER)).resolves.toEqual({
      judged: true,
      outOfBand: [],
      unhonoured: [{ id: 'rule-1', actionable: true, why: 'missing_equipment' }]
    });
  });

  it('says the dish is unknown when the library no longer holds it at all', async () => {
    // A dish dropped from the catalogue, and an account that changed language:
    // the library is read in the person's own locale, so both arrive here as an
    // absence.
    await expect(harness({ library: [] }).honourability(USER)).resolves.toEqual({
      judged: true,
      outOfBand: [],
      unhonoured: [{ id: 'rule-1', actionable: false, why: 'unknown_dish' }]
    });
  });

  it('says the meal is not theirs when they stopped eating it', async () => {
    const service = harness({ rules: [rule({ slot: 'supper' as MealSlot })] });

    await expect(service.honourability(USER)).resolves.toEqual({
      judged: true,
      outOfBand: [],
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
    await expect(harness({ library: [summer] }).honourability(USER)).resolves.toEqual({ judged: true, outOfBand: [], unhonoured: [] });
  });

  it('calls a day that cannot reach its macros out of band, and no rule unhonoured', async () => {
    // Two rules on one Monday, and a library with nothing for the three meals
    // they leave free. Both are **served** — the day's bands are not one of
    // `honouredPin`'s three bounds — so neither rule is unhonoured, and what is
    // said is about the day (`0103`). Both of its rules are named, including the
    // one nobody made a trade about, because both are on the plate and both
    // contribute to the miss.
    const dinner = dish('rice-bowl', { slots: ['dinner'] });
    const service = harness({ library: [FIXED, dinner], rules: [rule(), rule({ id: 'rule-2', dishSlug: dinner.slug, slot: 'dinner' as MealSlot })] });

    await expect(service.honourability(USER)).resolves.toEqual({
      judged: true,
      outOfBand: [
        { id: 'rule-1', weekday: 0 },
        { id: 'rule-2', weekday: 0 }
      ],
      unhonoured: []
    });
  });

  it('judges a day by the rules it really carries, not by one whose dish is gone', async () => {
    // The lunch rule's dish left the library, so the plan carries only the
    // dinner — and a lone pin always holds. Counting the dropped one would judge
    // the day against a meal nobody is served, and would say the surviving rule
    // misses its numbers because of a dish that is not there.
    const dinner = dish('rice-bowl', { slots: ['dinner'] });
    const service = harness({ library: [dinner], rules: [rule(), rule({ id: 'rule-2', dishSlug: dinner.slug, slot: 'dinner' as MealSlot })] });

    await expect(service.honourability(USER)).resolves.toEqual({
      judged: true,
      outOfBand: [],
      unhonoured: [{ id: 'rule-1', actionable: false, why: 'unknown_dish' }]
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
      outOfBand: [],
      unhonoured: [
        { id: 'rule-oven', actionable: true, why: 'missing_equipment' },
        { id: 'rule-gone', actionable: false, why: 'unknown_dish' }
      ]
    });
  });

  it('answers that it could not judge rather than that every rule is fine', async () => {
    // A profile whose targets the equations reject, or a consent withdrawn
    // between the two requests: the rules screen must not become an error page.
    await expect(harness({ targets: null }).honourability(USER)).resolves.toEqual({ judged: false, outOfBand: [], unhonoured: [] });
  });
});

/*
 * What a day's arithmetic does now: it warns, and somebody may accept it
 * (`0103`). The two halves that must not drift apart are `consequence` — the
 * sentence read before anybody commits — and `add`, which asks the same
 * question again and is the only gate.
 */

/** One gram of rice: a dish no dinner plate can be sized to, which `fitsPlate` refuses on a day holding nothing. */
const CRUMB = dish('one-grain', { ingredients: [{ grams: 1, slug: 'rice' }], slots: ['dinner'] });

/** A dinner dish that fits its plate but leaves this Monday unable to reach four macros beside the lunch rule. */
const CLASHING = dish('rice-bowl', { slots: ['dinner'] });

/** Fixed to dinner, so the day's lunch rule is what it is judged beside. */
const DINNER = { dishSlug: CLASHING.slug, slot: 'dinner' as MealSlot, weekday: 0 as Weekday };

function clashing(): FixedMealsService {
  return harness({ library: [FIXED, CLASHING], rules: [rule()] });
}

/** `add`'s two reads past the verdict: no rule on that meal yet, and the row it writes. */
function writable(): void {
  jest.spyOn(FixedMealController, 'taken').mockResolvedValue([]);
  jest.spyOn(FixedMealController, 'add').mockResolvedValue({ id: 'new-rule', dishName: 'Rice bowl', ...DINNER } as never);
}

describe('FixedMealsService.consequence', () => {
  it('says there is nothing to accept for a dish the day can hold', async () => {
    await expect(harness({ rules: [] }).consequence(USER, 0 as Weekday, 'lunch' as MealSlot, FIXED.slug)).resolves.toEqual({ fixable: true });
  });

  it('warns, acceptably, that the day cannot reach its macros beside the rule it holds', async () => {
    await expect(clashing().consequence(USER, DINNER.weekday, DINNER.slot, DINNER.dishSlug)).resolves.toEqual({
      acceptable: true,
      fixable: false,
      why: 'clashes_with_fixed'
    });
  });

  it('refuses a plate it cannot be sized into, and says it is not theirs to accept', async () => {
    // One gram of rice is not a dinner: `fitsPlate` refuses it on a day holding
    // nothing, so the reason is the plate and not the other rule. Arithmetic,
    // and still `acceptable: false` — `honouredPin` drops that pin, so accepting
    // it would promise a meal the generation never serves.
    const service = harness({ library: [CRUMB], rules: [] });

    await expect(service.consequence(USER, 0 as Weekday, 'dinner' as MealSlot, CRUMB.slug)).resolves.toEqual({
      acceptable: false,
      fixable: false,
      why: 'too_big_or_small'
    });
  });

  it('refuses an allergen, and says it is not theirs to accept', async () => {
    const cheesy = dish('cheese-bake', { ingredients: [{ grams: 100, slug: 'queso' }], slots: ['dinner'] });
    const service = harness({ allergenIds: ['milk'], library: [cheesy], rules: [] });

    await expect(service.consequence(USER, 0 as Weekday, 'dinner' as MealSlot, cheesy.slug)).resolves.toEqual({
      acceptable: false,
      fixable: false,
      why: 'allergen'
    });
  });

  it('answers a dish the library does not hold rather than failing', async () => {
    await expect(harness({ rules: [] }).consequence(USER, 0 as Weekday, 'lunch' as MealSlot, 'no-such-dish')).resolves.toEqual({
      acceptable: false,
      fixable: false,
      why: 'unknown_dish'
    });
  });
});

describe('FixedMealsService.add', () => {
  it('refuses a warning nobody accepted, with the reason, and writes nothing', async () => {
    writable();

    await expect(clashing().add(USER, DINNER)).rejects.toMatchObject({ name: 'FixedMealWarningError', why: 'clashes_with_fixed' });
    expect(FixedMealController.add).not.toHaveBeenCalled();
  });

  it('fixes the same meal once that reason is accepted', async () => {
    writable();

    await expect(clashing().add(USER, DINNER, ['clashes_with_fixed'])).resolves.toMatchObject({ id: 'new-rule' });
  });

  it('does not take an acceptance as read for a reason nobody may accept', async () => {
    // The arithmetic reason that is still a refusal: accepting everything a body
    // is allowed to accept leaves it a 422, not a 201.
    const service = harness({ library: [CRUMB], rules: [] });

    writable();

    await expect(service.add(USER, { ...DINNER, dishSlug: CRUMB.slug }, ['clashes_with_fixed'])).rejects.toMatchObject({
      fieldErrors: { dishSlug: ['too_big_or_small'] },
      name: 'InputParseError'
    });
    expect(FixedMealController.add).not.toHaveBeenCalled();
  });

  /*
   * The seven that stay refusals, each proved the same way: accepting *every*
   * acceptable reason changes nothing, because neither of them is this one. The
   * test the record draws is whether accepting the consequence leaves somebody
   * able to eat the thing, and for these it does not.
   */
  const refusals: readonly (readonly [string, () => FixedMealsService, string])[] = [
    [
      'allergen',
      () =>
        harness({
          allergenIds: ['milk'],
          library: [dish('cheese-bake', { ingredients: [{ grams: 100, slug: 'queso' }], slots: ['dinner'] })],
          rules: []
        }),
      'cheese-bake'
    ],
    ['excluded', () => harness({ excluded: true, library: [dish('any-dinner', { slots: ['dinner'] })], rules: [] }), 'any-dinner'],
    ['disliked', () => harness({ disliked: ['any-dinner'], library: [dish('any-dinner', { slots: ['dinner'] })], rules: [] }), 'any-dinner'],
    ['too_slow', () => harness({ library: [dish('any-dinner', { slots: ['dinner'] })], maxMinutes: 5, rules: [] }), 'any-dinner'],
    [
      'missing_equipment',
      () => harness({ kitchen: without('oven'), library: [dish('baked', { equipment: ['oven'], slots: ['dinner'] })], rules: [] }),
      'baked'
    ],
    ['no_method', () => harness({ library: [dish('no-steps', { slots: ['dinner'], steps: [] })], rules: [] }), 'no-steps'],
    ['too_big_or_small', () => harness({ library: [CRUMB], rules: [] }), CRUMB.slug],
    ['wrong_slot', () => harness({ library: [dish('lunch-only')], rules: [] }), 'lunch-only'],
    ['unknown_dish', () => harness({ library: [], rules: [] }), 'gone-dish']
  ];

  it.each(refusals)('refuses %s however much the body accepts', async (why, build, dishSlug) => {
    const service = build();

    writable();

    await expect(service.add(USER, { ...DINNER, dishSlug }, ['clashes_with_fixed'])).rejects.toMatchObject({
      fieldErrors: { dishSlug: [why] },
      name: 'InputParseError'
    });
    expect(FixedMealController.add).not.toHaveBeenCalled();
  });
});

describe('what an accepted rule costs afterwards', () => {
  it('says the accepted day misses its numbers, and calls no rule unhonoured', async () => {
    // The rule exists because somebody accepted the warning, and the trade is
    // honoured: `honouredPin` places both pins and the day comes out of band. So
    // the sentence owed is about that day's numbers — not that a rule was
    // dropped, which would be false, and not silence either.
    const service = harness({ library: [FIXED, CLASHING], rules: [rule(), rule({ id: 'rule-2', dishSlug: CLASHING.slug, slot: DINNER.slot })] });

    await expect(service.honourability(USER)).resolves.toEqual({
      judged: true,
      outOfBand: [
        { id: 'rule-1', weekday: 0 },
        { id: 'rule-2', weekday: 0 }
      ],
      unhonoured: []
    });
  });

  it('reports a plate the targets outgrew, and does not call it acceptable', async () => {
    // Nobody can accept `too_big_or_small` at `add` any more, but a rule written
    // when it fitted and left behind by a change of targets still reaches this —
    // and `honouredPin` really does drop it, so the sentence is true. The row
    // says `acceptable: false`, so no screen offers to keep it as it is.
    const service = harness({ library: [CRUMB], rules: [rule({ dishSlug: CRUMB.slug, slot: DINNER.slot })] });

    await expect(service.honourability(USER)).resolves.toEqual({
      judged: true,
      outOfBand: [],
      unhonoured: [{ id: 'rule-1', actionable: true, why: 'too_big_or_small' }]
    });
  });
});

describe('FixedMealsService.notOffered', () => {
  it('no longer says a dish is not offered for clashing, because it is offered now', async () => {
    // What the offer stopped filtering by (`0103`): the dish the day cannot hold
    // is in the picker's list, and the search has nothing to explain about it.
    await expect(clashing().notOffered(USER, DINNER.weekday, DINNER.slot, 'rice')).resolves.toEqual([]);
  });

  it('explains a plate it cannot be sized into, and does not offer a way past it', async () => {
    const service = harness({ library: [CRUMB], rules: [] });

    await expect(service.notOffered(USER, 0 as Weekday, 'dinner' as MealSlot, 'grain')).resolves.toEqual([
      { actionable: true, name: 'one-grain', slug: 'one-grain', why: 'too_big_or_small' }
    ]);
  });
});

/*
 * At most two meals of one weekday (`MAX_FIXED_MEALS_PER_DAY`, `0103`). The
 * bound is the repository's, re-counted inside the lock that writes the row;
 * what these cover is the half the routes owe — that nothing is offered for a
 * full day, so no screen can show a dish `add` would then refuse, and that no
 * model call is spent on one.
 */
describe('a weekday that already holds its two', () => {
  /** A dish for the meal nobody has fixed yet, so an empty offer can only be the cap's doing. */
  const TOAST = dish('toast', { slots: ['breakfast'] });

  /** Monday's lunch and dinner both spoken for; the breakfast is what is asked about. */
  function full(): FixedMealsService {
    return harness({ library: [FIXED, CLASHING, TOAST], rules: [rule(), rule({ id: 'rule-2', dishSlug: CLASHING.slug, slot: DINNER.slot })] });
  }

  const BREAKFAST = { dishSlug: TOAST.slug, slot: 'breakfast' as MealSlot, weekday: 0 as Weekday };

  it('offers nothing for a third meal of that day', async () => {
    expect(await full().fixable(USER, BREAKFAST.weekday, BREAKFAST.slot)).toEqual([]);
    // And the day beside it is untouched: the cap is per weekday, not per account.
    expect((await full().fixable(USER, 1 as Weekday, BREAKFAST.slot)).length).toBeGreaterThan(0);
  });

  it('leaves the third rule to the lock, so the allowance is asked before the day', async () => {
    // **Not refused here**, and the test is the point rather than the mechanism
    // (`warn-e2e`, 2026-10-16): a fast path would answer 409 `FIXED_MEAL_DAY_FULL`
    // to a premium account that has also spent all three of its rules, whose
    // real answer is 429 `QUOTA_EXCEEDED`. Both bounds are re-counted in one
    // lock, in that order, so the service hands the rule over instead of
    // choosing the sentence itself.
    writable();

    await expect(full().add(USER, BREAKFAST)).resolves.toMatchObject({ id: 'new-rule' });
    expect(FixedMealController.add).toHaveBeenCalledWith(USER, BREAKFAST);
  });

  it('does not judge the dish for a day nothing can be fixed to', async () => {
    // The offer for such a day is empty, so judging the dish would answer
    // `too_big_or_small` about a dish whose plate is fine — a lie, and one that
    // would reach the screen as a 422 instead of the day's own refusal.
    writable();

    await expect(full().add(USER, { ...BREAKFAST, dishSlug: FIXED.slug })).resolves.toMatchObject({ id: 'new-rule' });
  });

  it('refuses the consequence rather than inventing a reason about the dish', async () => {
    await expect(full().consequence(USER, BREAKFAST.weekday, BREAKFAST.slot, BREAKFAST.dishSlug)).rejects.toMatchObject({
      name: 'FixedMealDayFullError'
    });
  });

  it('explains nothing about a dish, because the day is what refused', async () => {
    await expect(full().notOffered(USER, BREAKFAST.weekday, BREAKFAST.slot, 'toast')).resolves.toEqual([]);
  });

  it('spends no model call on a day that cannot hold the dish', async () => {
    const service = full();

    jest.spyOn(DishRequestController, 'standing').mockResolvedValue({ allowed: true } as never);

    await expect(service.request(USER, BREAKFAST.weekday, BREAKFAST.slot, 'tortilla de patata')).rejects.toMatchObject({
      name: 'FixedMealDayFullError'
    });
  });

  it('still lets the second rule of a day be written', async () => {
    // The cap is two and not one: the pair `0101` exists for is still allowed,
    // warning accepted.
    writable();

    await expect(clashing().add(USER, DINNER, ['clashes_with_fixed'])).resolves.toMatchObject({ id: 'new-rule' });
  });
});
