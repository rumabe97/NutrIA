import { matchCustomAllergen, normaliseForMatching, toMatchIndex } from 'core/domain/Safety';

import {
  BARE_FORMS,
  DAIRY_WORDS,
  FORM_FAMILIES,
  NOT_A_FOOD,
  PLANT_QUALIFIERS,
  READINGS,
  SAME_WORD,
  SERVING_WORDS,
  SPELLINGS,
  TITLE_BOWL,
  TITLE_HEAD_ENDS,
  TITLE_NEGATION_ENDS,
  TITLE_NEGATIONS,
  TITLE_NOT_A_FORM,
  TITLE_ONLY_AS_HEAD,
  UNSEEN_WHEN_ONLY_MAY_CONTAIN
} from './forms';
import { pictureParts } from './prompt';

import type { MatchIndex } from 'core/domain/Safety';
import type { PictureCandidateExtra } from 'core/entities/DishPicture';
import type { FormFamily } from './forms';
import type { PictureRecipe } from './prompt';

/**
 * Whether a drawn picture may be kept (`0066`, PRD 6).
 *
 * A vision judge names the foods it sees (call a) and matches them against the
 * recipe (call b). This file decides. **The allergens come from the catalogue,
 * never from the judge**: a named food is mapped to catalogue ingredients here,
 * in code, and their `ingredient_allergens` are what count. A picture is
 * rejected only when it clearly shows an extra food — named specifically, more
 * than a trace — that carries an allergen none of the dish's ingredients
 * carries. Everything else is a note.
 *
 * The matcher leans the other way from the one it is built on. For a typed
 * allergy a wrong match is shown as enforced, so `CustomAllergen` matches
 * exactly or not at all. Here a missed match lets a picture of prawns stand
 * for a dish with none, and a wrong one costs a redraw — so after the exact
 * match comes a word-by-word one, and an unmapped name is kept as a note.
 *
 * **A dish's own form is not an extra food** (`0073`, project 010). A picture
 * shows a form — pancakes, bread, meatballs, milk — not what it is made of, and
 * a word for a form read as its usual recipe rejected faithful pictures of the
 * same dish every time (corn-flour pancakes for gluten, a stew with a plant
 * protein for egg, gluten and milk). When the dish has its own version of the
 * form — an ingredient that is it, or a title that names it, both read from
 * the recipe in code through the closed tables of `forms.ts` — a name that
 * *is* the form brings no allergens, whether the match call paired it or left
 * it over. "Is" is a whitelist, not a guard: once the serving words are set
 * aside ("a glass of", "grated"), the name must be word for word one of the
 * family's `seen` rows. Every other name is read exactly as before the rule:
 * "cheese pancakes", "wheat noodles", "whole milk", "goat cheese", "cream
 * cheese", "cinnamon roll" are other foods. A title names a form only where
 * it means it: not negated ("sin queso ni pan", "en vez de pan",
 * "crustless"), not beside "bowl", and for a few words only as the title's
 * head ("tostadas de boniato", "wraps de lechuga" are no bread and no
 * tortilla). A name of the same form seen beside another that says more is
 * still a second food (project 006). A verdict whose exemption removed an
 * allergen says so: `own_form:<name>`, kept with the picture. The match call
 * decides no more than before, and less.
 *
 * Three words' worth of vocabulary go with it: a word that is not a food
 * ("base", "glass") is not mapped on its own; a plant word before a dairy word
 * ("soy yogurt") maps the plant, not the dairy; and a sulphite a food only may
 * contain never rejects (one it contains — dried apricots, wine — does, even
 * where another row of the same word only may).
 *
 * And the holes are closed (project 010, phase 5): a name that carries an
 * allergen and mapped to none — "pizza", "crepe", "paneer", "meringue",
 * "hamburger", "croutons" — is read as its usual recipe; a form's word alone
 * is the form with nothing in it, never the catalogue's only filled product
 * of that name (`BARE_FORMS`); and "tortilla" is a potato omelette on a dish
 * that is one, and a wheat wrap everywhere else (`READINGS`).
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
 * locale, the allergens it contains (`presence = 'contains'`) and those it
 * may contain (`may_contain`), by key.
 */
export type PictureCatalogueEntry = {
  readonly allergens: readonly string[];
  readonly mayContain?: readonly string[];
  readonly names: readonly string[];
  readonly slug: string;
};

export type PictureExtra = {
  readonly amount: SeenAmount;
  /**
   * Allergens of the food that the dish does not carry: one it contains that
   * no ingredient of the dish contains, or one it may contain that no
   * ingredient of the dish contains or may contain — oats beside a dish of
   * oats are not gluten the dish lacks; oats on a rice dish are.
   */
  readonly foreignAllergens: readonly string[];
  /** A preparation, not a food ("sauce", "white drizzle"): mapped to nothing. */
  readonly generic: boolean;
  /** The catalogue slugs the name was mapped to; empty when none. */
  readonly mappedTo: readonly string[];
  readonly name: string;
  /** Named: the judge called it specific, or its name maps to the catalogue. */
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
  'flake',
  'flakes',
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
  'spread',
  'stock',
  'topping'
]);

/** Linking words in the judge's English, and the `s` a possessive leaves behind ("goat's cheese"). */
const LINKING: ReadonlySet<string> = new Set(['a', 'and', 'in', 'of', 'on', 'or', 's', 'the', 'with']);

/**
 * The judge's English for a food the catalogue names otherwise, normalised and
 * singular → the catalogue slugs whose allergens it carries. A plural is read
 * through its singular ("croutons", "pies", "yogurts"). Only foods that carry
 * an allergen are worth a line: a missing one here lets a picture through.
 * Project 010's phase 5 closed the names that carried an allergen and mapped
 * to none ("pizza", "crepe", "paneer", "meringue"…; `judge.holes.test.ts`):
 * each is read as its usual recipe, never as a filled product.
 */
const SEEN_SYNONYMS: ReadonlyMap<string, readonly string[]> = new Map([
  ['batter', ['harina-de-trigo']],
  ['bechamel', ['leche-entera', 'harina-de-trigo']],
  ['biscuit', ['galletas-de-mantequilla']],
  ['bread', ['pan-blanco']],
  ['breaded', ['pan-rallado']],
  ['burrito', ['tortilla-de-trigo']],
  ['buttermilk', ['leche-entera']],
  ['cake', ['bizcocho']],
  ['calamari', ['calamar']],
  ['cookie', ['galletas-de-mantequilla']],
  ['crayfish', ['cangrejo']],
  ['cream', ['nata-para-cocinar']],
  ['crepe', ['tortitas-americanas']],
  ['crouton', ['pan-blanco']],
  // A crumble's topping is a butter biscuit's dough: flour, egg and butter.
  ['crumble', ['galletas-de-mantequilla']],
  ['crumb', ['pan-rallado']],
  // A pizza's crust or a pie's: what both carry is the flour.
  ['crust', ['masa-de-pizza']],
  ['cupcake', ['magdalena']],
  ['custard', ['natillas']],
  ['dumpling', ['harina-de-trigo']],
  ['fish', ['merluza']],
  ['flatbread', ['pan-de-pita']],
  ['frittata', ['huevo']],
  ['fritter', ['harina-de-trigo']],
  ['fusilli', ['pasta-cocida']],
  ['gyoza', ['harina-de-trigo']],
  ['hollandaise', ['huevo', 'mantequilla']],
  ['lasagna', ['placas-de-lasana']],
  ['latte', ['leche-entera']],
  ['macaroni', ['pasta-cocida']],
  ['mayo', ['mayonesa']],
  ['meringue', ['clara-de-huevo']],
  ['mussel', ['mejillon']],
  ['noodle', ['noodles-de-trigo']],
  ['nut', ['nueces']],
  ['oat', ['copos-de-avena']],
  ['oatmeal', ['copos-de-avena']],
  ['paneer', ['requeson']],
  ['pastry', ['masa-de-hojaldre']],
  ['penne', ['pasta-cocida']],
  ['pie', ['masa-quebrada']],
  // The form, not a topping: a pizza's cheese is seen as cheese.
  ['pizza', ['masa-de-pizza']],
  ['porridge', ['copos-de-avena']],
  ['prawn', ['gambas']],
  ['ramen', ['noodles-de-trigo']],
  ['shrimp', ['gambas']],
  ['spaghetti', ['pasta-cocida']],
  // Its shortcrust, and the egg it was read as before: the catalogue's two tarts share only that.
  ['tart', ['masa-quebrada', 'huevo']],
  ['toast', ['pan-de-molde']],
  ['udon', ['noodles-udon']],
  ['yogurt', ['yogur-natural-desnatado']]
]);

/** A word of `table` read as it is or through its singular: "croutons" is a "crouton". */
function lookup<T>(table: ReadonlyMap<string, T>, word: string): T | undefined {
  return forms(word)
    .map(form => table.get(form))
    .find(found => found !== undefined);
}

/** "gluten-free", "lactose free": the word before `free` is what the food lacks, not what it is. */
const FREE_OF = /\b[a-z]+ free\b/g;

/** The words of a name that could say what the food is, in order: "hamburger" read as "burger" (`SAME_WORD`). */
function words(text: string): readonly string[] {
  return normaliseForMatching(text)
    .replace(FREE_OF, ' ')
    .split(' ')
    .filter(word => word !== '' && !LINKING.has(word) && !DESCRIPTORS.has(word))
    .map(word => lookup(SAME_WORD, word) ?? word);
}

/** A word and its singular, so "prawns" meets "prawn", "tomatoes" meets "tomato" and "sandwiches" meets "sandwich". */
function forms(word: string): readonly string[] {
  const out = new Set([word]);

  if (word.endsWith('oes') || word.endsWith('ies')) {
    out.add(word.endsWith('ies') ? `${word.slice(0, -3)}y` : word.slice(0, -2));
  }

  // Phase 5: an "-es" plural after a hissing sound was read as a word of its own, and "sandwiches" carried nothing.
  if (/(ch|sh|ss|us|x|z)es$/.test(word)) {
    out.add(word.slice(0, -2));
  }

  if (word.endsWith('s') && word.length > 3) {
    out.add(word.slice(0, -1));
  }

  return [...out];
}

function sameWord(a: string, b: string): boolean {
  return forms(a).some(form => forms(b).includes(form));
}

/** Where `phrase` occurs in `list`, word by word through `same`: each occurrence's indexes. */
function occurrences(list: readonly string[], phrase: readonly string[], same: (a: string, b: string) => boolean): readonly (readonly number[])[] {
  return list.flatMap((_, start) =>
    phrase.every((word, offset) => list[start + offset] !== undefined && same(list[start + offset] as string, word))
      ? [phrase.map((_word, offset) => start + offset)]
      : []
  );
}

function exactly(a: string, b: string): boolean {
  return a === b;
}

/** The punctuation a title is read with: where a negation stops (`TITLE_NEGATION_ENDS`). */
const TITLE_MARKS: readonly string[] = [',', ')'];

/** The suffixes that negate the word they follow, written apart ("bread-free", "crust-less") or not ("crustless"). */
const NEGATING_SUFFIXES: readonly string[] = ['free', 'less'];

/**
 * A title as the rule reads it: lower case, no accents, its words — and its
 * commas and closing parentheses, where a negation stops. A word ending in
 * "less" is read as the word it negates: "crustless" is a negated "crust".
 */
function titleWords(name: string): { readonly negatedBySuffix: ReadonlySet<number>; readonly words: readonly string[] } {
  const read = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[,)]/g, mark => ` ${mark} `)
    .replace(/[^a-z0-9,)]+/g, ' ')
    .split(' ')
    .filter(word => word !== '');
  const words = read.map(word => (word.length > 'less'.length + 1 && word.endsWith('less') ? word.slice(0, -'less'.length) : word));
  const negatedBySuffix = new Set(
    read.flatMap((word, index) => (words[index] !== word || NEGATING_SUFFIXES.includes(read[index + 1] ?? '') ? [index] : []))
  );

  return { negatedBySuffix, words };
}

/**
 * The families of forms the dish has its own version of (`forms.ts`): an
 * ingredient that is the form, or a title that names it. A title word does
 * not name its form inside a phrase of `TITLE_NOT_A_FORM`, beside "bowl", or
 * negated — anywhere in the reach of a negation ("sin queso ni pan", "en vez
 * de pan") or by its own suffix ("bread-free", "breadless", "crust-less").
 * A word of `TITLE_ONLY_AS_HEAD` names it only as the title's first word, and
 * only when what follows it is the end of the title or a word of
 * `TITLE_HEAD_ENDS` ("tostadas con aguacate"): anything else after it —
 * "de", an adjective, a preposition — may be what stands in for the form.
 * And a title that negates a word of the family ("quiche sin masa") names
 * none of it.
 */
/** A title's words, and those a negation reaches ("sin queso ni pan") or its own suffix negates ("breadless"). */
function negatedTitle(name: string): { readonly negated: ReadonlySet<number>; readonly title: readonly string[] } {
  const { negatedBySuffix, words: title } = titleWords(name);
  const negated = new Set(negatedBySuffix);

  for (const negation of TITLE_NEGATIONS.map(phrase => phrase.split(' '))) {
    for (const at of occurrences(title, negation, exactly)) {
      for (let index = at.length + (at[0] ?? 0); index < title.length && !TITLE_NEGATION_ENDS.includes(title[index] as string); index++) {
        negated.add(index);
      }
    }
  }

  return { negated, title };
}

function ownFamilies(recipe: PictureRecipe): readonly FormFamily[] {
  const slugs = new Set(recipe.ingredients.map(ingredient => ingredient.slug));
  const { negated, title } = negatedTitle(recipe.name);
  const notAForm = new Set(TITLE_NOT_A_FORM.flatMap(phrase => occurrences(title, phrase.split(' '), exactly).flat()));

  const head = title.findIndex(word => !TITLE_MARKS.includes(word));
  const after = (index: number) => title.slice(index + 1).find(word => !TITLE_MARKS.includes(word));
  const besideBowl = (index: number) =>
    [title[index - 1], title[index + 1], title[index - 1] === 'de' ? title[index - 2] : undefined].some(word => TITLE_BOWL.includes(word ?? ''));
  const names = (at: readonly number[]) =>
    at.every(
      index =>
        !notAForm.has(index) &&
        !negated.has(index) &&
        !besideBowl(index) &&
        (!TITLE_ONLY_AS_HEAD.includes(title[index] as string) || (index === head && [undefined, ...TITLE_HEAD_ENDS].includes(after(index))))
    );
  const denied = (family: FormFamily) =>
    [...family.title, ...(family.without ?? [])].some(phrase =>
      occurrences(title, phrase.split(' '), exactly).some(at => at.some(index => negated.has(index)))
    );
  const titled = (family: FormFamily) =>
    !(family.titleNotWith ?? []).some(slug => slugs.has(slug)) &&
    !denied(family) &&
    family.title.some(phrase => occurrences(title, phrase.split(' '), exactly).some(names));

  return FORM_FAMILIES.filter(family => family.slugs.some(slug => slugs.has(slug)) || titled(family));
}

/**
 * How the dish reads each word of `READINGS`: as the other food it may name
 * when the dish is that food — it holds that food's slug, or its title names
 * it, not negated, or the title's first word is the word itself on a dish
 * that holds an egg — and as its usual reading everywhere else. An egg and a
 * potato alone make no omelette. "tortilla" on an omelette is the
 * omelette; on anything else it is a wheat wrap, and a dish of corn tortillas
 * excuses it as its own wraps-family form.
 */
function dishReadings(recipe: PictureRecipe): (word: string) => readonly string[] | undefined {
  const slugs = new Set(recipe.ingredients.map(ingredient => ingredient.slug));
  const { negated, title } = negatedTitle(recipe.name);
  const titled = (phrase: string) => occurrences(title, phrase.split(' '), exactly).some(at => at.every(index => !negated.has(index)));
  const head = title.findIndex(word => !TITLE_MARKS.includes(word));

  return word => {
    const reading = lookup(READINGS, word);

    if (reading === undefined) {
      return undefined;
    }

    const { reads, slugs: is, title: named, titleHead } = reading.when;
    const isIt =
      is.some(slug => slugs.has(slug)) ||
      named.some(titled) ||
      (head !== -1 &&
        titleHead.words.includes(title[head] as string) &&
        !negated.has(head) &&
        titleHead.holds.every(group => group.some(slug => slugs.has(slug))));

    return isIt ? reads : reading.otherwise;
  };
}

/**
 * A named plant right before a dairy word: the dairy word goes, the plant
 * word stays ("soy yogurt" is soy, "oat milk" is oats). A word that says only
 * that the food is not dairy — "plant", "vegan", "vegetable" — is no plant
 * and is not in `PLANT_QUALIFIERS`: "vegan butter" could be soy or nuts, and
 * reads as it always has. A whole catalogue name is left as it is.
 */
function plantQualified(name: string, own: readonly string[], catalogue: Catalogue): readonly string[] {
  const dairyAfterPlant = (word: string, index: number) =>
    index > 0 && DAIRY_WORDS.some(dairy => sameWord(word, dairy)) && PLANT_QUALIFIERS.some(plant => sameWord(own[index - 1] as string, plant));

  if (!own.some(dairyAfterPlant) || matchCustomAllergen(name, catalogue.index) !== null) {
    return own;
  }

  return own.filter((word, index) => !dairyAfterPlant(word, index));
}

type Catalogue = {
  readonly bySlug: ReadonlyMap<string, PictureCatalogueEntry>;
  readonly entries: readonly PictureCatalogueEntry[];
  readonly index: MatchIndex;
  /** Each entry's names as food words — descriptors and linking words gone — with its slug's words beside them. */
  readonly wordsOf: ReadonlyMap<string, readonly (readonly string[])[]>;
};

/** A catalogue read once per array: the same array judged again — a test's many pictures — is not indexed again. */
const readCatalogues = new WeakMap<readonly PictureCatalogueEntry[], Catalogue>();

function readCatalogue(entries: readonly PictureCatalogueEntry[]): Catalogue {
  const known = readCatalogues.get(entries);

  if (known !== undefined) {
    return known;
  }

  const catalogue: Catalogue = {
    bySlug: new Map(entries.map(entry => [entry.slug, entry])),
    entries,
    index: toMatchIndex(entries.flatMap(entry => entry.names.map(name => ({ id: entry.slug, name, slug: entry.slug })))),
    wordsOf: new Map(entries.map(entry => [entry.slug, [...entry.names, entry.slug].map(words).filter(list => list.length > 0)]))
  };

  readCatalogues.set(entries, catalogue);

  return catalogue;
}

/** What a name was mapped to: the entries' slugs, and the allergens they contain or may contain. */
type Mapped = { readonly contains: ReadonlySet<string>; readonly mayContain: ReadonlySet<string>; readonly slugs: readonly string[] };

/** Every allergen an entry contains or may contain. */
function everything(entry: PictureCatalogueEntry): readonly string[] {
  return [...entry.allergens, ...(entry.mayContain ?? [])];
}

/**
 * The catalogue slugs a seen food's name stands for.
 *
 * 0. A name that is one word of `READINGS` ("tortilla", "fried tortillas"):
 *    the reading the dish gives it (`dishReadings`). One of `BARE_FORMS`
 *    ("brownie", "a slice of brownie", "crackers"): the form with nothing in
 *    it, before the catalogue's filled product of that name.
 * 1. The whole name, exactly, as `CustomAllergen` matches it, or through
 *    `SEEN_SYNONYMS`: "peanut butter" is peanut butter and not butter.
 * 2. Otherwise every entry one of whose names is made only of the food's own
 *    words: "feta cheese" is feta, "chicken with cheese" is chicken and
 *    cheese, "rice noodles" are rice noodles. Each is really in the food, so
 *    all of their allergens count.
 * 3. A word no such name covers, through `SEEN_SYNONYMS`: "breaded" is
 *    breadcrumbs, bare "noodles" are wheat noodles — the safe reading, since a
 *    wrong rejection costs a redraw and a miss shows an allergen.
 * 4. And for each word still uncovered, every entry that has the word: "soy
 *    beans" is beans (2) and something soy (4). Only what all of a word's
 *    entries share counts — "oil" is sunflower oil or sesame oil, so it is
 *    neither's sesame. A word that is not a food (`NOT_A_FOOD`: "base",
 *    "glass") is not read here: "grain base" is not a pizza base.
 */
function mapName(name: string, food: readonly string[], catalogue: Catalogue, readAs: (word: string) => readonly string[] | undefined): Mapped {
  const entriesOf = (slugs: readonly string[]) => slugs.flatMap(slug => catalogue.bySlug.get(slug) ?? []);
  const union = (entries: readonly PictureCatalogueEntry[]): Mapped => ({
    contains: new Set(entries.flatMap(entry => entry.allergens)),
    mayContain: new Set(entries.flatMap(entry => entry.mayContain ?? [])),
    slugs: entries.map(entry => entry.slug)
  });
  const [only, ...more] = food;
  const bare = only !== undefined && more.length === 0 ? only : undefined;
  const unfilled = bare === undefined ? undefined : (readAs(bare) ?? lookup(BARE_FORMS, bare));
  const direct = matchCustomAllergen(name, catalogue.index);
  const exact = entriesOf(unfilled ?? (direct === null ? (lookup(SEEN_SYNONYMS, normaliseForMatching(name)) ?? []) : [direct]));

  if (exact.length > 0) {
    return union(exact);
  }

  const namesOf = (entry: PictureCatalogueEntry) => catalogue.wordsOf.get(entry.slug) ?? [];
  const whole = catalogue.entries.flatMap(entry => {
    const list = namesOf(entry).find(words => words.every(word => food.some(own => sameWord(own, word))));

    return list ? [{ covers: food.filter(own => list.some(word => sameWord(own, word))), entry }] : [];
  });
  const byWhole = new Set(whole.flatMap(match => match.covers));
  const synonyms = food
    .filter(word => !byWhole.has(word))
    .flatMap(word => entriesOf(lookup(SEEN_SYNONYMS, word) ?? []).map(entry => ({ covers: [word], entry })));
  const tight = [...whole, ...synonyms];
  const covered = new Set(tight.flatMap(match => match.covers));
  const { contains, mayContain, slugs } = union(tight.map(match => match.entry));
  const [allContains, allMay, allSlugs] = [new Set(contains), new Set(mayContain), new Set(slugs)];

  for (const word of food.filter(own => !covered.has(own) && !NOT_A_FOOD.some(other => sameWord(own, other)))) {
    const having = catalogue.entries.filter(entry => namesOf(entry).some(words => words.some(other => sameWord(word, other))));
    const [first, ...others] = having;

    if (!first) {
      continue;
    }

    having.forEach(entry => allSlugs.add(entry.slug));
    first.allergens.filter(allergen => others.every(entry => entry.allergens.includes(allergen))).forEach(allergen => allContains.add(allergen));
    // A sulphite every entry carries and one contains is contained: "may contain" must not absorb it (`UNSEEN_WHEN_ONLY_MAY_CONTAIN`).
    UNSEEN_WHEN_ONLY_MAY_CONTAIN.filter(
      allergen => having.every(entry => everything(entry).includes(allergen)) && having.some(entry => entry.allergens.includes(allergen))
    ).forEach(allergen => allContains.add(allergen));
    everything(first)
      .filter(allergen => others.every(entry => everything(entry).includes(allergen)))
      .forEach(allergen => allMay.add(allergen));
  }

  return { contains: allContains, mayContain: allMay, slugs: [...allSlugs] };
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
 * `catalogue` must be the whole catalogue, not the dish's own ingredients:
 * a name is mapped only to what it holds, so a catalogue of the dish alone
 * maps every extra to nothing and accepts everything. A catalogue no bigger
 * than the recipe is refused.
 */
export function judgePicture(input: {
  readonly catalogue: readonly PictureCatalogueEntry[];
  readonly match: PictureMatch;
  readonly recipe: PictureRecipe;
  readonly seen: SeenPicture;
}): PictureVerdict {
  const { match, recipe, seen } = input;

  if (input.catalogue.length <= recipe.ingredients.length) {
    throw new Error('judgePicture needs the whole ingredient catalogue, not the dish’s own ingredients');
  }

  const catalogue = readCatalogue(input.catalogue);
  const unknown = recipe.ingredients.filter(ingredient => !catalogue.bySlug.has(ingredient.slug)).map(ingredient => ingredient.slug);
  const dishEntries = recipe.ingredients.flatMap(ingredient => catalogue.bySlug.get(ingredient.slug) ?? []);
  const dishContains = new Set(dishEntries.flatMap(entry => entry.allergens));
  const dishCarries = new Set(dishEntries.flatMap(everything));
  const byKey = (names: readonly string[]) => new Map(names.map(name => [normaliseForMatching(name), name]));
  const listed = byKey([...match.extras, ...unaccounted(seen, match)]);
  const matched = byKey(match.ingredients.flatMap(ingredient => ingredient.matched));

  const families = ownFamilies(recipe);
  const readAs = dishReadings(recipe);
  const everyName = [...seen.foods.map(food => food.name), ...match.extras, ...match.ingredients.flatMap(ingredient => ingredient.matched)];
  const spelled = (word: string) => SPELLINGS.get(word) ?? lookup(SAME_WORD, word) ?? word;
  const sameSpelled = (a: string, b: string) => sameWord(spelled(a), spelled(b));

  /*
   * Project 006's second food, kept whatever the match call answered: a name
   * of the form seen beside another name of it that is no shorter and says
   * something this one does not ("milk" beside "soy milk", "bread" beside
   * "gluten-free bread", "grated cheese" beside "vegan cheese", "cow's milk"
   * beside "soy milk") is another batch of that form, not the dish's own, and
   * its word keeps its allergens. The other name is read whole, "gluten-free"
   * and all; this one by its food words.
   */
  const besideAnother = (name: string, form: string) => {
    const [key, mine] = [normaliseForMatching(name), words(name)];

    return everyName.some(other => {
      const theirs = normaliseForMatching(other)
        .split(' ')
        .filter(word => word !== '' && !LINKING.has(word));

      return (
        normaliseForMatching(other) !== key &&
        theirs.length >= mine.length &&
        theirs.some(their => !mine.some(word => sameSpelled(word, their))) &&
        theirs.some(their => sameSpelled(their, form))
      );
    });
  };

  /*
   * The family a name *is* a form of, among those the dish has its own
   * version of (`0073`): set aside the serving words ("a glass of",
   * "grated"), the name is word for word one row of that family — "milk",
   * "burger patty" — and it is not seen beside a fuller name of the same
   * form. A whitelist: nothing else a name says is weighed, so nothing else
   * can slip through. Two spellings of one row are one row.
   */
  const ownFormOf = (name: string): FormFamily | undefined => {
    const bare = normaliseForMatching(name)
      .split(' ')
      .filter(word => word !== '' && !SERVING_WORDS.includes(word));
    const rows = families.flatMap(family =>
      family.seen
        .map(row => row.split(' ').map(spelled))
        .filter(row => row.length === bare.length && row.every((word, index) => sameSpelled(bare[index] as string, word)))
        .map(row => ({ family, key: row.join(' '), row }))
    );
    const [first] = rows;

    return first !== undefined && rows.every(other => other.key === first.key) && !first.row.some(word => besideAnother(name, word))
      ? first.family
      : undefined;
  };

  const foreignOf = ({ contains, mayContain }: Pick<Mapped, 'contains' | 'mayContain'>) =>
    [
      ...new Set([
        ...[...contains].filter(allergen => !dishContains.has(allergen)),
        ...[...mayContain].filter(allergen => !dishCarries.has(allergen) && !UNSEEN_WHEN_ONLY_MAY_CONTAIN.includes(allergen))
      ])
    ].sort();

  /** Names whose own-form exemption took away an allergen the dish lacks, in the order they were judged. */
  const ownForms: string[] = [];

  const toExtra = (name: string): PictureExtra => {
    // An extra the judge named in (b) but not in (a) is taken at its word: specific, and more than a trace.
    const food = seenFood(name, seen);
    const amount = food?.amount ?? 'main';
    const all = words(name).filter(word => !GENERIC.has(word));
    const generic = all.length === 0;
    const own = generic ? all : plantQualified(name, all, catalogue);

    const read = (list: readonly string[]) => {
      const mapped =
        list.length === 0
          ? { contains: new Set<string>(), mayContain: new Set<string>(), slugs: [] }
          : mapName(list === all ? name : list.join(' '), list, catalogue, readAs);

      return { foreignAllergens: foreignOf(mapped), slugs: mapped.slugs };
    };

    const asToday = read(own);
    const family = asToday.foreignAllergens.length > 0 ? ownFormOf(name) : undefined;
    /*
     * A name of the dish's own form is excused of what its family's form
     * carries (`FormFamily.carries`, a closed set) and of nothing else,
     * whatever the row: "battered fish" is excused of its batter and its fish
     * is still weighed; a filled product's filling is never its form's.
     */
    const left = family === undefined ? asToday.foreignAllergens : asToday.foreignAllergens.filter(allergen => !family.carries.includes(allergen));
    // The exemption stands only where it takes an allergen away: elsewhere the name reads as it always has, notes and all.
    const used = left.length < asToday.foreignAllergens.length;
    const { foreignAllergens, slugs } = used ? { foreignAllergens: left, slugs: left.length > 0 ? asToday.slugs : [] } : asToday;
    // A name the catalogue knows has been named, whatever the judge's flag says: "peanut sauce" is peanuts.
    const specific = (food?.specific ?? true) || slugs.length > 0;

    if (used) {
      ownForms.push(name);
    }

    return { amount, foreignAllergens, generic, mappedTo: slugs, name, specific };
  };

  /*
   * What (b) matched to an ingredient is checked too: the match call decides
   * nothing either. A seen food it paired with an ingredient but whose own
   * name carries an allergen the dish lacks is an extra — prawns matched to
   * broccoli are still prawns. A fair variant (tuna for bonito, goat cheese
   * for white cheese) shares its ingredient's allergens and passes, and so
   * does the ingredient's own name cut short: "noodles" matched to cooked
   * rice noodles are those noodles, not wheat ones.
   */
  const foodWords = (name: string) => words(name).filter(word => !GENERIC.has(word));

  /** How many of a catalogue name's words a seen name has, or 0 unless it has only words from it. */
  const coverage = (name: string, list: readonly string[]) => {
    const own = foodWords(name);

    return own.length > 0 && own.every(word => list.some(other => sameWord(word, other)))
      ? list.filter(other => own.some(word => sameWord(word, other))).length
      : 0;
  };

  /*
   * The ingredient's name cut short — unless the same ingredient was also
   * matched to a fuller name for it. Then the short one is a second food:
   * "butter" beside "peanut butter" is a pat of butter, not the peanut butter.
   */
  const shortened = (key: string, name: string) =>
    match.ingredients
      .filter(ingredient => ingredient.matched.some(other => normaliseForMatching(other) === key))
      .some(ingredient =>
        (catalogue.wordsOf.get(ingredient.slug) ?? []).some(list => {
          const mine = coverage(name, list);

          return mine > 0 && !ingredient.matched.some(other => normaliseForMatching(other) !== key && coverage(other, list) > mine);
        })
      );

  const extras = [...listed.values()].map(toExtra);
  const mismatched = [...matched]
    .filter(([key, name]) => !listed.has(key) && !shortened(key, name))
    .map(([, name]) => toExtra(name))
    .filter(extra => extra.foreignAllergens.length > 0);

  extras.push(...mismatched);

  const rejecting = extras.filter(extra => extra.specific && !extra.generic && extra.amount !== 'trace' && extra.foreignAllergens.length > 0);
  const status = new Map(match.ingredients.map(ingredient => [ingredient.slug, ingredient.status]));
  const missing = pictureParts(recipe).mains.filter(main => status.get(main.slug) === 'not_seen');
  // The dish's own form is named, even when nothing else of its name maps: it is not an unknown food.
  const unmapped = extras.filter(extra => extra.specific && !extra.generic && extra.mappedTo.length === 0 && !ownForms.includes(extra.name));

  const notes = [
    rejecting.length > 0 ? `extra_allergen:${rejecting.map(extra => `${extra.name}=${extra.foreignAllergens.join('+')}`).join('/')}` : '',
    extras.length > 0 ? `extra_food:${extras.map(extra => extra.name).join('/')}` : '',
    mismatched.length > 0 ? `matched_foreign:${mismatched.map(extra => extra.name).join('/')}` : '',
    ownForms.length > 0 ? `own_form:${ownForms.join('/')}` : '',
    unmapped.length > 0 ? `unmapped:${unmapped.map(extra => extra.name).join('/')}` : '',
    missing.length > 0 ? `missing_main:${missing.map(main => main.name).join('/')}` : '',
    unknown.length > 0 ? `unknown_ingredient:${unknown.join('/')}` : '',
    ...qualityNotes(seen)
  ].filter(note => note !== '');

  return { accepted: rejecting.length === 0, extras, notes };
}

/**
 * What a rejected picture's verdict says in closed words (`0072`): for each
 * food carrying an allergen the dish lacks, those allergen keys and the
 * catalogue slugs its name was mapped to. The name itself — the vision model's
 * own word — is left behind: this is what is stored with a candidate and shown
 * to the owner. Every such food is here, a trace included: the owner is warned
 * of more than what rejected the picture, never of less.
 */
export function flaggedExtras(verdict: Pick<PictureVerdict, 'extras'>): PictureCandidateExtra[] {
  return verdict.extras
    .filter(extra => extra.foreignAllergens.length > 0)
    .map(extra => ({ foreignAllergens: [...extra.foreignAllergens], mappedTo: [...extra.mappedTo] }));
}
