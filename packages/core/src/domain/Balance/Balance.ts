import { dishGroups, FOOD_GROUP_SLUGS, FRESH_FRUIT_SLUGS } from 'core/domain/MealFit';
import { BREAD_SLUGS, MAIN_SLOTS, STARCH_RULES, starchBase } from 'core/domain/Variety';
import { toDry } from 'core/domain/Yield';

import type { CandidateDish, Catalogue, PlanDayAssignment, ScheduledMeal } from 'core/entities/Plan';

/**
 * How balanced a fortnight is by food group (project 019, architect report
 * `0010` § 1.2 and § 4.1): legumes, fish, meat, processed meat, eggs, the
 * capped starches, vegetables, fruit, whole grain and fibre, each against the
 * fortnightly table of PRD 019 (AESAN 2022, EFSA, WHO).
 *
 * Phase 1 only measures: nothing here is read by the scheduler yet. Every
 * group is read off the catalogue, never off a dish's name or what a model
 * said (`0004`), and in grams **as served** — the plate scaled to its
 * servings and what goes beside it — because the frequency is of what the
 * person eats. The thresholds are half an AESAN serving, so a garnish never
 * counts as the dish.
 */

/** Grams a meal needs of each group to count as a serving of it (`0010` § 1.2). */
export const BALANCE_GRAMS = {
  /** One egg (AESAN: 53–63 g); eggs are counted, not thresholded. */
  egg: 55,
  /** Fish, or fish and shellfish together for the maximum. */
  fish: 60,
  /** One portion of fruit. */
  fruit: 150,
  /** Dry-equivalent legume, half an AESAN serving (50–60 g). */
  legume: 25,
  /** Unprocessed meat, half an AESAN serving (100–125 g). */
  meat: 50,
  /** Potato or boniato on a plate (`FOOD_GROUP_GRAMS`). */
  potato: 100,
  /** Processed meat at any meal: the WHO names no safe level. */
  processed: 10,
  /** Vegetables at a lunch or dinner, plate and sides: one AESAN serving. */
  vegetables: 150
} as const;

/**
 * The legumes as they reach a plate besides the stewed pulses of `0079`: how a
 * legume gets to a Spanish dinner (`0062` § 2), as a spread, a curd or a snack.
 */
const LIGHT_LEGUME_SLUGS: ReadonlySet<string> = new Set([
  'altramuces',
  'edamame-cocido',
  'edamame-congelado',
  'frijoles-refritos',
  'garbanzos-tostados',
  'hummus',
  'hummus-de-remolacha',
  'pasta-de-garbanzos',
  'pasta-de-lentejas',
  'soja-texturizada',
  'tempeh',
  'tofu-ahumado',
  'tofu-firme',
  'tofu-sedoso'
]);

/** Tins of a whole stew: a quarter of the tin is the legume. */
const LEGUME_STEW_TINS: ReadonlySet<string> = new Set([
  'alubias-con-verduras-en-lata',
  'cocido-madrileno-en-lata',
  'fabada-en-lata',
  'garbanzos-con-espinacas-en-lata',
  'lentejas-con-chorizo-en-lata'
]);

/** Already dry: a dry pulse, a roasted one, a dried soya mince or a legume pasta. */
const DRY_LEGUME_SLUGS: ReadonlySet<string> = new Set([
  'alubias-blancas-secas',
  'alubias-pintas-secas',
  'garbanzos-secos',
  'garbanzos-tostados',
  'guisantes-secos-partidos',
  'habas-secas',
  'lentejas-secas',
  'pasta-de-garbanzos',
  'pasta-de-lentejas',
  'soja-en-grano',
  'soja-texturizada'
]);

/**
 * What `grams` of a legume row weigh as dry legume, or null for a row that is
 * not one: cooked ÷ 2.5, a stew tin ÷ 4, hummus and tofu ÷ 4, tempeh ÷ 2 and a
 * dry row as it is (`0010` § 1.2).
 */
export function legumeDryGrams(slug: string, grams: number): number | null {
  if (!FOOD_GROUP_SLUGS.pulses.has(slug) && !LIGHT_LEGUME_SLUGS.has(slug)) {
    return null;
  }

  if (DRY_LEGUME_SLUGS.has(slug)) {
    return grams;
  }

  if (LEGUME_STEW_TINS.has(slug) || slug.startsWith('hummus') || slug.startsWith('tofu-')) {
    return grams / 4;
  }

  return slug === 'tempeh' ? grams / 2 : grams / 2.5;
}

/** Oily fish (AESAN's "pescado azul"), by catalogue row. */
const OILY_FISH_SLUGS: ReadonlySet<string> = new Set([
  'anchoas-en-salazon',
  'atun-al-natural',
  'atun-en-aceite',
  'atun-en-escabeche',
  'atun-fresco',
  'bonito',
  'boquerones',
  'caballa',
  'caballa-en-conserva',
  'jurel',
  'melva-en-conserva',
  'mojama',
  'palometa',
  'pez-espada',
  'salmon',
  'salmon-ahumado',
  'salmon-congelado',
  'salmonete',
  'sardina',
  'sardinas-en-aceite',
  'trucha',
  'trucha-ahumada',
  'ventresca-de-atun'
]);

export function isOilyFish(slug: string): boolean {
  return OILY_FISH_SLUGS.has(slug);
}

/**
 * Processed meat: salted, cured, fermented or smoked (WHO), and the tins and
 * frozen foods made of it. Counted at any meal, since ham reaches breakfast.
 */
const PROCESSED_MEAT_SLUGS: ReadonlySet<string> = new Set([
  'bacon',
  'butifarra',
  'chorizo',
  'cocido-madrileno-en-lata',
  'croquetas-de-jamon-congeladas',
  'fabada-en-lata',
  'fiambre-de-pavo',
  'fiambre-de-pollo',
  'fuet',
  'jamon-cocido',
  'jamon-iberico',
  'jamon-serrano',
  'lacon',
  'lentejas-con-chorizo-en-lata',
  'lomo-embuchado',
  'morcilla',
  'mortadela',
  'nuggets-de-pollo-congelados',
  'panceta',
  'salchichas-de-pollo',
  'salchichas-frescas',
  'salchichon',
  'sobrasada'
]);

export function isProcessedMeat(slug: string): boolean {
  return PROCESSED_MEAT_SLUGS.has(slug);
}

/**
 * Rows of class `meat` that are not a portion of meat: stocks, a stock cube,
 * lard, pastries and the sauces made with a little of it. Their grams are not
 * meat a person eats; a 250 g broth is not a steak.
 */
const NOT_A_MEAT_PORTION: ReadonlySet<string> = new Set([
  'caldo-de-carne',
  'caldo-de-pollo',
  'ensaimada',
  'manteca-de-cerdo',
  'pastilla-de-caldo',
  'polvoron',
  'salsa-bolonesa-envasada',
  'salsa-carbonara-envasada',
  'sopa-de-fideos-envasada'
]);

/** White meat (AESAN: poultry and rabbit), by the animal its slug names. */
const WHITE_MEAT = /(?:^|-)(?:pollo|pavo|conejo|codorniz|perdiz|pato)(?:-|$)/;

/** Unprocessed meat as AESAN reads it: white, or red (beef, pork, lamb, goat, game); null for anything else. */
export function meatColour(slug: string, catalogue: Catalogue): 'red' | 'white' | null {
  const classes = catalogue.get(slug)?.classes ?? [];

  if (!classes.includes('meat') || isProcessedMeat(slug) || NOT_A_MEAT_PORTION.has(slug)) {
    return null;
  }

  return !classes.includes('pork') && WHITE_MEAT.test(slug) ? 'white' : 'red';
}

/** Whole grain: brown and wild rice, whole pasta, the whole grains, oats, whole bread. */
const WHOLE_GRAIN_SLUGS: ReadonlySet<string> = new Set([
  'amaranto',
  'arroz-integral-cocido',
  'arroz-integral-crudo',
  'arroz-salvaje-cocido',
  'arroz-salvaje-crudo',
  'bulgur-cocido',
  'bulgur-crudo',
  'copos-de-avena',
  'espelta-cocida',
  'espelta-en-grano',
  'freekeh',
  'harina-de-avena',
  'mijo',
  'mijo-cocido',
  'pan-de-hamburguesa-integral',
  'pan-de-molde-integral',
  'pan-integral',
  'pasta-integral-cocida',
  'pasta-integral-seca',
  'quinoa-cocida',
  'quinoa-cruda',
  'trigo-sarraceno',
  'trigo-sarraceno-cocido',
  'wrap-integral'
]);

export function isWholeGrain(slug: string): boolean {
  return WHOLE_GRAIN_SLUGS.has(slug);
}

/** A cereal row, whole or refined: pasta, rice, the grains and bread — not a pasta made of legumes. */
function isCereal(slug: string): boolean {
  if (slug === 'pasta-de-garbanzos' || slug === 'pasta-de-lentejas') {
    return false;
  }

  return (
    FOOD_GROUP_SLUGS.pasta.has(slug) ||
    FOOD_GROUP_SLUGS.rice.has(slug) ||
    FOOD_GROUP_SLUGS.grains.has(slug) ||
    BREAD_SLUGS.has(slug) ||
    isWholeGrain(slug)
  );
}

/** Fruit: the fresh fruit of `0062`, the fruit with no season and the frozen fruit. */
const OTHER_FRUIT_SLUGS: ReadonlySet<string> = new Set([
  'arandanos-congelados',
  'frambuesas-congeladas',
  'fresas-congeladas',
  'frutos-rojos-congelados',
  'mango-congelado',
  'maracuya',
  'papaya',
  'pina',
  'pina-congelada',
  'platano'
]);

export function isFruit(slug: string): boolean {
  return FRESH_FRUIT_SLUGS.has(slug) || OTHER_FRUIT_SLUGS.has(slug);
}

/** Produce that is neither a vegetable nor a fruit portion. */
const NOT_A_VEGETABLE: ReadonlySet<string> = new Set(['castana', 'coco-fresco', 'lima', 'limon', 'platano-macho']);

/** A frozen row that is not a vegetable even with no animal in it. */
const FROZEN_NOT_VEGETABLE = /^(?:helado|masa|pizza|polo|sorbete|yogur|pan)-/;

/** Tinned vegetables a Spanish kitchen cooks with. */
const TINNED_VEGETABLES: ReadonlySet<string> = new Set([
  'pimiento-del-piquillo',
  'pimientos-asados-en-conserva',
  'pisto-en-conserva',
  'tomate-entero-pelado',
  'tomate-troceado-en-conserva',
  'tomate-triturado'
]);

/** A vegetable row: fresh or frozen produce that is not fruit, potato or a legume, and tinned tomato and peppers. */
export function isVegetable(slug: string, catalogue: Catalogue): boolean {
  const ingredient = catalogue.get(slug);

  if (!ingredient || isFruit(slug) || NOT_A_VEGETABLE.has(slug) || FOOD_GROUP_SLUGS.potato.has(slug) || legumeDryGrams(slug, 1) !== null) {
    return false;
  }

  if (TINNED_VEGETABLES.has(slug) || ingredient.category === 'produce') {
    return true;
  }

  return ingredient.category === 'frozen' && ingredient.classes.length === 0 && !FROZEN_NOT_VEGETABLE.test(slug);
}

/** Grams of one portion of a dairy food (AESAN): milk 225, yoghurt 125, fresh cheese 100, cured 50; null for anything else. */
function dairyPortionGrams(slug: string, catalogue: Catalogue): number | null {
  if (catalogue.get(slug)?.category !== 'dairy' || /^(?:mantequilla|nata|ghee|crema-agria|yogur-de-(?:soja|coco))/.test(slug)) {
    return null;
  }

  if (/^(?:leche|kefir|yogur-bebible)/.test(slug)) {
    return 225;
  }

  if (/^(?:yogur|skyr|petit-suisse|cuajada)/.test(slug)) {
    return 125;
  }

  return /^(?:burrata|mascarpone|mozzarella-fresca|queso-(?:batido|cottage|crema|de-burgos|de-untar|fresco|tierno)|requeson|ricotta)/.test(slug)
    ? 100
    : 50;
}

/** Added sugar, roughly: the catalogue has no sugars column, so this reads the rows that are sugar. */
function isSugar(slug: string): boolean {
  return /^(?:azucar-|miel|sirope-|mermelada-|dulce-de-membrillo$)/.test(slug);
}

/** What one meal carries of each group, in grams as served. */
export type MealGroups = {
  readonly cerealDry: number;
  readonly dairyPortions: number;
  readonly eggs: number;
  readonly fish: number;
  readonly fruitPortions: number;
  readonly legumeDry: number;
  readonly oilyFish: number;
  readonly potato: number;
  readonly processed: number;
  readonly redMeat: number;
  readonly shellfish: number;
  readonly sugar: number;
  readonly vegetables: number;
  readonly whiteMeat: number;
  readonly wholeGrainDry: number;
};

/** Every group a list of rows carries, read off the catalogue. */
export function mealGroups(items: readonly { readonly grams: number; readonly slug: string }[], catalogue: Catalogue): MealGroups {
  const sum = {
    cerealDry: 0,
    dairyPortions: 0,
    eggs: 0,
    fish: 0,
    fruitPortions: 0,
    legumeDry: 0,
    oilyFish: 0,
    potato: 0,
    processed: 0,
    redMeat: 0,
    shellfish: 0,
    sugar: 0,
    vegetables: 0,
    whiteMeat: 0,
    wholeGrainDry: 0
  };

  for (const { grams, slug } of items) {
    const classes = catalogue.get(slug)?.classes ?? [];
    const legume = legumeDryGrams(slug, grams);
    const colour = meatColour(slug, catalogue);
    const dairy = dairyPortionGrams(slug, catalogue);

    sum.legumeDry += legume ?? 0;
    sum.fish += classes.includes('fish') ? grams : 0;
    sum.oilyFish += isOilyFish(slug) ? grams : 0;
    sum.shellfish += classes.includes('shellfish') ? grams : 0;
    sum.redMeat += colour === 'red' ? grams : 0;
    sum.whiteMeat += colour === 'white' ? grams : 0;
    sum.processed += isProcessedMeat(slug) ? grams : 0;
    sum.eggs += slug === 'huevo' || slug === 'huevo-de-codorniz' ? grams / BALANCE_GRAMS.egg : 0;
    sum.potato += FOOD_GROUP_SLUGS.potato.has(slug) ? grams : 0;
    sum.vegetables += isVegetable(slug, catalogue) ? grams : 0;
    sum.fruitPortions += isFruit(slug) ? grams / BALANCE_GRAMS.fruit : 0;
    sum.dairyPortions += dairy === null ? 0 : grams / dairy;
    sum.sugar += isSugar(slug) ? grams : 0;

    if (isCereal(slug)) {
      const dry = toDry(slug, grams)?.dryGrams ?? grams;

      sum.cerealDry += dry;
      sum.wholeGrainDry += isWholeGrain(slug) ? dry : 0;
    }
  }

  return sum;
}

/** The groups a meal *is* a serving of, at the thresholds of `BALANCE_GRAMS`. */
export type MealServings = {
  readonly fish: boolean;
  readonly fishOrShellfish: boolean;
  readonly legume: boolean;
  readonly meat: boolean;
  readonly oilyFish: boolean;
  readonly processed: boolean;
  readonly redMeat: boolean;
};

export function mealServings(groups: MealGroups): MealServings {
  const seafood = groups.fish + groups.shellfish;

  return {
    fish: groups.fish >= BALANCE_GRAMS.fish,
    fishOrShellfish: seafood >= BALANCE_GRAMS.fish,
    legume: groups.legumeDry >= BALANCE_GRAMS.legume,
    meat: groups.redMeat + groups.whiteMeat >= BALANCE_GRAMS.meat,
    // Oily fish "weighs more than the white fish and the shellfish on the plate".
    oilyFish: groups.fish >= BALANCE_GRAMS.fish && groups.oilyFish > seafood - groups.oilyFish,
    processed: groups.processed >= BALANCE_GRAMS.processed,
    redMeat: groups.redMeat >= BALANCE_GRAMS.meat
  };
}

/**
 * What a person's filtered pool can serve at all, at lunch or dinner (any meal
 * for processed meat): a minimum or a cap applies only to a group the pool
 * has (`0010` § 3.3). A dislike, an allergy or a way of eating that removes a
 * group removes its rule — read off the pool, never off the preference.
 */
export type BalanceSupply = { readonly fish: boolean; readonly legume: boolean; readonly meat: boolean; readonly processed: boolean };

export function balanceSupply(pool: readonly Pick<CandidateDish, 'ingredients' | 'servings' | 'slots'>[], catalogue: Catalogue): BalanceSupply {
  const supply = { fish: false, legume: false, meat: false, processed: false };

  for (const dish of pool) {
    const servings = dish.servings > 0 ? dish.servings : 1;
    const served = mealServings(
      mealGroups(
        dish.ingredients.map(item => ({ grams: (item.grams ?? 0) / servings, slug: item.slug })),
        catalogue
      )
    );
    const main = dish.slots.some(slot => MAIN_SLOTS.has(slot));

    supply.fish ||= main && served.fish;
    supply.legume ||= main && served.legume;
    supply.meat ||= main && served.meat;
    supply.processed ||= served.processed;
  }

  return supply;
}

/**
 * The rules of the table, in the order the LOG reports them. Vegetables are
 * judged two ways (owner's delegation of 2026-10-03): `vegetables` is the
 * PRD's rule, ≥ 150 g at every lunch and dinner, and is the one scored;
 * `vegetablesMostMains` is report `0010`'s measure, ≥ 150 g at 80% of them,
 * kept beside it so the two baselines read across. It is not scored.
 */
export const BALANCE_RULES = [
  'legumes',
  'fish',
  'oilyFish',
  'fishAndShellfish',
  'meat',
  'redMeat',
  'processed',
  'eggs',
  'starches',
  'vegetables',
  'vegetablesMostMains',
  'fruit',
  'wholeGrain',
  'fibre'
] as const;

export type BalanceRule = (typeof BALANCE_RULES)[number];

const UNSCORED_RULES: ReadonlySet<BalanceRule> = new Set(['vegetablesMostMains']);

/** One rule on one plan: whether it applies to this person, whether it held, what was served and the limit. */
export type RuleResult = { readonly applies: boolean; readonly limit: number; readonly met: boolean; readonly value: number };

export type BalanceReport = {
  /** What was served, per group: counts of lunches and dinners, per-day figures, shares. */
  readonly counts: {
    readonly dairyPortionsPerDay: number;
    readonly eggs: number;
    readonly fibrePerDay: number;
    readonly fish: number;
    readonly fishAndShellfish: number;
    readonly fruitPerDay: number;
    readonly legumes: number;
    readonly mains: number;
    readonly meat: number;
    readonly oilyFish: number;
    readonly potatoMains: number;
    readonly processed: number;
    readonly processedRuns: number;
    readonly redMeat: number;
    readonly redMeatRuns: number;
    /** Pasta, rice and grains at lunch and dinner, a side of them included; and the dish's own base alone. */
    readonly starches: Readonly<Record<string, number>>;
    readonly starchesDishOnly: Readonly<Record<string, number>>;
    readonly sugarPerDay: number;
    readonly vegetableMainsShare: number;
    readonly vegetablesPerMain: number;
    readonly whiteMeat: number;
    readonly wholeGrainShare: number | null;
  };
  readonly rules: Readonly<Record<BalanceRule, RuleResult>>;
  /** The share of the scored rules that apply that held. Unweighted: an easy rule never hides a hard one. */
  readonly score: number;
};

/** A fortnight's figure scaled to the plan's main meals, as `kindCap` scales a cap: `ceil(n × mains ÷ 28)`, one at least. */
export function scaledToMains(perFortnight: number, mains: number): number {
  return Math.max(1, Math.ceil((perFortnight * mains) / 28));
}

/** Meals running on consecutive days, or twice on one day: each day after a day of the same, and each second one on a day. */
function runs(days: readonly number[]): number {
  const sorted = [...days].sort((a, b) => a - b);

  return sorted.filter((day, index) => index > 0 && (sorted[index - 1] === day || sorted[index - 1] === day - 1)).length;
}

/** The meal's rows beside its plate: the scheduler puts the dish's scaled rows first. */
function sideRows(meal: ScheduledMeal): readonly { readonly grams: number; readonly slug: string }[] {
  return meal.ingredients.slice(meal.dish.ingredients.length);
}

export type BalanceInput = {
  readonly catalogue: Catalogue;
  readonly days: readonly PlanDayAssignment[];
  /** Vegetarian or vegan: the egg is their protein, so the egg cap does not apply. */
  readonly plantBased: boolean;
  readonly supply: BalanceSupply;
};

/**
 * The fortnight against PRD 019's table, per `0010` § 4.1: each rule that
 * applies holds or not; vegetables by the PRD's every main, the report's 80%
 * beside it unscored. Meat's cap doubles when the pool has no fish.
 */
export function balanceOf({ catalogue, days, plantBased, supply }: BalanceInput): BalanceReport {
  let legumes = 0;
  let fish = 0;
  let oilyFish = 0;
  let seafood = 0;
  let meat = 0;
  let redMeat = 0;
  let whiteMeat = 0;
  let potatoMains = 0;
  let mains = 0;
  let vegetableMains = 0;
  let vegetableGrams = 0;
  let cereal = 0;
  let whole = 0;
  let eggs = 0;
  let fruit = 0;
  let dairy = 0;
  let sugar = 0;
  let processed = 0;
  const redDays: number[] = [];
  const processedDays: number[] = [];
  const starches: Record<string, number> = Object.fromEntries(STARCH_RULES.capped.map(base => [base, 0]));
  const starchesDishOnly: Record<string, number> = Object.fromEntries(STARCH_RULES.capped.map(base => [base, 0]));

  for (const day of days) {
    for (const meal of day.meals) {
      const groups = mealGroups(meal.ingredients, catalogue);
      const served = mealServings(groups);

      eggs += groups.eggs;
      fruit += groups.fruitPortions;
      dairy += groups.dairyPortions;
      sugar += groups.sugar;

      if (served.processed) {
        processed += 1;
        processedDays.push(day.dayIndex);
      }

      if (!MAIN_SLOTS.has(meal.slot)) {
        continue;
      }

      mains += 1;
      legumes += served.legume ? 1 : 0;
      fish += served.fish ? 1 : 0;
      oilyFish += served.oilyFish ? 1 : 0;
      seafood += served.fishOrShellfish ? 1 : 0;
      meat += served.meat ? 1 : 0;
      whiteMeat += groups.whiteMeat >= BALANCE_GRAMS.meat ? 1 : 0;
      potatoMains += groups.potato >= BALANCE_GRAMS.potato ? 1 : 0;
      vegetableMains += groups.vegetables >= BALANCE_GRAMS.vegetables ? 1 : 0;
      vegetableGrams += groups.vegetables;
      cereal += groups.cerealDry;
      whole += groups.wholeGrainDry;

      if (served.redMeat) {
        redMeat += 1;
        redDays.push(day.dayIndex);
      }

      // The dish's base, and a rice or grain beside it, each count once (PRD 019).
      const base = starchBase(meal.dish);
      const sides = dishGroups({ ingredients: sideRows(meal) });
      const bases = new Set<string>();

      if (base && base in starches) {
        bases.add(base);
        starchesDishOnly[base] = (starchesDishOnly[base] ?? 0) + 1;
      }

      for (const group of sides) {
        if (group in starches) {
          bases.add(group);
        }
      }

      for (const counted of bases) {
        starches[counted] = (starches[counted] ?? 0) + 1;
      }
    }
  }

  const dayCount = Math.max(days.length, 1);
  const fibrePerDay = days.reduce((sum, day) => sum + day.totals.fiberG, 0) / dayCount;
  const fruitPerDay = fruit / dayCount;
  const vegetableMainsShare = mains > 0 ? vegetableMains / mains : 0;
  const wholeGrainShare = cereal > 0 ? whole / cereal : null;
  const cap = (figure: number) => scaledToMains(figure, mains);
  const starchCap = cap(STARCH_RULES.perFortnight);
  const starchMost = Math.max(0, ...Object.values(starches));

  const rules: Record<BalanceRule, RuleResult> = {
    eggs: { applies: !plantBased, limit: 8, met: eggs <= 8, value: eggs },
    fibre: { applies: true, limit: 25, met: fibrePerDay >= 25, value: fibrePerDay },
    fish: { applies: supply.fish, limit: cap(6), met: fish >= cap(6), value: fish },
    fishAndShellfish: { applies: true, limit: cap(8), met: seafood <= cap(8), value: seafood },
    fruit: { applies: true, limit: 2, met: fruitPerDay >= 2, value: fruitPerDay },
    legumes: { applies: supply.legume, limit: cap(8), met: legumes >= cap(8), value: legumes },
    meat: { applies: supply.meat, limit: cap(supply.fish ? 6 : 12), met: meat <= cap(supply.fish ? 6 : 12), value: meat },
    oilyFish: { applies: supply.fish, limit: cap(2), met: oilyFish >= cap(2), value: oilyFish },
    processed: { applies: supply.processed, limit: cap(2), met: processed <= cap(2) && runs(processedDays) === 0, value: processed },
    redMeat: { applies: supply.meat, limit: cap(4), met: redMeat <= cap(4) && runs(redDays) === 0, value: redMeat },
    starches: { applies: true, limit: starchCap, met: starchMost <= starchCap, value: starchMost },
    vegetables: { applies: mains > 0, limit: 1, met: mains > 0 && vegetableMains === mains, value: vegetableMainsShare },
    vegetablesMostMains: { applies: mains > 0, limit: 0.8, met: vegetableMainsShare >= 0.8, value: vegetableMainsShare },
    wholeGrain: { applies: wholeGrainShare !== null, limit: 0.5, met: (wholeGrainShare ?? 0) >= 0.5, value: wholeGrainShare ?? 0 }
  };

  const applying = BALANCE_RULES.filter(rule => rules[rule].applies && !UNSCORED_RULES.has(rule));

  return {
    counts: {
      dairyPortionsPerDay: dairy / dayCount,
      eggs,
      fibrePerDay,
      fish,
      fishAndShellfish: seafood,
      fruitPerDay,
      legumes,
      mains,
      meat,
      oilyFish,
      potatoMains,
      processed,
      processedRuns: runs(processedDays),
      redMeat,
      redMeatRuns: runs(redDays),
      starches,
      starchesDishOnly,
      sugarPerDay: sugar / dayCount,
      vegetableMainsShare,
      vegetablesPerMain: mains > 0 ? vegetableGrams / mains : 0,
      whiteMeat,
      wholeGrainShare
    },
    rules,
    score: applying.length > 0 ? applying.filter(rule => rules[rule].met).length / applying.length : 1
  };
}

/** Each slot's protein in g per kg of body weight: the mean and the lowest meal (`0010` § 2.2). Reported, not scored. */
export function proteinPerKgBySlot(
  days: readonly PlanDayAssignment[],
  weightKg: number
): Readonly<Record<string, { readonly mean: number; readonly min: number }>> {
  const bySlot = new Map<string, number[]>();

  for (const day of days) {
    for (const meal of day.meals) {
      bySlot.set(meal.slot, [...(bySlot.get(meal.slot) ?? []), meal.macros.proteinG / weightKg]);
    }
  }

  return Object.fromEntries(
    [...bySlot].map(([slot, values]) => [slot, { mean: values.reduce((sum, value) => sum + value, 0) / values.length, min: Math.min(...values) }])
  );
}
