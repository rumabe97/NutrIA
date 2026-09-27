import { matchCustomAllergen, normaliseForMatching, toMatchIndex } from 'core/domain/Safety';

import { pictureParts } from './prompt';

import type { MatchIndex } from 'core/domain/Safety';
import type { PictureRecipe } from './prompt';

/**
 * Whether a drawn picture may be kept (`0066`, PRD 6).
 *
 * A vision judge names the foods it sees (call a) and matches them against the
 * recipe (call b). This file decides. **The allergens come from the catalogue,
 * never from the judge**: a named food is mapped to catalogue ingredients here,
 * in code, and their `ingredient_allergens` are what count. A picture is
 * rejected only when it clearly shows a food — named specifically, more than
 * a trace — that carries an allergen none of the dish's ingredients carries.
 * Everything else is a note.
 *
 * The matcher leans the other way from the one it is built on. For a typed
 * allergy a wrong match is shown as enforced, so `CustomAllergen` matches
 * exactly or not at all. Here a missed match lets a picture of prawns stand
 * for a dish with none, and a wrong one costs a redraw — so after the exact
 * match comes a word-by-word one, and an unmapped name is kept as a note.
 */

/** How much of a food the judge sees. `trace` never rejects a picture. */
export type SeenAmount = 'garnish' | 'main' | 'side' | 'trace';

export type SeenFood = {
  readonly amount: SeenAmount;
  readonly name: string;
  /** False when the judge could not name it — a "sauce", a "white drizzle". */
  readonly specific: boolean;
};

/** Call (a): what the picture shows, without knowing what it should. */
export type SeenPicture = {
  readonly extraDishes?: number;
  readonly foods: readonly SeenFood[];
  readonly nonFood?: readonly string[];
  readonly plasticOrCgi?: boolean;
  readonly realism?: number;
  readonly sharpness?: number;
};

/** Call (b): each ingredient seen or not, and the seen foods that match none. */
export type PictureMatch = {
  readonly extras: readonly string[];
  readonly ingredients: readonly { readonly matched: readonly string[]; readonly slug: string; readonly status: 'not_seen' | 'seen' | 'unsure' }[];
};

/**
 * A catalogue ingredient as the rule reads it: every name it has, in any
 * locale, and the allergens it contains (`presence = 'contains'`), by key.
 */
export type PictureCatalogueEntry = { readonly allergens: readonly string[]; readonly names: readonly string[]; readonly slug: string };

export type PictureExtra = {
  readonly amount: SeenAmount;
  /** Allergens of the food that none of the dish's ingredients carries. */
  readonly foreignAllergens: readonly string[];
  /** A preparation, not a food ("sauce", "white drizzle"): mapped to nothing. */
  readonly generic: boolean;
  /** The catalogue slugs the name was mapped to; empty when none. */
  readonly mappedTo: readonly string[];
  readonly name: string;
  readonly specific: boolean;
};

export type PictureVerdict = { readonly accepted: boolean; readonly extras: readonly PictureExtra[]; readonly notes: readonly string[] };

/**
 * Words that say how a food looks, is cut or was cooked, never what it is.
 * "Hard-boiled egg" is an egg, "red bell peppers" are peppers, "grated
 * cheese" is cheese. `orange` is a fruit before it is a colour, and stays.
 */
const DESCRIPTORS: ReadonlySet<string> = new Set([
  'baby',
  'baked',
  'black',
  'boiled',
  'braised',
  'brown',
  'caramelised',
  'caramelized',
  'charred',
  'chopped',
  'chunks',
  'cooked',
  'creamy',
  'crispy',
  'crushed',
  'cubed',
  'cubes',
  'dark',
  'diced',
  'dollop',
  'dried',
  'fat',
  'fillet',
  'fillets',
  'fresh',
  'fried',
  'golden',
  'grated',
  'green',
  'grilled',
  'ground',
  'halved',
  'hard',
  'large',
  'light',
  'low',
  'mashed',
  'mature',
  'minced',
  'natural',
  'pale',
  'piece',
  'pieces',
  'plain',
  'poached',
  'raw',
  'red',
  'ring',
  'rings',
  'roasted',
  'salted',
  'sauteed',
  'scrambled',
  'semi',
  'shaved',
  'shredded',
  'skimmed',
  'slice',
  'sliced',
  'slices',
  'small',
  'smoked',
  'soft',
  'steamed',
  'stewed',
  'strips',
  'tinned',
  'toasted',
  'unsalted',
  'wedge',
  'wedges',
  'white',
  'whole',
  'yellow'
]);

/**
 * Words that name a preparation, not a food. A name made only of these and
 * descriptors — "sauce", "white drizzle", "creamy sauce", "broth" — maps to
 * nothing, whatever the judge said: the pilot's judge read a pale sauce on a
 * dish with no milk as milk. A food word beside one still counts: "peanut
 * sauce" is peanuts, "sesame dressing" is sesame.
 */
const GENERIC: ReadonlySet<string> = new Set([
  'broth',
  'coating',
  'drizzle',
  'dressing',
  'dusting',
  'filling',
  'garnish',
  'glaze',
  'herb',
  'herbs',
  'juice',
  'liquid',
  'mixture',
  'reduction',
  'sauce',
  'seasoning',
  'sheen',
  'spice',
  'spices',
  'stock',
  'topping'
]);

/** Linking words in the judge's English, and the `s` a possessive leaves behind ("goat's cheese"). */
const LINKING: ReadonlySet<string> = new Set(['a', 'and', 'in', 'of', 'on', 'or', 's', 'the', 'with']);

/**
 * The judge's English for a food the catalogue names otherwise, normalised →
 * a catalogue slug whose allergens it shares. Only foods that carry an
 * allergen are worth a line: a missing one here lets a picture through.
 */
const SEEN_SYNONYMS: ReadonlyMap<string, string> = new Map([
  ['biscuit', 'galletas-maria'],
  ['biscuits', 'galletas-maria'],
  ['bread', 'pan-blanco'],
  ['calamari', 'calamar'],
  ['cookie', 'galletas-maria'],
  ['cookies', 'galletas-maria'],
  ['cream', 'nata-para-cocinar'],
  ['croutons', 'pan-blanco'],
  ['fish', 'merluza'],
  ['flatbread', 'pan-de-pita'],
  ['lasagna', 'placas-de-lasana'],
  ['macaroni', 'pasta-cocida'],
  ['mayo', 'mayonesa'],
  ['mussel', 'mejillon'],
  ['nuts', 'nueces'],
  ['oatmeal', 'copos-de-avena'],
  ['pastry', 'masa-de-hojaldre'],
  ['penne', 'pasta-cocida'],
  ['pie', 'masa-quebrada'],
  ['prawn', 'gambas'],
  ['shrimp', 'gambas'],
  ['spaghetti', 'pasta-cocida'],
  ['toast', 'pan-de-molde'],
  ['yogurt', 'yogur-natural-desnatado']
]);

/** "gluten-free", "lactose free": the word before `free` is what the food lacks, not what it is. */
const FREE_OF = /\b[a-z]+ free\b/g;

/** The words of a name that could say what the food is, in order. */
function words(text: string): readonly string[] {
  return normaliseForMatching(text)
    .replace(FREE_OF, ' ')
    .split(' ')
    .filter(word => word !== '' && !LINKING.has(word) && !DESCRIPTORS.has(word));
}

/** A word and its singular, so "prawns" meets "prawn" and "tomatoes" meets "tomato". */
function forms(word: string): readonly string[] {
  const out = new Set([word]);

  if (word.endsWith('oes') || word.endsWith('ies')) {
    out.add(word.endsWith('ies') ? `${word.slice(0, -3)}y` : word.slice(0, -2));
  }

  if (word.endsWith('s') && word.length > 3) {
    out.add(word.slice(0, -1));
  }

  return [...out];
}

function sameWord(a: string, b: string): boolean {
  return forms(a).some(form => forms(b).includes(form));
}

type Catalogue = {
  readonly bySlug: ReadonlyMap<string, PictureCatalogueEntry>;
  readonly entries: readonly PictureCatalogueEntry[];
  readonly index: MatchIndex;
  /** Each entry's names as food words — descriptors and linking words gone — with its slug's words beside them. */
  readonly wordsOf: ReadonlyMap<string, readonly (readonly string[])[]>;
};

function readCatalogue(entries: readonly PictureCatalogueEntry[]): Catalogue {
  return {
    bySlug: new Map(entries.map(entry => [entry.slug, entry])),
    entries,
    index: toMatchIndex(entries.flatMap(entry => entry.names.map(name => ({ id: entry.slug, name, slug: entry.slug })))),
    wordsOf: new Map(entries.map(entry => [entry.slug, [...entry.names, entry.slug].map(words).filter(list => list.length > 0)]))
  };
}

/**
 * The catalogue slugs a seen food's name stands for.
 *
 * 1. The whole name, exactly, as `CustomAllergen` matches it, or through
 *    `SEEN_SYNONYMS`: "peanut butter" is peanut butter and not butter.
 * 2. Otherwise every entry one of whose names is made only of the food's own
 *    words, or that a word names through `SEEN_SYNONYMS`: "feta cheese" is
 *    feta, "chicken with cheese" is chicken and cheese. Each is really in the
 *    food, so all of their allergens count.
 * 3. And for each word no such entry covers, every entry that has the word:
 *    "soy beans" is beans (2) and something soy (3). Only what all of a
 *    word's entries share counts — "oil" is sunflower oil or sesame oil, so it
 *    is neither's sesame.
 */
function mapName(
  name: string,
  food: readonly string[],
  catalogue: Catalogue
): { readonly allergens: ReadonlySet<string>; readonly slugs: readonly string[] } {
  const exact = matchCustomAllergen(name, catalogue.index) ?? SEEN_SYNONYMS.get(normaliseForMatching(name));
  const exactEntry = exact === undefined ? undefined : catalogue.bySlug.get(exact);

  if (exactEntry) {
    return { allergens: new Set(exactEntry.allergens), slugs: [exactEntry.slug] };
  }

  const namesOf = (entry: PictureCatalogueEntry) => catalogue.wordsOf.get(entry.slug) ?? [];
  const synonyms = food.flatMap(word => {
    const entry = catalogue.bySlug.get(SEEN_SYNONYMS.get(word) ?? '');

    return entry ? [{ covers: [word], entry }] : [];
  });
  const whole = catalogue.entries.flatMap(entry => {
    const list = namesOf(entry).find(words => words.every(word => food.some(own => sameWord(own, word))));

    return list ? [{ covers: food.filter(own => list.some(word => sameWord(own, word))), entry }] : [];
  });
  const tight = [...synonyms, ...whole];
  const covered = new Set(tight.flatMap(match => match.covers));
  const allergens = new Set(tight.flatMap(match => match.entry.allergens));
  const slugs = new Set(tight.map(match => match.entry.slug));

  for (const word of food.filter(own => !covered.has(own))) {
    const having = catalogue.entries.filter(entry => namesOf(entry).some(words => words.some(other => sameWord(word, other))));
    const [first, ...others] = having;

    if (!first) {
      continue;
    }

    having.forEach(entry => slugs.add(entry.slug));
    first.allergens.filter(allergen => others.every(entry => entry.allergens.includes(allergen))).forEach(allergen => allergens.add(allergen));
  }

  return { allergens, slugs: [...slugs] };
}

/**
 * The seen foods the match left out: neither an extra nor matched to an
 * ingredient. A judge that drops one must not be how a food gets through.
 */
function unaccounted(seen: SeenPicture, match: PictureMatch): readonly string[] {
  const named = new Set([...match.extras, ...match.ingredients.flatMap(ingredient => ingredient.matched)].map(normaliseForMatching));

  return seen.foods.map(food => food.name).filter(name => !named.has(normaliseForMatching(name)));
}

/** Whether every word of one name is a word of the other: "prawns" and "grilled prawns", never "egg" and "eggplant". */
function holds(a: string, b: string): boolean {
  const [short, long] = [a, b].map(text => normaliseForMatching(text).split(' ')).sort((x, y) => x.length - y.length) as [string[], string[]];

  return short.every(word => word !== '' && long.includes(word));
}

/** The seen food an extra's name refers to, exactly, or else by one name holding the other's words. */
function seenFood(name: string, seen: SeenPicture): SeenFood | undefined {
  const key = normaliseForMatching(name);

  return seen.foods.find(food => normaliseForMatching(food.name) === key) ?? seen.foods.find(food => holds(food.name, name));
}

function qualityNotes(seen: SeenPicture): readonly string[] {
  return [
    seen.plasticOrCgi === true || (seen.realism !== undefined && seen.realism < 4) ? 'plastic_cgi' : '',
    seen.sharpness !== undefined && seen.sharpness < 4 ? 'blur' : '',
    (seen.nonFood?.length ?? 0) > 0 ? 'non_food' : '',
    (seen.extraDishes ?? 0) > 0 ? 'extra_dish' : ''
  ].filter(note => note !== '');
}

/**
 * The verdict on one picture of `recipe`.
 *
 * `catalogue` must hold the dish's own ingredients and may hold the whole
 * catalogue — the more it holds, the more of what the judge names is mapped.
 */
export function judgePicture(input: {
  readonly catalogue: readonly PictureCatalogueEntry[];
  readonly match: PictureMatch;
  readonly recipe: PictureRecipe;
  readonly seen: SeenPicture;
}): PictureVerdict {
  const { match, recipe, seen } = input;
  const catalogue = readCatalogue(input.catalogue);
  const unknown = recipe.ingredients.filter(ingredient => !catalogue.bySlug.has(ingredient.slug)).map(ingredient => ingredient.slug);
  const dishAllergens = new Set(recipe.ingredients.flatMap(ingredient => catalogue.bySlug.get(ingredient.slug)?.allergens ?? []));
  const names = [...new Map([...match.extras, ...unaccounted(seen, match)].map(name => [normaliseForMatching(name), name])).values()];

  const extras = names.map((name): PictureExtra => {
    // An extra the judge named in (b) but not in (a) is taken at its word: specific, and more than a trace.
    const food = seenFood(name, seen);
    const specific = food?.specific ?? true;
    const amount = food?.amount ?? 'main';
    const own = words(name).filter(word => !GENERIC.has(word));
    const generic = own.length === 0;
    const { allergens, slugs } = generic ? { allergens: new Set<string>(), slugs: [] } : mapName(name, own, catalogue);
    const foreignAllergens = [...allergens].filter(allergen => !dishAllergens.has(allergen)).sort();

    return { amount, foreignAllergens, generic, mappedTo: slugs, name, specific };
  });

  const rejecting = extras.filter(extra => extra.specific && !extra.generic && extra.amount !== 'trace' && extra.foreignAllergens.length > 0);
  const status = new Map(match.ingredients.map(ingredient => [ingredient.slug, ingredient.status]));
  const missing = pictureParts(recipe).mains.filter(main => status.get(main.slug) === 'not_seen');
  const unmapped = extras.filter(extra => extra.specific && !extra.generic && extra.mappedTo.length === 0);

  const notes = [
    rejecting.length > 0 ? `extra_allergen:${rejecting.map(extra => `${extra.name}=${extra.foreignAllergens.join('+')}`).join('/')}` : '',
    extras.length > 0 ? `extra_food:${extras.map(extra => extra.name).join('/')}` : '',
    unmapped.length > 0 ? `unmapped:${unmapped.map(extra => extra.name).join('/')}` : '',
    missing.length > 0 ? `missing_main:${missing.map(main => main.name).join('/')}` : '',
    unknown.length > 0 ? `unknown_ingredient:${unknown.join('/')}` : '',
    ...qualityNotes(seen)
  ].filter(note => note !== '');

  return { accepted: rejecting.length === 0, extras, notes };
}
