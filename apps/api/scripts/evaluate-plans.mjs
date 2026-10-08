#!/usr/bin/env node
/**
 * Does a plan, scheduled and validated against the REAL dish library, land every
 * day inside 5% on all four macros — and does no declared allergen reach a plate?
 *
 * The scheduler and the validator carry unit tests, and unit tests run on fixtures.
 * A fixture is a library somebody wrote to make a test pass; the library people
 * actually get plans from is a few hundred dishes with the distribution a seed and
 * a model happened to produce. This runs the same `schedulePlan` / `validatePlan`
 * the API calls, over that real library, for a fixed set of profiles, and reports
 * what actually happened — never an estimate.
 *
 * What it is NOT: a copy of `PlanGenerationService`. It calls no model
 * (`AI_PROVIDER` is never read), asks for no fallback retry, and touches no real
 * account — `RecipeController.generationContext` is called with a fresh random
 * UUID that matches no row, which is exactly why every repository behind it comes
 * back empty rather than throwing (see the hand-back for the read-by-read proof).
 * A plan this script cannot schedule is reported as "could not measure", the way
 * `PlanGenerationService` would report `GENERATION_POOL_TOO_SMALL` — this script
 * does not retry with a wider pool, because a retry would measure a different,
 * more forgiving question than the one asked.
 *
 * Read-only, provably: every database call this process makes runs inside one
 * Postgres transaction opened `BEGIN ... READ ONLY` (via `db.transaction(fn,
 * { accessMode: 'read only' })`), which is engine-enforced — a write inside it
 * errors rather than applies. See "why one transaction, and why it is provable"
 * below for the mechanism and its one caveat.
 *
 * Usage (from the repository root, against the local Postgres `pnpm db:local` runs —
 * never Neon):
 *   NUTRIA_LOCAL_PG=1 node apps/api/scripts/evaluate-plans.mjs [--locale es-ES] [--json out.json] [--compare before.json] [--flag <name>]... [--start YYYY-MM-DD] [--only <profile>] [--rotate [seeds] [--exceptions]]
 *
 * `--flag <name>` names a scheduler flag to measure with on (project 016). The
 * one that exists is `accompaniments`: each profile's larder (`larderFor`, the
 * same filter the API will hand the scheduler) is offered beside lunch and
 * dinner. Any other name is refused.
 *
 * `--start` is the fortnight's first day (default 2026-10-05): season is a
 * hard filter on the month each day falls in — on a dish's fresh fruit since
 * 017 phase 2, and with accompaniments on what goes beside it — so the figures
 * depend on it. It is printed and recorded in the JSON.
 *
 * `--rotate [seeds]` (019 phase 1, default 10 seeds) plans the way production
 * does instead of from the whole library: each seed is one fortnight's
 * rotation — `reusablePool` with a `Rotation` built as `PlanGeneration` builds
 * it, nineteen dishes a slot — then the same rescues in the same order: the
 * whole library when the pool cannot fill a plan or the plan is blocked, and
 * `wider_rotation` (the uncapped rotation, kept when `planBandMiss` is
 * smaller) when a day misses a band. Without the model's fresh third: the
 * pool is the rotation alone, which is what `PoolBuilder` serves with no
 * provider. Each plan is scored for balance against PRD 019's table
 * (`core/domain/Balance`), and the report is per profile, per goal and per
 * rule. `--compare` does not read a rotate file.
 *
 * `--exceptions` (019 phase 4, with `--rotate`) adds, per plan, which of its
 * exceptions to the table's maximums and minimums the bands needed and which
 * they did not (`bandNeededExceptions`): the meals past a cap or short of a
 * floor, and how many no single swap could have removed with the day kept inside
 * its bands. It runs after the scheduling clock stops.
 *
 * Every plan, plain or rotated, carries its balance score and its protein per
 * kg at each meal (`balance`, `proteinPerKg`).
 *
 * Exit codes:
 *   0  every profile measured; no plate carried a declared allergen
 *   1  something could not be measured (a pool too small for a profile, a
 *      target set the equations reject) — never guessed at, always said
 *   2  a plate carried a declared allergen — a P0 on its own, checked last so it
 *      overrides a 1
 */
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { readFileSync, writeFileSync } from 'node:fs';

import { assertNotProduction } from '../../../.claude/skills/local-probe/scripts/guard.mjs';

import { RecipeController } from 'core/controllers/Recipe';
import { BALANCE_RULES, balanceOf, balanceSupply, mealGroups, mealServings, proteinPerKgBySlot } from 'core/domain/Balance';
import { larderFor } from 'core/domain/Accompaniment';
import { SafetyController } from 'core/controllers/Safety';
import { cuisineFamily, dishGroups, groupFits, isSnackOrBreakfastDish, outOfSeasonFruit } from 'core/domain/MealFit';
import { DEFAULT_MEAL_SHAPE, shapeFor, slotsIn, weightsFor } from 'core/domain/MealShape';
import { loadedTargets } from 'core/domain/Event';
import { TargetsUnreachableError, minimumDailyKcal, nutritionTargets } from 'core/domain/Nutrition';
import { isBlocking, PLAN_TOLERANCE, planBandMiss, validatePlan } from 'core/domain/PlanValidation';
import {
  breaksDishRule,
  breaksPatternDish,
  freeFromExclusions,
  isForeignCuisine,
  isLegumeSlug,
  leaningSlugs,
  PATTERN_EXCLUDED_SLUGS,
  resolvePreferences
} from 'core/domain/Preference';
import { bandNeededExceptions, PLAN_DAYS, PLATE_GRAMS_MAX, PLATE_LIMIT, plateGramsMax, schedulePlan, SERVING_PREFERENCE } from 'core/domain/Scheduler';
import { bestEffortExclusions, dishSafety, normaliseForMatching, resolveCustomAllergens, toSafetyProfile } from 'core/domain/Safety';
import {
  DISHES_NEEDED_PER_SLOT,
  isCappedStarch,
  legumeKind,
  MAIN_SLOTS,
  mainProtein,
  rotatePool,
  SNACK_KIND_SLOTS,
  snackKind,
  STARCH_RULES,
  starchBase,
  starchCap
} from 'core/domain/Variety';
import { plateFoodMax, plateFoods } from 'core/domain/PlateFood';

// ---------------------------------------------------------------------------
// The profiles. Fixed here, printed in the report, so the next run measures the
// same thing this one did — a number only means something next to the one it
// replaced, and that only holds if nobody quietly changed what was asked.
//
// Each covers a distinct axis the agent's brief names as load-bearing: a small
// energy target, a large one, three meals a day, five, an allergen that removes
// a whole food class, a dietary pattern, and a fortnight carrying an event.
// ---------------------------------------------------------------------------
const PROFILES = [
  {
    slug: 'objetivo-bajo-3-comidas',
    description: 'Small energy target, three meals a day, no restrictions',
    target: { activityLevel: 'sedentary', ageYears: 28, goal: 'weight_loss', heightCm: 158, paceKgPerWeek: 0.5, sex: 'female', weightKg: 52 },
    shape: shapeFor(3, false)
  },
  {
    slug: 'objetivo-alto-5-comidas',
    description: 'Large energy target, five meals a day, no restrictions',
    target: { activityLevel: 'athlete', ageYears: 26, goal: 'muscle_gain', heightCm: 190, paceKgPerWeek: 0.25, sex: 'male', weightKg: 98 },
    shape: shapeFor(5, true)
  },
  {
    slug: 'alergia-lacteos',
    description: 'A declared allergy removing a whole food class (dairy), ordinary shape',
    target: { activityLevel: 'moderate', ageYears: 35, goal: 'maintenance', heightCm: 167, sex: 'female', weightKg: 65 },
    shape: DEFAULT_MEAL_SHAPE,
    allergenClass: 'dairy'
  },
  {
    slug: 'patron-vegetariano',
    description: 'A declared dietary pattern (vegetarian), ordinary shape',
    target: { activityLevel: 'light', ageYears: 40, goal: 'healthy_eating', heightCm: 175, sex: 'male', weightKg: 80 },
    shape: DEFAULT_MEAL_SHAPE,
    dietaryPattern: 'vegetarian'
  },
  {
    slug: 'quincena-con-evento',
    description: 'Ordinary shape, two days of the fortnight loaded for an event (carbs up)',
    target: { activityLevel: 'moderate', ageYears: 30, goal: 'performance', heightCm: 170, sex: 'female', weightKg: 63 },
    shape: DEFAULT_MEAL_SHAPE,
    // Two days "before the race", the way `PlanGeneration.service.ts` loads them —
    // a day is judged against its own loaded target, not the plan's (`0043`).
    event: { carbs: 'up', daysBefore: 2, fat: 'same', loadedDayIndexes: [9, 10], protein: 'same' }
  },
  {
    slug: 'alergia-personalizada',
    description: 'A free-text (custom) allergen resolved against the catalogue, ordinary shape',
    target: { activityLevel: 'moderate', ageYears: 45, goal: 'maintenance', heightCm: 172, sex: 'male', weightKg: 78 },
    shape: DEFAULT_MEAL_SHAPE,
    customAllergenLabel: 'tomate'
  },
  {
    slug: 'alergia-personalizada-no-resuelta',
    description: 'A free-text custom allergen the catalogue cannot resolve, best-effort excluded by shared word',
    target: { activityLevel: 'moderate', ageYears: 45, goal: 'maintenance', heightCm: 172, sex: 'male', weightKg: 78 },
    shape: DEFAULT_MEAL_SHAPE,
    customAllergenLabel: 'frutos secos variados'
  },
  {
    slug: 'patron-halal',
    description: 'A declared dietary pattern (halal), ordinary shape — enforced in code since prompt 4.0.0',
    target: { activityLevel: 'light', ageYears: 33, goal: 'healthy_eating', heightCm: 178, sex: 'male', weightKg: 82 },
    shape: DEFAULT_MEAL_SHAPE,
    dietaryPattern: 'halal'
  },
  {
    slug: 'patron-kosher',
    description: 'A declared dietary pattern (kosher), ordinary shape — enforced in code, meat never with dairy',
    target: { activityLevel: 'light', ageYears: 38, goal: 'healthy_eating', heightCm: 165, sex: 'female', weightKg: 60 },
    shape: DEFAULT_MEAL_SHAPE,
    dietaryPattern: 'kosher'
  },
  {
    slug: 'patron-sin-gluten',
    description: 'A declared dietary pattern (gluten-free), ordinary shape — enforced by the gluten tag, traces included',
    target: { activityLevel: 'moderate', ageYears: 29, goal: 'weight_loss', heightCm: 163, sex: 'female', weightKg: 64 },
    shape: DEFAULT_MEAL_SHAPE,
    dietaryPattern: 'gluten_free'
  },
  {
    slug: 'patron-sin-lactosa',
    description: 'A declared dietary pattern (lactose-free), ordinary shape — enforced by the milk and lactose tags',
    target: { activityLevel: 'moderate', ageYears: 52, goal: 'maintenance', heightCm: 180, sex: 'male', weightKg: 85 },
    shape: DEFAULT_MEAL_SHAPE,
    dietaryPattern: 'lactose_free'
  },
  {
    // A synthetic stand-in for a real meal plan, not a copy of it (`0076`): two
    // main plates and a light snack carrying a BMI-over-30 weight-loss target,
    // which once came back as 1,700-kcal lunches beside 250-kcal dinners.
    slug: 'imc-alto-2-comidas',
    description:
      'BMI over 30, losing 1 kg a week, a light morning snack, lunch and dinner — protein on a reference weight, plates inside PLATE_LIMIT',
    target: { activityLevel: 'moderate', ageYears: 60, goal: 'weight_loss', heightCm: 176, paceKgPerWeek: 1, sex: 'male', weightKg: 102 },
    shape: { afternoon_snack: 'off', breakfast: 'off', dinner: 'normal', lunch: 'normal', morning_snack: 'light', supper: 'off' }
  },
  {
    slug: 'patron-tradicional-espanola',
    description: 'A declared dietary pattern (traditional Spanish), ordinary shape — 0077: rows, cuisines and names enforced in code',
    target: { activityLevel: 'moderate', ageYears: 62, goal: 'maintenance', heightCm: 172, sex: 'male', weightKg: 78 },
    shape: DEFAULT_MEAL_SHAPE,
    dietaryPattern: 'traditional_spanish'
  },
  {
    // A synthetic stand-in, not a copy (`0076`), for a real 3-meal account whose
    // plan ran protein −3% to −15% on most days and served a yoghurt cup ×3 as
    // dinner (017 phase 3, owner's amendment of 2026-10-02): its targets as the
    // app gave them, its meals, and the dislike it told the app.
    slug: 'tres-comidas-proteina-alta',
    description: 'Three meals (morning snack, lunch, dinner), 2,079 kcal with 138 g protein, dislikes fish',
    target: { activityLevel: 'moderate', ageYears: 40, goal: 'weight_loss', heightCm: 178, paceKgPerWeek: 0.5, sex: 'male', weightKg: 92 },
    targets: { carbsG: 236, fatG: 65, kcal: 2079, proteinG: 138 },
    shape: { afternoon_snack: 'off', breakfast: 'off', dinner: 'normal', lunch: 'normal', morning_snack: 'normal', supper: 'off' },
    dislikedLabels: ['pescado']
  }
];

const KNOWN_FLAGS = new Set(['accompaniments']);

/** Gnocchi's catalogue row: counted on its own line until the starch rule knows it (project 017). */
const GNOCCHI_SLUG = 'noquis';

const BAND_KINDS = new Set(['carbs_out_of_band', 'fat_out_of_band', 'kcal_out_of_band', 'protein_above_target', 'protein_below_target']);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const options = { compare: null, exceptions: false, flags: [], json: null, locale: 'es-ES', only: null, rotate: null, start: '2026-10-05' };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--locale') {
      options.locale = argv[(index += 1)];
    } else if (arg === '--json') {
      options.json = argv[(index += 1)];
    } else if (arg === '--compare') {
      options.compare = argv[(index += 1)];
    } else if (arg === '--only') {
      options.only = argv[(index += 1)];
    } else if (arg === '--start') {
      options.start = argv[(index += 1)];
    } else if (arg === '--exceptions') {
      options.exceptions = true;
    } else if (arg === '--rotate') {
      const seeds = /^\d+$/.test(argv[index + 1] ?? '') ? Number(argv[(index += 1)]) : 10;

      if (seeds < 1) {
        console.error('--rotate needs at least one seed');
        process.exit(2);
      }

      options.rotate = seeds;
    } else if (arg === '--flag') {
      const name = argv[(index += 1)];

      if (!KNOWN_FLAGS.has(name)) {
        console.error(`--flag needs a known name (${[...KNOWN_FLAGS].join(', ')})`);
        process.exit(2);
      }

      options.flags.push(name);
    } else {
      console.error(`unknown argument: ${arg}`);
      process.exit(2);
    }
  }

  return options;
}

// ---------------------------------------------------------------------------
// Building a profile's context without a real account.
//
// `RecipeController.nobodysContext` is `generationContext` without the consent
// check (there is nobody to have consented) over a random id. It takes, behind it, seven
// repository reads — every one of them a `WHERE user_id = $1` (or, for
// `SafetyRepository.listAllergens`, no user filter at all: it is reference
// data). None of them checks that the id exists first; a `SELECT ... WHERE
// user_id = $1` against an id nothing owns returns zero rows, not an error.
// A freshly random UUID is therefore guaranteed to name no account and to read
// back the empty profile — no allergies, no dietary pattern, no preferences —
// which is exactly the "nobody has told us anything about this person" state a
// synthetic profile starts from. Nothing is ever written with this id.
// ---------------------------------------------------------------------------
async function baseContext(locale) {
  const context = await RecipeController.nobodysContext();

  // `generationContext` resolves locale from the (nonexistent) profile row, so
  // it is always the fallback. Overridden here because it is `context.locale`
  // — not the catalogue's own name-resolution — that decides which locale's
  // *recipes* `reusablePool` reads (`recipes.locale`; ingredient names are a
  // separate, always-safe-to-fall-back concern and are not re-resolved here).
  // The allergen catalogue by key, so a gluten-free or lactose-free profile is
  // enforced by the same tags `generationContext` hands `resolvePreferences`.
  // Reference data, read-only, no user filter.
  const allergenIdsByKey = new Map((await SafetyController.listAllergens()).map(allergen => [allergen.key, allergen.id]));

  return { ...context, allergenIdsByKey, locale };
}

/**
 * The allergen id that, declared, removes the whole of one food class — found
 * empirically from the real catalogue's `ingredient_allergens` links rather
 * than assumed from a seed key, so it is exactly what `findSafetyViolations`
 * would enforce, not a guess at what the seed currently calls "dairy".
 */
function dominantAllergenForClass(ingredients, foodClass) {
  const inClass = ingredients.filter(ingredient => ingredient.classes.includes(foodClass));

  if (inClass.length === 0) {
    return null;
  }

  const counts = new Map();

  for (const ingredient of inClass) {
    for (const link of ingredient.allergens) {
      if (link.presence !== 'contains') {
        continue;
      }

      counts.set(link.allergenId, (counts.get(link.allergenId) ?? 0) + 1);
    }
  }

  let best = null;

  for (const [allergenId, count] of counts) {
    if (!best || count > best.count) {
      best = { allergenId, count };
    }
  }

  return best ? { allergenId: best.allergenId, classSize: inClass.length, coverage: best.count / inClass.length } : null;
}

function contextFor(profile, shared) {
  const ingredients = [...shared.catalogue.values()];

  if (profile.allergenClass) {
    const dominant = dominantAllergenForClass(ingredients, profile.allergenClass);

    if (!dominant) {
      return { context: null, note: `no allergen in the real catalogue covers any "${profile.allergenClass}" ingredient` };
    }

    const safety = toSafetyProfile([{ allergenId: dominant.allergenId, crossContaminationSensitive: false }], [], [], []);

    return {
      context: { ...shared, safety },
      note: `allergen covers ${dominant.classSize} of ${dominant.classSize} "${profile.allergenClass}" ingredients by id, ${(dominant.coverage * 100).toFixed(0)}% linked to one allergen`
    };
  }

  if (profile.customAllergenLabel) {
    const resolved = resolveCustomAllergens([profile.customAllergenLabel], ingredients);
    const safety = toSafetyProfile([], [], resolved, ingredients);

    if (!resolved[0]?.ingredientId) {
      // What `RecipeController.generationContext` does with an entry it cannot
      // resolve: every row sharing a word with it leaves, beside the preferences.
      const bestEffort = bestEffortExclusions(safety.unenforceableLabels, ingredients);
      const preferences = { ...shared.preferences, excludedIngredientIds: new Set([...shared.preferences.excludedIngredientIds, ...bestEffort]) };

      return {
        context: { ...shared, preferences, safety },
        note: `custom allergen "${profile.customAllergenLabel}" did not resolve; best-effort removed ${bestEffort.size} catalogue rows sharing a word with it`
      };
    }

    return {
      context: { ...shared, safety },
      note: `custom allergen "${profile.customAllergenLabel}" resolved to ${safety.excludedIngredientIds.size} catalogue rows`
    };
  }

  if (profile.dietaryPattern) {
    const dietaryPatterns = [profile.dietaryPattern];
    const resolved = resolvePreferences({
      allergenIdsByKey: shared.allergenIdsByKey,
      dietaryPatterns,
      dislikedLabels: [],
      ingredients,
      maxMinutesPerDish: null
    });
    // `resolvePreferences` starts fresh from this one pattern, so it drops
    // `shared.preferences`' own exclusions — `nobodysContext`'s empty safety
    // profile means `shared` already excludes every free-from substitute, and
    // recomputing it here (rather than losing it) is what keeps a vegetarian
    // or halal profile from measuring pan-sin-gluten as offered when
    // `RecipeController.generationContext` would never offer it to them either.
    const freeFrom = freeFromExclusions(ingredients, {
      allergenIdsByKey: shared.allergenIdsByKey,
      dietaryPatterns,
      restrictedAllergenIds: new Set([...shared.safety.allergenIds, ...shared.safety.intoleranceAllergenIds])
    });
    const preferences =
      freeFrom.size === 0 ? resolved : { ...resolved, excludedIngredientIds: new Set([...resolved.excludedIngredientIds, ...freeFrom]) };

    return {
      // The pattern itself too, as `generationContext` carries it: the library
      // is narrowed to the meals its ingredients belong to for this person, and
      // a vegetarian sees every plant protein at every meal (`0062` § 4).
      context: { ...shared, dietaryPatterns, preferences },
      note: `${preferences.excludedIngredientIds.size} ingredients excluded by "${profile.dietaryPattern}"`
    };
  }

  if (profile.dislikedLabels) {
    // What `generationContext` does with a profile's dislikes: resolved by
    // `resolvePreferences` and added to what `nobodysContext` already excludes.
    const resolved = resolvePreferences({
      allergenIdsByKey: shared.allergenIdsByKey,
      dietaryPatterns: [],
      dislikedLabels: profile.dislikedLabels,
      ingredients,
      maxMinutesPerDish: null
    });
    const preferences = {
      ...shared.preferences,
      excludedIngredientIds: new Set([...shared.preferences.excludedIngredientIds, ...resolved.excludedIngredientIds])
    };

    return {
      context: { ...shared, preferences },
      note: `${resolved.excludedIngredientIds.size} ingredients excluded by the dislikes ${profile.dislikedLabels.join(', ')}`
    };
  }

  return { context: shared, note: null };
}

// ---------------------------------------------------------------------------
// What `schedulePlan` needs for one profile beside its pool: its targets (null,
// with the reason, when the equations reject them), its meals and their
// weights, the days loaded for an event (`0043`), the month each day falls in,
// and the larder when accompaniments are on. Shared by the plain run and
// `--rotate`, so both plan the same person.
// ---------------------------------------------------------------------------
function planInputs(profile, context, options) {
  let targets;

  try {
    // A profile stated by its targets keeps the body's fibre and floor, and its own macros.
    targets = { ...nutritionTargets(profile.target), ...profile.targets };
  } catch (error) {
    if (error instanceof TargetsUnreachableError) {
      return { note: `targets unreachable: ${error.message}`, targets: null };
    }

    throw error;
  }

  const weights = weightsFor(profile.shape);
  const slots = slotsIn(profile.shape);

  const dayTargets = new Map();

  if (profile.event) {
    const loaded = loadedTargets(targets, profile.event);

    for (const dayIndex of profile.event.loadedDayIndexes) {
      dayTargets.set(dayIndex, loaded);
    }
  }

  // The month each day falls in, from the fortnight's first day, as the API will give it.
  const start = new Date(`${options.start}T12:00:00Z`);
  const monthOf = dayIndex => new Date(start.getTime() + (dayIndex - 1) * 86_400_000).getUTCMonth() + 1;
  const accompaniments = options.flags.includes('accompaniments')
    ? { larder: larderFor({ catalogue: context.catalogue, preferences: context.preferences, safety: context.safety }), monthOf }
    : undefined;

  return { accompaniments, dayTargets, monthOf, slots, targets, weights };
}

/** Every declared allergen on a plate of the plan, re-checked meal by meal as `PlanGenerationService.assertPlanIsSafe` does. */
function unsafeMeals(days, context) {
  const unsafe = [];

  for (const day of days) {
    for (const meal of day.meals) {
      const safety = dishSafety(meal.ingredients, context.catalogue, context.safety);

      if (safety.kind === 'unsafe') {
        for (const violation of safety.violations) {
          unsafe.push({ dayIndex: day.dayIndex, dish: meal.dish.name, ingredient: violation.ingredientName, kind: violation.kind, slot: meal.slot });
        }
      }
    }
  }

  return unsafe;
}

/** Vegetarian or vegan: the egg is their protein, and PRD 019 keeps their eggs uncapped. */
function isPlantBased(profile) {
  return profile.dietaryPattern === 'vegetarian' || profile.dietaryPattern === 'vegan';
}

// ---------------------------------------------------------------------------
// Measuring one profile
// ---------------------------------------------------------------------------
async function measureProfile(profile, shared, options) {
  const { context, note } = contextFor(profile, shared);

  if (!context) {
    return { measured: false, note, slug: profile.slug };
  }

  const inputs = planInputs(profile, context, options);

  if (!inputs.targets) {
    return { measured: false, note: inputs.note, slug: profile.slug };
  }

  const { accompaniments, dayTargets, monthOf, slots, targets, weights } = inputs;

  const pool = await RecipeController.reusablePool(slots, context);
  // What the library can serve each meal for this person, after `fitSlots`
  // (`0079` Table 2 included), against `DISHES_NEEDED_PER_SLOT`; and the
  // dinners by cuisine family, which is where Table 2 cuts.
  const poolBySlot = Object.fromEntries(slots.map(slot => [slot, pool.filter(dish => dish.slots.includes(slot)).length]));
  const dinnersByFamily = {};

  for (const dish of pool.filter(candidate => candidate.slots.includes('dinner'))) {
    const family = cuisineFamily(dish.cuisine);

    dinnersByFamily[family] = (dinnersByFamily[family] ?? 0) + 1;
  }

  // The scheduler alone, without the pool's read or this report (017 phase 3): what generation waits for.
  const scheduleStarted = performance.now();
  const scheduled = schedulePlan({
    accompaniments,
    catalogue: context.catalogue,
    dayTargets,
    minimumKcal: minimumDailyKcal(profile.target.sex),
    monthOf,
    pool,
    targets,
    weights
  });

  const scheduleMs = Math.round(performance.now() - scheduleStarted);

  if (!scheduled.ok) {
    return { measured: false, note, poolSize: pool.length, shortfall: scheduled.shortfall, slug: profile.slug };
  }

  const violations = validatePlan({
    assignment: scheduled.assignment,
    dayTargets,
    expectedDays: PLAN_DAYS,
    expectedSlots: slots,
    sex: profile.target.sex,
    targets,
    weightKg: profile.target.weightKg
  });

  // A second, independent safety pass over the assembled plan — the same check
  // `PlanGenerationService.assertPlanIsSafe` makes immediately before saving.
  // `reusablePool` already filtered by `dishSafety`; this re-checks what was
  // actually scheduled, so a placement bug that somehow introduced an unsafe
  // dish cannot hide behind "the pool was already safe".
  const unsafe = unsafeMeals(scheduled.assignment.days, context);

  // Every day's own signed deviation from its own target, whether inside the
  // band or not — `bandViolations` only exists for a day *outside* one, so a
  // library that already lands 14/14 inside band (this one, on every fixed
  // profile) would otherwise report nothing at all about how far from the
  // centre those days actually sit. A day loaded for an event is judged
  // against its own raised target, exactly as `validatePlan` judges it.
  const deviations = macroDeviations(scheduled.assignment.days, dayTargets, targets);
  const plateShare = plateShares(scheduled.assignment.days, dayTargets, targets, weights);
  const plateWeight = plateGrams(scheduled.assignment.days, dayTargets, targets, weights);

  const blockingViolations = violations.filter(isBlocking);
  const bandViolations = violations.filter(violation => BAND_KINDS.has(violation.kind));
  const varietyViolations = violations.filter(violation => violation.kind === 'variety');
  const otherAdvisories = violations.filter(violation => !isBlocking(violation) && violation.kind !== 'variety' && !BAND_KINDS.has(violation.kind));

  const daysOutside = new Set(bandViolations.map(violation => violation.dayIndex));
  const daysInsideAll4 = PLAN_DAYS - daysOutside.size;
  // Each day out of band with what missed and what it served (017 phase 2), so
  // a day a rule costs can be traced to its macro and its meals.
  const outOfBand = [...daysOutside]
    .sort((a, b) => a - b)
    .map(dayIndex => ({
      dayIndex,
      meals: (scheduled.assignment.days.find(day => day.dayIndex === dayIndex)?.meals ?? []).map(meal => ({
        base: starchBase(meal.dish) ?? 'none',
        dish: meal.dish.name,
        kcal: Math.round(meal.macros.kcal),
        servings: meal.servings,
        sides: (meal.accompaniments ?? []).map(side => side.key),
        slot: meal.slot
      })),
      misses: bandViolations
        .filter(violation => violation.dayIndex === dayIndex)
        .map(violation => ({ actual: Math.round(violation.actual * 10) / 10, kind: violation.kind, target: violation.target }))
    }));

  let worst = null;

  for (const violation of bandViolations) {
    if (violation.target <= 0) {
      continue;
    }

    const deviation = Math.abs(violation.actual - violation.target) / violation.target;

    if (!worst || deviation > worst.deviation) {
      worst = { actual: violation.actual, dayIndex: violation.dayIndex, deviation, macro: violation.kind, target: violation.target };
    }
  }

  const tally = list => {
    const counts = new Map();

    for (const item of list) {
      counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    }

    return Object.fromEntries(counts);
  };

  // Blocking violations are structural or safety, never a target this profile
  // chose — worth the actual figures, not just a count, because "9 days" reads
  // very differently from "1188 kcal against a 1200 floor" (a target clamped to
  // the floor itself) versus "1188 kcal against a 1200 floor" from a target that
  // was nowhere near it.
  const blockingDetail = blockingViolations.map(violation => {
    if (violation.kind === 'below_minimum_kcal') {
      return { actual: violation.actual, dayIndex: violation.dayIndex, kind: violation.kind, minimum: violation.minimum };
    }

    if (violation.kind === 'protein_above_ceiling') {
      return { actual: violation.actual, ceiling: violation.ceiling, dayIndex: violation.dayIndex, kind: violation.kind };
    }

    if (violation.kind === 'wrong_day_count') {
      return { actual: violation.actual, expected: violation.expected, kind: violation.kind };
    }

    if (violation.kind === 'missing_slot') {
      return { dayIndex: violation.dayIndex, kind: violation.kind, slot: violation.slot };
    }

    return { dayIndex: violation.dayIndex, kind: violation.kind };
  });

  return {
    advisories: tally([...bandViolations, ...otherAdvisories]),
    scheduleMs,
    blocking: tally(blockingViolations),
    blockingDetail,
    daysInsideAll4,
    deviations,
    fallback: null,
    accompanied: accompanimentMetrics(scheduled.assignment.days),
    dishRuleBreaks: dishRuleBreaks(scheduled.assignment.days, context),
    foodGroups: foodGroupGrams(scheduled.assignment.days, context.catalogue, dayTargets, targets, weights),
    dinnersByFamily,
    measured: true,
    note,
    outOfBand,
    plateShare,
    plateWeight,
    poolBySlot,
    poolSize: pool.length,
    servings: servingsHistogram(scheduled.assignment.days),
    servingsInBand: servingsInBand(scheduled.assignment.days),
    slug: profile.slug,
    unsafe,
    spanish: spanishMetrics(scheduled.assignment.days, context.catalogue),
    starch: starchMetrics(scheduled.assignment.days),
    kinds: kindMetrics(scheduled.assignment.days, context.catalogue, monthOf),
    mainMeals: mainMealMetrics(scheduled.assignment.days),
    // How varied the plan actually is, not just whether it broke a rule —
    // distinct dishes maximised, no two days the same, a repeat as far apart
    // as the pool allows (owner, 2026-09-26; `0065`).
    variety: varietyMetrics(scheduled.assignment.days, slots),
    varietyViolations: varietyViolations.map(violation => ({
      dayIndex: violation.violation.dayIndex,
      dishSlug: 'dishSlug' in violation.violation ? violation.violation.dishSlug : null,
      kind: violation.violation.kind,
      matchesDayIndex: 'matchesDayIndex' in violation.violation ? violation.violation.matchesDayIndex : null,
      slot: 'slot' in violation.violation ? violation.violation.slot : null
    })),
    worst,
    // 019 phase 1: the fortnight against PRD 019's table, and each meal's protein per kg.
    balance: balanceOf({
      catalogue: context.catalogue,
      days: scheduled.assignment.days,
      plantBased: isPlantBased(profile),
      supply: balanceSupply(pool, context.catalogue)
    }),
    proteinPerKg: proteinPerKgBySlot(scheduled.assignment.days, profile.target.weightKg)
  };
}

/**
 * The plate's starch base (016 phase 7), over the plan's lunches and dinners:
 * how many of each base, how many dinners are pasta or rice, and every pair of
 * days running — or meals on one day — that share pasta or rice, which
 * `STARCH_RULES` keeps apart. The dish's own base, never what is beside it.
 *
 * Project 017 phase 1 adds, without changing the rest: each lunch and dinner by
 * slot, cuisine family (`cuisineFamily`) and base; the dinners of pasta or rice
 * outside the Asian family, where `0079` Table 2 says rice and pasta are not a
 * dinner; and every lunch or dinner with gnocchi (`GNOCCHI_SLUG`), a base the
 * rule does not know yet.
 */
function starchMetrics(days) {
  const mains = {};
  const dinners = {};
  const byDay = new Map(STARCH_RULES.capped.map(base => [base, new Map()]));
  const total = Object.fromEntries(STARCH_RULES.capped.map(base => [base, 0]));
  const byFamily = {};
  const gnocchi = [];
  let dinnerPastaOrRiceOutsideAsian = 0;
  const outsideTable2 = [];

  for (const day of days) {
    for (const meal of day.meals) {
      const base = starchBase(meal.dish) ?? 'none';

      if (byDay.has(base)) {
        byDay.get(base).set(day.dayIndex, (byDay.get(base).get(day.dayIndex) ?? 0) + 1);
        total[base] += 1;
      }

      if (MAIN_SLOTS.has(meal.slot)) {
        mains[base] = (mains[base] ?? 0) + 1;

        const family = cuisineFamily(meal.dish.cuisine);
        const slot = (byFamily[meal.slot] ??= {});
        const bases = (slot[family] ??= {});

        bases[base] = (bases[base] ?? 0) + 1;

        if (meal.slot === 'dinner' && isCappedStarch(base) && family !== 'asian') {
          dinnerPastaOrRiceOutsideAsian += 1;
        }

        // 017 phase 2: what Table 2 itself refuses at this meal — rice at a
        // Latin dinner is allowed, so this, not the line above, must be 0.
        for (const group of dishGroups(meal.dish)) {
          if (isCappedStarch(group) && !groupFits(family, group, meal.slot)) {
            outsideTable2.push({ dayIndex: day.dayIndex, dish: meal.dish.name, family, group, slot: meal.slot });
          }
        }

        if (meal.dish.ingredients.some(item => item.slug === GNOCCHI_SLUG)) {
          gnocchi.push({ base, dayIndex: day.dayIndex, dish: meal.dish.name, family, slot: meal.slot });
        }
      }

      if (meal.slot === 'dinner') {
        dinners[base] = (dinners[base] ?? 0) + 1;
      }
    }
  }

  const repeats = [];

  for (const [base, counts] of byDay) {
    for (const [dayIndex, count] of [...counts].sort((a, b) => a[0] - b[0])) {
      if (count > 1) {
        repeats.push(`${base} twice on day ${dayIndex}`);
      }

      if (counts.has(dayIndex - 1)) {
        repeats.push(`${base} days ${dayIndex - 1}–${dayIndex}`);
      }
    }
  }

  return {
    byFamily,
    cap: starchCap(days.length),
    consecutive: repeats,
    dinnerPastaOrRice: (dinners.pasta ?? 0) + (dinners.rice ?? 0),
    dinnerPastaOrRiceOutsideAsian,
    dinners,
    gnocchi,
    mains,
    outsideTable2,
    total
  };
}

/**
 * How often one kind of food comes back (017 phase 2): each main protein at
 * lunch and dinner (`mainProtein`), over the fortnight and in its busiest week;
 * each legume at any meal (`legumeKind`), with the days it ran on or doubled.
 */
function kindMetrics(days, catalogue, monthOf) {
  const proteins = {};
  const legumeDays = new Map();
  const outOfSeason = [];
  const snacks = {};

  for (const day of days) {
    for (const meal of day.meals) {
      const snack = SNACK_KIND_SLOTS.has(meal.slot) ? snackKind(meal.dish, catalogue) : null;

      if (snack) {
        snacks[snack] = (snacks[snack] ?? 0) + 1;
      }

      const fruit = outOfSeasonFruit(meal.dish, catalogue, monthOf(day.dayIndex));

      if (fruit) {
        outOfSeason.push({ dayIndex: day.dayIndex, dish: meal.dish.name, fruit, slot: meal.slot });
      }

      const legume = legumeKind(meal.dish);

      if (legume) {
        legumeDays.set(legume, [...(legumeDays.get(legume) ?? []), day.dayIndex]);
      }

      if (!MAIN_SLOTS.has(meal.slot)) {
        continue;
      }

      const protein = mainProtein(meal.dish, catalogue);

      if (protein) {
        const entry = (proteins[protein] ??= { total: 0, weeks: [0, 0] });

        entry.total += 1;
        entry.weeks[day.dayIndex <= 7 ? 0 : 1] += 1;
      }
    }
  }

  const top = Object.entries(proteins).sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]));

  const legumes = Object.fromEntries(
    [...legumeDays].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([kind, at]) => [kind, at.length])
  );
  const legumeRuns = [...legumeDays].flatMap(([kind, at]) =>
    at.flatMap((dayIndex, position) => [
      ...(at.indexOf(dayIndex) !== position ? [`${kind} twice on day ${dayIndex}`] : []),
      ...(at.indexOf(dayIndex) === position && at.includes(dayIndex - 1) ? [`${kind} days ${dayIndex - 1}–${dayIndex}`] : [])
    ])
  );
  const legumeTop = Object.entries(legumes)[0];

  return {
    legumeMax: legumeTop ? { kind: legumeTop[0], total: legumeTop[1] } : null,
    legumeRuns,
    legumes,
    outOfSeason,
    snackMax:
      Object.entries(snacks)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([kind, total]) => ({ kind, total }))[0] ?? null,
    snacks,
    proteinMax: top[0] ? { kind: top[0][0], total: top[0][1].total } : null,
    proteinMaxWeek: Math.max(0, ...top.map(([, entry]) => Math.max(...entry.weeks))),
    proteins: Object.fromEntries(top.map(([kind, entry]) => [kind, entry.total]))
  };
}

/**
 * What traditional Spanish (`0077`) promises, read off the plates of every
 * profile: a row the pattern excludes, a dish of a foreign cuisine, a dish with
 * a foreign name — each zero for `patron-tradicional-espanola`, and a baseline
 * for everyone else — and how many lunches and dinners carry legumes and fish
 * (PRD 013 criterion 6: at least 8 and 6 in the fortnight).
 */
function spanishMetrics(days, catalogue) {
  const forbidden = PATTERN_EXCLUDED_SLUGS.traditional_spanish;
  const forbiddenRows = [];
  const foreignCuisines = [];
  const foreignNames = [];
  let withLegumes = 0;
  let withFish = 0;

  for (const day of days) {
    for (const meal of day.meals) {
      const { dish } = meal;
      // The whole meal, so a row beside the plate is judged as one on it.
      const slugs = meal.ingredients.map(item => item.slug);

      for (const slug of slugs.filter(slug => forbidden.has(slug))) {
        forbiddenRows.push({ dayIndex: day.dayIndex, dish: dish.name, slot: meal.slot, slug });
      }

      if (isForeignCuisine(dish.cuisine)) {
        foreignCuisines.push({ cuisine: dish.cuisine, dayIndex: day.dayIndex, dish: dish.name, slot: meal.slot });
      } else if (breaksPatternDish({ cuisine: null, name: dish.name }, { refusesForeignDishes: true })) {
        foreignNames.push({ dayIndex: day.dayIndex, dish: dish.name, slot: meal.slot });
      }

      if (meal.slot === 'lunch' || meal.slot === 'dinner') {
        withLegumes += slugs.some(isLegumeSlug) ? 1 : 0;
        withFish += slugs.some(slug => (catalogue.get(slug)?.classes ?? []).some(cls => cls === 'fish' || cls === 'shellfish')) ? 1 : 0;
      }
    }
  }

  return { foreignCuisines, foreignNames, forbiddenRows, mainsWithFish: withFish, mainsWithLegumes: withLegumes };
}

/**
 * How far a fortnight's four macros actually sit from their targets, day by
 * day, whether the day landed inside `PLAN_TOLERANCE` or not.
 *
 * `bandViolations` only exists for a day a macro left its band — which is
 * exactly nothing on a library that already lands every profile 14/14 inside
 * 5%, and "inside the band" is precisely the case the owner asked about: a
 * plan can be perfect by that measure and still sit near one edge of every
 * band on most days, never near the middle. The mean *signed* deviation is
 * what shows a bias a symmetric band cannot — a fat figure that is +4% on ten
 * days and −4% on four averages near zero on `Math.abs` alone but never on
 * the signed mean, which is the number this script did not compute before.
 *
 * Read straight off `assignment.days[].totals` against each day's own target
 * (`dayTargets` for a loaded day, the plan's `targets` otherwise) — the same
 * inputs `validatePlan` judges the band against, so a deviation reported here
 * is never a different question from the one the band already asks.
 */
function macroDeviations(days, dayTargets, targets) {
  const macros = [
    { key: 'kcal', target: 'kcal' },
    { key: 'proteinG', target: 'proteinG' },
    { key: 'carbsG', target: 'carbsG' },
    { key: 'fatG', target: 'fatG' }
  ];
  const signed = Object.fromEntries(macros.map(macro => [macro.key, []]));

  for (const day of days) {
    const dayTarget = dayTargets.get(day.dayIndex) ?? targets;

    for (const macro of macros) {
      const target = dayTarget[macro.target];

      if (target > 0) {
        signed[macro.key].push((day.totals[macro.key] - target) / target);
      }
    }
  }

  const mean = list => list.reduce((sum, value) => sum + value, 0) / list.length;

  return Object.fromEntries(
    macros.map(macro => {
      const values = signed[macro.key];

      return [macro.key, { meanAbs: mean(values.map(Math.abs)), meanSigned: mean(values), n: values.length }];
    })
  );
}

/**
 * How varied a scheduled fortnight actually is, read straight off the
 * assignment — never an estimate, the same way every other number in this
 * script is read off what `schedulePlan` actually returned.
 *
 * - `distinctPerSlot` / `totalDistinct`: how many different dishes each slot,
 *   and the plan as a whole, actually used.
 * - `identicalDayPairs`: every later day whose exact set of dishes repeats an
 *   earlier one — the hard rule the owner named; a plan with any is a bug,
 *   not a preference.
 * - `maxRepeats`: the most times any one dish was served, and which one.
 *   Never above `VARIETY_RULES.maxOccurrencesPerPlan` (two) — `canPlace`
 *   prevents it by construction, so a higher number here is a bug worth
 *   reporting, not a policy.
 * - `minGapDays` / `minGapMainDays`: the closest two servings of the same
 *   dish ever landed, in days — the second only over `lunch` and `dinner`,
 *   which is what "a repeat of a main is as far apart as possible" measures.
 *   `null` when nothing repeated at all.
 */
function varietyMetrics(days, slots) {
  const bySlot = new Map(slots.map(slot => [slot, new Map()]));

  for (const day of days) {
    for (const meal of day.meals) {
      const bucket = bySlot.get(meal.slot);

      if (!bucket) {
        continue;
      }

      const dayIndexes = bucket.get(meal.dish.slug) ?? [];

      dayIndexes.push(day.dayIndex);
      bucket.set(meal.dish.slug, dayIndexes);
    }
  }

  const distinctPerSlot = Object.fromEntries([...bySlot].map(([slot, bucket]) => [slot, bucket.size]));

  let maxRepeats = { count: 0, slug: null };
  let minGapDays = null;
  let minGapMainDays = null;

  for (const [slot, bucket] of bySlot) {
    for (const [slug, dayIndexes] of bucket) {
      if (dayIndexes.length > maxRepeats.count) {
        maxRepeats = { count: dayIndexes.length, slug };
      }

      const sorted = [...dayIndexes].sort((a, b) => a - b);

      for (let index = 1; index < sorted.length; index += 1) {
        const gap = sorted[index] - sorted[index - 1];

        minGapDays = minGapDays === null ? gap : Math.min(minGapDays, gap);

        if (MAIN_SLOTS.has(slot)) {
          minGapMainDays = minGapMainDays === null ? gap : Math.min(minGapMainDays, gap);
        }
      }
    }
  }

  const signatures = new Map();
  const identicalDayPairs = [];

  for (const day of days) {
    const signature = [...day.meals]
      .map(meal => meal.dish.slug)
      .sort()
      .join('|');
    const firstDayIndex = signatures.get(signature);

    if (firstDayIndex === undefined) {
      signatures.set(signature, day.dayIndex);
    } else {
      identicalDayPairs.push([firstDayIndex, day.dayIndex]);
    }
  }

  return {
    distinctPerSlot,
    identicalDayPairs,
    maxRepeats,
    minGapDays,
    minGapMainDays,
    slotsFilled: days.length * slots.length,
    totalDistinct: new Set(days.flatMap(day => day.meals.map(meal => meal.dish.slug))).size
  };
}

// ---------------------------------------------------------------------------
// Measuring one profile the way production plans it (`--rotate`, 019 phase 1)
// ---------------------------------------------------------------------------

/**
 * What one rotation offers at lunch and dinner before the scheduler chooses
 * anything (`0010` § 4.2): dishes that are a serving of legume, how many kinds
 * of legume they are, and dishes that are a serving of fish. Read per serving.
 */
function rotationOffer(pool, catalogue) {
  const kinds = new Set();
  let legumeMains = 0;
  let fishMains = 0;

  for (const dish of pool.filter(candidate => candidate.slots.some(slot => MAIN_SLOTS.has(slot)))) {
    const servings = dish.servings > 0 ? dish.servings : 1;
    const served = mealServings(
      mealGroups(
        dish.ingredients.map(item => ({ grams: item.grams / servings, slug: item.slug })),
        catalogue
      )
    );

    if (served.legume) {
      legumeMains += 1;
      kinds.add(legumeKind(dish) ?? 'otra');
    }

    fishMains += served.fish ? 1 : 0;
  }

  return { fishMains, legumeKinds: kinds.size, legumeMains };
}

/**
 * One profile over `options.rotate` seeds, each a fortnight planned as
 * `PlanGeneration.service.ts` plans it with no model: the person's rotation
 * (`reusablePool` with a `Rotation`), then the same rescues in the same order
 * — the whole library when the pool cannot fill the plan, or when the plan is
 * blocked; the uncapped rotation (`wider_rotation`) when a day misses a band
 * and that plan misses by less (`planBandMiss`). A synthetic person has no
 * history, dislikes or chosen kitchens, so only the foods their way of eating
 * leans towards (`leaningSlugs`) lean the pick, as they do in production.
 */
async function measureRotations(profile, shared, options) {
  const { context, note } = contextFor(profile, shared);

  if (!context) {
    return { measured: false, note, slug: profile.slug };
  }

  const inputs = planInputs(profile, context, options);

  if (!inputs.targets) {
    return { measured: false, note: inputs.note, slug: profile.slug };
  }

  const { accompaniments, dayTargets, monthOf, slots, targets, weights } = inputs;
  // The person's whole filtered library: the full-library rescue, the tail of the
  // uncapped rotation, and what decides which rules apply to them.
  const everything = await RecipeController.reusablePool(slots, context);
  const supply = balanceSupply(everything, context.catalogue);
  const inputFor = pool => ({
    accompaniments,
    catalogue: context.catalogue,
    dayTargets,
    minimumKcal: minimumDailyKcal(profile.target.sex),
    monthOf,
    pool,
    targets,
    weights
  });
  const schedule = pool => schedulePlan(inputFor(pool));
  const check = assignment =>
    validatePlan({
      assignment,
      dayTargets,
      expectedDays: PLAN_DAYS,
      expectedSlots: slots,
      sex: profile.target.sex,
      targets,
      weightKg: profile.target.weightKg
    });
  const plans = [];

  for (let seed = 1; seed <= options.rotate; seed += 1) {
    const rotation = {
      avoidSlugs: new Set(),
      preferCuisines: new Set(),
      preferIngredientSlugs: leaningSlugs(context.preferences),
      preferSlugs: new Set(),
      seed: `${profile.slug}:${seed}`
    };
    // eslint-disable-next-line no-await-in-loop -- one read per seed, inside the run's one read-only transaction.
    const reusable = await RecipeController.reusablePool(slots, context, rotation);
    const started = performance.now();
    let scheduled = schedule(reusable);
    let fallback = null;
    let usedPool = reusable;

    if (!scheduled.ok) {
      scheduled = schedule(everything);
      fallback = 'full_library';
      usedPool = everything;
    }

    if (!scheduled.ok) {
      plans.push({ measured: false, seed, shortfall: scheduled.shortfall });
      continue;
    }

    let violations = check(scheduled.assignment);

    if (violations.some(isBlocking) && fallback === null) {
      const retried = schedule(everything);

      if (retried.ok && !check(retried.assignment).some(isBlocking)) {
        scheduled = retried;
        violations = check(retried.assignment);
        fallback = 'full_library';
        usedPool = everything;
      }
    }

    const missedBand = fallback === null && planBandMiss(violations) > 0;

    if (missedBand) {
      const rest = rotatePool(everything, slots, rotation, Number.POSITIVE_INFINITY);
      const wider = [...new Map([...reusable, ...rest].map(dish => [dish.slug, dish])).values()];
      const retried = schedule(wider);

      if (retried.ok) {
        const retriedViolations = check(retried.assignment);

        if (!retriedViolations.some(isBlocking) && planBandMiss(retriedViolations) < planBandMiss(violations)) {
          scheduled = retried;
          violations = retriedViolations;
          fallback = 'wider_rotation';
          usedPool = wider;
        }
      }
    }

    const scheduleMs = Math.round(performance.now() - started);
    const daysOutside = new Set(violations.filter(violation => BAND_KINDS.has(violation.kind)).map(violation => violation.dayIndex));
    // After the clock stopped: which exceptions to the table the bands needed (019 phase 4).
    const exceptions = options.exceptions ? bandNeededExceptions(inputFor(usedPool), scheduled.assignment) : undefined;

    plans.push({
      exceptions,
      balance: balanceOf({ catalogue: context.catalogue, days: scheduled.assignment.days, plantBased: isPlantBased(profile), supply }),
      blocking: violations.filter(isBlocking).length,
      daysInsideAll4: PLAN_DAYS - daysOutside.size,
      fallback,
      measured: true,
      missedBand,
      offer: rotationOffer(reusable, context.catalogue),
      poolSize: reusable.length,
      proteinPerKg: proteinPerKgBySlot(scheduled.assignment.days, profile.target.weightKg),
      scheduleMs,
      seed,
      unsafe: unsafeMeals(scheduled.assignment.days, context)
    });
  }

  return { goal: profile.target.goal, measured: plans.every(plan => plan.measured), note, plans, slug: profile.slug, supply };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length === 0 ? null : sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Lowest / median / highest of a figure over a profile's measured plans. */
function spread(plans, read) {
  const values = plans.map(read);

  return values.length === 0 ? null : { max: Math.max(...values), median: median(values), min: Math.min(...values) };
}

/**
 * A rotate run summed up: per profile, the spread of the figures report `0010`
 * § 4.2 tabulates; per rule, the plans it applied to and held on; per goal,
 * the mean of its profiles' median scores.
 */
function summariseRotations(results) {
  const profiles = results.map(result => {
    const plans = (result.plans ?? []).filter(plan => plan.measured);

    return {
      days: spread(plans, plan => plan.daysInsideAll4),
      fallbacks: Object.fromEntries(['full_library', 'wider_rotation'].map(kind => [kind, plans.filter(plan => plan.fallback === kind).length])),
      fish: spread(plans, plan => plan.balance.counts.fish),
      goal: result.goal,
      legumes: spread(plans, plan => plan.balance.counts.legumes),
      missedBand: plans.filter(plan => plan.missedBand).length,
      offerLegumeKinds: spread(plans, plan => plan.offer.legumeKinds),
      offerLegumeMains: spread(plans, plan => plan.offer.legumeMains),
      plans: plans.length,
      processed: spread(plans, plan => plan.balance.counts.processed),
      score: spread(plans, plan => plan.balance.score),
      slug: result.slug
    };
  });
  const allPlans = results.flatMap(result => (result.plans ?? []).filter(plan => plan.measured));
  const rules = Object.fromEntries(
    BALANCE_RULES.map(rule => {
      const applying = allPlans.filter(plan => plan.balance.rules[rule].applies);

      return [rule, { applies: applying.length, met: applying.filter(plan => plan.balance.rules[rule].met).length }];
    })
  );
  const goals = {};

  for (const profile of profiles.filter(entry => entry.score)) {
    (goals[profile.goal] ??= []).push(profile.score.median);
  }

  // Exceptions to the table (`--exceptions`): per group, plans broken, meals broken, meals the bands needed.
  const exceptions = { maximums: {}, minimums: {} };

  for (const plan of allPlans.filter(entry => entry.exceptions)) {
    for (const kind of ['maximums', 'minimums']) {
      for (const [group, { count, needed }] of Object.entries(plan.exceptions[kind])) {
        const total = (exceptions[kind][group] ??= { count: 0, needed: 0, plans: 0 });

        total.count += count;
        total.needed += needed;
        total.plans += 1;
      }
    }
  }

  return {
    days: { inside: allPlans.reduce((sum, plan) => sum + plan.daysInsideAll4, 0), of: allPlans.length * PLAN_DAYS },
    exceptions: allPlans.some(plan => plan.exceptions) ? exceptions : null,
    scheduleMs: allPlans.reduce((sum, plan) => sum + plan.scheduleMs, 0),
    goals: Object.fromEntries(
      Object.entries(goals).map(([goal, scores]) => [
        goal,
        { meanOfMedians: scores.reduce((sum, value) => sum + value, 0) / scores.length, profiles: scores.length }
      ])
    ),
    plans: allPlans.length,
    profiles,
    rules,
    unsafe: allPlans.reduce((sum, plan) => sum + plan.unsafe.length, 0)
  };
}

function printRotations(results, summary) {
  const range = value => (value ? `${round1(value.min)} / ${round1(value.median)} / ${round1(value.max)}` : 'n/a');

  for (const result of results) {
    const profile = summary.profiles.find(entry => entry.slug === result.slug);

    console.log(`\n${result.slug} (${result.goal ?? 'n/a'})${result.note ? ` — note: ${result.note}` : ''}`);

    if (!profile || profile.plans === 0) {
      console.log('  COULD NOT MEASURE');
      continue;
    }

    const unmeasured = (result.plans ?? []).filter(plan => !plan.measured);

    console.log(
      `  plans ${profile.plans}${unmeasured.length > 0 ? ` (could not measure seeds ${unmeasured.map(plan => plan.seed).join(', ')})` : ''}; days in band ${range(profile.days)};` +
        ` band missed on the rotation ${profile.missedBand}, rescued by wider_rotation ${profile.fallbacks.wider_rotation}, full_library ${profile.fallbacks.full_library}`
    );
    console.log(
      `  min / median / max — legumes ${range(profile.legumes)}, fish ${range(profile.fish)}, processed ${range(profile.processed)}, score ${range(profile.score)}`
    );
    console.log(
      `  rotation offer at lunch and dinner — legume dishes ${range(profile.offerLegumeMains)}, of kinds ${range(profile.offerLegumeKinds)}`
    );
    console.log(
      `  applies: ${Object.entries(result.supply ?? {})
        .map(([group, has]) => `${group} ${has ? 'yes' : 'no'}`)
        .join(', ')}`
    );
  }

  console.log('\nRules held (plans where the rule applies):');

  for (const [rule, { applies, met }] of Object.entries(summary.rules)) {
    console.log(`  ${rule.padEnd(17)} ${met}/${applies}${applies > 0 ? ` (${Math.round((met / applies) * 100)}%)` : ''}`);
  }

  if (summary.exceptions) {
    console.log('\nExceptions to the table (plans / meals past a maximum or short of a minimum / of those, the bands needed):');

    for (const kind of ['maximums', 'minimums']) {
      for (const [group, { count, needed, plans }] of Object.entries(summary.exceptions[kind])) {
        console.log(`  ${kind === 'maximums' ? 'max' : 'min'} ${group.padEnd(17)} ${plans} plans, ${count} meals, ${needed} needed by the bands`);
      }
    }
  }

  console.log(`\nTime in schedulePlan, all plans: ${summary.scheduleMs} ms`);
  console.log("\nScore by goal (mean of the profiles' median scores):");

  for (const [goal, { meanOfMedians, profiles }] of Object.entries(summary.goals)) {
    console.log(`  ${goal.padEnd(15)} ${Math.round(meanOfMedians * 100)}% (${profiles} profile${profiles === 1 ? '' : 's'})`);
  }

  console.log(`\nDays inside 5% on all four macros: ${summary.days.inside} / ${summary.days.of}; plates with a declared allergen: ${summary.unsafe}`);
}

function round1(value) {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function pct(fraction) {
  return `${(fraction * 100).toFixed(1)}%`;
}

const DEVIATION_LABELS = { carbsG: 'carbs', fatG: 'fat', kcal: 'kcal', proteinG: 'protein' };

function formatDeviations(deviations) {
  return Object.entries(deviations)
    .map(([key, { meanAbs, meanSigned }]) => `${DEVIATION_LABELS[key]} ${meanSigned >= 0 ? '+' : ''}${pct(meanSigned)} / ${pct(meanAbs)}`)
    .join(', ');
}

/** The mean of every macro's `meanAbs`, in one number — what "overall" means in `verdict`. */
function overallMeanAbs(deviations) {
  const values = Object.values(deviations).map(entry => entry.meanAbs);

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Each plate's energy over its slot's share of that day's target — the measure
 * `PLATE_LIMIT` bounds (`0076`), from the same `weightsFor` the scheduler sized
 * with and each day's own target, a loaded one included.
 */
function plateShares(days, dayTargets, targets, weights) {
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0) || 1;
  const shares = [];

  for (const day of days) {
    const kcal = (dayTargets.get(day.dayIndex) ?? targets).kcal;

    for (const meal of day.meals) {
      const budget = (kcal * (weights.get(meal.slot) ?? 0)) / total;

      if (budget > 0) {
        shares.push(meal.macros.kcal / budget);
      }
    }
  }

  const round = value => Math.round(value * 100) / 100;

  return {
    max: shares.length > 0 ? round(Math.max(...shares)) : null,
    min: shares.length > 0 ? round(Math.min(...shares)) : null,
    outsideLimit: shares.filter(share => share < PLATE_LIMIT.min || share > PLATE_LIMIT.max).length,
    plates: shares.length
  };
}

/**
 * What every plate weighs — the sum of its ingredients' grams, cooked, as the
 * scheduler sizes them — against `plateGramsMax` for its slot and that day's
 * share (`0078`, scaled for a big main meal by 016): the heaviest plate, the
 * mean and the heaviest per slot, and how many are over their ceiling. A meal
 * is one plate until accompaniments land (016 phase 2), so this is also what a
 * meal weighs.
 */
function plateGrams(days, dayTargets, targets, weights) {
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0) || 1;
  const bySlot = new Map();
  let max = null;
  let overCeiling = 0;
  let plates = 0;

  for (const day of days) {
    const kcal = (dayTargets.get(day.dayIndex) ?? targets).kcal;

    for (const meal of day.meals) {
      const budgetKcal = (kcal * (weights.get(meal.slot) ?? 0)) / total;
      // The plate alone: what the ceiling bounds. The meal, accompaniments included, beside it.
      const grams = plateItems(meal).reduce((sum, item) => sum + item.grams, 0);
      const mealGrams = meal.ingredients.reduce((sum, item) => sum + item.grams, 0);
      const ceiling = meal.accompaniments ? PLATE_GRAMS_MAX[meal.slot] : plateGramsMax(meal.slot, budgetKcal);
      const slot = bySlot.get(meal.slot) ?? { ceiling: 0, count: 0, max: 0, mealMax: 0, mealTotal: 0, total: 0 };

      bySlot.set(meal.slot, {
        ceiling: Math.max(slot.ceiling, ceiling),
        count: slot.count + 1,
        max: Math.max(slot.max, grams),
        mealMax: Math.max(slot.mealMax, mealGrams),
        mealTotal: slot.mealTotal + mealGrams,
        total: slot.total + grams
      });
      max = max === null ? grams : Math.max(max, grams);
      // A tenth of a gram per item is rounding, not weight.
      overCeiling += grams > ceiling + 0.5 ? 1 : 0;
      plates += 1;
    }
  }

  return {
    ceilingBySlot: Object.fromEntries([...bySlot].map(([slot, { ceiling }]) => [slot, Math.round(ceiling)])),
    max: max === null ? null : Math.round(max),
    maxBySlot: Object.fromEntries([...bySlot].map(([slot, entry]) => [slot, Math.round(entry.max)])),
    mealMaxBySlot: Object.fromEntries([...bySlot].map(([slot, entry]) => [slot, Math.round(entry.mealMax)])),
    mealMeanBySlot: Object.fromEntries([...bySlot].map(([slot, { count, mealTotal }]) => [slot, Math.round(mealTotal / count)])),
    meanBySlot: Object.fromEntries([...bySlot].map(([slot, { count, total }]) => [slot, Math.round(total / count)])),
    overCeiling,
    plates
  };
}

/** A meal's plate alone, without what is beside it: the scheduler puts the dish's scaled rows first. */
function plateItems(meal) {
  return meal.ingredients.slice(0, meal.dish.ingredients.length);
}

/** Of the plates of each kind, how many were served between 0.75 and 1.5 servings (`SERVING_PREFERENCE`, 016 phase 3). */
function servingsInBand(days) {
  const count = { all: { inside: 0, plates: 0 }, mains: { inside: 0, plates: 0 } };

  for (const day of days) {
    for (const meal of day.meals) {
      const inside = meal.servings >= SERVING_PREFERENCE.min && meal.servings <= SERVING_PREFERENCE.max ? 1 : 0;

      count.all.inside += inside;
      count.all.plates += 1;

      if (MAIN_SLOTS.has(meal.slot)) {
        count.mains.inside += inside;
        count.mains.plates += 1;
      }
    }
  }

  return count;
}

/**
 * Lunches and dinners by how many accompaniments they carry (0–3), the share
 * of the meal's energy those carry where there are any, which ones were
 * served most, and how many different ones the fortnight served (018 p3: the
 * variety a longer list is for). Null when the plan was made without accompaniments.
 */
function accompanimentMetrics(days) {
  const meals = days.flatMap(day => day.meals).filter(meal => MAIN_SLOTS.has(meal.slot));

  if (!meals.some(meal => meal.accompaniments)) {
    return null;
  }

  const byCount = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const shares = [];
  const keys = new Map();

  for (const meal of meals) {
    const list = meal.accompaniments ?? [];
    const kcal = list.reduce((sum, item) => sum + item.macros.kcal, 0);

    byCount[list.length] = (byCount[list.length] ?? 0) + 1;

    if (list.length > 0 && meal.macros.kcal > 0) {
      shares.push(kcal / meal.macros.kcal);
    }

    for (const item of list) {
      keys.set(item.key, (keys.get(item.key) ?? 0) + 1);
    }
  }

  const round = value => Math.round(value * 1000) / 1000;

  return {
    byCount,
    distinct: keys.size,
    kcalShareMax: shares.length > 0 ? round(Math.max(...shares)) : null,
    kcalShareMean: shares.length > 0 ? round(shares.reduce((sum, value) => sum + value, 0) / shares.length) : null,
    meals: meals.length,
    top: [...keys].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8)
  };
}

/** Meals that break a whole-dish rule of the person's way of eating (kosher: meat with dairy), over the whole meal. */
function dishRuleBreaks(days, context) {
  const breaks = [];

  for (const day of days) {
    for (const meal of day.meals) {
      if (breaksDishRule(meal.ingredients, context.catalogue, context.preferences)) {
        breaks.push({ dayIndex: day.dayIndex, dish: meal.dish.name, slot: meal.slot });
      }
    }
  }

  return breaks;
}

/**
 * A dinner is a meal (017 phase 3, owner's amendment of 2026-10-02): every
 * lunch and dinner filled by a dish that is a snack or a breakfast by its slots
 * (`isSnackOrBreakfastDish`), and every one of those past two servings — both
 * must be 0 — beside the largest plate served at a main meal, for the eye.
 */
function mainMealMetrics(days) {
  const light = [];
  let largest = null;

  for (const day of days) {
    for (const meal of day.meals) {
      if (!MAIN_SLOTS.has(meal.slot)) {
        continue;
      }

      if (isSnackOrBreakfastDish(meal.dish)) {
        light.push({ dayIndex: day.dayIndex, dish: meal.dish.name, servings: meal.servings, slot: meal.slot });
      }

      if (!largest || meal.servings > largest.servings) {
        largest = { dayIndex: day.dayIndex, dish: meal.dish.name, servings: meal.servings, slot: meal.slot };
      }
    }
  }

  return { largest, lightOverTwo: light.filter(item => item.servings > 2), lightPlates: light };
}

/**
 * How many plates of each slot were served at each size (project 016): the
 * question accompaniments answer is whether a big meal is one dish at three
 * servings, and a mean hides that.
 */
function servingsHistogram(days) {
  const bySlot = {};

  for (const day of days) {
    for (const meal of day.meals) {
      const sizes = (bySlot[meal.slot] ??= {});
      // Two decimals, so `1.00` is not an integer key an object would move ahead of `0.75`.
      const key = meal.servings.toFixed(2);

      sizes[key] = (sizes[key] ?? 0) + 1;
    }
  }

  return Object.fromEntries(
    Object.entries(bySlot).map(([slot, sizes]) => [slot, Object.fromEntries(Object.entries(sizes).sort(([a], [b]) => Number(a) - Number(b)))])
  );
}

/**
 * The foods `PLATE_FOOD_MAX` caps per plate (`0008` § D, 016 phase 5), as
 * served and recognised by core's own `plateFood`: meat, fish and shellfish,
 * cooked legumes, grains read dry, potato and sweet potato. Per group, the
 * heaviest plate, the mean over the plates that carry any of it, and how many
 * are over `plateFoodMax` for their slot and that day's share. Keyed as phases
 * 3 and 4 wrote them, so `--compare` reads across.
 */
const FOOD_GROUP_KEYS = { fish: 'fish', grain: 'grains', legume: 'legumes', meat: 'meat', potato: 'potato' };

function foodGroupGrams(days, catalogue, dayTargets, targets, weights) {
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0) || 1;
  const groups = Object.fromEntries(Object.values(FOOD_GROUP_KEYS).map(group => [group, []]));
  const over = Object.fromEntries(Object.values(FOOD_GROUP_KEYS).map(group => [group, 0]));

  for (const day of days) {
    const kcal = (dayTargets.get(day.dayIndex) ?? targets).kcal;

    for (const meal of day.meals) {
      const budgetKcal = (kcal * (weights.get(meal.slot) ?? 0)) / total;

      for (const [food, grams] of Object.entries(plateFoods(plateItems(meal), catalogue))) {
        const group = FOOD_GROUP_KEYS[food];

        over[group] += grams > plateFoodMax(food, meal.slot, budgetKcal) + 0.5 ? 1 : 0;
        groups[group].push(grams);
      }
    }
  }

  return Object.fromEntries(
    Object.entries(groups).map(([group, list]) => [
      group,
      {
        max: list.length > 0 ? Math.round(Math.max(...list)) : null,
        mean: list.length > 0 ? Math.round(list.reduce((sum, grams) => sum + grams, 0) / list.length) : null,
        over: over[group],
        plates: list.length
      }
    ])
  );
}

/**
 * What the library this run planned from is made of (project 017, decision
 * `0080`): the locale's recipes by source, by source and slot, and by slot and
 * cuisine family. A recipe offered at two slots counts at both. Read in the
 * run's own read-only transaction, so it describes exactly what was measured.
 */
async function libraryComposition(tx, locale) {
  const rows = await tx.execute(`select source, cuisine, meal_slots from recipes where locale = '${locale.replaceAll("'", "''")}'`);
  const bySource = {};
  const bySourceAndSlot = {};
  const bySlotAndFamily = {};

  for (const row of rows) {
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;

    const family = cuisineFamily(row.cuisine);

    for (const slot of row.meal_slots) {
      const slots = (bySourceAndSlot[row.source] ??= {});
      const families = (bySlotAndFamily[slot] ??= {});

      slots[slot] = (slots[slot] ?? 0) + 1;
      families[family] = (families[family] ?? 0) + 1;
    }
  }

  return { bySlotAndFamily, bySource, bySourceAndSlot, recipes: rows.length };
}

function printLibrary(library) {
  const list = counts =>
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => `${key} ${count}`)
      .join(', ');

  console.log(`Library: ${library.recipes} recipes (${list(library.bySource)})`);

  for (const [source, slots] of Object.entries(library.bySourceAndSlot).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${source} by slot: ${list(slots)}`);
  }

  for (const [slot, families] of Object.entries(library.bySlotAndFamily).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${slot} by family: ${list(families)}`);
  }
}

function printProfile(profile, result) {
  console.log(`\n${profile.slug} — ${profile.description}`);

  if (result.note) {
    console.log(`  note: ${result.note}`);
  }

  if (!result.measured) {
    console.log(
      `  COULD NOT MEASURE: ${result.shortfall ? `pool too small for ${result.shortfall.slot} on day ${result.shortfall.dayIndex} (available: ${result.shortfall.available})` : result.note}`
    );

    return;
  }

  console.log(`  pool: ${result.poolSize} dishes`);

  if (result.poolBySlot) {
    const thin = Object.entries(result.poolBySlot).filter(([, count]) => count < DISHES_NEEDED_PER_SLOT);

    console.log(
      `  servable per slot (need ${DISHES_NEEDED_PER_SLOT}): ${Object.entries(result.poolBySlot)
        .map(([slot, count]) => `${slot} ${count}`)
        .join(', ')}${thin.length > 0 ? ` — BELOW: ${thin.map(([slot]) => slot).join(', ')}` : ''}`
    );
    console.log(
      `  dinners by cuisine family: ${
        Object.entries(result.dinnersByFamily ?? {})
          .map(([family, count]) => `${family} ${count}`)
          .join(', ') || 'none'
      }`
    );
  }
  console.log(`  days inside 5% on all four macros: ${result.daysInsideAll4} / ${PLAN_DAYS}`);

  if (result.worst) {
    console.log(
      `  worst day: day ${result.worst.dayIndex}, ${result.worst.macro} — actual ${result.worst.actual.toFixed(0)} vs target ${result.worst.target.toFixed(0)} (${pct(result.worst.deviation)} off, tolerance ${pct(PLAN_TOLERANCE.kcal)})`
    );
  } else {
    console.log('  worst day: none — every day inside band');
  }

  for (const day of result.outOfBand ?? []) {
    console.log(
      `  out of band, day ${day.dayIndex}: ${day.misses.map(miss => `${miss.kind} ${miss.actual} vs ${miss.target}`).join('; ')} — ${day.meals
        .map(meal => `${meal.slot} "${meal.dish}" ×${meal.servings}${meal.sides.length > 0 ? ` + ${meal.sides.join(', ')}` : ''}`)
        .join('; ')}`
    );
  }

  console.log(`  deviation from target, signed mean / mean |dev|: ${formatDeviations(result.deviations)}`);

  const advisoryEntries = Object.entries(result.advisories);

  console.log(
    advisoryEntries.length > 0 ? `  advisories: ${advisoryEntries.map(([kind, count]) => `${kind} (${count})`).join(', ')}` : '  advisories: none'
  );

  const blockingEntries = Object.entries(result.blocking);

  if (blockingEntries.length > 0) {
    console.log(`  BLOCKING: ${blockingEntries.map(([kind, count]) => `${kind} (${count})`).join(', ')}`);

    for (const detail of result.blockingDetail.slice(0, 5)) {
      if (detail.kind === 'below_minimum_kcal') {
        console.log(`    day ${detail.dayIndex}: ${detail.actual.toFixed(0)} kcal, under the ${detail.minimum} floor`);
      } else if (detail.kind === 'protein_above_ceiling') {
        console.log(`    day ${detail.dayIndex}: ${detail.actual.toFixed(0)}g protein, over the ${detail.ceiling.toFixed(0)}g ceiling`);
      } else if (detail.kind === 'missing_slot') {
        console.log(`    day ${detail.dayIndex}: missing ${detail.slot}`);
      } else {
        console.log(`    ${detail.kind}${'dayIndex' in detail ? ` day ${detail.dayIndex}` : ''}`);
      }
    }
  }

  const variety = result.variety;
  const perSlot = Object.entries(variety.distinctPerSlot)
    .map(([slot, count]) => `${slot} ${count}`)
    .join(', ');

  console.log(`  distinct dishes: ${variety.totalDistinct} / ${variety.slotsFilled} slots (${perSlot})`);
  console.log(`  max repeats of one dish: ${variety.maxRepeats.count}${variety.maxRepeats.slug ? ` (${variety.maxRepeats.slug})` : ''}`);
  console.log(
    `  min gap between repeats: ${variety.minGapDays === null ? 'n/a — nothing repeated' : `${variety.minGapDays} day(s)`}` +
      ` (mains only: ${variety.minGapMainDays === null ? 'n/a' : `${variety.minGapMainDays} day(s)`})`
  );
  console.log(
    variety.identicalDayPairs.length > 0
      ? `  identical day pairs: ${variety.identicalDayPairs.length} (e.g. day ${variety.identicalDayPairs[0][0]} == day ${variety.identicalDayPairs[0][1]})`
      : '  identical day pairs: none'
  );

  console.log(result.varietyViolations.length > 0 ? `  variety violations: ${result.varietyViolations.length}` : '  variety violations: none');

  for (const violation of result.varietyViolations.slice(0, 10)) {
    console.log(
      `    day ${violation.dayIndex}${violation.slot ? ` ${violation.slot}` : ''}: ${violation.dishSlug ?? `matches day ${violation.matchesDayIndex}`} (${violation.kind})`
    );
  }

  if (result.plateShare) {
    const { max, min, outsideLimit, plates } = result.plateShare;

    console.log(
      `  plate share of its slot (limit ${PLATE_LIMIT.min}–${PLATE_LIMIT.max}): min ${min}, max ${max}, outside ${outsideLimit} / ${plates}`
    );
  }

  if (result.plateWeight) {
    const { ceilingBySlot, max, maxBySlot, meanBySlot, overCeiling, plates } = result.plateWeight;
    const means = Object.entries(meanBySlot)
      .map(
        ([slot, mean]) =>
          `${slot} ${mean} g, max ${maxBySlot?.[slot] ?? '?'} g (ceiling ${ceilingBySlot?.[slot] ?? PLATE_GRAMS_MAX[slot]}, flat ${PLATE_GRAMS_MAX[slot]})`
      )
      .join('; ');

    console.log(`  plate grams (0078, scaled by 016 unless accompaniments): max ${max} g; ${means}; over the ceiling ${overCeiling} / ${plates}`);

    if (result.plateWeight.mealMeanBySlot) {
      console.log(
        `  meal grams (plate and accompaniments): ${Object.entries(result.plateWeight.mealMeanBySlot)
          .map(([slot, mean]) => `${slot} ${mean} g, max ${result.plateWeight.mealMaxBySlot?.[slot] ?? '?'} g`)
          .join('; ')}`
      );
    }
  }

  if (result.servingsInBand) {
    const { all, mains } = result.servingsInBand;

    console.log(
      `  servings inside ${SERVING_PREFERENCE.min}–${SERVING_PREFERENCE.max}: lunch and dinner ${mains.inside} / ${mains.plates} (${pct(mains.inside / (mains.plates || 1))}), all plates ${all.inside} / ${all.plates} (${pct(all.inside / (all.plates || 1))})`
    );
  }

  if (result.accompanied) {
    const { byCount, distinct, kcalShareMax, kcalShareMean, meals, top } = result.accompanied;

    console.log(
      `  accompaniments on ${meals} lunches and dinners: ${Object.entries(byCount)
        .map(([count, n]) => `${count}: ${n} (${pct(n / (meals || 1))})`)
        .join(
          ', '
        )}; their kcal share mean ${kcalShareMean === null ? 'n/a' : pct(kcalShareMean)}, max ${kcalShareMax === null ? 'n/a' : pct(kcalShareMax)}`
    );
    console.log(`    most served: ${top.map(([key, n]) => `${key} ${n}`).join(', ') || 'none'}`);
    console.log(`    distinct accompaniments in the fortnight (018 p3): ${distinct}`);
  }

  if (result.dishRuleBreaks?.length > 0) {
    console.log(`  WHOLE-MEAL RULE BROKEN (meat with dairy) on ${result.dishRuleBreaks.length} meal(s)`);
  }

  if (result.servings) {
    const lines = Object.entries(result.servings).map(
      ([slot, sizes]) =>
        `${slot} ${Object.entries(sizes)
          .map(([size, count]) => `${size}×${count}`)
          .join(' ')}`
    );

    console.log(`  servings per slot (size×plates): ${lines.join('; ')}`);
  }

  if (result.foodGroups) {
    const groups = Object.entries(result.foodGroups)
      .map(([group, { max, mean, over, plates }]) =>
        plates > 0 ? `${group} mean ${mean} g, max ${max} g on ${plates}, over the ceiling ${over ?? '?'}` : `${group} none`
      )
      .join('; ');

    console.log(`  grams per food group per plate (grains dry): ${groups}`);
  }

  if (typeof result.ms === 'number') {
    console.log(`  time: ${result.ms} ms, of which scheduling ${result.scheduleMs} ms`);
  }

  const spanish = result.spanish;

  console.log(
    `  traditional Spanish (0077): ${spanish.forbiddenRows.length} excluded row(s), ${spanish.foreignCuisines.length} foreign cuisine(s), ${spanish.foreignNames.length} foreign name(s) on plates;` +
      ` lunches and dinners with legumes ${spanish.mainsWithLegumes}, with fish ${spanish.mainsWithFish}`
  );

  if (profile.dietaryPattern === 'traditional_spanish') {
    for (const item of [...spanish.forbiddenRows, ...spanish.foreignCuisines, ...spanish.foreignNames].slice(0, 10)) {
      console.log(
        `    FOREIGN day ${item.dayIndex} ${item.slot}: "${item.dish}"${item.slug ? ` holds ${item.slug}` : ''}${item.cuisine ? ` (${item.cuisine})` : ''}`
      );
    }
  }

  if (result.starch) {
    const { cap, consecutive, dinnerPastaOrRice, mains, total } = result.starch;

    console.log(
      `  starch base (016 p7), lunches and dinners: ${Object.entries(mains)
        .sort((a, b) => b[1] - a[1])
        .map(([base, count]) => `${base} ${count}`)
        .join(', ')}; all meals ${Object.entries(total)
        .map(([base, count]) => `${base} ${count}`)
        .join(
          ', '
        )} (cap ${cap} each); dinners with pasta or rice ${dinnerPastaOrRice}; days running ${consecutive.length}${consecutive.length > 0 ? ` (${consecutive.join(', ')})` : ''}`
    );

    const { byFamily = {}, dinnerPastaOrRiceOutsideAsian, gnocchi = [] } = result.starch;

    for (const slot of ['lunch', 'dinner']) {
      const families = Object.entries(byFamily[slot] ?? {}).sort((a, b) => a[0].localeCompare(b[0]));

      console.log(
        `  starch by family (017 p1), ${slot}: ${families
          .map(
            ([family, bases]) =>
              `${family} [${Object.entries(bases)
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .map(([base, count]) => `${base} ${count}`)
                .join(', ')}]`
          )
          .join('; ')}`
      );
    }

    console.log(`  dinners with pasta or rice outside the Asian family: ${dinnerPastaOrRiceOutsideAsian}`);

    const { outsideTable2 = [] } = result.starch;

    console.log(
      `  pasta, rice or grains where 0079 Table 2 refuses them (017 p2, must be 0): ${outsideTable2.length}${outsideTable2.length > 0 ? ` (${outsideTable2.map(item => `day ${item.dayIndex} ${item.slot}: "${item.dish}", ${item.family} ${item.group}`).join('; ')})` : ''}`
    );
    console.log(
      `  gnocchi: ${gnocchi.length}${gnocchi.length > 0 ? ` (${gnocchi.map(item => `day ${item.dayIndex} ${item.slot}: "${item.dish}", ${item.family}, read as ${item.base}`).join('; ')})` : ''}`
    );
  }

  if (result.kinds) {
    const { proteinMax, proteinMaxWeek, proteins } = result.kinds;

    console.log(
      `  main proteins at lunch and dinner (017 p2): ${Object.entries(proteins)
        .map(([kind, count]) => `${kind} ${count}`)
        .join(', ')}; most ${proteinMax ? `${proteinMax.kind} ${proteinMax.total}` : 'none'}, busiest week ${proteinMaxWeek}`
    );

    const { legumeRuns = [], legumes = {}, outOfSeason = [], snacks = {} } = result.kinds;

    console.log(
      `  snacks by kind (017 p2, 3 a fortnight each): ${
        Object.entries(snacks)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([kind, count]) => `${kind} ${count}`)
          .join(', ') || 'none'
      }`
    );

    console.log(
      `  plates with fresh fruit out of season that day (017 p2, must be 0): ${outOfSeason.length}${outOfSeason.length > 0 ? ` (${outOfSeason.map(item => `day ${item.dayIndex} ${item.slot}: "${item.dish}", ${item.fruit}`).join('; ')})` : ''}`
    );

    const { largest, lightOverTwo, lightPlates } = result.mainMeals;
    const listed = items =>
      items.length > 0 ? ` (${items.map(item => `day ${item.dayIndex} ${item.slot}: "${item.dish}" ×${item.servings}`).join('; ')})` : '';

    console.log(`  lunches and dinners filled by a snack or breakfast dish (017 p3, must be 0): ${lightPlates.length}${listed(lightPlates)}`);
    console.log(`  of those, past 2 servings (017 p3, must be 0): ${lightOverTwo.length}${listed(lightOverTwo)}`);
    console.log(
      `  largest plate at lunch or dinner: ${largest ? `×${largest.servings}, day ${largest.dayIndex} ${largest.slot}: "${largest.dish}"` : 'none'}`
    );

    console.log(
      `  legumes by kind, every meal (017 p2, 3 a fortnight each, never on days running): ${
        Object.entries(legumes)
          .map(([kind, count]) => `${kind} ${count}`)
          .join(', ') || 'none'
      }; days running ${legumeRuns.length}${legumeRuns.length > 0 ? ` (${legumeRuns.join(', ')})` : ''}`
    );
  }

  if (result.balance) {
    const missed = Object.entries(result.balance.rules)
      .filter(([, rule]) => rule.applies && !rule.met)
      .map(([name, rule]) => `${name} ${round1(rule.value)} (limit ${round1(rule.limit)})`);

    console.log(`  balance against PRD 019 (019 p1): score ${Math.round(result.balance.score * 100)}%; missed ${missed.join(', ') || 'none'}`);
    console.log(
      `  protein g/kg by meal, mean (lowest): ${Object.entries(result.proteinPerKg)
        .map(([slot, { mean, min }]) => `${slot} ${round1(mean)} (${round1(min)})`)
        .join(', ')}`
    );
  }

  if (result.unsafe.length > 0) {
    console.log(`  UNSAFE — declared allergen reached a plate (${result.unsafe.length}):`);

    for (const item of result.unsafe) {
      console.log(`    day ${item.dayIndex} ${item.slot}: "${item.dish}" contains "${item.ingredient}" (${item.kind})`);
    }
  } else {
    console.log('  unsafe dishes: none');
  }
}

function verdict(before, after) {
  if (!before.measured || !after.measured) {
    return `cannot compare — ${!before.measured ? 'before' : 'after'} was not measured`;
  }

  if (after.unsafe.length > before.unsafe.length) {
    return `WORSE — an allergen now reaches a plate that did not before (${before.unsafe.length} → ${after.unsafe.length})`;
  }

  const daysDelta = after.daysInsideAll4 - before.daysInsideAll4;
  const beforeWorst = before.worst?.deviation ?? 0;
  const afterWorst = after.worst?.deviation ?? 0;
  const worstDelta = afterWorst - beforeWorst;

  if (daysDelta === 0 && worstDelta === 0) {
    return 'the same';
  }

  if (daysDelta >= 0 && worstDelta <= 0 && (daysDelta > 0 || worstDelta < 0)) {
    return `better — days inside 5% ${before.daysInsideAll4} → ${after.daysInsideAll4}, worst deviation ${pct(beforeWorst)} → ${pct(afterWorst)}`;
  }

  if (daysDelta <= 0 && worstDelta >= 0 && (daysDelta < 0 || worstDelta > 0)) {
    return `worse — days inside 5% ${before.daysInsideAll4} → ${after.daysInsideAll4}, worst deviation ${pct(beforeWorst)} → ${pct(afterWorst)}, for ${after.worst ? after.worst.macro : 'no single macro'}`;
  }

  return `mixed — days inside 5% ${before.daysInsideAll4} → ${after.daysInsideAll4}, worst deviation ${pct(beforeWorst)} → ${pct(afterWorst)} (${after.worst ? after.worst.macro : 'n/a'})`;
}

/**
 * The same idea as `verdict`, for how close to the centre of the band a day
 * lands rather than whether it is inside one at all — the question `verdict`
 * cannot answer once every day already is (owner, 2026-09-26).
 */
function deviationVerdict(before, after) {
  if (!before.measured || !after.measured || !before.deviations || !after.deviations) {
    return null;
  }

  const line = key => {
    const b = before.deviations[key];
    const a = after.deviations[key];

    return `${DEVIATION_LABELS[key]} mean |dev| ${pct(b.meanAbs)} → ${pct(a.meanAbs)} (signed ${b.meanSigned >= 0 ? '+' : ''}${pct(b.meanSigned)} → ${a.meanSigned >= 0 ? '+' : ''}${pct(a.meanSigned)})`;
  };

  const overallBefore = overallMeanAbs(before.deviations);
  const overallAfter = overallMeanAbs(after.deviations);

  return `deviation: overall mean |dev| ${pct(overallBefore)} → ${pct(overallAfter)}; ` + ['kcal', 'proteinG', 'carbsG', 'fatG'].map(line).join('; ');
}

/** The same idea as `verdict`, for how varied the plan is rather than how well it hits its macros. */
function varietyVerdict(before, after) {
  if (!before.measured || !after.measured || !before.variety || !after.variety) {
    return null;
  }

  const distinctDelta = after.variety.totalDistinct - before.variety.totalDistinct;
  const identicalDelta = after.variety.identicalDayPairs.length - before.variety.identicalDayPairs.length;

  if (distinctDelta === 0 && identicalDelta === 0) {
    return `variety unchanged — ${after.variety.totalDistinct} / ${after.variety.slotsFilled} distinct dishes, ${after.variety.identicalDayPairs.length} identical day pair(s)`;
  }

  return (
    `variety: distinct dishes ${before.variety.totalDistinct} → ${after.variety.totalDistinct} / ${after.variety.slotsFilled} slots, ` +
    `identical day pairs ${before.variety.identicalDayPairs.length} → ${after.variety.identicalDayPairs.length}, ` +
    `max repeats ${before.variety.maxRepeats.count} → ${after.variety.maxRepeats.count}`
  );
}

function printComparison(before, results) {
  console.log('\n--- comparison ---');

  for (const after of results) {
    const previous = before.find(entry => entry.slug === after.slug);

    if (!previous) {
      console.log(`${after.slug}: no matching profile in the comparison file`);
      continue;
    }

    console.log(`${after.slug}: ${verdict(previous, after)}`);

    const deviation = deviationVerdict(previous, after);

    if (deviation) {
      console.log(`  ${deviation}`);
    }

    const variety = varietyVerdict(previous, after);

    if (variety) {
      console.log(`  ${variety}`);
    }

    // Nor does a file written before 018 phase 3 count the distinct accompaniments.
    if (after.accompanied) {
      const before = previous.accompanied?.distinct;

      console.log(`  distinct accompaniments: ${before === undefined ? 'not measured before' : before} → ${after.accompanied.distinct}`);
    }

    // A file written before `0076` has no plate shares; say so rather than compare with nothing.
    if (after.plateShare) {
      console.log(
        previous.plateShare
          ? `  plate share: max ${previous.plateShare.max} → ${after.plateShare.max}, outside the limit ${previous.plateShare.outsideLimit} → ${after.plateShare.outsideLimit}`
          : `  plate share: max ${after.plateShare.max}, outside the limit ${after.plateShare.outsideLimit} (not measured before)`
      );
    }

    // Nor does a file written before `0078` have plate grams.
    if (after.plateWeight) {
      console.log(
        previous.plateWeight
          ? `  plate grams: max ${previous.plateWeight.max} → ${after.plateWeight.max} g, over the ceiling ${previous.plateWeight.overCeiling} → ${after.plateWeight.overCeiling}; mean ${Object.entries(
              after.plateWeight.meanBySlot
            )
              .map(([slot, mean]) => `${slot} ${previous.plateWeight.meanBySlot?.[slot] ?? '?'} → ${mean} g`)
              .join(', ')}`
          : `  plate grams: max ${after.plateWeight.max} g, over the ceiling ${after.plateWeight.overCeiling} (not measured before)`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
//
// Why one transaction, and why it is provable: every core repository method
// this script's call graph reaches — `RecipeRepository.loadCatalogue`,
// `.findReusable`; `SafetyRepository.findAllergies/.findCustomAllergens/
// .findIntolerances/.listAllergens`; `ProfileRepository.findByUserId/
// .findDietaryPatterns/.findFoodPreferences/.findPreferences`;
// `HealthRepository.findAll/.takesProteinSupplement` — is a bare `SELECT`
// (confirmed by reading each one; see the hand-back). None of them accepts a
// transaction handle, so a check-then-select in the caller cannot make them
// participate in one on its own.
//
// `database()` in `packages/database` is a lazily-created module-level
// singleton, and TypeScript's CommonJS output calls it as `(0, database_1
// .database)()` — a property read at call time, not a value captured at
// import time (confirmed by inspecting the built `dist`). So for the
// lifetime of one `db.transaction(fn, { accessMode: 'read only' })` block,
// reassigning the *exported* `database` function to always return the
// transaction's own session makes every repository call above run inside
// that one `BEGIN ... READ ONLY` — enforced by Postgres itself: a write
// statement inside errors, it does not silently apply. The one caveat: this
// relies on `require('database')` in this process resolving to the same
// cached module object `packages/core`'s compiled `dist` resolves to, which
// holds for a single pnpm workspace process and is what the hand-back's
// determinism check (running the whole script twice) also exercises.
// ---------------------------------------------------------------------------
/** A `--rotate` run's report, JSON and exit: its own, since `--compare` reads the plain run's shape. */
function finishRotations(options, library, results) {
  const summary = summariseRotations(results);

  console.log(`Mode: --rotate ${options.rotate} — production's rotation and rescues, without the model's fresh dishes`);
  printRotations(results, summary);

  if (options.json) {
    writeFileSync(
      options.json,
      JSON.stringify(
        {
          flags: options.flags,
          library,
          locale: options.locale,
          rotate: options.rotate,
          start: options.start,
          profiles: PROFILES.map(profile => ({ description: profile.description, slug: profile.slug })),
          summary,
          results
        },
        null,
        2
      )
    );
    console.log(`\nWritten to ${options.json}`);
  }

  if (summary.unsafe > 0) {
    console.error('\nEXIT 2 — a declared allergen reached a plate.');
    process.exit(2);
  }

  if (results.some(result => !result.measured)) {
    console.error('\nEXIT 1 — at least one profile or seed could not be measured.');
    process.exit(1);
  }

  console.log('\nEXIT 0 — every plan measured; no plate carried a declared allergen.');
  process.exit(0);
}

async function main() {
  assertNotProduction();

  const options = parseArgs(process.argv.slice(2));
  const require = createRequire(import.meta.url);
  const databaseModule = require('database');
  const originalDatabase = databaseModule.database;
  const pooled = originalDatabase();

  let library;
  let results;

  try {
    await pooled.transaction(
      async tx => {
        databaseModule.database = () => tx;

        try {
          const shared = await baseContext(options.locale);

          library = await libraryComposition(tx, options.locale);
          results = [];

          for (const profile of PROFILES.filter(entry => !options.only || entry.slug === options.only)) {
            // eslint-disable-next-line no-await-in-loop -- profiles are measured one at a
            // time inside a single transaction; concurrent reads would not change the
            // result, only make a failure harder to attribute to one profile.
            const started = performance.now();
            const result = options.rotate ? await measureRotations(profile, shared, options) : await measureProfile(profile, shared, options);

            results.push({ ...result, ms: Math.round(performance.now() - started) });
          }
        } finally {
          databaseModule.database = originalDatabase;
        }
      },
      { accessMode: 'read only' }
    );
  } finally {
    await databaseModule.closeDatabase();
  }

  console.log(`Locale: ${options.locale}`);
  console.log(`Flags: ${options.flags.length > 0 ? options.flags.join(', ') : 'none'}`);
  console.log(`Fortnight starts: ${options.start}`);
  console.log(`Profiles (fixed, reuse for the next run): ${PROFILES.map(profile => profile.slug).join(', ')}`);
  printLibrary(library);

  if (options.rotate) {
    finishRotations(options, library, results);
  }

  for (const profile of PROFILES.filter(entry => !options.only || entry.slug === options.only)) {
    printProfile(
      profile,
      results.find(result => result.slug === profile.slug)
    );
  }

  if (options.json) {
    writeFileSync(
      options.json,
      JSON.stringify(
        {
          flags: options.flags,
          library,
          locale: options.locale,
          start: options.start,
          profiles: PROFILES.map(profile => ({ description: profile.description, slug: profile.slug })),
          results
        },
        null,
        2
      )
    );
    console.log(`\nWritten to ${options.json}`);
  }

  if (options.compare) {
    const before = JSON.parse(readFileSync(options.compare, 'utf8'));

    printComparison(before.results, results);
  }

  const anyUnsafe = results.some(result => result.measured && result.unsafe.length > 0);
  const anyUnmeasured = results.some(result => !result.measured);

  if (anyUnsafe) {
    console.error('\nEXIT 2 — a declared allergen reached a plate. See "UNSAFE" above.');
    process.exit(2);
  }

  if (anyUnmeasured) {
    console.error('\nEXIT 1 — at least one profile could not be measured. See "COULD NOT MEASURE" above.');
    process.exit(1);
  }

  console.log('\nEXIT 0 — every profile measured; no plate carried a declared allergen.');
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
