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
 *   NUTRIA_LOCAL_PG=1 node apps/api/scripts/evaluate-plans.mjs [--locale es-ES] [--json out.json] [--compare before.json] [--flag <name>]... [--without oven[,blender]] [--prefer air_fryer[,grill]] [--share N] [--start YYYY-MM-DD] [--only <profile>] [--rotate [seeds] [--exceptions]] [--pins N [--pin-slot <slot>] [--per-day N] [--pins-from kept.json]] [--pantry <larder|slugs> [--pantry-mode rank|filter|bucket] [--pantry-share N]]
 *
 * `--pantry <larder|slugs>` (project 022 phase 0) says what is already in the
 * house: the name of one of the hand-written larders (`LARDERS` — `despensa-15`,
 * `despensa-15-sin-condimentos`, `despensa-30`, `despensa-60`), or a
 * comma-separated list of catalogue slugs. It needs `--rotate`, because every
 * figure it adds is a figure about a fortnight somebody was actually served.
 *
 * `--pantry-mode` says what the pantry is allowed to do:
 *   `rank` (the default) keeps a share of each slot's cap for the dishes
 *     somebody would have to buy fewest items for — the shape the PRD proposes;
 *   `filter` keeps only the dishes the pantry covers whole, which is the shape
 *     `architecture/0012` refused at fourteen days. It is measured **here and
 *     nowhere else**, to confirm the refusal with this cohort's own numbers, and
 *     it is never a product mode;
 *   `bucket` puts the pantry's slugs through `preferIngredientSlugs` — the one
 *     bucket all four leanings share. That is the composition `0102` already
 *     priced the dilution of, and it is measured as the **rejected** one, so the
 *     rejection is a number and not a recollection.
 *
 * `--pantry-yields first|last` says which preference gives way first when a
 * plan built on both a cupboard and a preferred appliance misses a macro band
 * (`narrowerRungs`). It is the composition question criterion 3 turns on, so a
 * `--prefer` run's kitchen figures mean one thing under `first` and another
 * under `last`, and the run prints which one it was.
 *
 * `--pantry-share N` is the rank's quota per slot: 0 is no quota at all, and
 * `DISHES_NEEDED_PER_SLOT` (19) is the whole cap, which is a sort key with no
 * quota rather than a share. The rungs between are the composition the phase has
 * to choose: 5 is roughly what a preferred appliance leaves of a slot, 14 is the
 * appliance's own share.
 *
 * The figures a pantry run adds — the fortnight's shopping rows, the rows the
 * pantry already covers, the plates and whole meals it reaches — are written on
 * **every** run, pantry or not, so a no-pantry baseline file carries them too and
 * the comparison is a measurement rather than a recollection.
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
 * `--per-day N` folds those rules onto fewer days — two rules both on the fifth
 * day rather than one each on the fifth and the third. The rule count is held
 * fixed on purpose: what is unknown is not what a rule costs but what *sharing a
 * day* costs, and a three-meal shape pinned twice has one meal left to reach
 * four macros with (`0045`).
 *
 * `--pins-from <kept.json>` replays the standing rules another run wrote instead of choosing
 * them again. It is **required** for any before-and-after over a library that changed: the
 * pick is a hash modulo the candidate count, so loading 280 dishes re-rolled all 28 rules and
 * the two runs measured different rules while reading like a comparison.
 *
 * `--pins N` (with `--rotate`) gives every profile N standing weekly fixed
 * meals — *"every Friday dinner is tortilla de patata"* — and reports what they
 * cost: how many day-slots served the dish the rule asks for, how many days that
 * carried a rule missed a band and at which slot, and how many fell under the
 * energy floor. A weekly rule lands on two days of every fourteen, so N rules
 * constrain 2N days of every plan, for ever. `--pin-slot <slot>` forces every
 * rule onto one slot, which is how the question "does a fixed lunch cost more
 * than a fixed breakfast" is asked. The rules are written in `pinsFor`, which
 * explains the three things that would otherwise measure something else.
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
import { BALANCE_RULES, balanceOf, balanceSupply, mealGroups, mealServings, proteinPerKgBySlot, reserveGroups } from 'core/domain/Balance';
import { larderFor } from 'core/domain/Accompaniment';
import { APPLIANCES } from 'core/entities/Kitchen';
import { SafetyController } from 'core/controllers/Safety';
import { cuisineFamily, dishGroups, groupFits, isSnackOrBreakfastDish, outOfSeasonFruit } from 'core/domain/MealFit';
import { DEFAULT_MEAL_SHAPE, proteinWeightsFor, shapeFor, slotsIn, weightsFor } from 'core/domain/MealShape';
import { loadedTargets } from 'core/domain/Event';
import { MEAL_SLOTS } from 'core/entities/Plan';
import { TargetsUnreachableError, minimumDailyKcal, nutritionTargets } from 'core/domain/Nutrition';
import { isBlocking, PLAN_TOLERANCE, planBandMiss, validatePlan } from 'core/domain/PlanValidation';
import { buildShoppingList } from 'core/domain/ShoppingList';
import {
  breaksDishRule,
  breaksPatternDish,
  freeFromExclusions,
  isForeignCuisine,
  isLegumeSlug,
  leaningSlugs,
  PATTERN_EXCLUDED_SLUGS,
  preferredAppliances,
  resolvePreferences
} from 'core/domain/Preference';
import {
  bandNeededExceptions,
  pinnable,
  PLAN_DAYS,
  PLATE_GRAMS_MAX,
  PLATE_LIMIT,
  plateGramsMax,
  schedulePlan,
  SERVING_PREFERENCE
} from 'core/domain/Scheduler';
import { bestEffortExclusions, dishSafety, normaliseForMatching, resolveCustomAllergens, toSafetyProfile } from 'core/domain/Safety';
import {
  DISHES_NEEDED_PER_SLOT,
  isCappedStarch,
  legumeKind,
  MAIN_SLOTS,
  mainProtein,
  narrowerShares,
  rotatePool,
  SNACK_KIND_SLOTS,
  snackKind,
  STARCH_RULES,
  starchBase,
  starchCap,
  withApplianceShare
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

// ---------------------------------------------------------------------------
// What is already in the house (project 022 phase 0)
//
// The larders are **hand-written**, and that is the whole point of them. The
// library's own top-K would flatter the feature: ordering the catalogue by how
// many dishes use an ingredient and taking the first fifteen builds a cupboard
// nobody has, whose coverage then says what the library is like rather than what
// a kitchen is like. These are four cupboards somebody could open, each one
// saying out loud what it assumes, so the next run can disagree with the
// assumption instead of with the number.
//
// Every slug is a real `ingredients.slug` of the `es-ES` catalogue, checked
// against the database before the run (`unknownPantrySlugs`) rather than trusted
// here: a typo would otherwise read as "the pantry covered nothing".
// ---------------------------------------------------------------------------

/**
 * Seasonings, fats and sweeteners — what a kitchen has whether anybody declared
 * it or not.
 *
 * Named, and reported separately, because of what they do to a coverage figure:
 * `sal` is in 883 of the 1,638 local recipes and `aceite-de-oliva-virgen-extra`
 * in 822, so **any** larder holding both makes "plates using a pantry item"
 * about 100% before the feature has done a single thing. A figure that cannot go
 * down is not a measurement. So every coverage figure below is reported twice —
 * over all of the pantry's items, and over the ones that are food somebody
 * actually walks a supermarket for — and the PRD's own split of a fortnight's
 * list ("99–115 rows, of which 73–88 are real food") is the same split.
 *
 * It is a **reporting** set and never a behaving one: the rank counts the items
 * somebody would have to buy, salt and oil included, because that is what the
 * shopping list counts.
 */
const PANTRY_STAPLES = new Set([
  'aceite-de-girasol',
  'aceite-de-oliva-virgen-extra',
  'aceite-de-sesamo',
  'ajo',
  'ajo-en-polvo',
  'albahaca-seca',
  'azucar-blanco',
  'azucar-moreno',
  'canela-molida',
  'comino-molido',
  'curcuma-molida',
  'curry-en-polvo',
  'harina-de-trigo',
  'laurel',
  'miel',
  'mostaza-de-dijon',
  'nuez-moscada',
  'oregano-seco',
  'pimenton-ahumado',
  'pimenton-dulce',
  'pimienta-negra',
  'romero-seco',
  'sal',
  'salsa-de-soja',
  'tomillo-seco',
  'vinagre-de-jerez'
]);

/**
 * The cupboards, at the three sizes `architecture/0012` § 4.1 measured and one
 * control.
 *
 * `assumes` is not decoration: it is the sentence the next run has to agree with
 * before it may reuse the number. A larder is wrong in a way a seed is not —
 * nobody can re-roll it — so what it takes for granted is written beside it.
 */
const LARDERS = {
  'despensa-15': {
    assumes:
      'A shared flat on a Wednesday: the cupboard and the fridge door, with nothing fresh planned. Salt, oil, pepper and garlic are simply there, the way a kitchen has its seasonings; the tin of tuna, the crushed tomato and the two cooked pulses are the week’s emergency dinners. No fresh vegetable but an onion and a potato, and no meat or fish that is not a tin.',
    items: [
      'sal',
      'aceite-de-oliva-virgen-extra',
      'pimienta-negra',
      'ajo',
      'cebolla',
      'patata',
      'arroz-bomba-crudo',
      'pasta-integral-seca',
      'huevo',
      'atun-al-natural',
      'tomate-triturado',
      'garbanzos-cocidos',
      'lentejas-cocidas',
      'pan-integral',
      'leche-semidesnatada'
    ]
  },
  'despensa-15-sin-condimentos': {
    assumes:
      'The control, and the only larder written to answer a question about another one: the 15-item cupboard with its four seasonings taken out and four foods somebody shops for put in. If the 15-item larder’s coverage survives here, the feature is steering on food; if it collapses, the feature was steering on salt and oil, which every kitchen has and nobody would type.',
    items: [
      'cebolla',
      'patata',
      'arroz-bomba-crudo',
      'pasta-integral-seca',
      'huevo',
      'atun-al-natural',
      'tomate-triturado',
      'garbanzos-cocidos',
      'lentejas-cocidas',
      'pan-integral',
      'leche-semidesnatada',
      'zanahoria',
      'pimiento-rojo',
      'limon',
      'yogur-griego-natural'
    ]
  },
  'despensa-30': {
    assumes:
      'A weekly shopper mid-week: the 15-item cupboard, the three spices that actually get used, and what is left of Saturday’s fresh shop — the vegetable drawer half full, one fresh protein, the yoghurt and the oats that are breakfast every day. It assumes somebody who cooks, which is the person this feature is for and also the person it flatters.',
    items: [
      'sal',
      'aceite-de-oliva-virgen-extra',
      'pimienta-negra',
      'ajo',
      'cebolla',
      'patata',
      'arroz-bomba-crudo',
      'pasta-integral-seca',
      'huevo',
      'atun-al-natural',
      'tomate-triturado',
      'garbanzos-cocidos',
      'lentejas-cocidas',
      'pan-integral',
      'leche-semidesnatada',
      'zanahoria',
      'pimiento-rojo',
      'calabacin',
      'tomate',
      'limon',
      'espinaca',
      'platano',
      'manzana',
      'pechuga-de-pollo',
      'yogur-griego-natural',
      'copos-de-avena',
      'queso-rallado',
      'pimenton-dulce',
      'oregano-seco',
      'laurel'
    ]
  },
  'despensa-60': {
    assumes:
      'The day after the big monthly shop, and the top of what `architecture/0012` § 4.1 measured: a full spice rack, four proteins, the freezer stocked, fruit and nuts for the fortnight. It is the best case on purpose — nobody types sixty things — so what it measures is the ceiling the PRD promises ("about one row in two at sixty") and not a typical cupboard.',
    items: [
      'sal',
      'aceite-de-oliva-virgen-extra',
      'pimienta-negra',
      'ajo',
      'cebolla',
      'patata',
      'arroz-bomba-crudo',
      'pasta-integral-seca',
      'huevo',
      'atun-al-natural',
      'tomate-triturado',
      'garbanzos-cocidos',
      'lentejas-cocidas',
      'pan-integral',
      'leche-semidesnatada',
      'zanahoria',
      'pimiento-rojo',
      'calabacin',
      'tomate',
      'limon',
      'espinaca',
      'platano',
      'manzana',
      'pechuga-de-pollo',
      'yogur-griego-natural',
      'copos-de-avena',
      'queso-rallado',
      'pimenton-dulce',
      'oregano-seco',
      'laurel',
      'brocoli',
      'coliflor',
      'puerro',
      'berenjena',
      'pepino',
      'cebolla-morada',
      'tomate-cherry',
      'boniato',
      'calabaza',
      'judia-verde',
      'aguacate',
      'kiwi',
      'salmon',
      'merluza',
      'lomo-de-cerdo',
      'pechuga-de-pavo',
      'tofu-firme',
      'alubias-blancas-cocidas',
      'arroz-integral-crudo',
      'quinoa-cruda',
      'nueces',
      'almendras',
      'mantequilla-de-cacahuete',
      'semillas-de-chia',
      'pan-de-centeno',
      'requeson',
      'miel',
      'canela-molida',
      'pimenton-ahumado',
      'comino-molido'
    ]
  }
};

/** What `--pantry-mode` accepts, and what each one is for: see the header. */
const PANTRY_MODES = new Set(['bucket', 'filter', 'rank']);

/**
 * The rungs a plan that missed a macro band walks down, widest first, when a
 * cupboard holds a share of the slots as well as an appliance (PRD criterion 4).
 *
 * `narrowerShares` is the appliance's own ladder and the reason this one exists:
 * the bands outrank every preference (`0045` before `0102`), and the rescue that
 * honours that replaces the pool with the whole library — which costs the person
 * the rotation's variety, its avoid list, its food-group reserves, the appliance
 * **and** the cupboard, all at once. A quota with no rung is therefore a cliff,
 * and `0102` already paid for finding that out once.
 *
 * **Which of the two yields first is the composition, and it is measured rather
 * than assumed** (`--pantry-yields`). `first` gives the cupboard up entirely
 * before the appliance gives up anything, on the reading that an appliance is a
 * standing preference shaping every fortnight somebody will ever get while a
 * cupboard is one fortnight's, so `0102`'s rule — give up what costs the person
 * least, first — points at the cupboard. `last` is the same ladder read the
 * other way, and it exists because that reading is arguable: the cupboard is the
 * more specific and more recent ask, and a person who has just typed what is in
 * the house may well mind losing it more. Criterion 3's figures mean different
 * things under the two orders, so a run says which one produced them.
 */
function narrowerRungs(rotation, pantryShare, yields) {
  const appliance = narrowerShares(rotation);
  const pantry = pantryShare <= 0 ? [] : [...new Set([Math.floor(pantryShare / 2), 0])].filter(rung => rung < pantryShare);

  // `null` on either side of a rung means "that one keeps the share it had": a
  // rung gives up one preference and leaves the other exactly as it was, so the
  // order of the two groups below is the whole of what separates the two
  // compositions. The second group is walked with the first already spent.
  if (yields === 'last') {
    return [
      ...appliance.map(rung => ({ appliance: rung, pantry: null })),
      ...pantry.map(rung => ({ appliance: appliance.length > 0 ? 0 : null, pantry: rung }))
    ];
  }

  return [
    ...pantry.map(rung => ({ appliance: null, pantry: rung })),
    ...appliance.map(rung => ({ appliance: rung, pantry: pantry.length > 0 ? 0 : null }))
  ];
}

/**
 * The slugs this pantry names that the catalogue does not hold.
 *
 * Checked against the real catalogue inside the run's transaction and never in
 * `parseArgs`, because the catalogue is not loaded until then: a typo validated
 * against nothing would read as "the pantry covered nothing", which is the one
 * failure that looks exactly like a result.
 */
function unknownPantrySlugs(pantry, catalogue) {
  return pantry.items.filter(slug => !catalogue.has(slug));
}

/**
 * A fortnight's shopping list, and how much of it the cupboard already holds.
 *
 * Built with `buildShoppingList` — the function `PlanGeneration.service.ts`
 * builds the stored list with — so a row counted here is a row somebody reads,
 * cooked grains merged onto their dry row and all (`0078`). Dated the way
 * `withDates` dates it, because `0091` keys each row's per-day breakdown by the
 * day's own date: an undated day is still summed into the total but filed under
 * a key no range filter can choose, which is harmless for a count and wrong for
 * anything else.
 *
 * `rows` is the whole list; `foodRows` leaves out the seasonings and fats of
 * `PANTRY_STAPLES`, which is the PRD's own split of a list into 99–115 rows of
 * which 73–88 are real food. `covered` is the rows a pantry would hand back
 * already bought — the shop's shortening, and the only honest reading of "fewer
 * things to buy".
 */
function shoppingMetrics(assignment, catalogue, startDay, pantry) {
  const start = new Date(`${startDay}T12:00:00Z`);
  const dated = {
    days: assignment.days.map(day => ({
      ...day,
      date: new Date(start.getTime() + (day.dayIndex - 1) * 86_400_000).toISOString().slice(0, 10)
    }))
  };
  const rows = buildShoppingList(dated, catalogue).items;
  const food = rows.filter(row => !PANTRY_STAPLES.has(row.slug));

  return {
    covered: rows.filter(row => pantry.has(row.slug)).length,
    coveredFood: food.filter(row => pantry.has(row.slug)).length,
    foodRows: food.length,
    rows: rows.length
  };
}

/**
 * What the cupboard reached on the plates: the figure the sentence after a
 * generation is read from (PRD § *Outcome* 4), and the one a pantry run has to
 * beat a no-pantry run on or the steering is a defect rather than a trade.
 *
 * Read off `meal.ingredients` — the plate as it is served, the accompaniment
 * included — and not off `meal.dish.ingredients`: a side is bought like
 * everything else, so a plate is only "what I already had" when the side was
 * too.
 *
 * Three figures, because only one of them is honest on its own: `plates` counts
 * a meal using **anything** from the pantry, which a larder holding salt and oil
 * makes nearly every meal; `foodPlates` counts a meal using something from it
 * that is not a seasoning; and `whole` counts a meal whose every item was
 * already in the house, which is the only one somebody would call *«una comida
 * con lo que ya tenía»*.
 */
function pantryPlateMetrics(days, pantry) {
  const meals = days.flatMap(day => day.meals);
  const uses = (meal, only) => meal.ingredients.some(item => pantry.has(item.slug) && !(only && PANTRY_STAPLES.has(item.slug)));

  return {
    foodPlates: meals.filter(meal => uses(meal, true)).length,
    meals: meals.length,
    plates: meals.filter(meal => uses(meal, false)).length,
    whole: meals.filter(meal => meal.ingredients.every(item => pantry.has(item.slug))).length
  };
}

/** How many of this dish's distinct ingredients somebody with this pantry would still have to buy. */
function missingItems(dish, pantry) {
  return new Set(dish.ingredients.map(item => item.slug).filter(slug => !pantry.has(slug))).size;
}

/** Whether the pantry covers every ingredient of this dish — the hard filter `architecture/0012` refused. */
function coveredWhole(dish, pantry) {
  return dish.ingredients.every(item => pantry.has(item.slug));
}

/**
 * The dishes of a slot kept for what is already in the house: the ones somebody
 * would have to buy fewest items for, in that order, as many as the quota
 * leaves.
 *
 * **A rank and never a boolean** (PRD § *Outcome* 3). A fifth reason in
 * `isPreferredDish` would be one more tenant of the single bucket all four
 * leanings share, and a 15-item larder puts most of the library in it — which is
 * the dilution `0102` measured and `APPLIANCE_DISHES_PER_SLOT` exists because
 * of. So this orders instead of partitioning, and it is handed to `rotatePool`
 * as part of its `reserve`, **after** what the food groups keep: a legume
 * minimum is what validation refuses a fortnight for and a pantry is not.
 *
 * It is the instrument's mirror of the shape phase 4 would implement in
 * `Rotation.ts`, not a parallel scheduler: everything else on the path —
 * the shuffle, the appliance share, the cap, the rescues — is the real code's.
 * Where it sits in the truncation order is the composition being measured, and
 * `quota` is the knob: 0 is no quota at all, and `DISHES_NEEDED_PER_SLOT` is the
 * whole of a slot's cap, which is a sort key with no quota rather than a share.
 */
function pantryReserve(inSlot, reserved, pantry, quota) {
  if (quota <= 0 || pantry.size === 0) {
    return [];
  }

  const already = new Set(reserved.map(dish => dish.slug));
  const wanted = quota - reserved.filter(dish => missingItems(dish, pantry) < dish.ingredients.length).length;

  if (wanted <= 0) {
    return [];
  }

  // A stable sort over the slot's **shuffled** order, so two dishes somebody
  // would buy the same number of things for are still picked by the seed and the
  // pick stays theirs. `Array.prototype.sort` is stable by specification.
  return inSlot
    .filter(dish => !already.has(dish.slug))
    .map(dish => ({ dish, missing: missingItems(dish, pantry) }))
    .sort((left, right) => left.missing - right.missing)
    .slice(0, wanted)
    .map(entry => entry.dish);
}

// ---------------------------------------------------------------------------
// Fixed recurring meals — the measurement that gates how many a tier may hold.
//
// *"Every Friday dinner is tortilla de patata."* A weekly rule lands on two days
// of every fourteen, so `--pins N` constrains 2N of a plan's 14 days, for ever,
// at every generation. What is being measured is what that costs: days still
// inside 5% on all four macros, and which slot the lost ones pinned.
//
// The rules below are written in the order people name their routines — a
// Friday dinner, a Sunday lunch, a midweek lunch, a weekday breakfast — because
// the first rule a tier allows should be the one a person actually writes, and
// a lunch pin costs more than a breakfast pin (a three-meal day carries about
// 40% of its energy at lunch by design).
// ---------------------------------------------------------------------------

/** The day of the fortnight each successive rule takes; its second landing is seven days later. */
const PIN_DAYS = [5, 7, 3, 1];

/** The slot each successive rule takes, when `--pin-slot` does not force one and the person eats it. */
const PIN_SLOTS = ['dinner', 'lunch', 'lunch', 'breakfast'];

/**
 * The slots a day's rules take when `--per-day` puts more than one on it, in
 * the order somebody writes them: *"los viernes como X y ceno Y"* is a lunch
 * and a dinner, and breakfast is the third thing anybody fixes.
 *
 * Distinct by construction — a meal can hold one rule — and filtered to the
 * slots the profile actually eats, so a three-meal shape pinned twice has one
 * meal left and pinned three times has none. That difference is the whole
 * measurement.
 */
const PIN_DAY_SLOTS = ['lunch', 'dinner', 'breakfast', 'afternoon_snack', 'morning_snack', 'supper'];

function pinHash(text) {
  let hash = 0;

  for (const character of text) {
    hash = (hash * 31 + character.codePointAt(0)) % 1_000_003;
  }

  return hash;
}

/**
 * The standing rules one profile is measured with: `options.pins` of them, each
 * on its own day, in a slot the person eats, holding a dish their own library
 * can serve there.
 *
 * Three things this gets right, and each of them would otherwise measure
 * something that is not the feature:
 *
 * - **The dish is chosen once, from the person's whole library** — not per seed
 *   and not from the seed's rotation. A rule stands until the person removes it,
 *   and `rotatePool` drops what was served last fortnight, so a dish chosen
 *   inside the rotation would vanish from later seeds and quietly measure plans
 *   with no rule in them.
 * - **It is a middling candidate, not the best fit.** `pinnable` has already
 *   kept only dishes that size into the slot; among those the pick is a hash of
 *   the rule, so the scheduler is not handed the dish it would have chosen
 *   anyway — which is the whole point of a person choosing instead.
 * - **Never the day's only slot** (`0036` allows a one-meal day): a profile that
 *   eats once a day writes no rules at all, and says so.
 */
function pinsFor(slots, everything, inputFor, options, profileSlug, solvable) {
  if (options.pins === 0) {
    return { map: new Map(), rules: [] };
  }

  if (slots.length < 2) {
    return { map: new Map(), note: 'one-meal day: a rule would pin the whole day', rules: [] };
  }

  const map = new Map();
  const rules = [];
  const perDay = options.perDay;

  // `--pins-from <run.json>`: the rules another run wrote, replayed verbatim. The pick is a
  // hash **modulo the candidate count**, so a library that grew re-rolls every rule — adding
  // 280 dishes changed all 28 of them, and the two runs then measure different standing rules
  // while reading like a before and an after. A profile the file does not name keeps its own.
  const replayed = options.pinsFrom?.get(profileSlug);

  if (replayed) {
    for (const rule of replayed) {
      rules.push(rule);

      if (rule.slug === null || rule.slug === undefined) {
        continue;
      }

      for (const landing of [rule.day, rule.day + 7]) {
        const held = map.get(landing) ?? new Map();

        held.set(rule.slot, { slot: rule.slot, slug: rule.slug });
        map.set(landing, held);
      }
    }

    return { map, rules, ...(perDay > 1 ? { perDay, wholeDays: [...map.values()].filter(day => day.size >= slots.length).length } : {}) };
  }

  // With `--per-day 1` this is the arrangement every earlier measurement used:
  // one rule a day, on PIN_DAYS in order. Above one, the same number of rules is
  // folded onto fewer days, which is the comparison — the cost of a rule is
  // known, the cost of *sharing a day* is not.
  const eaten = PIN_DAY_SLOTS.filter(slot => slots.includes(slot));

  for (let rule = 0; rule < options.pins; rule += 1) {
    const dayRule = rule % perDay;
    const day = PIN_DAYS[Math.floor(rule / perDay)];

    if (day === undefined) {
      rules.push({ rule, unwritable: `--pins ${options.pins} over --per-day ${perDay} needs more days than the fixture has` });
      continue;
    }

    const wanted = perDay > 1 ? eaten[dayRule] : (options.pinSlot ?? PIN_SLOTS[rule]);
    const slot = slots.includes(wanted) ? wanted : slots[rule % slots.length];

    if (perDay > 1 && wanted === undefined) {
      rules.push({ day, rule, unwritable: 'this profile eats fewer meals than this day has rules' });
      continue;
    }

    const candidates = [...pinnable(inputFor(everything, new Map()), day, slot)].sort((a, b) => a.slug.localeCompare(b.slug));

    if (candidates.length === 0) {
      rules.push({ day, slot, slug: null, unwritable: 'no dish of this library sizes into this slot' });
      continue;
    }

    // `--pin-no-starch`: the same rule, written over a dish that does not spend
    // the fortnight's four pasta-rice-grain mains (`STARCH_RULES`, `0081`). It
    // exists to tell two very different costs apart — what a fixed *meal* costs,
    // and what a fixed *starch* costs — because a Spanish main carries rice or
    // potato far more often than not, and the two are otherwise measured as one.
    const plain = candidates.filter(dish => !isCappedStarch(starchBase(dish)));
    const from = options.pinNoStarch && plain.length > 0 ? plain : candidates;
    const held = map.get(day);
    // `--pin-fit`: a rule sharing a day with one already written is chosen from
    // the dishes that leave that day solvable, rather than by the hash. It is
    // what a screen could offer, and the measurement that tells a bad *pair*
    // from a bad *idea*: if the hash's pair breaks the day and a chosen one does
    // not, the feature is an offer that knows what is already fixed.
    const fitting =
      options.pinFit && held && held.size > 0 && solvable
        ? from.filter(dish => solvable(new Map([[1, new Map([...held, [slot, { slot, slug: dish.slug }]])]])))
        : from;
    const pickFrom = fitting.length > 0 ? fitting : from;
    const chosen = pickFrom[pinHash(`${profileSlug}:${day}:${slot}`) % pickFrom.length];

    rules.push({ day, slot, slug: chosen.slug, ...(options.pinFit && held && held.size > 0 ? { fitting: fitting.length, of: from.length } : {}) });

    for (const landing of [day, day + 7]) {
      const held = map.get(landing) ?? new Map();

      held.set(slot, { slot, slug: chosen.slug });
      map.set(landing, held);
    }
  }

  return { map, rules, ...(perDay > 1 ? { perDay, wholeDays: [...map.values()].filter(day => day.size >= slots.length).length } : {}) };
}

/**
 * The pool a seed plans from, with the standing rules' dishes in it.
 *
 * A pinned dish is a forced candidate (`0097`), and a rotation that excluded it
 * — which `rotatePool` does to everything served last fortnight — would have the
 * scheduler refuse the rule for want of the dish rather than for want of room.
 */
function withPins(pool, pins, everything) {
  const missing = [...new Set([...pins.values()].flatMap(day => [...day.values()].map(pin => pin.slug)))].filter(
    slug => !pool.some(dish => dish.slug === slug)
  );

  return missing.length === 0 ? pool : [...pool, ...missing.flatMap(slug => everything.filter(dish => dish.slug === slug))];
}

/** What a finished plan did with its rules: kept, or refused that day and built without it. */
function pinOutcome(assignment, pins) {
  const refused = [];
  let honoured = 0;

  for (const [dayIndex, held] of pins) {
    for (const pin of held.values()) {
      const day = assignment.days.find(entry => entry.dayIndex === dayIndex);
      const meal = day?.meals.find(entry => entry.slot === pin.slot);

      if (meal?.dish.slug === pin.slug) {
        honoured += 1;
      } else {
        refused.push({ dayIndex, slot: pin.slot });
      }
    }
  }

  return { honoured, refused };
}

/** Gnocchi's catalogue row: counted on its own line until the starch rule knows it (project 017). */
const GNOCCHI_SLUG = 'noquis';

const BAND_KINDS = new Set(['carbs_out_of_band', 'fat_out_of_band', 'kcal_out_of_band', 'protein_above_target', 'protein_below_target']);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const options = {
    compare: null,
    exceptions: false,
    flags: [],
    json: null,
    locale: 'es-ES',
    only: null,
    pantry: null,
    pantryMode: 'rank',
    pantryShare: 5,
    pantryYields: 'first',
    perDay: 1,
    pinFit: false,
    pinsFrom: null,
    pinNoStarch: false,
    pinSlot: null,
    pins: 0,
    prefer: [],
    rotate: null,
    share: null,
    start: '2026-10-05',
    without: []
  };

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
    } else if (arg === '--pins') {
      const rules = Number(argv[(index += 1)]);

      if (!Number.isInteger(rules) || rules < 0 || rules > PIN_DAYS.length) {
        console.error(`--pins needs a whole number between 0 and ${PIN_DAYS.length}`);
        process.exit(2);
      }

      options.pins = rules;
    } else if (arg === '--per-day') {
      const held = Number(argv[(index += 1)]);

      if (!Number.isInteger(held) || held < 1 || held > PIN_DAY_SLOTS.length) {
        console.error(`--per-day needs a whole number between 1 and ${PIN_DAY_SLOTS.length}`);
        process.exit(2);
      }

      options.perDay = held;
    } else if (arg === '--pins-from') {
      options.pinsFrom = argv[(index += 1)];
    } else if (arg === '--pin-fit') {
      options.pinFit = true;
    } else if (arg === '--pin-no-starch') {
      options.pinNoStarch = true;
    } else if (arg === '--pin-slot') {
      const slot = argv[(index += 1)];

      if (!PINNABLE_SLOTS.has(slot)) {
        console.error(`--pin-slot needs one of ${[...PINNABLE_SLOTS].join(', ')}`);
        process.exit(2);
      }

      options.pinSlot = slot;
    } else if (arg === '--rotate') {
      const seeds = /^\d+$/.test(argv[index + 1] ?? '') ? Number(argv[(index += 1)]) : 10;

      if (seeds < 1) {
        console.error('--rotate needs at least one seed');
        process.exit(2);
      }

      options.rotate = seeds;
    } else if (arg === '--without') {
      const named = (argv[(index += 1)] ?? '').split(',').filter(Boolean);
      const unknown = named.filter(appliance => !APPLIANCES.includes(appliance));

      if (named.length === 0 || unknown.length > 0) {
        console.error(`--without needs appliances of the catalogue (${APPLIANCES.join(', ')})`);
        process.exit(2);
      }

      options.without = named;
    } else if (arg === '--prefer') {
      const named = (argv[(index += 1)] ?? '').split(',').filter(Boolean);
      const unknown = named.filter(appliance => !APPLIANCES.includes(appliance));

      if (named.length === 0 || unknown.length > 0) {
        console.error(`--prefer needs appliances of the catalogue (${APPLIANCES.join(', ')})`);
        process.exit(2);
      }

      options.prefer = named;
    } else if (arg === '--share') {
      const size = Number(argv[(index += 1)]);

      if (!Number.isInteger(size) || size < 0) {
        console.error('--share needs a whole number of dishes per slot, 0 or more');
        process.exit(2);
      }

      options.share = size;
    } else if (arg === '--flag') {
      const name = argv[(index += 1)];

      if (!KNOWN_FLAGS.has(name)) {
        console.error(`--flag needs a known name (${[...KNOWN_FLAGS].join(', ')})`);
        process.exit(2);
      }

      options.flags.push(name);
    } else if (arg === '--pantry') {
      const named = (argv[(index += 1)] ?? '').trim();
      const larder = LARDERS[named];
      // A larder by name, or a list typed on the command line. The slugs
      // themselves are checked against the catalogue inside the run, not here.
      const items = larder ? larder.items : named.split(',').map(slug => slug.trim()).filter(Boolean);

      if (items.length === 0) {
        console.error(`--pantry needs a larder (${Object.keys(LARDERS).join(', ')}) or a comma-separated list of catalogue slugs`);
        process.exit(2);
      }

      options.pantry = { assumes: larder?.assumes ?? null, items, name: larder ? named : 'a list given on the command line' };
    } else if (arg === '--pantry-mode') {
      const mode = argv[(index += 1)];

      if (!PANTRY_MODES.has(mode)) {
        console.error(`--pantry-mode needs one of ${[...PANTRY_MODES].join(', ')}`);
        process.exit(2);
      }

      options.pantryMode = mode;
    } else if (arg === '--pantry-share') {
      const size = Number(argv[(index += 1)]);

      if (!Number.isInteger(size) || size < 0) {
        console.error('--pantry-share needs a whole number of dishes per slot, 0 or more');
        process.exit(2);
      }

      options.pantryShare = Math.min(size, DISHES_NEEDED_PER_SLOT);
    } else if (arg === '--pantry-yields') {
      const order = argv[(index += 1)];

      if (order !== 'first' && order !== 'last') {
        console.error('--pantry-yields needs first (the cupboard gives way before the appliance) or last (the appliance gives way first)');
        process.exit(2);
      }

      options.pantryYields = order;
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
 * The same context with appliances taken out of its kitchen (`0102`).
 *
 * `nobodysContext` reads a random id, so `kitchenOf([])` already hands every
 * profile the **default** kitchen — a hob, an oven, a microwave and a blender —
 * which is what an account that never opened the screen has. This says "and not
 * these", by writing `missing` on the ones named, and it writes it in the one
 * place the rule is read from (`preferences.kitchen`), so the library filter and
 * the gate cannot be measured against different kitchens (`0052`).
 */
function withoutAppliances(shared, without) {
  if (without.length === 0) {
    return shared;
  }

  const kitchen = { ...shared.preferences.kitchen };

  for (const appliance of without) {
    kitchen[appliance] = 'missing';
  }

  return { ...shared, preferences: { ...shared.preferences, kitchen } };
}

/**
 * The same context with appliances they would rather use (`0102`) — the other
 * half of `withoutAppliances`, and the only way this instrument can measure the
 * preference half at all: the stance travels to the rotation through
 * `preferredAppliances(preferences.kitchen)`, exactly as `PlanGeneration` reads
 * it, so what is measured here is the pick a real plan would be built from.
 */
function withPreferredAppliances(shared, prefer) {
  if (prefer.length === 0) {
    return shared;
  }

  const kitchen = { ...shared.preferences.kitchen };

  for (const appliance of prefer) {
    kitchen[appliance] = 'prefers';
  }

  return { ...shared, preferences: { ...shared.preferences, kitchen } };
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
      // Carried across, and it is not optional: this branch rebuilds
      // `preferences` from scratch rather than spreading `shared.preferences`,
      // so without this the kitchen arrives as `null` — and `withinEquipment`
      // reads null as "nobody asked", which is true of **every** dish. The six
      // `dietaryPattern` profiles would then measure `--without` as a no-op and
      // report a cost of zero that nothing had been charged (`plan-evaluator`,
      // 2026-10-16).
      kitchen: shared.preferences.kitchen,
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

  // The protein split by the person's goal (019 phase 6, `0088`): their own, as generation passes it.
  const proteinWeights = proteinWeightsFor(profile.target.goal, weights);

  return { accompaniments, dayTargets, monthOf, proteinWeights, slots, targets, weights };
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

  const { accompaniments, dayTargets, monthOf, proteinWeights, slots, targets, weights } = inputs;

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
    proteinWeights,
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

  const { accompaniments, dayTargets, monthOf, proteinWeights, slots, targets, weights } = inputs;
  // The person's whole filtered library: the full-library rescue, the tail of the
  // uncapped rotation, and what decides which rules apply to them.
  const whole = await RecipeController.reusablePool(slots, context);
  const pantry = new Set(options.pantry?.items ?? []);
  // `filter` mode (022 phase 0): the library becomes the dishes this cupboard
  // covers whole — the rescues included, because *«solo con lo que tengo»* has
  // nothing wider to fall back on. Filtered on the dish's own ingredients, as a
  // pool filter must be: a side added at serve time is not a dish the pool
  // chose. Measured only to confirm `architecture/0012`'s refusal with this
  // cohort's own numbers; it is never a product mode.
  const everything = pantry.size > 0 && options.pantryMode === 'filter' ? whole.filter(dish => coveredWhole(dish, pantry)) : whole;
  // What each slot has to offer before the scheduler chooses anything, against
  // the nineteen a fortnight needs. Per profile and not per seed: a filter is a
  // property of the library, and the stop signal is read straight off it.
  const perSlotLibrary = Object.fromEntries(slots.map(slot => [slot, everything.filter(dish => dish.slots.includes(slot)).length]));
  const ranked = pantry.size > 0 && options.pantryMode === 'rank';
  const supply = balanceSupply(everything, context.catalogue);
  const inputFor = (pool, pinned) => ({
    accompaniments,
    catalogue: context.catalogue,
    dayTargets,
    minimumKcal: minimumDailyKcal(profile.target.sex),
    monthOf,
    pinned,
    pool: pinned.size === 0 ? pool : withPins(pool, pinned, everything),
    proteinWeights,
    targets,
    weights
  });
  /**
   * Whether a day holding exactly these pins can be built inside its bands.
   *
   * One day on its own, with the whole library and no variety pressure from the
   * other thirteen, so it is **optimistic** by construction: a pair it refuses
   * can never work, and a pair it accepts may still cost a day inside a real
   * fortnight. That asymmetry is what makes it usable as a filter and useless
   * as a promise.
   */
  const daySolvable = pinned => {
    const scheduled = schedulePlan({ ...inputFor(everything, pinned), dayTargets: new Map(), days: 1 });

    if (!scheduled.ok) {
      return false;
    }

    const violations = validatePlan({
      assignment: scheduled.assignment,
      dayTargets: new Map(),
      expectedDays: 1,
      expectedSlots: slots,
      sex: profile.target.sex,
      targets,
      weightKg: profile.target.weightKg
    });

    return !violations.some(violation => BAND_KINDS.has(violation.kind));
  };
  /**
   * Every pick this run makes, so the rank and the ladder the bands walk it down
   * are the same composition.
   *
   * Without a pantry it is `RecipeController.rotateFor`, which is the one place
   * that says what a rotation reserves — and calling it with `whole` is exactly
   * what `reusablePool(slots, context, rotation)` did here before, since that is
   * `rotateFor` over the same `servable` library this function already read into
   * `whole`. One read per profile instead of one per seed, the same pick.
   *
   * With a pantry ranked, it is the same call with the cupboard's reserve
   * appended to the food groups' — after them, never instead of them.
   */
  const rotate = (pool, rot, share = options.pantryShare) =>
    ranked
      ? rotatePool(pool, slots, rot, undefined, (inSlot, slot, taken) => {
          const reserved = reserveGroups(inSlot, slot, context.catalogue, taken);

          return [...reserved, ...pantryReserve(inSlot, reserved, pantry, share)];
        })
      : RecipeController.rotateFor(pool, slots, context, rot);
  // The rules are written once and stand over every seed, which is what weekly means.
  const pins = pinsFor(slots, everything, inputFor, options, profile.slug, daySolvable);
  const schedule = pool => schedulePlan(inputFor(pool, pins.map));
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
      // How big a share of each slot's pick a preferred appliance holds, which
      // `0102` leaves as the owner's choice and this measures instead of arguing.
      // Unset is the default (`APPLIANCE_DISHES_PER_SLOT`), and `shareOf`
      // clamps it to that constant — so a value above it measures the constant,
      // and only a smaller share can be seen from here.
      ...(options.share === null ? {} : { applianceShare: options.share }),
      avoidSlugs: new Set(),
      // What they would rather cook with, which `PlanGeneration` passes and this
      // instrument did not: without it a `--prefer` run would measure the pick of
      // a kitchen nobody stated, and the preference half of `0102` cannot be seen.
      preferAppliances: new Set(preferredAppliances(context.preferences.kitchen)),
      preferCuisines: new Set(),
      // `bucket` mode (022 phase 0) is the **rejected** composition, measured as
      // one: the cupboard's slugs ride in with the foods a way of eating leans
      // towards, which is the single bucket `isPreferredDish` partitions on and
      // whose dilution `0102` already paid for. A 15-item larder puts most of the
      // library in it, and this is how that is a number rather than an argument.
      preferIngredientSlugs:
        options.pantryMode === 'bucket' && pantry.size > 0
          ? new Set([...leaningSlugs(context.preferences), ...pantry])
          : leaningSlugs(context.preferences),
      preferSlugs: new Set(),
      seed: `${profile.slug}:${seed}`
    };
    const reusable = rotate(everything, rotation);
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
    // The kitchen's share gives way before the rotation does, exactly as
    // `PlanGeneration` walks it down: half the share, then none, the first rung
    // that holds every band winning (`narrowerShares`, `0102`). Without this the
    // evaluator would measure a rescue the service no longer reaches first.
    let kitchenShare = null;
    // Which rung of the cupboard's own share this plan ended on, `null` for the
    // full one: the figure that says what keeping the bands cost the pantry, and
    // the one PRD criterion 4 is about.
    let pantryShare = null;

    if (missedBand) {
      for (const rung of narrowerRungs(rotation, ranked ? options.pantryShare : 0, options.pantryYields)) {
        const narrowed = rotate(
          everything,
          rung.appliance === null ? rotation : withApplianceShare(rotation, rung.appliance),
          rung.pantry === null ? options.pantryShare : rung.pantry
        );
        const retried = schedule(narrowed);

        if (!retried.ok) {
          continue;
        }

        const retriedViolations = check(retried.assignment);

        if (retriedViolations.some(isBlocking) || planBandMiss(retriedViolations) >= planBandMiss(violations)) {
          continue;
        }

        scheduled = retried;
        violations = retriedViolations;
        usedPool = narrowed;
        kitchenShare = rung.appliance;
        pantryShare = rung.pantry;

        if (planBandMiss(violations) === 0) {
          break;
        }
      }
    }

    if (fallback === null && planBandMiss(violations) > 0) {
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
          kitchenShare = null;
          // The uncapped rotation has no cap for a share to be scarce against, so
          // a rescued fortnight has no cupboard either — which is exactly the
          // cliff the rungs above exist to avoid reaching.
          pantryShare = null;
        }
      }
    }

    const scheduleMs = Math.round(performance.now() - started);
    const daysOutside = new Set(violations.filter(violation => BAND_KINDS.has(violation.kind)).map(violation => violation.dayIndex));
    // After the clock stopped: which exceptions to the table the bands needed (019 phase 4).
    const exceptions = options.exceptions ? bandNeededExceptions(inputFor(usedPool, pins.map), scheduled.assignment) : undefined;
    const outcome = pinOutcome(scheduled.assignment, pins.map);
    const belowFloor = new Set(violations.filter(violation => violation.kind === 'below_minimum_kcal').map(violation => violation.dayIndex));

    plans.push({
      exceptions,
      balance: balanceOf({ catalogue: context.catalogue, days: scheduled.assignment.days, plantBased: isPlantBased(profile), supply }),
      blocking: violations.filter(isBlocking).length,
      daysInsideAll4: PLAN_DAYS - daysOutside.size,
      fallback,
      // Which rung of the appliance share this plan ended on, `null` for the full
      // one: the figure that says what keeping the bands cost the preference.
      kitchenShare,
      // The fortnight's own shopping list and what the cupboard reached on the
      // plates (022 phase 0). Written on **every** run, pantry or not, so a
      // no-pantry baseline file carries them too: "against the no-pantry run"
      // has to be a comparison of two measurements, and a baseline that cannot
      // say how long its list was is a recollection.
      list: shoppingMetrics(scheduled.assignment, context.catalogue, options.start, pantry),
      measured: true,
      missedBand,
      offer: rotationOffer(reusable, context.catalogue),
      pantryPlates: pantryPlateMetrics(scheduled.assignment.days, pantry),
      pantryShare,
      // What the pick held of each slot, against the nineteen a fortnight needs:
      // where a rank's quota shows up, and what a filter's shortfall looks like
      // once the rotation has taken what it could.
      perSlotPool: Object.fromEntries(slots.map(slot => [slot, usedPool.filter(dish => dish.slots.includes(slot)).length])),
      // The preference half of `0102`, which only a `--prefer` run can see: how
      // many of the pick, and of the plates, are cooked in an appliance they said
      // they would rather use. Zero plates with dishes in the pick is the defect
      // `APPLIANCE_DISHES_PER_SLOT` exists for.
      preferredOffered: reusable.filter(dish => (dish.equipment ?? []).some(appliance => rotation.preferAppliances.has(appliance))).length,
      preferredPlates: scheduled.assignment.days
        .flatMap(day => day.meals)
        .filter(meal => (meal.dish.equipment ?? []).some(appliance => rotation.preferAppliances.has(appliance))).length,
      pinnedDaysBelowFloor: [...belowFloor].filter(day => pins.map.has(day)).length,
      // Which slots a lost day pinned are the whole shape of the answer: a fixed
      // lunch takes about 40% of a three-meal day's energy, a fixed breakfast far
      // less — and a day holding two is counted once per slot it holds.
      pinnedDaysOutside: [...daysOutside].filter(day => pins.map.has(day)).flatMap(day => [...pins.map.get(day).keys()]),
      // Which macro a pinned day missed, for the measurement that asks whether a
      // day can hold two rules at all (`0101`): "two rules cost a day" is a
      // number, "they cost it its fat" is a cause.
      pinnedBandKinds: violations
        .filter(violation => BAND_KINDS.has(violation.kind) && pins.map.has(violation.dayIndex))
        .map(violation => violation.kind),
      pinsHonoured: outcome.honoured,
      pinsRefused: outcome.refused,
      poolSize: reusable.length,
      proteinPerKg: proteinPerKgBySlot(scheduled.assignment.days, profile.target.weightKg),
      scheduleMs,
      seed,
      unsafe: unsafeMeals(scheduled.assignment.days, context)
    });
  }

  return {
    goal: profile.target.goal,
    measured: plans.every(plan => plan.measured),
    note,
    // The servable library per slot against `DISHES_NEEDED_PER_SLOT` — the figure
    // `architecture/0012` refused the hard filter on ("41 lunches, 62 dinners and
    // 5 dishes at each snack"), and the first half of phase 0's stop signal.
    perSlotLibrary,
    pinNote: pins.note,
    pins: pins.rules,
    pinsPerDay: pins.perDay ?? 1,
    pinsWholeDays: pins.wholeDays ?? 0,
    plans,
    slots,
    slug: profile.slug,
    supply
  };
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
      // How many fortnights kept their bands by narrowing the kitchen's share
      // rather than by giving up the rotation, and to what.
      kitchenNarrowed: plans.filter(plan => plan.kitchenShare !== null && plan.kitchenShare !== undefined).map(plan => plan.kitchenShare),
      // The fortnight's list and what the cupboard reached (022 phase 0), every
      // one of them a spread over the profile's seeds and never a single number
      // (PRD criterion 2).
      listFoodRows: spread(plans, plan => plan.list.foodRows),
      listRows: spread(plans, plan => plan.list.rows),
      missedBand: plans.filter(plan => plan.missedBand).length,
      offerLegumeKinds: spread(plans, plan => plan.offer.legumeKinds),
      offerLegumeMains: spread(plans, plan => plan.offer.legumeMains),
      pantryCovered: spread(plans, plan => plan.list.covered),
      pantryCoveredFood: spread(plans, plan => plan.list.coveredFood),
      pantryFoodPlates: spread(plans, plan => plan.pantryPlates.foodPlates),
      // How many fortnights kept their bands by narrowing the cupboard's share
      // rather than by giving up the rotation, and to what (PRD criterion 4).
      pantryNarrowed: plans.filter(plan => plan.pantryShare !== null && plan.pantryShare !== undefined).map(plan => plan.pantryShare),
      pantryPlates: spread(plans, plan => plan.pantryPlates.plates),
      pantryWhole: spread(plans, plan => plan.pantryPlates.whole),
      // The thinnest slot of this person's library against the nineteen a
      // fortnight needs: the stop signal, read where it fires first — the snacks.
      poolFloor: result.perSlotLibrary
        ? Object.entries(result.perSlotLibrary).reduce(
            (worst, [slot, count]) => (worst === null || count < worst.count ? { count, slot } : worst),
            null
          )
        : null,
      plans: plans.length,
      preferredOffered: spread(plans, plan => plan.preferredOffered),
      preferredPlates: spread(plans, plan => plan.preferredPlates),
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

  // The fixed meals (`--pins`): what was asked of the plans, what they kept, and
  // what the kept ones cost. A rule that was refused is not a rule that was free.
  const pinned = {
    bySlot: {},
    daysBelowFloor: allPlans.reduce((sum, plan) => sum + (plan.pinnedDaysBelowFloor ?? 0), 0),
    daysOutside: allPlans.flatMap(plan => plan.pinnedDaysOutside ?? []).length,
    honoured: allPlans.reduce((sum, plan) => sum + (plan.pinsHonoured ?? 0), 0),
    of: allPlans.reduce((sum, plan) => sum + (plan.pinsHonoured ?? 0) + (plan.pinsRefused?.length ?? 0), 0),
    perDay: Math.max(1, ...results.map(result => result.pinsPerDay ?? 1)),
    unwritable: results.flatMap(result => result.pins ?? []).filter(rule => rule.unwritable).length,
    wholeDays: results.reduce((sum, result) => sum + (result.pinsWholeDays ?? 0), 0)
  };

  for (const slot of allPlans.flatMap(plan => plan.pinnedDaysOutside ?? [])) {
    pinned.bySlot[slot] = (pinned.bySlot[slot] ?? 0) + 1;
  }

  for (const plan of allPlans) {
    for (const refusal of plan.pinsRefused ?? []) {
      pinned.bySlot[`refused:${refusal.slot}`] = (pinned.bySlot[`refused:${refusal.slot}`] ?? 0) + 1;
    }
  }

  // The cohort's own figures (022 phase 0). Summed over every measured fortnight
  // and never over one, because a figure about plates or rows that a single plan
  // produced is not a figure this project may quote (PRD criterion 2).
  const cohort = read => allPlans.reduce((total, plan) => total + read(plan), 0);
  const pantry = {
    coveredFoodRows: cohort(plan => plan.list.coveredFood),
    coveredRows: cohort(plan => plan.list.covered),
    foodPlates: cohort(plan => plan.pantryPlates.foodPlates),
    foodRows: cohort(plan => plan.list.foodRows),
    meals: cohort(plan => plan.pantryPlates.meals),
    plates: cohort(plan => plan.pantryPlates.plates),
    rows: cohort(plan => plan.list.rows),
    // Every slot of every profile whose servable library is under the nineteen a
    // fortnight needs. Empty is the stop signal not firing on this half of it.
    slotsUnderNeed: results.flatMap(result =>
      Object.entries(result.perSlotLibrary ?? {})
        .filter(([, count]) => count < DISHES_NEEDED_PER_SLOT)
        .map(([slot, count]) => ({ count, profile: result.slug, slot }))
    ),
    // The fortnights that kept their bands by giving the cupboard's share up by
    // degrees instead of falling to the whole library (PRD criterion 4): the rung
    // is what makes a quota a preference rather than a cliff.
    narrowed: allPlans.filter(plan => plan.pantryShare !== null && plan.pantryShare !== undefined).length,
    wholeMeals: cohort(plan => plan.pantryPlates.whole)
  };

  return {
    pantry,
    pinned,
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
    // The fortnight's list on every run, pantry or not: it is the baseline the
    // pantry's own figures are read against, so it is never conditional.
    console.log(
      `  shopping list — rows ${range(profile.listRows)}, of them real food ${range(profile.listFoodRows)}` +
        `; thinnest slot of the library ${profile.poolFloor ? `${profile.poolFloor.slot} ${profile.poolFloor.count}` : 'n/a'} of ${DISHES_NEEDED_PER_SLOT}`
    );

    // Printed only when a cupboard was named: with none, every figure below is
    // zero by construction and says nothing.
    if (profile.pantryPlates && profile.pantryPlates.max > 0) {
      console.log(
        `  the cupboard — rows already bought ${range(profile.pantryCovered)} (real food ${range(profile.pantryCoveredFood)})` +
          `, plates using something of it ${range(profile.pantryPlates)} (not a seasoning ${range(profile.pantryFoodPlates)})` +
          `, meals using only it ${range(profile.pantryWhole)}`
      );
    }

    // Printed only for a `--prefer` run, where the number means something: a
    // kitchen nobody stated offers no preferred dish and eats no preferred plate.
    if (profile.preferredOffered && profile.preferredOffered.max > 0) {
      console.log(
        `  preferred appliance — dishes in the pick ${range(profile.preferredOffered)}, plates served ${range(profile.preferredPlates)} of ${PLAN_DAYS * (result.slots?.length ?? 0) || 'n/a'}`
      );
      console.log(
        `  the share gave way for the bands on ${profile.kitchenNarrowed?.length ?? 0} of ${profile.plans} fortnights${
          profile.kitchenNarrowed?.length > 0 ? ` (to ${profile.kitchenNarrowed.join(', ')} dishes a slot)` : ''
        }, rescued from the whole library ${profile.fallbacks.wider_rotation}`
      );
    }
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

  if (summary.pinned.of > 0) {
    const { bySlot, daysBelowFloor, daysOutside, honoured, of, perDay, unwritable, wholeDays } = summary.pinned;
    const slots = Object.entries(bySlot)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slot, count]) => `${slot} ${count}`)
      .join(', ');

    console.log(`\nFixed meals: ${honoured} of ${of} day-slots served the dish the rule asks for${perDay > 1 ? `, ${perDay} rules to a day` : ''}.`);

    if (wholeDays > 0) {
      console.log(`  profiles whose every meal that day was a rule: ${wholeDays}`);
    }

    console.log(`  days that carried a rule and missed a band: ${daysOutside}${slots === '' ? '' : ` (${slots})`}`);
    console.log(`  days that carried a rule and fell under the energy floor: ${daysBelowFloor}`);

    if (unwritable > 0) {
      console.log(`  rules no library could write: ${unwritable}`);
    }
  }

  if (summary.pantry) {
    const { coveredFoodRows, coveredRows, foodPlates, foodRows, meals, narrowed, plates, rows, slotsUnderNeed, wholeMeals } = summary.pantry;
    const share = (part, of) => (of > 0 ? ` (${Math.round((part / of) * 100)}%)` : '');

    console.log('\nThe cupboard, over the whole cohort:');
    console.log(`  shopping rows ${rows}, of them real food ${foodRows}`);
    console.log(`  rows the cupboard already holds ${coveredRows}${share(coveredRows, rows)}, of them real food ${coveredFoodRows}${share(coveredFoodRows, foodRows)}`);
    console.log(
      `  plates using something of it ${plates}${share(plates, meals)} of ${meals}, not a seasoning ${foodPlates}${share(foodPlates, meals)}, using only it ${wholeMeals}${share(wholeMeals, meals)}`
    );
    console.log(`  fortnights that kept their bands by narrowing the cupboard's share instead of losing it: ${narrowed}`);
    console.log(
      `  slots whose library is under ${DISHES_NEEDED_PER_SLOT}: ${
        slotsUnderNeed.length === 0
          ? 'none'
          : `${slotsUnderNeed.length} — ${slotsUnderNeed.map(entry => `${entry.profile}/${entry.slot} ${entry.count}`).join(', ')}`
      }`
    );
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
          // What the run was asked with, kept beside its numbers: a coverage
          // figure means nothing without the cupboard that produced it, and a
          // larder is the one input nobody can re-roll.
          pantry: options.pantry && {
            ...options.pantry,
            mode: options.pantryMode,
            share: options.pantryMode === 'rank' ? options.pantryShare : null,
            yields: options.pantryMode === 'rank' ? options.pantryYields : null,
            staples: options.pantry.items.filter(slug => PANTRY_STAPLES.has(slug))
          },
          prefer: options.prefer,
          rotate: options.rotate,
          start: options.start,
          without: options.without,
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

  if (options.pantry && !options.rotate) {
    console.error('--pantry needs --rotate beside it: every figure it adds is a figure about a fortnight somebody was actually served');
    process.exit(2);
  }

  if (options.share !== null && options.prefer.length === 0) {
    console.error('--share prices the quota a preferred appliance holds, so it needs --prefer beside it: with no preference the share is zero whatever this says');
    process.exit(2);
  }

  if (options.pinsFrom) {
    if (options.pins === 0) {
      console.error('--pins-from replays the rules of a kept run, so it needs the same --pins N (and --per-day N) beside it');
      process.exit(2);
    }

    const path = options.pinsFrom;
    const kept = JSON.parse(readFileSync(path, 'utf8'));
    const replayed = new Map((kept.results ?? []).filter(result => result.pins).map(result => [result.slug, result.pins]));

    if (replayed.size === 0) {
      console.error(`${path} holds no rules to replay; keep a run with --pins first`);
      process.exit(2);
    }

    options.pinsFrom = replayed;
  }

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
          const shared = withPreferredAppliances(withoutAppliances(await baseContext(options.locale), options.without), options.prefer);

          if (options.pantry) {
            // Checked here and not in `parseArgs`, because the catalogue is not
            // read until now: a slug validated against nothing would come back
            // as "the cupboard covered nothing", which is the one failure that
            // reads exactly like a result.
            const unknown = unknownPantrySlugs(options.pantry, shared.catalogue);

            if (unknown.length > 0) {
              console.error(`--pantry names ${unknown.length} slug(s) the ${options.locale} catalogue does not hold: ${unknown.join(', ')}`);
              process.exit(2);
            }
          }

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
  // Named here and kept in the JSON, because a run's numbers mean nothing without
  // its kitchen: `--compare` against a file that cannot say what it lacked would
  // read a smaller pool as a regression (`0102`, project 021 phase 6).
  console.log(
    `Kitchen: ${options.without.length > 0 ? `the default, without ${options.without.join(', ')}` : 'the default (hob, oven, microwave, blender)'}` +
      `${options.prefer.length > 0 ? `, and would rather use ${options.prefer.join(', ')}` : ''}`
  );
  console.log(`Fortnight starts: ${options.start}`);

  if (options.pantry) {
    const staples = options.pantry.items.filter(slug => PANTRY_STAPLES.has(slug)).length;

    console.log(
      `Cupboard: ${options.pantry.name} — ${options.pantry.items.length} items, of them ${staples} seasonings; mode ${options.pantryMode}` +
        `${options.pantryMode === 'rank' ? `, share ${options.pantryShare} of ${DISHES_NEEDED_PER_SLOT} dishes a slot, and it gives way ${options.pantryYields} when a band is missed` : ''}`
    );

    if (options.pantry.assumes) {
      console.log(`  assumes: ${options.pantry.assumes}`);
    }
  }
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
          prefer: options.prefer,
          start: options.start,
          without: options.without,
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
