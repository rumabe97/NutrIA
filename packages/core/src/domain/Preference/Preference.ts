import { cuisineFamily } from 'core/domain/MealFit';
import { normaliseForMatching } from 'core/domain/Safety';

import type { CuisineFamily } from 'core/domain/MealFit';

import type { CatalogueIngredient } from 'core/entities/Plan';
import type { FoodClass } from 'database/schema/food';

/**
 * What a way of eating excludes, as classes of food rather than as a sentence
 * in a prompt.
 *
 * A person who declares themselves vegetarian and is served chicken has been
 * failed by the product, not by the model — the model was asked politely and
 * ignored. These are the same kind of rule as the allergy gate and run in the
 * same place: before a dish can be proposed, not after it is on the plate.
 *
 * `halal` and `kosher` are here too, and in `PATTERN_SLUG_RUNS` and
 * `SEPARATES_MEAT_AND_DAIRY` below, because a religious way of eating is never
 * named to the model (owner's decision, 2026-09-25: a label that reveals a
 * belief does not leave the building). What the catalogue can express is
 * enforced in code; what it cannot — whether meat was slaughtered and certified
 * — is not claimed, and buying certified meat stays the person's.
 *
 * `gluten_free` and `lactose_free` are enforced in code too, by the allergen
 * tags the safety layer reads (`PATTERN_ALLERGENS`), and never named to the
 * model: each reveals a coeliac disease or an intolerance.
 *
 * Absent on purpose: `flexitarian`, which is a direction rather than a rule.
 */
export const PATTERN_EXCLUSIONS: Readonly<Record<string, readonly FoodClass[]>> = {
  halal: ['pork'],
  kosher: ['pork', 'shellfish'],
  pescatarian: ['meat', 'pork'],
  vegan: ['animal', 'dairy', 'egg', 'fish', 'meat', 'pork', 'shellfish'],
  vegetarian: ['fish', 'meat', 'pork', 'shellfish']
};

/** Alcoholic drinks and what is cooked with them, as slug words. A vinegar and an alcohol-free drink are not. */
const ALCOHOL_RUNS: readonly string[] = [
  'brandy',
  'cava',
  'cerveza',
  'conac',
  'ginebra',
  'jerez',
  'licor',
  'marsala',
  'mirin',
  'oporto',
  'ron',
  'sake',
  'sidra',
  'tequila',
  'vermut',
  'vino',
  'vodka',
  'whisky'
];

/** Gelatine: an animal product of unstated origin, most often pork. */
const GELATINE_RUNS: readonly string[] = ['gelatina'];

/** Fish without fins and scales, which kashrut excludes; the class `fish` cannot tell them apart. */
const SCALELESS_FISH_RUNS: readonly string[] = [
  'anguila',
  'angulas',
  'cazon',
  'esturion',
  'caviar',
  'panga',
  'pez-espada',
  'rape',
  'siluro',
  'tiburon'
];

/**
 * What a religious way of eating excludes that no food class names, as runs of
 * whole slug words — the same whole-token rule the allergy layer uses, so
 * `vino` reaches `vino-tinto` and not `vinagre-de-vino-tinto`, which is
 * excepted by name in `isExceptedFromRuns`.
 */
export const PATTERN_SLUG_RUNS: Readonly<Record<string, readonly string[]>> = {
  halal: [...ALCOHOL_RUNS, ...GELATINE_RUNS],
  kosher: [...ALCOHOL_RUNS, ...GELATINE_RUNS, ...SCALELESS_FISH_RUNS]
};

/**
 * What a way of eating excludes by name: exact catalogue slugs, never runs.
 *
 * `traditional_spanish` (`0077`): the rows foreign to Spanish home cooking —
 * soy and meat substitutes, foreign grains and noodles, Asian and Latin
 * American sauces, foreign breads, tropical produce, foreign cheeses, plant
 * drinks. Exact, because a run would overreach: `ostra` would take
 * `seta-ostra`. A slug here the catalogue does not hold is ignored; the seed
 * test keeps the list inside the seed. Avena, aguacate, cuscús, basmati and
 * the modern dairy stay, by the owner's choice.
 */
export const PATTERN_EXCLUDED_SLUGS: Readonly<Record<string, ReadonlySet<string>>> = {
  traditional_spanish: new Set([
    'aceite-de-coco',
    'aceite-de-sesamo',
    'agua-de-coco',
    'alga-kombu',
    'alga-nori',
    'alga-wakame',
    'alubias-negras-cocidas',
    'amaranto',
    'arroz-jazmin-crudo',
    'arroz-para-sushi',
    'arroz-salvaje-cocido',
    'arroz-salvaje-crudo',
    'arroz-tres-delicias-congelado',
    'azukis',
    'baba-ganoush',
    'bagel',
    'bebida-de-proteinas',
    'bebida-de-proteinas-vegetal',
    'brotes-de-alfalfa',
    'brotes-de-soja',
    'bulgur-cocido',
    'bulgur-crudo',
    'caldo-dashi',
    'chile-chipotle-seco',
    'chutney-de-mango',
    'cinco-especias-chinas',
    'coco-fresco',
    'col-china',
    'col-rizada',
    'crema-agria',
    'crema-de-anacardos',
    'crema-de-coco',
    'curry-en-polvo',
    'daikon',
    'edamame-cocido',
    'edamame-congelado',
    'espirulina',
    'fideos-de-arroz-cocidos',
    'fideos-de-arroz-secos',
    'fideos-de-cristal',
    'fideos-soba',
    'filete-de-panga-congelado',
    'freekeh',
    'frijoles-refritos',
    'garam-masala',
    'ghee',
    'gochujang',
    'guacamole',
    'hamburguesa-vegetal',
    'harina-de-trigo-sarraceno',
    'harissa',
    'heura',
    'hierba-limon',
    'hummus',
    'hummus-de-remolacha',
    'jackfruit',
    'jalapeno',
    'jengibre-en-polvo',
    'jengibre-fresco',
    'judia-mungo',
    'kimchi',
    'kombucha',
    'leche-de-almendra',
    'leche-de-avena',
    'leche-de-coco',
    'leche-de-coco-ligera',
    'leche-de-soja',
    'lentejas-rojas-cocidas',
    'levadura-nutricional',
    'lichi',
    'mango',
    'mango-congelado',
    'mantequilla-de-cacahuete',
    'maracuya',
    'mijo',
    'mijo-cocido',
    'miso',
    'nachos',
    'noodles-de-trigo',
    'noodles-udon',
    'nuggets-vegetales',
    'okra',
    'pak-choi',
    'pan-bao',
    'pan-de-pita',
    'pan-naan',
    'papaya',
    'papel-de-arroz',
    'pasta-de-curry-rojo',
    'pasta-de-curry-verde',
    'pate-vegetal',
    'pesto-vegano',
    'pitaya',
    'platano-macho',
    'proteina-de-guisante',
    'proteina-de-suero',
    'queso-cheddar',
    'queso-cottage',
    'queso-feta',
    'queso-halloumi',
    'queso-havarti',
    'queso-raclette',
    'queso-scamorza',
    'queso-vegano',
    'quinoa-cocida',
    'quinoa-cruda',
    'quinoa-hinchada',
    'ramen-instantaneo',
    'ras-el-hanout',
    'salchichas-vegetales',
    'salsa-agridulce',
    'salsa-barbacoa',
    'salsa-de-chile-dulce',
    'salsa-de-ostras',
    'salsa-de-pescado',
    'salsa-de-soja',
    'salsa-de-soja-baja-en-sal',
    'salsa-hoisin',
    'salsa-pico-de-gallo',
    'salsa-ponzu',
    'salsa-satay',
    'salsa-sriracha',
    'salsa-teriyaki',
    'sazonador-para-tacos',
    'seitan',
    'sesamo',
    'seta-shiitake',
    'sirope-de-agave',
    'sirope-de-arce',
    'sirope-de-datiles',
    'skyr',
    'soja-cocida',
    'soja-en-grano',
    'soja-texturizada',
    'sumac',
    'tahini',
    'tamari',
    'te-matcha',
    'tempeh',
    'tilapia',
    'tofu-ahumado',
    'tofu-firme',
    'tofu-sedoso',
    'tortilla-de-maiz',
    'tortilla-de-trigo',
    'tortitas-americanas',
    'tortitas-de-maiz',
    'trigo-sarraceno',
    'trigo-sarraceno-cocido',
    'tzatziki',
    'vinagre-de-arroz',
    'wasabi',
    'wrap-integral',
    'yogur-de-coco',
    'yogur-de-soja',
    'yuca',
    'zaatar'
  ])
};

/** Legumes, by the head of the slug: a plato de cuchara's base, not `pasta-de-lentejas` or `harina-de-garbanzo`. */
const LEGUME_HEADS: readonly string[] = ['alubias', 'garbanzos', 'habas', 'judias-rojas', 'judiones', 'lentejas'];

/**
 * The rows traditional Spanish cooking is built on (`0077`), by what a slug
 * starts with: legumes, rice and the huerta. By the head of the slug, not a run
 * anywhere in it, so `lentejas-cocidas` leans and `pasta-de-lentejas`,
 * `harina-de-garbanzo` and `seta-de-cardo` do not. Fish and seafood are their
 * classes.
 */
const SPANISH_LEAN_HEADS: readonly string[] = [
  ...LEGUME_HEADS,
  // Rice — the foreign ones are excluded before the lean is read
  'arroz',
  // Huerta
  'acelga',
  'alcachofa',
  'alcachofas',
  'berenjena',
  'borraja',
  'brocoli',
  'calabacin',
  'cardo',
  'coliflor',
  'espinaca',
  'espinacas',
  'judia-verde',
  'judias-verdes',
  'pimiento',
  'pimientos',
  'puerro'
];

/** Whether a slug starts with one of these heads, as whole words. */
function startsWithHead(slug: string, heads: readonly string[]): boolean {
  return heads.some(head => slug === head || slug.startsWith(`${head}-`));
}

/** Whether a catalogue row is a legume in the sense `0077` leans to — what the evaluator counts a plato de cuchara by. */
export function isLegumeSlug(slug: string): boolean {
  return startsWithHead(slug, LEGUME_HEADS);
}

/**
 * What a way of eating leans towards, as a test on a catalogue row. A lean, not
 * a rule: it moves a dish to the front of the library's pick through the same
 * `Leaning` a liked food does, and takes nothing out.
 */
const PATTERN_LEANS: Readonly<Record<string, readonly ((ingredient: CatalogueIngredient) => boolean)[]>> = {
  traditional_spanish: [
    ingredient => startsWithHead(ingredient.slug, SPANISH_LEAN_HEADS),
    ingredient => ingredient.classes.includes('fish') || ingredient.classes.includes('shellfish')
  ]
};

/**
 * What a health-revealing way of eating excludes, as allergen keys and which
 * presences count. Gluten-free takes traces out too: somebody who eats that way
 * is often coeliac, and the declaration does not say they are not. Lactose-free
 * reads `milk` as well as `lactose`, because the catalogue tags lactose on only
 * part of its dairy; a row whose slug says `sin-lactosa` is what it says.
 */
export const PATTERN_ALLERGENS: Readonly<
  Record<string, { readonly keys: readonly string[]; readonly presences: readonly ('contains' | 'may_contain')[] }>
> = {
  gluten_free: { keys: ['gluten'], presences: ['contains', 'may_contain'] },
  lactose_free: { keys: ['lactose', 'milk'], presences: ['contains'] }
};

/** Whether a row carries an allergen a health-revealing way of eating rules out. */
function hasPatternAllergen(ingredient: CatalogueIngredient, patterns: readonly string[], allergenIdsByKey: ReadonlyMap<string, string>): boolean {
  return patterns.some(pattern => {
    const rule = PATTERN_ALLERGENS[pattern];

    if (!rule || (pattern === 'lactose_free' && hasRun(ingredient.slug, ['sin-lactosa']))) {
      return false;
    }

    const ids = new Set(rule.keys.map(key => allergenIdsByKey.get(key)).filter((id): id is string => id !== undefined));

    return ingredient.allergens.some(link => ids.has(link.allergenId) && rule.presences.includes(link.presence));
  });
}

/**
 * The runs that mark a catalogue row as a substitute built for one
 * restriction — gluten-free bread, lactose-free milk — never a food anyone
 * without it reaches for, the same whole-token rule `PATTERN_ALLERGENS`'
 * `lactose_free` guard already reads a `sin-lactosa` slug by. Two seed
 * dishes reached an account with no gluten restriction at all, built around
 * gluten-free bread, because nothing asked whether this person's restriction
 * was the one the ingredient exists for (owner, 2026-09-26). Everyone else
 * already has the ordinary version the catalogue lists them beside it.
 */
const FREE_FROM_RUNS: Readonly<Record<'gluten' | 'lactose', readonly string[]>> = { gluten: ['sin-gluten'], lactose: ['sin-lactosa'] };

/** The allergen keys, and the dietary pattern, that mean this person needs a `FREE_FROM_RUNS` restriction. */
const FREE_FROM_NEEDS: Readonly<Record<keyof typeof FREE_FROM_RUNS, { readonly allergenKeys: readonly string[]; readonly pattern: string }>> = {
  gluten: { allergenKeys: ['gluten'], pattern: 'gluten_free' },
  // `lactose` covers an intolerance declared against either key — the seed
  // links lactose-free milk to `milk` alone (it still carries the protein),
  // so a milk *allergy* is a different, stricter restriction the allergy gate
  // already refuses this ingredient for on its own.
  lactose: { allergenKeys: ['lactose', 'milk'], pattern: 'lactose_free' }
};

/**
 * Whether this person has the restriction a free-from substitute exists for
 * — an allergy or intolerance naming its allergen, or the matching way of
 * eating.
 */
function hasFreeFromRestriction(
  restriction: keyof typeof FREE_FROM_RUNS,
  input: {
    readonly allergenIdsByKey: ReadonlyMap<string, string>;
    readonly dietaryPatterns: readonly string[];
    readonly restrictedAllergenIds: ReadonlySet<string>;
  }
): boolean {
  const need = FREE_FROM_NEEDS[restriction];

  return (
    input.dietaryPatterns.includes(need.pattern) ||
    need.allergenKeys.some(key => {
      const id = input.allergenIdsByKey.get(key);

      return id !== undefined && input.restrictedAllergenIds.has(id);
    })
  );
}

/**
 * Every free-from substitute this person has no restriction for — gluten-free
 * bread offered to somebody with no gluten allergy, intolerance or way of
 * eating, say.
 *
 * A preference, not a safety rule: eating it harms nobody, so `dishSafety` is
 * unmoved by this set and a person who *does* need it keeps every one of
 * these on their catalogue exactly as before — `hasFreeFromRestriction`
 * answers true and nothing here touches it. Merged into
 * `GenerationContext.preferences.excludedIngredientIds` the way
 * `proteinSupplementExclusions` is, so the one set that already keeps a dish
 * off the library's reuse pool (`RecipeController.usesExcluded`) and off the
 * model's catalogue (`PoolBuilder.isWantedIngredient`) keeps this off both
 * too, with no second gate to keep in step.
 */
export function freeFromExclusions(
  ingredients: readonly { readonly id: string; readonly slug: string }[],
  input: {
    readonly allergenIdsByKey: ReadonlyMap<string, string>;
    readonly dietaryPatterns: readonly string[];
    readonly restrictedAllergenIds: ReadonlySet<string>;
  }
): ReadonlySet<string> {
  const restrictions = (Object.keys(FREE_FROM_RUNS) as (keyof typeof FREE_FROM_RUNS)[]).filter(
    restriction => !hasFreeFromRestriction(restriction, input)
  );

  if (restrictions.length === 0) {
    return new Set();
  }

  const runs = restrictions.flatMap(restriction => FREE_FROM_RUNS[restriction]);

  return new Set(ingredients.filter(ingredient => hasRun(ingredient.slug, runs)).map(ingredient => ingredient.id));
}

/** Ways of eating that never put meat and dairy in one dish. Judged per dish, by `breaksDishRule`. */
const SEPARATES_MEAT_AND_DAIRY: ReadonlySet<string> = new Set(['kosher']);

/** Whether a slug contains any of these runs of whole words. */
function hasRun(slug: string, runs: readonly string[]): boolean {
  const tokens = slug.split('-');

  return runs.some(run => {
    const words = run.split('-');

    return tokens.some((_token, start) => words.every((word, offset) => tokens[start + offset] === word));
  });
}

/** A vinegar is not a drink, and an alcohol-free drink is the point of its name. */
function isExceptedFromRuns(slug: string): boolean {
  return slug.startsWith('vinagre') || hasRun(slug, ['sin-alcohol']);
}

/**
 * The words people use for a whole family of food, and the classes each names.
 *
 * The mirror image of the allergy synonym list, and deliberately so: there, a
 * group word is refused because narrowing "marisco" to prawns would leave
 * mussels on the plate of someone who could die of them. Here the group word is
 * *expanded* — the risk runs the other way. Someone who says they dislike fish
 * and is served hake has been ignored; someone who dislikes fish and is served
 * no seafood at all has been understood.
 */
const GROUP_LABELS: ReadonlyMap<string, readonly FoodClass[]> = new Map([
  ['carne', ['meat', 'pork']],
  ['carnes', ['meat', 'pork']],
  ['cerdo', ['pork']],
  ['embutido', ['pork']],
  ['embutidos', ['pork']],
  ['huevo', ['egg']],
  ['huevos', ['egg']],
  ['lacteos', ['dairy']],
  ['leche', ['dairy']],
  ['marisco', ['shellfish']],
  ['mariscos', ['shellfish']],
  ['pescado', ['fish']],
  ['pescados', ['fish']],
  ['pescado y marisco', ['fish', 'shellfish']]
]);

/**
 * Whether a dislike is a promise or a request — the same question
 * `resolvePreferences` answers while building a plan, asked without one.
 *
 * Deliberately needs no catalogue classes and no macros: a group word is known
 * from the map, and everything else is an exact name or slug. That keeps it
 * cheap enough to run on a profile screen, and it is the *same* rule, not a
 * second one that agrees until it does not.
 */
export function isEnforceableDislike(label: string, ingredients: readonly { readonly name: string; readonly slug: string }[]): boolean {
  const key = normaliseForMatching(label);

  if (key === '') {
    return false;
  }

  if (GROUP_LABELS.has(key)) {
    return true;
  }

  return ingredients.some(ingredient => normaliseForMatching(ingredient.name) === key || normaliseForMatching(ingredient.slug) === key);
}

export type PreferenceExclusions = {
  /** Every catalogue row a way of eating or a dislike rules out. */
  readonly excludedIngredientIds: ReadonlySet<string>;
  /**
   * Whether a dish may not hold meat and dairy together (kosher). A rule on the
   * dish, not on an ingredient: each is fine alone. See `breaksDishRule`.
   */
  readonly keepsMeatFromDairy: boolean;
  /**
   * Catalogue rows a way of eating leans towards, as slugs — for
   * `traditional_spanish`, legumes, fish and seafood, rice and huerta
   * vegetables (`0077`). A weight on the pick like a like, never a rule, and
   * kept apart from `preferredIngredientSlugs` because those are named to the
   * model as what they like and these are not. Never holds an excluded row.
   * Joined with the likes by `leaningSlugs`.
   */
  readonly leaningIngredientSlugs: ReadonlySet<string>;
  /**
   * The longest a dish may take, prep plus cooking, or null when they set none.
   *
   * Enforced rather than asked for the reason the whole of `0023` exists: a
   * person who says thirty minutes and is handed a fifty-minute stew has been
   * ignored, and the model is the wrong place to guarantee it.
   */
  readonly maxMinutesPerDish: number | null;
  /**
   * Foods they said they like, as catalogue slugs.
   *
   * Not a rule: a like cannot be enforced the way a dislike can — you can serve
   * someone salmon, you cannot make them enjoy it. It is a weight on the pick
   * (0026), which is why these are slugs for the rotation rather than ids for a
   * filter.
   */
  readonly preferredIngredientSlugs: ReadonlySet<string>;
  /**
   * Whether a dish of a foreign cuisine, or with a foreign name, is out
   * (`traditional_spanish`). A rule on the dish, not on an ingredient. See
   * `breaksPatternDish`.
   */
  readonly refusesForeignDishes: boolean;
  /** Dislikes that named nothing the catalogue knows. Never sent to the model (prompt 4.0.0), never claimed as applied. */
  readonly unenforceableLabels: readonly string[];
};

/**
 * Every catalogue row a label names, or null when it names nothing the
 * catalogue knows.
 *
 * The two are different answers and the caller needs both: an empty list from a
 * word we understand ("pescado" on a catalogue with no fish) still keeps its
 * promise; a null means all we can do is ask the model.
 */
function named(
  raw: string,
  ingredients: readonly CatalogueIngredient[],
  byKey: ReadonlyMap<string, CatalogueIngredient>
): readonly CatalogueIngredient[] | null {
  const key = normaliseForMatching(raw.trim());

  if (key === '') {
    return null;
  }

  const group = GROUP_LABELS.get(key);

  if (group) {
    const wanted = new Set(group);

    return ingredients.filter(ingredient => inClasses(ingredient, wanted));
  }

  const match = byKey.get(key);

  if (!match) {
    return null;
  }

  // The row itself and everything made of it, by the same whole-token rule the
  // allergy layer uses: `salmon` is a run inside `salmon-ahumado`, and is not a
  // run inside `salmonete`.
  const run = match.slug.split('-');

  return ingredients.filter(ingredient => {
    const tokens = ingredient.slug.split('-');

    return tokens.some((_token, start) => run.every((word, offset) => tokens[start + offset] === word));
  });
}

/** Whether an ingredient belongs to any of these classes. */
function inClasses(ingredient: CatalogueIngredient, classes: ReadonlySet<FoodClass>): boolean {
  return ingredient.classes.some(cls => classes.has(cls));
}

/**
 * The catalogue rows a person's *preferences* exclude — their way of eating and
 * the things they said they dislike.
 *
 * Three ways a dislike resolves, in order:
 *   1. the exact name or slug of a catalogue row, and everything made of it —
 *      "salmón" reaches `salmon-ahumado` and `salmon-congelado`;
 *   2. a group word, through `GROUP_LABELS` — "pescado" reaches every fish;
 *   3. nothing, in which case the label is returned as unenforceable.
 *
 * This is a preference, not a safety rule, and the two are kept apart on
 * purpose: a stored plan is never re-judged against it, no violation is
 * reported for one, and a dish rejected here is rejected quietly.
 */
export function resolvePreferences(input: {
  /**
   * The allergen catalogue by key, so `gluten_free` and `lactose_free` can be
   * enforced by the same tags the allergy gate reads. Required, so a caller
   * that forgets it fails to compile rather than serving gluten.
   */
  readonly allergenIdsByKey: ReadonlyMap<string, string>;
  readonly dietaryPatterns: readonly string[];
  readonly dislikedLabels: readonly string[];
  readonly ingredients: readonly CatalogueIngredient[];
  readonly likedLabels?: readonly string[];
  readonly maxMinutesPerDish?: number | null;
}): PreferenceExclusions {
  const classes = new Set<FoodClass>(input.dietaryPatterns.flatMap(pattern => PATTERN_EXCLUSIONS[pattern] ?? []));
  const runs = [...new Set(input.dietaryPatterns.flatMap(pattern => PATTERN_SLUG_RUNS[pattern] ?? []))];
  const slugs = new Set(input.dietaryPatterns.flatMap(pattern => [...(PATTERN_EXCLUDED_SLUGS[pattern] ?? [])]));
  const excluded = new Set<string>();
  const unenforceable: string[] = [];

  const byAllergen = input.dietaryPatterns.filter(pattern => PATTERN_ALLERGENS[pattern] !== undefined);
  const { allergenIdsByKey } = input;

  if (classes.size > 0 || runs.length > 0 || slugs.size > 0 || byAllergen.length > 0) {
    for (const ingredient of input.ingredients) {
      if (
        inClasses(ingredient, classes) ||
        slugs.has(ingredient.slug) ||
        (hasRun(ingredient.slug, runs) && !isExceptedFromRuns(ingredient.slug)) ||
        hasPatternAllergen(ingredient, byAllergen, allergenIdsByKey)
      ) {
        excluded.add(ingredient.id);
      }
    }
  }

  const byKey = new Map<string, CatalogueIngredient>();

  for (const ingredient of input.ingredients) {
    for (const key of [normaliseForMatching(ingredient.name), normaliseForMatching(ingredient.slug)]) {
      if (key !== '' && !byKey.has(key)) {
        byKey.set(key, ingredient);
      }
    }
  }

  for (const raw of input.dislikedLabels) {
    const rows = named(raw, input.ingredients, byKey);

    if (rows === null) {
      unenforceable.push(raw.trim());
      continue;
    }

    for (const ingredient of rows) {
      excluded.add(ingredient.id);
    }
  }

  const preferred = new Set<string>();

  for (const raw of input.likedLabels ?? []) {
    for (const ingredient of named(raw, input.ingredients, byKey) ?? []) {
      preferred.add(ingredient.slug);
    }
  }

  const leans = input.dietaryPatterns.flatMap(pattern => PATTERN_LEANS[pattern] ?? []);
  const leaning = new Set(
    leans.length === 0
      ? []
      : input.ingredients
          .filter(ingredient => !excluded.has(ingredient.id) && leans.some(lean => lean(ingredient)))
          .map(ingredient => ingredient.slug)
  );

  return {
    excludedIngredientIds: excluded,
    keepsMeatFromDairy: input.dietaryPatterns.some(pattern => SEPARATES_MEAT_AND_DAIRY.has(pattern)),
    leaningIngredientSlugs: leaning,
    maxMinutesPerDish: input.maxMinutesPerDish ?? null,
    preferredIngredientSlugs: preferred,
    refusesForeignDishes: input.dietaryPatterns.some(pattern => REFUSES_FOREIGN_DISHES.has(pattern)),
    unenforceableLabels: unenforceable
  };
}

/** Nothing excluded — for a caller with no profile to read, and for tests. */
export const NO_PREFERENCE_EXCLUSIONS: PreferenceExclusions = {
  excludedIngredientIds: new Set(),
  keepsMeatFromDairy: false,
  leaningIngredientSlugs: new Set(),
  maxMinutesPerDish: null,
  preferredIngredientSlugs: new Set(),
  refusesForeignDishes: false,
  unenforceableLabels: []
};

/**
 * The most minutes a dish may take and still be offered to someone whose
 * limit is `limit`: the limit plus a fifth, rounded up to the next ten.
 *
 * The minutes on a dish are an estimate — the model's, or the recipe's author's
 * — and a strict limit threw dishes away for running a minute or two over it:
 * across a week's benchmark, time was a routine reason to drop a dish, and a
 * real generation lost its only model dinner to it. The owner's rule: 30
 * admits 40, 55 admits 70 (55 × 1.2 = 66), 25 admits 30. Integer arithmetic,
 * so an exact multiple of ten stays where it is. The prompt still asks for the
 * limit itself; this margin is only for accepting what comes back.
 */
export function timeAllowance(limit: number): number {
  return Math.ceil((limit * 12) / 100) * 10;
}

/** Whether a dish can be cooked in the time they said they have, give or take the margin `timeAllowance` allows. */
export function withinTime(dish: { readonly cookMinutes: number; readonly prepMinutes: number }, limit: number | null): boolean {
  return limit === null || dish.prepMinutes + dish.cookMinutes <= timeAllowance(limit);
}

/**
 * Whether a whole dish breaks a rule of their way of eating that no single
 * ingredient does — today, meat with dairy for someone who keeps them apart.
 * Meat is `meat` or `pork` (pork implies meat in the seed, and both are named
 * so a row tagged with one alone is still caught); a stock made of meat counts.
 */
export function breaksDishRule(
  ingredients: readonly { readonly slug: string }[],
  catalogue: ReadonlyMap<string, { readonly classes: readonly FoodClass[] }>,
  preferences: Pick<PreferenceExclusions, 'keepsMeatFromDairy'>
): boolean {
  if (!preferences.keepsMeatFromDairy) {
    return false;
  }

  const classes = new Set(ingredients.flatMap(item => catalogue.get(item.slug)?.classes ?? []));

  return (classes.has('meat') || classes.has('pork')) && classes.has('dairy');
}

/**
 * Every slug the library pick puts first for this person: the foods they said
 * they like, and the ones their way of eating leans towards. One union, so a
 * plan and a single swap lean the same way (`Rotation.isPreferredDish`).
 */
export function leaningSlugs(preferences: Pick<PreferenceExclusions, 'leaningIngredientSlugs' | 'preferredIngredientSlugs'>): ReadonlySet<string> {
  if (preferences.leaningIngredientSlugs.size === 0) {
    return preferences.preferredIngredientSlugs;
  }

  return new Set([...preferences.preferredIngredientSlugs, ...preferences.leaningIngredientSlugs]);
}

/**
 * The cuisine families foreign to Spanish home cooking (`0077`, as amended
 * 2026-10-03): a dish whose stated cuisine `cuisineFamily` reads as one of
 * these is out for `traditional_spanish`. Read from the family, not from a
 * second list, so a value added to `0079`'s Table 1 is refused the day it is
 * mapped — "turca" and "cubana" reached the plan while the two lists drifted.
 */
export const FOREIGN_FAMILIES: ReadonlySet<CuisineFamily> = new Set(['arab', 'asian', 'latin']);

/**
 * Foreign cuisines Table 1 maps to no family, normalised (`normaliseForMatching`:
 * lower case, no accents). They read as `other` there, judged with the Spanish
 * table, and are refused here by name.
 */
export const FOREIGN_UNMAPPED_CUISINES: ReadonlySet<string> = new Set(['americana', 'estadounidense', 'tropical', 'nordica', 'escandinava', 'fusion']);

/**
 * Whether a stated cuisine is foreign to Spanish home cooking. Mediterránea,
 * española and its regions, italiana, francesa and griega pass on their
 * ingredients, and so does a dish with no cuisine at all.
 */
export function isForeignCuisine(cuisine: string | null | undefined): boolean {
  if (!cuisine) {
    return false;
  }

  return FOREIGN_FAMILIES.has(cuisineFamily(cuisine)) || FOREIGN_UNMAPPED_CUISINES.has(normaliseForMatching(cuisine));
}

/**
 * A dish name that gives away a foreign dish (`0077`), read on the normalised
 * name — accents gone and punctuation a space — so "Tabulé" meets `tabule` and
 * a word boundary is plain ASCII. "Tacos" is foreign at the start of a name or
 * as the Mexican kind, and Spanish otherwise: "huevos al plato con tacos de
 * jamón" keeps its tacos.
 */
const FOREIGN_DISH_NAME =
  /\b(?:curry|shakshuka|wok|poke|sushi|ramen|burrito|fajitas?|quesadilla|teriyaki|pad thai|falafel|tabule|nachos|hummus|guacamole|chipotle|tikka|masala|noodles?|bibimbap|kimchi)\b|^tacos\b|\btacos (?:de pollo|de ternera|de pescado|mexicanos|al pastor)\b/;

/** Ways of eating that refuse a dish by its cuisine or its name. Judged per dish, by `breaksPatternDish`. */
const REFUSES_FOREIGN_DISHES: ReadonlySet<string> = new Set(['traditional_spanish']);

/**
 * Whether a whole dish is foreign to this person's way of eating by what it
 * says it is rather than by what it holds: a stated cuisine
 * `isForeignCuisine` refuses, or a name `FOREIGN_DISH_NAME` gives away. A missing or
 * empty cuisine passes; its ingredients are judged on their own, by
 * `excludedIngredientIds`.
 */
export function breaksPatternDish(
  dish: { readonly cuisine: string | null; readonly name: string },
  preferences: Pick<PreferenceExclusions, 'refusesForeignDishes'>
): boolean {
  if (!preferences.refusesForeignDishes) {
    return false;
  }

  if (isForeignCuisine(dish.cuisine)) {
    return true;
  }

  return FOREIGN_DISH_NAME.test(normaliseForMatching(dish.name));
}
