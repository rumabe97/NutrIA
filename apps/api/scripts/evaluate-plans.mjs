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
 * Usage (from apps/api):
 *   node --env-file-if-exists=.env scripts/evaluate-plans.mjs [--locale es-ES] [--json out.json] [--compare before.json]
 *
 * Exit codes:
 *   0  every profile measured; no plate carried a declared allergen
 *   1  something could not be measured (a pool too small for a profile, a
 *      target set the equations reject) — never guessed at, always said
 *   2  a plate carried a declared allergen — a P0 on its own, checked last so it
 *      overrides a 1
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

import { assertNotProduction } from '../../../.claude/skills/local-probe/scripts/guard.mjs';

import { RecipeController } from 'core/controllers/Recipe';
import { SafetyController } from 'core/controllers/Safety';
import { DEFAULT_MEAL_SHAPE, shapeFor, slotsIn, weightsFor } from 'core/domain/MealShape';
import { loadedTargets } from 'core/domain/Event';
import { TargetsUnreachableError, minimumDailyKcal, nutritionTargets } from 'core/domain/Nutrition';
import { isBlocking, PLAN_TOLERANCE, validatePlan } from 'core/domain/PlanValidation';
import { freeFromExclusions, resolvePreferences } from 'core/domain/Preference';
import { PLAN_DAYS, schedulePlan } from 'core/domain/Scheduler';
import { bestEffortExclusions, dishSafety, resolveCustomAllergens, toSafetyProfile } from 'core/domain/Safety';
import { MAIN_SLOTS } from 'core/domain/Variety';

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
  }
];

const BAND_KINDS = new Set(['carbs_out_of_band', 'fat_out_of_band', 'kcal_out_of_band', 'protein_above_target', 'protein_below_target']);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const options = { compare: null, json: null, locale: 'es-ES' };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--locale') {
      options.locale = argv[(index += 1)];
    } else if (arg === '--json') {
      options.json = argv[(index += 1)];
    } else if (arg === '--compare') {
      options.compare = argv[(index += 1)];
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

  return { context: shared, note: null };
}

// ---------------------------------------------------------------------------
// Measuring one profile
// ---------------------------------------------------------------------------
async function measureProfile(profile, shared) {
  const { context, note } = contextFor(profile, shared);

  if (!context) {
    return { measured: false, note, slug: profile.slug };
  }

  let targets;

  try {
    targets = nutritionTargets(profile.target);
  } catch (error) {
    if (error instanceof TargetsUnreachableError) {
      return { measured: false, note: `targets unreachable: ${error.message}`, slug: profile.slug };
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

  const pool = await RecipeController.reusablePool(slots, context);

  const scheduled = schedulePlan({
    catalogue: context.catalogue,
    dayTargets,
    minimumKcal: minimumDailyKcal(profile.target.sex),
    pool,
    targets,
    weights
  });

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
  const unsafe = [];

  for (const day of scheduled.assignment.days) {
    for (const meal of day.meals) {
      const safety = dishSafety(meal.ingredients, context.catalogue, context.safety);

      if (safety.kind === 'unsafe') {
        for (const violation of safety.violations) {
          unsafe.push({ dayIndex: day.dayIndex, dish: meal.dish.name, ingredient: violation.ingredientName, kind: violation.kind, slot: meal.slot });
        }
      }
    }
  }

  // Every day's own signed deviation from its own target, whether inside the
  // band or not — `bandViolations` only exists for a day *outside* one, so a
  // library that already lands 14/14 inside band (this one, on every fixed
  // profile) would otherwise report nothing at all about how far from the
  // centre those days actually sit. A day loaded for an event is judged
  // against its own raised target, exactly as `validatePlan` judges it.
  const deviations = macroDeviations(scheduled.assignment.days, dayTargets, targets);

  const blockingViolations = violations.filter(isBlocking);
  const bandViolations = violations.filter(violation => BAND_KINDS.has(violation.kind));
  const varietyViolations = violations.filter(violation => violation.kind === 'variety');
  const otherAdvisories = violations.filter(violation => !isBlocking(violation) && violation.kind !== 'variety' && !BAND_KINDS.has(violation.kind));

  const daysOutside = new Set(bandViolations.map(violation => violation.dayIndex));
  const daysInsideAll4 = PLAN_DAYS - daysOutside.size;

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
    blocking: tally(blockingViolations),
    blockingDetail,
    daysInsideAll4,
    deviations,
    fallback: null,
    measured: true,
    note,
    poolSize: pool.length,
    slug: profile.slug,
    unsafe,
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
    worst
  };
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
  console.log(`  days inside 5% on all four macros: ${result.daysInsideAll4} / ${PLAN_DAYS}`);

  if (result.worst) {
    console.log(
      `  worst day: day ${result.worst.dayIndex}, ${result.worst.macro} — actual ${result.worst.actual.toFixed(0)} vs target ${result.worst.target.toFixed(0)} (${pct(result.worst.deviation)} off, tolerance ${pct(PLAN_TOLERANCE.kcal)})`
    );
  } else {
    console.log('  worst day: none — every day inside band');
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
async function main() {
  assertNotProduction();

  const options = parseArgs(process.argv.slice(2));
  const require = createRequire(import.meta.url);
  const databaseModule = require('database');
  const originalDatabase = databaseModule.database;
  const pooled = originalDatabase();

  let results;

  try {
    await pooled.transaction(
      async tx => {
        databaseModule.database = () => tx;

        try {
          const shared = await baseContext(options.locale);

          results = [];

          for (const profile of PROFILES) {
            // eslint-disable-next-line no-await-in-loop -- profiles are measured one at a
            // time inside a single transaction; concurrent reads would not change the
            // result, only make a failure harder to attribute to one profile.
            results.push(await measureProfile(profile, shared));
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
  console.log(`Profiles (fixed, reuse for the next run): ${PROFILES.map(profile => profile.slug).join(', ')}`);

  for (const profile of PROFILES) {
    printProfile(
      profile,
      results.find(result => result.slug === profile.slug)
    );
  }

  if (options.json) {
    writeFileSync(
      options.json,
      JSON.stringify(
        { locale: options.locale, profiles: PROFILES.map(profile => ({ description: profile.description, slug: profile.slug })), results },
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
