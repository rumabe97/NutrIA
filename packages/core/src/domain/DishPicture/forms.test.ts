import { describe, expect, it } from 'vitest';

import { dish, DISHES, judged, picture, SEED_CATALOGUE } from '#test/dish-picture/acceptance';

import {
  DAIRY_WORDS,
  FORM_FAMILIES,
  NOT_A_FOOD,
  NOT_A_PLANT,
  PLANT_QUALIFIERS,
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
import { judgePicture } from './judge';

import type { PictureCatalogueEntry, PictureRecipe } from 'core/domain/DishPicture';
import type { FormFamily } from './forms';

/*
 * Every row of the own-form tables (`forms.ts`, `0073`) is a case here, in
 * both directions, against the seed catalogue: a slug, a title word or a
 * judge's word that excuses a form on a dish that has its own version of it,
 * and the same form rejected on a dish that has none. The families as the
 * product sees them — what must still be rejected, the production cases — are
 * in `judge.forms.test.ts`; this file is the tables, row by row.
 */

/** A dish with nothing of its own: lettuce, under a title that names no form. */
const PLAIN = dish('Plato de prueba', ['lechuga', 100]);

/**
 * The judge's words of a family that carry no allergen on their own today,
 * so they reject nothing and there is nothing to excuse: the holes phase 5
 * closes ("pizza", "crepe", "tortilla"…) and forms whose catalogue rows carry
 * nothing. Pinned both ways: a word here that starts to carry an allergen, or
 * one missing that carries none, fails the last test of this file.
 */
const CARRIES_NOTHING = ['crepe', 'crouton', 'crumb', 'crust', 'cupcake', 'fritter', 'fusilli', 'patty', 'pizza', 'sausage', 'tortilla'];

function foreign(recipe: PictureRecipe, name: string): readonly string[] {
  return judged(recipe, picture(recipe, { name })).extras.find(extra => extra.name === name)?.foreignAllergens ?? [];
}

/**
 * What its slugs and title words are tried with: the first of a family's words
 * that carries an allergen, and only what the family's form carries if one
 * does ("croquette" rather than "nugget", whose soy is the protein's).
 */
function probe(family: FormFamily): string {
  const carrying = family.seen.filter(seen => !CARRIES_NOTHING.includes(seen));
  const word = carrying.find(seen => BEYOND_THE_FAMILY[seen] === undefined) ?? carrying[0];

  if (word === undefined) {
    throw new Error(`The family "${family.family}" has no word that carries an allergen`);
  }

  return word;
}

/** A title that names `phrase` where it names its form: first, when it is a word only a title's head names a form by. */
function titled(phrase: string): string {
  return TITLE_ONLY_AS_HEAD.includes(phrase) ? `${phrase} con lechuga` : `Prueba ${phrase} casera`;
}

function rejected(recipe: PictureRecipe, name: string): boolean {
  const verdict = judged(recipe, picture(recipe, { name }));

  return !verdict.accepted && !verdict.notes.some(note => note.startsWith('own_form:'));
}

/**
 * The rows the catalogue reads as carrying an allergen beyond their family's
 * closed set (`FormFamily.carries`) — a filling, a protein, a trace. The rule
 * never excuses it (`judge.ts`): each is excused of its form and still
 * weighed against the dish for these. On a plain dish, so these reject.
 */
const BEYOND_THE_FAMILY: Readonly<Record<string, readonly string[]>> = {
  // The catalogue's fish is hake.
  'battered fish': ['fish'],
  // The catalogue's only brownie holds walnuts (the lead's decision, round 3): a brownie beside a nut-free sponge is rejected.
  brownie: ['tree_nuts'],
  // The catalogue's crackers may contain sesame; the family's form is its flour.
  cracker: ['sesame'],
  // The catalogue's only empanada is tuna.
  empanada: ['fish'],
  // The catalogue's nuggets are chicken or soy: the soy is the protein.
  nugget: ['soy'],
  // A quiche's cream: lactose is not a pastry's.
  quiche: ['lactose'],
  // The bare word reads as the catalogue's chocolate sandwich biscuits.
  sandwich: ['milk', 'soy']
};

/**
 * A picture of `recipe` where the judge named `name` beside its foods, and the
 * rule excused it as the dish's own form: accepted, or — for a row of
 * `BEYOND_THE_FAMILY` — excused of its form and rejected for what is left.
 */
function expectOwnForm(recipe: PictureRecipe, name: string, of?: string): void {
  const verdict = judged(recipe, picture(recipe, of === undefined ? { name } : { name, of }));
  const own = new Set(recipe.ingredients.flatMap(({ slug }) => SEED_CATALOGUE.find(entry => entry.slug === slug)?.allergens ?? []));
  const left = (BEYOND_THE_FAMILY[name] ?? []).filter(allergen => !own.has(allergen));

  expect(verdict.notes).toContain(`own_form:${name}`);
  expect(verdict.extras.find(extra => extra.name === name)?.foreignAllergens).toEqual(left);
  expect(verdict.accepted).toBe(left.length === 0);
}

/** The allergens of `name` beside a plain dish that its family's closed set does not hold. */
function beyondItsFamily(family: FormFamily, name: string): readonly string[] {
  return foreign(PLAIN, name).filter(allergen => !family.carries.includes(allergen));
}

describe('forms — the tables are closed and well formed', () => {
  it('holds the fifteen families of report 0006, each named once', () => {
    expect(FORM_FAMILIES.map(family => family.family)).toEqual([
      'bread',
      'breading',
      'pancakes',
      'cakes',
      'biscuits',
      'crackers',
      'wraps',
      'pastry',
      'pasta',
      'meat',
      'nuggets',
      'milk',
      'yogurt',
      'cheese',
      'cream'
    ]);
  });

  it.each(FORM_FAMILIES.flatMap(family => [...family.slugs, ...(family.titleNotWith ?? [])].map(slug => [family.family, slug] as const)))(
    '%s: "%s" is a slug of the seed catalogue',
    (_family, slug) => {
      expect(SEED_CATALOGUE.some(entry => entry.slug === slug)).toBe(true);
    }
  );

  it('writes every title word as a normalised title reads it: lower case, no accents, single spaces', () => {
    const titles = [...FORM_FAMILIES.flatMap(family => family.title), ...TITLE_NOT_A_FORM];

    expect(titles.filter(word => !/^[a-z0-9]+( [a-z0-9]+)*$/.test(word))).toEqual([]);
  });

  it('gives a word of the judge to one family only', () => {
    const seen = FORM_FAMILIES.flatMap(family => family.seen);

    expect(seen.filter((word, index) => seen.indexOf(word) !== index)).toEqual([]);
  });

  // The second review's P3: a name matches one row at most, however it is spelled or counted, so `ownFormOf` never has two families to choose from.
  it('gives no row to two families, set aside plurals and spellings', () => {
    const key = (row: string) =>
      row
        .split(' ')
        .map(word => SPELLINGS.get(word) ?? word)
        .map(word => word.replace(/ies$/, 'y').replace(/s$/, ''))
        .join(' ');
    const owners = new Map<string, Set<string>>();

    for (const family of FORM_FAMILIES) {
      for (const row of family.seen) {
        owners.set(key(row), (owners.get(key(row)) ?? new Set()).add(family.family));
      }
    }

    expect([...owners].filter(([, families]) => families.size > 1)).toEqual([]);
  });

  it('keys the breading and the breaded forms by the title only (phase 1’s review)', () => {
    expect(FORM_FAMILIES.filter(family => family.slugs.length === 0).map(family => family.family)).toEqual([
      'breading',
      'pancakes',
      'cakes',
      'pastry',
      'nuggets'
    ]);
  });

  it('keys no cake by a rice or corn cake, which are crackers (phase 1’s review)', () => {
    const cakes = FORM_FAMILIES.find(family => family.family === 'cakes');

    expect(cakes?.slugs).toEqual([]);
    expect(cakes?.titleNotWith).toEqual(['tortitas-de-arroz', 'tortitas-de-maiz']);
  });

  it('leaves a bare "burger" out of the meat family: it is seen in its bun (phase 1’s review)', () => {
    expect(FORM_FAMILIES.flatMap(family => family.seen)).not.toContain('burger');
  });
});

describe('forms — each slug excuses its family’s form, and nothing without it does', () => {
  const rows = FORM_FAMILIES.flatMap(family => family.slugs.map(slug => [family.family, slug, probe(family)] as const));

  it.each(rows)('%s: a dish of "%s" excuses "%s" named for it', (_family, slug, word) => {
    expectOwnForm(dish('Plato de prueba', [slug, 100], ['lechuga', 50]), word, slug);
  });

  it.each(FORM_FAMILIES.filter(family => family.slugs.length > 0).map(family => [family.family, probe(family)] as const))(
    '%s: "%s" on a dish without its slugs is still rejected',
    (_family, word) => {
      expect(judged(PLAIN, picture(PLAIN, { name: word })).accepted).toBe(false);
    }
  );
});

describe('forms — each title word excuses its family’s form, and a title without one does not', () => {
  const rows = FORM_FAMILIES.flatMap(family => family.title.map(phrase => [family.family, phrase, probe(family)] as const));

  it.each(rows)('%s: a title with "%s" excuses "%s"', (_family, phrase, word) => {
    expectOwnForm(dish(titled(phrase), ['lechuga', 100]), word);
  });

  it.each(FORM_FAMILIES.map(family => [family.family, probe(family)] as const))(
    '%s: "%s" under a title that names no form is still rejected',
    (_family, word) => {
      expect(judged(PLAIN, picture(PLAIN, { name: word })).accepted).toBe(false);
    }
  );

  it.each(
    FORM_FAMILIES.flatMap(family =>
      (family.titleNotWith ?? []).flatMap(slug => family.title.map(phrase => [family.family, phrase, slug, probe(family)] as const))
    )
  )('%s: a title with "%s" excuses nothing on a dish of %s — "%s" is still rejected', (_family, phrase, slug, word) => {
    const recipe = dish(titled(phrase), [slug, 40], ['lechuga', 100]);

    expect(judged(recipe, picture(recipe, { name: word })).accepted).toBe(false);
  });

  it.each(TITLE_NOT_A_FORM)('a title word inside "%s" names no form: "bread" is still rejected', phrase => {
    const recipe = dish(`Prueba ${phrase} casera`, ['lechuga', 100]);

    expect(judged(recipe, picture(recipe, { name: 'bread' })).accepted).toBe(false);
  });

  it('still reads the same word as a form elsewhere in that title', () => {
    expectOwnForm(dish('Pan con pan rallado', ['lechuga', 100]), 'bread');
  });

  // The third review (P1 5): the same word in another sense.
  it.each([
    [dish('Ensalada con migas de atún', ['lechuga', 100], ['atun-al-natural', 60], ['tomate', 60]), ['bread']],
    [dish('Ensalada con migas de bacalao', ['lechuga', 100], ['tomate', 60]), ['bread']],
    [dish('Chicken breast with pan sauce', ['pechuga-de-pollo', 150], ['aceite-de-oliva-virgen-extra', 10]), ['bread', 'toast']],
    [dish('Chicken with pan juices', ['pechuga-de-pollo', 150]), ['bread']],
    [dish('Pan grilled chicken', ['pechuga-de-pollo', 150]), ['bread']]
  ] as const)('"%s" names no bread', (recipe, names) => {
    for (const name of names) {
      expect(rejected(recipe, name)).toBe(true);
    }
  });

  /*
   * Recorded, not decided by the rule (the lead, round 3): "sin queso y pan"
   * may mean without cheese, and with bread. The negation ends at "y", so
   * the title names bread.
   */
  it('reads "Hamburguesa sin queso y pan" as naming bread', () => {
    expectOwnForm(dish('Hamburguesa sin queso y pan', ['lentejas-cocidas', 150]), 'bun');
  });
});

/** The family whose title words hold `word`, and the first of its judge's words that carries an allergen. */
function familyOfTitle(word: string): readonly [FormFamily, string] {
  const family = FORM_FAMILIES.find(known => known.title.includes(word));

  if (family === undefined) {
    throw new Error(`"${word}" is no title word`);
  }

  return [family, probe(family)];
}

/*
 * Phase 2's review (P1-B): a title word counted wherever it stood. Some
 * Spanish words name a form only as the title's head — first, and not before
 * "de", which says what stands in for the form.
 */
describe('forms — a word that names its form only as the title’s head', () => {
  it('holds only title words of some family', () => {
    expect(TITLE_ONLY_AS_HEAD.filter(word => !FORM_FAMILIES.some(family => family.title.includes(word)))).toEqual([]);
  });

  it.each(TITLE_ONLY_AS_HEAD)('"%s" away from the head names nothing', word => {
    const [, seen] = familyOfTitle(word);

    expect(rejected(dish(`Ensalada con ${word} y lechuga`, ['lechuga', 100]), seen)).toBe(true);
  });

  it.each(TITLE_ONLY_AS_HEAD)('"%s" at the head, before "de", names nothing', word => {
    const [, seen] = familyOfTitle(word);

    expect(rejected(dish(`${word} de lechuga`, ['lechuga', 100]), seen)).toBe(true);
  });

  // The third review (P1 1): an adjective, a preposition or a noun between the head and "de" — or instead of it — is as good as "de".
  it.each(TITLE_ONLY_AS_HEAD)('"%s" at the head, before any other word, names nothing', word => {
    const [, seen] = familyOfTitle(word);

    for (const title of [
      `${word} crujientes de lechuga`,
      `${word} en lechuga`,
      `${word} del huerto`,
      `${word}, lechuga`,
      `${word} (lechuga)`,
      `${word} lechuga`
    ]) {
      expect(rejected(dish(title, ['lechuga', 100]), seen)).toBe(true);
    }
  });

  it.each(TITLE_ONLY_AS_HEAD.flatMap(word => [...TITLE_HEAD_ENDS, ''].map(end => [word, end] as const)))(
    '"%s" at the head, then "%s" or the end of the title, names its form',
    (word, end) => {
      const [, seen] = familyOfTitle(word);

      expectOwnForm(dish(end === '' ? word : `${word} ${end} lechuga`, ['lechuga', 100]), seen);
    }
  );

  it('skips punctuation after the head: "Tostadas, con aguacate" names bread', () => {
    expectOwnForm(dish('Tostadas, con aguacate', ['aguacate', 80]), 'bread');
  });

  // The third review (P1 1, 2): each a vegetable or a leaf in the form's place, in Spanish and in English.
  it.each([
    ['Tostadas crujientes de boniato con aguacate', ['bread', 'toast']],
    ['Tostadas: boniato y aguacate', ['toast']],
    ['Tostadas del huerto', ['toast']],
    ['Tostadas, boniato', ['toast']],
    ['Tostada (boniato)', ['toast']],
    ['La tostada de boniato', ['toast']],
    ['2 tostadas de boniato', ['toast']],
    ['Tostadas de-boniato', ['toast']],
    ['TOSTADAS DE BONIATO', ['toast']],
    ['Tostaditas de boniato', ['toast']],
    ['Sándwich vegetal de lechuga', ['toast', 'bread']],
    ['Sweet potato toast with avocado', ['bread', 'toast']],
    ['Aubergine toasts with tomato', ['toast']],
    ['Wraps frescos de lechuga con pollo', ['wrap']],
    ['Fajitas en lechuga', ['wrap']],
    ['Tacos en hojas de lechuga', ['taco', 'wrap']],
    ['Taco salad', ['taco', 'wrap']],
    ['Tacos lechuga', ['wrap']]
  ] as const)('"%s" names no form: %j are rejected', (title, names) => {
    const recipe = dish(title, ['boniato', 150], ['lechuga', 80]);

    for (const name of names) {
      expect(rejected(recipe, name)).toBe(true);
    }
  });

  it('leaves every other title word counting wherever it stands', () => {
    expectOwnForm(dish('Ensalada con pan y lechuga', ['lechuga', 100]), 'bread');
    expectOwnForm(dish('Ensalada de tortitas de trigo sarraceno', ['lechuga', 100]), 'pancakes');
  });

  // P1-4: the second review's titles, each a leaf or a vegetable in the form's place.
  it.each([
    ['Wraps de lechuga con pollo', ['wrap', 'flatbread']],
    ['Wrap de lechuga', ['wrap', 'flatbread']],
    ['Lettuce wraps with chicken', ['wrap', 'flatbread']],
    ['Sándwich de lechuga', ['bread', 'bun', 'toast']],
    ['Lettuce sandwich', ['bread', 'bun', 'toast']],
    ['Quesadilla de boniato', ['wrap', 'flatbread']],
    ['Enchiladas de calabacín', ['wrap', 'flatbread']],
    ['Montadito de berenjena', ['bread', 'bun', 'toast']]
  ] as const)('"%s" names no form: %j are rejected', (title, names) => {
    const recipe = dish(title, ['pechuga-de-pollo', 150], ['lechuga', 80]);

    for (const name of names) {
      expect(rejected(recipe, name)).toBe(true);
    }
  });

  /*
   * What stays by design, pinned so a change is seen: "pan" and "pizza" name
   * their form wherever they stand and whatever follows — "pan de coliflor"
   * and "pizza de coliflor" are a bread and a pizza, and so is anything else
   * "de" a vegetable. Only the words of `TITLE_ONLY_AS_HEAD` are read by
   * their place.
   */
  it('keeps "Pan de coliflor" a bread and "Pizza de coliflor" a pizza', () => {
    expectOwnForm(dish('Pan de coliflor con pollo', ['coliflor', 200], ['pechuga-de-pollo', 100]), 'bread');
    expectOwnForm(dish('Pizza de coliflor', ['coliflor', 200], ['huevo', 60]), 'pastry');
  });
});

/* P1-4: a burrito or a taco served as a bowl has no tortilla. */
describe('forms — a title word beside "bowl" names no form', () => {
  const CHICKEN = (title: string) => dish(title, ['pechuga-de-pollo', 150], ['lechuga', 80]);

  it.each(
    TITLE_BOWL.flatMap(bowl => [`Burrito ${bowl} de pollo`, `Taco ${bowl} con pollo`, `Arepa ${bowl} con pollo`, `${bowl} de arepas con pollo`])
  )('"%s" names no tortilla', title => {
    expect(rejected(CHICKEN(title), 'wrap')).toBe(true);
    expect(rejected(CHICKEN(title), 'flatbread')).toBe(true);
  });

  it.each(['Burrito en bol', 'Burrito bol de pollo', 'Cuenco de burrito con pollo'])('"%s" names no tortilla (the third review)', title => {
    expect(rejected(CHICKEN(title), 'wrap')).toBe(true);
  });

  it('still names the form where "bowl" is not beside it', () => {
    expectOwnForm(CHICKEN('Burrito con pollo y arroz, en bowl'), 'wrap');
    expectOwnForm(CHICKEN('Arepas con pollo, en bowl'), 'wrap');
  });
});

/*
 * Phase 2's reviews (P1-B, P1-3): a title that says the dish has none of a
 * form names none. A negation reaches every word after it up to a word of
 * `TITLE_NEGATION_ENDS` — not only the next one, which is how "sin queso ni
 * pan", "sin su pan" and "en vez de pan" slipped through.
 */
describe('forms — a negated title word names no form', () => {
  // No slug keys the meat family: its title does.
  const BURGER = (title: string) => dish(title, ['lentejas-cocidas', 150], ['lechuga', 60]);

  it.each(TITLE_NEGATIONS)('"%s" before a title word negates it: "bun" is rejected, "burger patty" is still the dish’s', negation => {
    expect(rejected(BURGER(`Hamburguesa ${negation} pan`), 'bun')).toBe(true);
    expectOwnForm(BURGER(`Hamburguesa ${negation} pan`), 'burger patty');
  });

  it.each([
    'Hamburguesa sin queso ni pan',
    'Hamburguesa sin gluten ni pan',
    'Hamburguesa de pollo sin gluten ni lactosa ni pan',
    'Hamburguesa sin su pan',
    'Hamburguesa sin sus panes',
    'Hamburguesa sin un pan',
    'Hamburguesa sin el pan',
    'Hamburguesa sin nada de pan',
    'Hamburguesa con lechuga en vez de pan',
    'Hamburguesa en lugar de pan, con lechuga',
    'Hamburguesa (sin pan)',
    'Hamburguesa sin-pan',
    'HAMBURGUESA SIN PAN',
    'Hamburguesa, no bread',
    'Burger with no bread',
    'Burger without any bread',
    'Burger without the bread',
    'Burger with lettuce instead of bread'
  ])('"%s" names no bread, however far the negation reaches', title => {
    expect(rejected(BURGER(title), 'bun')).toBe(true);
    expect(rejected(BURGER(title), 'bread')).toBe(true);
    expectOwnForm(BURGER(title), 'burger patty');
  });

  it.each(TITLE_NEGATION_ENDS)('"%s" ends a negation’s reach: the title word after it is named', end => {
    const title = end === ')' ? 'Hamburguesa (sin salsa) pan' : `Hamburguesa sin salsa${end === ',' ? ',' : ` ${end}`} pan`;

    expectOwnForm(BURGER(title), 'bun');
  });

  it('reads a word before "free", or ending in "less", as negated — and "gluten-free bread" as bread', () => {
    expect(rejected(BURGER('Bread-free burger'), 'bread')).toBe(true);
    expect(rejected(BURGER('Bread free burger'), 'bread')).toBe(true);
    expect(rejected(BURGER('Breadless burger'), 'bread')).toBe(true);
    expect(rejected(BURGER('Burger bread-less with lettuce'), 'bread')).toBe(true);
    expect(rejected(BURGER('Hamburguesa libre de pan'), 'bread')).toBe(true);
    expectOwnForm(BURGER('Gluten-free bread with a burger'), 'bread');
    expectOwnForm(BURGER('Pan sin gluten con hamburguesa'), 'bread');
    // The suffix negates its own word only: "sugarless cake" is a cake.
    expectOwnForm(dish('Sugarless cake with berries', ['lechuga', 100]), 'cake');
  });

  it.each(['Crustless quiche', 'Quiche crustless', 'Crust-less vegetable quiche', 'Quiche sin masa de espinacas', 'Quiche sin base'])(
    '"%s" names no pastry',
    title => {
      const quiche = dish(title, ['huevo', 150], ['espinaca', 80]);

      for (const name of ['pastry', 'dough', 'pie']) {
        expect(rejected(quiche, name)).toBe(true);
      }
    }
  );

  it('lets one negated word of a family take the whole family’s title key away', () => {
    expect(rejected(BURGER('Bocadillo sin pan'), 'bread')).toBe(true);
  });

  it.each(FORM_FAMILIES.flatMap(family => (family.without ?? []).map(word => [family.family, word] as const)))(
    '%s: a title that negates "%s" names none of the family',
    (key, word) => {
      const family = FORM_FAMILIES.find(known => known.family === key) as FormFamily;
      const recipe = dish(`${family.title[0] ?? ''} sin ${word}`, ['lechuga', 100]);

      expect(rejected(recipe, probe(family))).toBe(true);
      expectOwnForm(dish(`${family.title[0] ?? ''} con ${word}`, ['lechuga', 100]), probe(family));
    }
  );
});

/*
 * Phase 2's reviews (P1-A, P1-1, P1-2): the rule is a whitelist. A name is the
 * dish's own form only when, set aside how it is served, it is one row of the
 * family, word for word. Whatever else it says — a kind of milk, a filling,
 * another form, a word of the dish's own ingredients — makes it a name the
 * rule reads as it always has.
 */
describe('forms — a name of the dish’s own form is a row, set aside how it is served', () => {
  // The judge's name stands for the soy milk: the soy milk is not also seen under its own name, which would make it a second food.
  const SHAKE = dish('Batido de leche de soja con plátano y fresas', ['leche-de-soja', 250], ['platano', 100], ['fresa', 80]);
  const SOY = 'leche-de-soja';
  const TOAST = dish('Plato de prueba', ['pan-sin-gluten', 80], ['lechuga', 50]);
  const CHEESE = dish('Plato de prueba', ['queso-vegano', 50], ['lechuga', 50]);
  const PANCAKES = DISHES.ricePancakes;

  /** Each serving word, in the name the judge would give: the dish, the name, the ingredient it stands for. */
  const SERVED: Readonly<Record<string, readonly [PictureRecipe, string, string | undefined]>> = {
    a: [SHAKE, 'a glass of milk', SOY],
    bowl: [SHAKE, 'bowl of milk', SOY],
    cup: [SHAKE, 'cup of milk', SOY],
    glass: [SHAKE, 'glass of milk', SOY],
    grated: [CHEESE, 'grated cheese', 'queso-vegano'],
    melted: [CHEESE, 'melted cheese', 'queso-vegano'],
    of: [TOAST, 'slice of bread', 'pan-sin-gluten'],
    piece: [TOAST, 'piece of toast', 'pan-sin-gluten'],
    pieces: [TOAST, 'pieces of toast', 'pan-sin-gluten'],
    slice: [TOAST, 'slice of toast', 'pan-sin-gluten'],
    sliced: [TOAST, 'sliced bread', 'pan-sin-gluten'],
    slices: [TOAST, 'slices of bread', 'pan-sin-gluten'],
    stack: [PANCAKES, 'stack of pancakes', undefined],
    toasted: [TOAST, 'toasted bread', 'pan-sin-gluten']
  };

  it('has a case for every serving word', () => {
    expect(Object.keys(SERVED).sort()).toEqual([...SERVING_WORDS].sort());
  });

  it.each(Object.entries(SERVED))('the serving word "%s" leaves the form the dish’s own: %j', (_word, [recipe, name, of]) => {
    expectOwnForm(recipe, name, of);
  });

  it.each([
    // A word that says what kind of milk it is: dairy, whatever the dish holds (P1-2).
    [SHAKE, 'whole milk'],
    [SHAKE, 'skimmed milk'],
    [SHAKE, 'semi skimmed milk'],
    [SHAKE, 'fresh milk'],
    [SHAKE, 'cold milk'],
    [SHAKE, "cow's milk"],
    [SHAKE, 'cow milk'],
    [SHAKE, 'goat milk'],
    [SHAKE, 'dairy milk'],
    // A word of the dish's own ingredients is not a serving word either: "banana milk" is no row.
    [SHAKE, 'banana milk'],
    [SHAKE, 'apple milk'],
    [CHEESE, 'goat cheese'],
    [CHEESE, 'mature cheese'],
    [CHEESE, 'soft cheese'],
    [TOAST, 'white bread'],
    [TOAST, 'wholemeal bread']
  ] as const)('any other word makes it a name read as before: "%s"', (recipe, name) => {
    const verdict = judged(recipe, picture(recipe, { name, of: recipe.ingredients[0]?.slug as string }));

    expect(verdict.accepted).toBe(false);
    expect(verdict.notes.some(note => note.startsWith('own_form:'))).toBe(false);
  });

  // P1-1: a name made only of form words the dish owns is still no row.
  it.each([
    [
      dish('Tarta de queso vegana', ['queso-vegano', 150], ['nata-vegetal-de-soja', 100], ['harina-de-arroz', 50]),
      'cream cheese',
      'queso-vegano',
      'milk'
    ],
    [dish('Pan sin gluten con leche de soja', ['pan-sin-gluten', 80], ['leche-de-soja', 200]), 'milk roll', 'pan-sin-gluten', 'eggs'],
    [dish('Pan sin gluten con leche de soja', ['pan-sin-gluten', 80], ['leche-de-soja', 200]), 'milk bun', 'pan-sin-gluten', 'milk'],
    [dish('Pan sin gluten con leche de soja', ['pan-sin-gluten', 80], ['leche-de-soja', 200]), 'milk bread', 'pan-sin-gluten', 'milk'],
    [dish('Bocadillo sin gluten de heura', ['pan-sin-gluten', 80], ['heura', 100]), 'meatball sandwich', 'pan-sin-gluten', 'eggs']
  ] as const)('rejects two forms the dish owns read as one food: "%s"', (recipe, name, of, allergen) => {
    for (const shown of [picture(recipe, { name }), picture(recipe, { name, of }), picture(recipe, { name, of, paired: true })]) {
      const verdict = judged(recipe, shown);

      expect(verdict.accepted).toBe(false);
      expect(verdict.extras.find(extra => extra.name === name)?.foreignAllergens).toContain(allergen);
      expect(verdict.notes.some(note => note.startsWith('own_form:'))).toBe(false);
    }
  });

  it('keeps the usual notes of a name it read as it always has', () => {
    const verdict = judged(SHAKE, picture(SHAKE, { name: 'cow milk', of: SOY }));

    expect(verdict.notes).toContain('extra_allergen:cow milk=lactose+milk');
    expect(verdict.extras.find(extra => extra.name === 'cow milk')?.mappedTo).toContain('leche-entera');
  });

  it('reads a row seen beside a fuller name of its form as a second food: "glass of milk" beside "soy milk"', () => {
    const shown = picture(SHAKE, { name: 'glass of milk', of: SOY });
    const verdict = judged(SHAKE, {
      match: shown.match,
      seen: { foods: [...shown.seen.foods, { amount: 'main', name: 'soy milk', specific: true }] }
    });

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras.find(extra => extra.name === 'glass of milk')?.foreignAllergens).toContain('milk');
  });

  it('reads a whole name the catalogue holds as that food, even with a word of the dish: "milk roll" beside a glass of milk', () => {
    const breakfast = dish('Desayuno de prueba con leche', ['pan-sin-gluten', 80], ['leche-entera', 200]);
    const verdict = judged(breakfast, picture(breakfast, { name: 'milk roll', of: 'pan-sin-gluten' }));

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras.find(extra => extra.name === 'milk roll')?.foreignAllergens).toEqual(['eggs', 'gluten']);
    expect(verdict.notes.some(note => note.startsWith('own_form:'))).toBe(false);
  });
});

describe('forms — each word of the judge is excused on a dish of its family', () => {
  const rows = FORM_FAMILIES.flatMap(family => family.seen.map(word => [family.family, word] as const));

  /*
   * A dish of the family: its first slug, which the word names (a slug seen
   * under its own fuller name beside the word would make the word a second
   * food), or else its first title word.
   */
  it.each(rows)('%s: "%s"', (key, word) => {
    const family = FORM_FAMILIES.find(known => known.family === key) as FormFamily;
    const [slug] = family.slugs;
    const recipe =
      slug === undefined ? dish(`Prueba ${family.title[0] ?? ''} casera`, ['lechuga', 100]) : dish('Plato de prueba', [slug, 100], ['lechuga', 50]);

    const shown = picture(recipe, slug === undefined ? { name: word } : { name: word, of: slug });

    if (CARRIES_NOTHING.includes(word)) {
      expect(judged(recipe, shown).accepted).toBe(true);
      expect(foreign(PLAIN, word)).toEqual([]);
    } else {
      // Excused of what its family's form carries, and of nothing more: a row of `BEYOND_THE_FAMILY` still rejects a dish that lacks the rest.
      expectOwnForm(recipe, word, slug);
      expect(foreign(PLAIN, word)).not.toEqual([]);
    }
  });

  it('pins the words that carry nothing today, and only those', () => {
    const nothing = FORM_FAMILIES.flatMap(family => family.seen).filter(word => foreign(PLAIN, word).length === 0);

    expect(nothing.sort()).toEqual([...CARRIES_NOTHING].sort());
  });

  /*
   * Row by row: what the catalogue reads in each of the judge's names beyond
   * its family's closed set. The rule leaves it to be weighed against the
   * dish; a new row, or a new catalogue product a row reads as, that carries
   * more shows up here.
   */
  it('pins what each row carries beyond its family’s closed set', () => {
    const beyond = Object.fromEntries(
      FORM_FAMILIES.flatMap(family =>
        family.seen.flatMap(row => {
          const extra = beyondItsFamily(family, row);

          return extra.length > 0 ? [[row, extra]] : [];
        })
      )
    );

    expect(beyond).toEqual(BEYOND_THE_FAMILY);
  });

  /*
   * Each family's closed set, allergen by allergen: a known allergen key, and
   * one some row of the family reads as carrying — no allergen is in a set
   * for nothing.
   */
  it.each(FORM_FAMILIES.flatMap(family => family.carries.map(allergen => [family.family, allergen] as const)))(
    '%s: "%s" is carried by one of its rows',
    (key, allergen) => {
      const family = FORM_FAMILIES.find(known => known.family === key) as FormFamily;

      expect(family.seen.some(row => foreign(PLAIN, row).includes(allergen))).toBe(true);
    }
  );

  it('writes each family’s closed set sorted, without repeats', () => {
    for (const family of FORM_FAMILIES) {
      expect(family.carries).toEqual([...new Set(family.carries)].sort());
    }
  });

  it('weighs what "battered fish" carries beyond its batter: accepted on battered hake, rejected on a battered dish with no fish', () => {
    expectOwnForm(DISHES.batteredHake, 'battered fish', 'merluza');

    const chicken = dish('Pollo rebozado con ensalada', ['pechuga-de-pollo', 150], ['lechuga', 80]);
    const verdict = judged(chicken, picture(chicken, { name: 'battered fish' }));

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras.find(extra => extra.name === 'battered fish')?.foreignAllergens).toEqual(['fish']);
  });
});

/* Before phase 2's third round a list of phrases (`SEEN_NOT_A_FORM`) kept these apart; a whitelist needs none — neither is a row. */
describe('forms — a phrase in which a form’s word names another food', () => {
  it.each([
    ['ice cream', dish('Plato de prueba', ['crema-de-coco', 60], ['lechuga', 50]), 'milk'],
    ['milk chocolate', dish('Plato de prueba', ['leche-de-soja', 200], ['lechuga', 50]), 'milk'],
    ['cream sauce', dish('Plato de prueba', ['crema-de-coco', 60], ['lechuga', 50]), 'milk']
  ])('rejects "%s" on a dish of its family’s own version, for %s', (name, recipe, allergen) => {
    const verdict = judged(recipe, picture(recipe, { name }));

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras.find(extra => extra.name === name)?.foreignAllergens).toContain(allergen);
    expect(verdict.notes.some(note => note.startsWith('own_form:'))).toBe(false);
  });
});

describe('forms — two spellings are one word', () => {
  it.each([...SPELLINGS])('"%s" and "%s"', (british, american) => {
    const family = FORM_FAMILIES.find(known => known.seen.includes(american));

    expect(family?.seen).toContain(british);
  });

  it('keeps "yogurt" beside "soya yoghurt" a second food', () => {
    const recipe = dish('Prueba de yogur de soja sin más', ['yogur-de-soja', 150], ['fresa', 80]);
    const verdict = judged(recipe, picture(recipe, { name: 'yogurt' }));

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras.find(extra => extra.name === 'yogurt')?.foreignAllergens).toContain('milk');
  });

  it('keeps "pita" beside "pitta bread" a second food', () => {
    const recipe = dish('Tacos de maíz con pollo', ['tortilla-de-maiz', 60], ['pechuga-de-pollo', 100]);
    const shown = picture(recipe, { name: 'pita' });
    const verdict = judged(recipe, {
      match: shown.match,
      seen: { foods: [...shown.seen.foods, { amount: 'main', name: 'pitta bread', specific: true }] }
    });

    expect(verdict.accepted).toBe(false);
  });
});

describe('forms — a word that is not a food is not read on its own', () => {
  it.each(NOT_A_FOOD)('"%s" alone maps to no catalogue row', word => {
    const verdict = judged(PLAIN, picture(PLAIN, { name: word }));

    expect(verdict.accepted).toBe(true);
    expect(verdict.extras.find(extra => extra.name === word)?.mappedTo).toEqual([]);
  });

  it('still reads a whole catalogue name that holds one: a pizza base carries gluten', () => {
    expect(foreign(PLAIN, 'pizza base')).toEqual(['gluten']);
  });
});

describe('forms — a plant word before a dairy word maps the plant', () => {
  const QUALIFIED: Readonly<Record<string, readonly string[]>> = {
    almond: ['tree_nuts'],
    cashew: ['tree_nuts'],
    coconut: [],
    hazelnut: ['tree_nuts'],
    nut: ['tree_nuts'],
    oat: ['gluten'],
    rice: [],
    soy: ['soy'],
    soya: ['soy']
  };

  it('has a case for every plant word', () => {
    expect(Object.keys(QUALIFIED).sort()).toEqual([...PLANT_QUALIFIERS].sort());
  });

  it.each(PLANT_QUALIFIERS.flatMap(plant => DAIRY_WORDS.map(dairy => [plant, dairy] as const)))('"%s %s" carries no milk', (plant, dairy) => {
    expect(foreign(PLAIN, `${plant} ${dairy}`)).not.toContain('milk');
  });

  it.each(Object.entries(QUALIFIED))('"%s milk" carries what its plant carries: %j', (plant, allergens) => {
    expect(foreign(PLAIN, `${plant} milk`)).toEqual(allergens);
  });

  it.each(DAIRY_WORDS)('"%s" alone, or after a word that is not a plant, is still milk', dairy => {
    expect(foreign(PLAIN, dairy)).toContain('milk');
    expect(foreign(PLAIN, `goat ${dairy}`)).toContain('milk');
  });

  it('maps a dairy word before a plant word as it always did: "milk with coconut" is milk', () => {
    expect(foreign(PLAIN, 'milk with coconut')).toContain('milk');
  });

  /*
   * The lead's decision (round 3): a word that says only "not dairy" names no
   * plant — "vegan butter" could be soy or nuts — so its dairy word reads as
   * it always has. Before, the pair mapped to nothing and was accepted as an
   * unknown food anywhere.
   */
  it('keeps the words that say only "not dairy" out of the plants', () => {
    expect(NOT_A_PLANT.filter(word => PLANT_QUALIFIERS.includes(word) || NOT_A_FOOD.includes(word))).toEqual([]);
  });

  // A whole catalogue name is read as that product: the catalogue's "Vegan cheese" is its vegan cheese.
  it.each(
    NOT_A_PLANT.flatMap(word => DAIRY_WORDS.map(dairy => `${word} ${dairy}`)).filter(
      name => !SEED_CATALOGUE.some(entry => entry.names.some(known => known.toLowerCase() === name))
    )
  )('"%s" on a plain dish is still dairy', name => {
    const verdict = judged(PLAIN, picture(PLAIN, { name }));

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras.find(extra => extra.name === name)?.foreignAllergens).toContain('milk');
  });

  // Both directions, on dishes of a plant milk or cream: the named plant is the dish's, the generic word is not.
  it.each([
    [DISHES.oatMilkRicePudding, 'oat milk', 'plant milk'],
    [DISHES.oatMilkRicePudding, 'oat milk', 'vegan milk'],
    [DISHES.coconutCurry, 'coconut cream', 'vegetable cream'],
    [DISHES.soyYoghurt, 'soy yogurt', 'vegan yogurt']
  ] as const)('on "%s", accepts "%s" and rejects "%s"', (recipe, named, generic) => {
    expect(judged(recipe, picture(recipe, { name: named })).accepted).toBe(true);
    expect(rejected(recipe, generic)).toBe(true);
  });

  it('rejects "vegan butter" on a plain dish, which could be soy or nuts', () => {
    expect(rejected(PLAIN, 'vegan butter')).toBe(true);
  });

  // Phase 2's review (P2-C): with "plant" read as no food, a plant protein on a lentil stew carried nothing.
  it('still reads "plant protein" as the catalogue’s plant protein, and rejects it for soy on a lentil stew', () => {
    const stew = dish('Guiso de lentejas', ['lentejas-cocidas', 200], ['zanahoria', 50]);
    const verdict = judged(stew, picture(stew, { name: 'plant protein' }));

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras.find(extra => extra.name === 'plant protein')?.foreignAllergens).toEqual(['soy']);
  });
});

describe('forms — a sulphite a food only may contain never rejects', () => {
  it('lists sulphites alone', () => {
    expect(UNSEEN_WHEN_ONLY_MAY_CONTAIN).toEqual(['sulphites']);
  });

  it('holds only allergens some catalogue row may contain', () => {
    expect(UNSEEN_WHEN_ONLY_MAY_CONTAIN.every(key => SEED_CATALOGUE.some(entry => (entry.mayContain ?? []).includes(key)))).toBe(true);
  });

  /*
   * Phase 2's review (P2-E): a word several catalogue rows hold counts what
   * they all carry. A sulphite one contains and the others only may contain
   * is contained — "may contain" must not absorb it. A catalogue made up for
   * the case: no seed row pairs the two today.
   */
  describe('on a word several rows hold', () => {
    const row = (slug: string, name: string, allergens: readonly string[], mayContain: readonly string[] = []): PictureCatalogueEntry => ({
      allergens,
      mayContain,
      names: [name],
      slug
    });
    const recipe: PictureRecipe = { ingredients: [{ grams: 100, name: 'Lettuce', slug: 'lechuga' }], name: 'Plato de prueba' };
    const judgedOn = (catalogue: readonly PictureCatalogueEntry[]) =>
      judgePicture({
        catalogue,
        match: { extras: ['wine'], ingredients: [{ matched: ['lettuce'], slug: 'lechuga', status: 'seen' }] },
        recipe,
        seen: { foods: ['lettuce', 'wine'].map(name => ({ amount: 'main' as const, name, specific: true })) }
      });

    it('rejects when one row contains a sulphite and the others may', () => {
      const verdict = judgedOn([
        row('lechuga', 'Lettuce', []),
        row('vino-de-jerez', 'Sherry wine', ['sulphites']),
        row('vino-de-arroz', 'Rice wine', [], ['sulphites'])
      ]);

      expect(verdict.accepted).toBe(false);
      expect(verdict.extras.find(extra => extra.name === 'wine')?.foreignAllergens).toEqual(['sulphites']);
    });

    it('accepts when every row only may contain it', () => {
      const verdict = judgedOn([
        row('lechuga', 'Lettuce', []),
        row('vino-de-jerez', 'Sherry wine', [], ['sulphites']),
        row('vino-de-arroz', 'Rice wine', [], ['sulphites'])
      ]);

      expect(verdict.accepted).toBe(true);
    });
  });
});
