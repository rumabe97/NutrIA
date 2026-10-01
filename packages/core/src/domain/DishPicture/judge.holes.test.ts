import { describe, expect, it } from 'vitest';

import { dish, DISHES, judged, picture } from '#test/dish-picture/acceptance';

/*
 * The holes (project 010, PRD 8; report `0006` § 5.6): names of foods that
 * anyone would expect to carry an allergen and that today's rule maps to
 * none, so a pizza drawn on a dish with no gluten passes. Each name is read as
 * an extra food on a dish of water, which carries nothing: what it maps to is
 * all that counts.
 *
 * `EXPECTED` is the report's list of 166 such names, by the allergen their
 * usual recipe carries. Phase 1 pinned the 19 that missed it, so that they
 * could not become 20 unnoticed. Rewritten on purpose in phase 5, which closed
 * them: the test now pins what each of them carries (`CLOSED`), the names the
 * phase's sweep found beyond the 166 (`FOUND`), and the two it left open with
 * the reason (`LEFT_OPEN`). The guard is the same: every name carries its
 * allergen but those left open.
 */
const EXPECTED: Readonly<Record<string, readonly string[]>> = {
  celery: ['celery', 'celery sticks'],
  crustaceans: ['shrimp', 'prawns', 'king prawns', 'lobster', 'crab', 'langoustine', 'crayfish'],
  eggs: [
    'egg',
    'fried egg',
    'boiled egg',
    'poached egg',
    'scrambled eggs',
    'omelette',
    'omelet',
    'frittata',
    'egg yolk',
    'mayonnaise',
    'aioli',
    'meringue',
    'hollandaise',
    'quiche',
    'egg noodles'
  ],
  fish: [
    'salmon',
    'tuna',
    'cod',
    'hake',
    'anchovies',
    'sardines',
    'white fish',
    'fish fillet',
    'smoked salmon',
    'mackerel',
    'trout',
    'sea bass',
    'fish'
  ],
  gluten: [
    'bread',
    'toast',
    'bun',
    'baguette',
    'bagel',
    'pita bread',
    'naan',
    'wrap',
    'flour tortilla',
    'wheat tortilla',
    'tortilla',
    'pizza',
    'pizza crust',
    'pizza slice',
    'pastry',
    'puff pastry',
    'pie',
    'tart',
    'quiche',
    'croissant',
    'pancakes',
    'crepes',
    'crepe',
    'waffles',
    'cake',
    'cupcake',
    'muffin',
    'brownie',
    'cookies',
    'biscuits',
    'crackers',
    'pretzel',
    'breadsticks',
    'croutons',
    'breadcrumbs',
    'breaded chicken',
    'battered fish',
    'dumplings',
    'gyoza',
    'pasta',
    'spaghetti',
    'penne',
    'fusilli',
    'macaroni',
    'lasagna',
    'ravioli',
    'gnocchi',
    'noodles',
    'ramen',
    'udon',
    'egg noodles',
    'couscous',
    'bulgur',
    'seitan',
    'burrito',
    'sandwich',
    'fritters',
    'crumble',
    'granola',
    'muesli',
    'cereal',
    'barley',
    'soy sauce',
    'beer'
  ],
  milk: [
    'milk',
    'glass of milk',
    'yogurt',
    'greek yogurt',
    'cheese',
    'grated cheese',
    'melted cheese',
    'feta',
    'feta cheese',
    'mozzarella',
    'parmesan',
    'cottage cheese',
    'cream cheese',
    'ricotta',
    'halloumi',
    'paneer',
    'goat cheese',
    'blue cheese',
    'cream',
    'whipped cream',
    'sour cream',
    'butter',
    'ice cream',
    'custard',
    'milkshake',
    'latte',
    'cheese sauce',
    'bechamel',
    'white chocolate',
    'milk chocolate'
  ],
  molluscs: ['mussels', 'clams', 'squid', 'calamari', 'octopus', 'scallops', 'oysters', 'cuttlefish'],
  mustard: ['mustard', 'mustard seeds'],
  peanuts: ['peanuts', 'peanut butter', 'peanut sauce', 'crushed peanuts'],
  sesame: ['sesame seeds', 'tahini', 'sesame', 'hummus'],
  soy: ['tofu', 'tempeh', 'edamame', 'soy sauce', 'miso', 'soy beans'],
  tree_nuts: ['almonds', 'walnuts', 'hazelnuts', 'cashews', 'pistachios', 'pine nuts', 'pecans', 'nuts', 'chopped nuts', 'almond flakes', 'pesto']
};

/*
 * Phase 5's sweep: the annex's foods and every family's row, singular and
 * plural, read the same way. These carried no allergen either, beyond the
 * 166: a word nothing held ("hamburger", "buttermilk", "crust", "crumbs",
 * "patty"), the catalogue's names in the singular only ("crouton"), and a
 * plural the rule read as a word of its own ("toasts", "pies", "yogurts",
 * "sandwiches", "octopuses").
 */
const FOUND: Readonly<Record<string, readonly string[]>> = {
  gluten: ['hamburger', 'crust', 'crouton', 'crumbs', 'toasts', 'pies', 'gyozas', 'lasagnas', 'flatbreads', 'sandwiches', 'sausages', 'patty'],
  milk: ['buttermilk', 'yogurts'],
  molluscs: ['octopuses']
};

/*
 * What each hole carries since phase 5, exactly, on a dish of water — the 19
 * of report § 5.6 and those the sweep found. Each is read as its usual recipe
 * (`SEEN_SYNONYMS` in `judge.ts`); "hamburger" and "omelet" as the words the
 * rule knew (`SAME_WORD`); a plural through its singular; "tortilla" as a
 * wheat wrap on any dish that is no potato omelette (`READINGS`) — on water,
 * the wrap's gluten.
 */
const CLOSED: Readonly<Record<string, readonly string[]>> = {
  burrito: ['gluten'],
  buttermilk: ['lactose', 'milk'],
  crayfish: ['crustaceans'],
  crepe: ['eggs', 'gluten', 'milk'],
  crepes: ['eggs', 'gluten', 'milk'],
  crouton: ['gluten'],
  crumble: ['eggs', 'gluten', 'milk'],
  crumbs: ['gluten'],
  crust: ['gluten'],
  cupcake: ['eggs', 'gluten', 'milk'],
  flatbreads: ['gluten'],
  frittata: ['eggs'],
  fritters: ['gluten'],
  fusilli: ['gluten'],
  gyozas: ['gluten'],
  hamburger: ['gluten'],
  hollandaise: ['eggs', 'lactose', 'milk'],
  lasagnas: ['eggs', 'gluten'],
  latte: ['lactose', 'milk'],
  meringue: ['eggs'],
  octopuses: ['molluscs'],
  omelet: ['eggs'],
  paneer: ['lactose', 'milk'],
  pies: ['gluten', 'milk'],
  pizza: ['gluten'],
  'pizza crust': ['gluten'],
  'pizza slice': ['gluten'],
  sandwiches: ['gluten'],
  tart: ['eggs', 'gluten', 'milk'],
  toasts: ['gluten'],
  tortilla: ['gluten'],
  yogurts: ['lactose', 'milk']
};

/*
 * Left open on purpose, each with its reason. A row here must still carry
 * nothing: mapping it is a decision, not a clean-up.
 */
const LEFT_OPEN: readonly (readonly [name: string, allergen: string, reason: string])[] = [
  [
    'sausages',
    'gluten',
    'Only the vegetarian sausages contain an allergen (soy, gluten); the fresh and chicken ones only may contain gluten, and the cured ones (chorizo, fuet, butifarra) nothing. The judge names a dish’s own chorizo "sausage" — three faithful pictures of the pilot — and reading the bare word as either would reject them.'
  ],
  [
    'patty',
    'gluten',
    'A patty is meat, fish or vegetables pressed flat, with no allergen of its own; the gluten is a beef burger’s "may contain". "burger patty" is read as a burger, and is the meat family’s row.'
  ]
];

/*
 * Phase 5's step 5: a form's word alone is the form with nothing in it
 * (`BARE_FORMS`), never the catalogue's only filled product of that name — a
 * brownie that may contain nuts, a tuna empanada, crackers that may contain
 * sesame, chocolate sandwich biscuits. What each carries, exactly.
 */
const BARE: Readonly<Record<string, readonly string[]>> = {
  'a slice of brownie': ['eggs', 'gluten', 'milk'],
  brownie: ['eggs', 'gluten', 'milk'],
  brownies: ['eggs', 'gluten', 'milk'],
  cracker: ['gluten'],
  crackers: ['gluten'],
  empanada: ['gluten', 'milk'],
  empanadas: ['gluten', 'milk'],
  sandwich: ['gluten']
};

const WATER = dish('Agua', ['agua', 100]);

function foreignAllergens(name: string): readonly string[] {
  return judged(WATER, picture(WATER, { name })).extras.find(extra => extra.name === name)?.foreignAllergens ?? [];
}

describe('judgePicture — the names that carry an allergen and mapped to none', () => {
  it('reads the report’s 166 names, and 15 the sweep found', () => {
    expect(Object.values(EXPECTED).flat()).toHaveLength(166);
    expect(Object.values(FOUND).flat()).toHaveLength(15);
  });

  it('closes the 19 of the report, and the sweep’s, but for those left open', () => {
    const report = ['tortilla', 'pizza', 'pizza crust', 'pizza slice', 'tart', 'crepes', 'crepe', 'cupcake', 'fusilli', 'burrito', 'fritters'];
    const more = ['crumble', 'paneer', 'latte', 'omelet', 'frittata', 'meringue', 'hollandaise', 'crayfish'];
    const found = Object.values(FOUND)
      .flat()
      .filter(name => !LEFT_OPEN.some(([open]) => open === name));

    expect(Object.keys(CLOSED).sort()).toEqual([...report, ...more, ...found].sort());
  });

  it.each(Object.entries(CLOSED))('"%s" carries %j', (name, allergens) => {
    expect(foreignAllergens(name)).toEqual(allergens);
  });

  it.each(LEFT_OPEN)('leaves "%s" open: it does not carry %s — %s', (name, allergen) => {
    expect(foreignAllergens(name)).not.toContain(allergen);
  });

  it.each(Object.entries(BARE))('reads a bare "%s" as the form with nothing in it: %j', (name, allergens) => {
    expect(foreignAllergens(name)).toEqual(allergens);
  });

  it('has no hole beyond those left open', () => {
    const missed = [...Object.entries(EXPECTED), ...Object.entries(FOUND)].flatMap(([allergen, names]) =>
      names.filter(name => !foreignAllergens(name).includes(allergen)).map(name => `${name}=${allergen}`)
    );

    expect(missed.sort()).toEqual(LEFT_OPEN.map(([name, allergen]) => `${name}=${allergen}`).sort());
  });
});

/*
 * "tortilla" is read from the dish (`READINGS`, the lead's decision): an
 * omelette on a dish that is one — its title names one, or opens with
 * "tortilla" on a dish of egg, or it holds the packaged omelette — and a
 * wheat wrap, with its gluten, on every other dish. Never the reading that
 * fits the dish best: a wheat wrap must not pass on a dish of egg with no
 * gluten. An egg and a potato alone make no omelette (the reviewer's P2-5):
 * a potato salad with egg is no tortilla.
 */
describe('judgePicture — "tortilla", read from the dish', () => {
  const OIL = ['aceite-de-oliva-virgen-extra', 5] as const;
  const RICE = dish('Arroz con pollo', ['arroz-blanco-cocido', 150], ['pechuga-de-pollo', 120], OIL);
  const EGGS = dish('Revuelto de espinacas', ['huevo', 120], ['espinaca', 100], OIL);
  const WHEAT = dish('Pollo con cuscús', ['cuscus-cocido', 150], ['pechuga-de-pollo', 120], OIL);
  // The judge's "tortilla" stands for the dish's corn tortilla, which is not also seen under its own name (that would make it a second food).
  const TACOS = dish('Tacos de pollo', ['tortilla-de-maiz', 60], ['pechuga-de-pollo', 120], OIL);
  const OMELETTE = DISHES.potatoOmelette;

  it.each([
    ['a dish of rice and chicken: the wrap', RICE, undefined, ['gluten']],
    ['a dish of egg with no gluten that is no omelette: the wrap, rejected', EGGS, undefined, ['gluten']],
    ['a dish that carries gluten: the wrap, which it carries', WHEAT, undefined, []],
    ['a dish of corn tortillas: the wrap, its own form', TACOS, 'tortilla-de-maiz', []],
    ['a potato omelette by its title: the omelette', OMELETTE, 'huevo', []],
    // P2-5: an egg and a potato alone make no omelette.
    [
      'a dish of egg and potato that is no omelette: the wrap, rejected',
      dish('Plato de prueba', ['huevo', 150], ['patata', 200], OIL),
      undefined,
      ['gluten']
    ],
    [
      'a potato salad with egg: the wrap, rejected',
      dish('Ensalada de patata con huevo', ['patata', 200], ['huevo', 100], OIL),
      undefined,
      ['gluten']
    ],
    ['huevos rotos: the wrap, rejected', dish('Huevos rotos con patatas', ['huevo', 120], ['patata', 200], OIL), undefined, ['gluten']],
    ['a title that names a frittata: the omelette', dish('Frittata de verduras al horno', ['huevo', 150], ['patata', 100], OIL), undefined, []],
    ['a dish of the packaged omelette: the omelette', dish('Plato de prueba', ['tortilla-de-patatas-envasada', 150], ['lechuga', 50]), undefined, []],
    [
      'a title that names a potato omelette: the omelette',
      dish('Tortilla de patata con calabacín', ['huevo', 150], ['calabacin', 150], OIL),
      undefined,
      []
    ],
    ['a title that names a Spanish omelette: the omelette', dish('Tortilla española al horno', ['huevo', 150], ['cebolla', 60], OIL), undefined, []],
    ['a title that names an omelette: the omelette', dish('Omelette de champiñones', ['huevo', 150], ['champinon', 100], OIL), undefined, []],
    // "tortilla" as the title's first word, on a dish that holds an egg: a vegetable or French omelette (two of the library's).
    [
      'a title headed "tortilla" on a dish of egg: the omelette',
      dish('Tortilla de calabacín y cebolla', ['huevo', 150], ['calabacin', 150], OIL),
      undefined,
      []
    ],
    [
      'a title headed "tortilla" on a dish with no egg: the wrap',
      dish('Tortilla rellena de pollo', ['pechuga-de-pollo', 120], ['lechuga', 50], OIL),
      undefined,
      ['gluten']
    ],
    [
      '"tortilla" in a title, not first, on a dish of egg: the wrap',
      dish('Huevos revueltos con tortilla', ['huevo', 120], ['espinaca', 100], OIL),
      undefined,
      ['gluten']
    ],
    // An omelette title with no egg is still read as an omelette, and its egg is weighed.
    [
      'an omelette title on a dish with no egg: the omelette, for its egg',
      dish('Tortilla de patatas vegana', ['harina-de-garbanzo', 60], ['patata', 200], OIL),
      undefined,
      ['eggs']
    ],
    ['a negated omelette title: the wrap', dish('Huevos con espinacas, sin omelette', ['huevo', 120], ['espinaca', 100], OIL), undefined, ['gluten']]
  ] as const)('on %s', (_case, recipe, of, allergens) => {
    const verdict = judged(recipe, picture(recipe, of === undefined ? { name: 'tortilla' } : { name: 'tortilla', of }));

    expect(verdict.extras.find(extra => extra.name === 'tortilla')?.foreignAllergens).toEqual(allergens);
    expect(verdict.accepted).toBe(allergens.length === 0);
  });

  /*
   * The known misses of a reading taken from the dish: the judge's "tortilla"
   * is the food the dish is, so a picture of the other one under that bare
   * word passes. A wheat wrap on a potato omelette with no gluten is read as
   * the omelette; a potato omelette on a wheat dish with no egg, as the wrap.
   */
  it.each([
    ['a wheat wrap on a potato omelette with no gluten', OMELETTE],
    ['a potato omelette on a wheat dish with no egg', WHEAT]
  ] as const)('known miss: accepts a bare "tortilla" that is %s', (_case, recipe) => {
    expect(judged(recipe, picture(recipe, { name: 'tortilla' })).accepted).toBe(true);
  });

  it('accepts the omelette every way the match call answers', () => {
    expect(judged(OMELETTE, picture(OMELETTE, { name: 'tortilla', of: 'huevo', paired: true })).accepted).toBe(true);
    expect(judged(OMELETTE, picture(OMELETTE, { name: 'tortillas', of: 'huevo' })).accepted).toBe(true);
  });

  it('says so when it is the dish’s own wraps form, and not on an omelette', () => {
    expect(judged(TACOS, picture(TACOS, { name: 'tortilla', of: 'tortilla-de-maiz' })).notes).toContain('own_form:tortilla');
    expect(judged(OMELETTE, picture(OMELETTE, { name: 'tortilla' })).notes.some(note => note.startsWith('own_form:'))).toBe(false);
  });

  it('keeps "tortilla" beside the dish’s own "corn tortilla" a second food, as project 006 does', () => {
    expect(judged(TACOS, picture(TACOS, { name: 'tortilla' })).accepted).toBe(false);
  });

  it('reads a name that says more as it always was: "spanish tortilla" is egg, "wheat tortilla" gluten', () => {
    expect(foreignAllergens('spanish tortilla')).toEqual(['eggs']);
    expect(foreignAllergens('wheat tortilla')).toEqual(['gluten']);
  });
});
