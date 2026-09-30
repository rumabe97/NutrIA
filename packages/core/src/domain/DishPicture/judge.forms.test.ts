import { describe, expect, it } from 'vitest';

import { flaggedExtras } from 'core/domain/DishPicture';

import { dish, DISHES, judged, picture } from '#test/dish-picture/acceptance';

import type { PictureRecipe } from 'core/domain/DishPicture';
import type { Picture } from '#test/dish-picture/acceptance';

/*
 * What the rule must do once it knows a dish's own form (project 010, `0073`),
 * written while the rule is still the one that does not: a word that names a
 * form — pancakes, bread, meatballs, milk — brings no allergens when the dish
 * has its own version of that form, by an ingredient that is the form or by a
 * title that names it, and every other word of the name counts as before.
 *
 * How phase 2 uses the marks. A case here says what is wanted. Where today's
 * rule gets it wrong the case is registered with `it.fails`, through `wanted`:
 * the suite is green now, and a marked case that passes turns it red — so the
 * marks are exactly the production cases and the faithful pictures the rule
 * rejects, no more. Phase 2 changes the rule until each marked case passes and
 * removes its mark: a `'both'` or `'extra'` in a table becomes `'neither'`, an
 * `it.fails` becomes `it`. When none is left, the mark column and `wanted` go.
 * The cases that must stay rejected carry no mark: they pass today and after.
 *
 * Two families have title keys only (`0073`): breading and the breaded forms
 * (nuggets, croquettes). Breadcrumbs or cornflakes in a dish can be a binder
 * or a cereal, and are not seen as a coating; only a title that says
 * "empanado", "rebozado", "nuggets" or "croquetas" excuses the form.
 *
 * For phase 2: the architect's prototype puts a bare "burger" in the meat
 * family and accepts it beside a plant protein. It must not: a burger is seen
 * in its bun, and the bun's gluten is what rejects it. "burger patty" and
 * "patty" are the meat alone, and are excused.
 *
 * Every dish is an example written for these tests, except the three of
 * production, which are rebuilt and say what they assume.
 */
function wanted(wrongToday: boolean) {
  return wrongToday ? it.fails : it;
}

type Dish = keyof typeof DISHES;

/** Which of the match call's two answers today's rule rejects, for a picture it should accept. */
type WrongToday = 'both' | 'extra' | 'neither';

/**
 * A faithful picture: the judge calls the dish's own food `name`. With `of`,
 * the ingredient the name stands for — tried both ways the match call can
 * answer, paired with it and left as an extra. With `null`, the name is for
 * something the title says and no single ingredient is, so it is an extra.
 */
type Faithful = readonly [dish: Dish, name: string, of: string | null, wrongToday: WrongToday];

function accepts(rows: readonly Faithful[]): void {
  for (const [key, name, of, wrongToday] of rows) {
    const recipe = DISHES[key];

    if (of !== null) {
      const paired = picture(recipe, { name, of, paired: true });

      wanted(wrongToday === 'both')(`accepts "${name}" paired with ${of} on "${recipe.name}"`, () => {
        expect(judged(recipe, paired).accepted).toBe(true);
      });
    }

    const extra = picture(recipe, of === null ? { name } : { name, of });

    wanted(wrongToday !== 'neither')(`accepts "${name}" left as an extra on "${recipe.name}"`, () => {
      expect(judged(recipe, extra).accepted).toBe(true);
    });
  }
}

/**
 * A picture that must stay rejected: `name` beside the dish's own foods, for
 * `allergen`. With `of`, also standing for that ingredient, both ways the
 * match call can answer — its pairing excuses nothing.
 */
type Rejected = readonly [dish: Dish, name: string, of: string | null, allergen: string];

function rejects(rows: readonly Rejected[]): void {
  for (const [key, name, of, allergen] of rows) {
    const recipe = DISHES[key];
    const ways: readonly (readonly [string, Picture])[] = [
      ['left as an extra', picture(recipe, { name })],
      ...(of === null
        ? []
        : ([
            [`left as an extra for ${of}`, picture(recipe, { name, of })],
            [`paired with ${of}`, picture(recipe, { name, of, paired: true })]
          ] as const))
    ];

    it.each(ways)(`rejects "${name}" %s on "${recipe.name}", for ${allergen}`, (_way, shown) => {
      const verdict = judged(recipe, shown);

      expect(verdict.accepted).toBe(false);
      expect(verdict.extras.find(extra => extra.name === name)?.foreignAllergens).toContain(allergen);
    });
  }
}

/*
 * The three dishes production rejected on 2026-09-30, all three falsely for
 * the allergen named (report `0006` § 5.2). Their ingredients are
 * production's. Two titles are reworded, far from any title of the private
 * library: production's are also dish names there, and those stay out of the
 * repository. What the rule will read is kept as production wrote it: the
 * pancakes' title opens with production's own "Tortitas caseras de maíz" (the
 * prefix report `0006` quotes), so the case is no easier than production was.
 * Phase 2 must accept it with that wording, and not read "tortitas … de maíz"
 * as corn cakes: the dish holds corn flour, not `tortitas-de-maiz`.
 * "Tortitas de arroz" names the rice cakes. What is
 * rebuilt, and assumed: the grams (not known: plausible ones, heaviest first
 * as the recipes list them); and everything the judge
 * answered beyond the names the rejections' notes kept — which other foods it
 * saw, their amounts, what the match call did with them. Each is written both
 * ways the match call could have answered about the form, because for the
 * pancakes it can no longer be known: the hand-accept erased the notes.
 */
const OIL = ['aceite-de-oliva-virgen-extra', 5] as const;

const CORN_PANCAKES = dish(
  'Tortitas caseras de maíz para desayunar, con fruta',
  ['fresa', 150],
  ['leche-semidesnatada', 120],
  ['harina-de-maiz', 80],
  ['huevo', 60],
  ['miel', 15],
  OIL,
  ['levadura-quimica', 4],
  ['sal', 1]
);
const RICE_CAKES = dish(
  'Tortitas de arroz para merendar, con fiambre y fruta',
  ['fiambre-de-pavo', 100],
  ['manzana', 90],
  ['tortitas-de-arroz', 40],
  ['mostaza-de-dijon', 10],
  OIL
);
const HEURA_STEW = dish(
  'Guiso rápido de lentejas con verduras y heura',
  ['lentejas-cocidas', 200],
  ['heura', 120],
  ['tomate-triturado', 100],
  ['zanahoria', 80],
  ['pimiento-rojo', 60],
  ['cebolla', 50],
  ['aceite-de-oliva-virgen-extra', 10],
  ['sal', 2],
  ['pimenton-dulce', 2],
  ['laurel', 1]
);

/** A picture as the judge's two calls answered: the foods seen, all mains and specific; what each ingredient was matched to; the rest not seen. */
function answered(recipe: PictureRecipe, seen: readonly string[], matched: Readonly<Record<string, readonly string[] | string>>): Picture {
  const paired = new Set(Object.values(matched).flat());

  return {
    match: {
      extras: seen.filter(name => !paired.has(name)),
      ingredients: recipe.ingredients.map(({ slug }) => {
        const names = matched[slug];

        return names === undefined ? { matched: [], slug, status: 'not_seen' as const } : { matched: [names].flat(), slug, status: 'seen' as const };
      })
    },
    seen: { foods: seen.map(name => ({ amount: 'main' as const, name, specific: true })) }
  };
}

const PANCAKES_SEEN = ['pancakes', 'strawberries', 'honey'];
const RICE_CAKES_SEEN = ['shredded chicken', 'diced potatoes', 'grain base'];
const STEW_SEEN = ['lentils', 'meatballs', 'carrots', 'red pepper'];
const STEW_MATCHED = { 'lentejas-cocidas': 'lentils', 'pimiento-rojo': 'red pepper', zanahoria: 'carrots' };

const PRODUCTION = {
  pancakesExtra: [CORN_PANCAKES, answered(CORN_PANCAKES, PANCAKES_SEEN, { fresa: 'strawberries', miel: 'honey' })],
  pancakesPaired: [CORN_PANCAKES, answered(CORN_PANCAKES, PANCAKES_SEEN, { fresa: 'strawberries', 'harina-de-maiz': 'pancakes', miel: 'honey' })],
  riceCakesExtra: [RICE_CAKES, answered(RICE_CAKES, RICE_CAKES_SEEN, {})],
  // As production answered: the chicken and the potatoes are the turkey and the apple, drawn unfaithfully, and carry no allergen.
  riceCakesPaired: [RICE_CAKES, answered(RICE_CAKES, RICE_CAKES_SEEN, { 'tortitas-de-arroz': 'grain base' })],
  // As production answered on the first attempt.
  stewExtra: [HEURA_STEW, answered(HEURA_STEW, STEW_SEEN, STEW_MATCHED)],
  stewPaired: [HEURA_STEW, answered(HEURA_STEW, STEW_SEEN, { ...STEW_MATCHED, heura: 'meatballs' })]
} as const;

describe('judgePicture — the production cases, rebuilt', () => {
  it.fails.each([
    ['the corn-flour pancakes, "pancakes" left as an extra', PRODUCTION.pancakesExtra],
    ['the corn-flour pancakes, "pancakes" paired with the corn flour', PRODUCTION.pancakesPaired],
    ['the rice cakes, "grain base" paired with the rice cakes', PRODUCTION.riceCakesPaired],
    ['the rice cakes, "grain base" left as an extra', PRODUCTION.riceCakesExtra],
    ['the stew with heura, "meatballs" left as an extra', PRODUCTION.stewExtra],
    ['the stew with heura, "meatballs" paired with the heura', PRODUCTION.stewPaired]
  ] as const)('accepts %s', (_case, [recipe, shown]) => {
    expect(judged(recipe, shown).accepted).toBe(true);
  });

  /*
   * Not a wanted behaviour: the proof that the rebuilds are the mechanism.
   * Today's rule gives back what production recorded — the rice cakes' note
   * as the report quotes it (the `missing_main` after it is this rebuild's:
   * the turkey and the apple, which the judge did not see), the stew's three
   * allergens, and for the pancakes gluten
   * alone from a single catalogue row, which is what the owner's console
   * showed. Phase 2 deletes this test with the behaviour it describes.
   */
  it('reproduces, with today’s rule, what production recorded of each rejection', () => {
    expect(judged(...PRODUCTION.riceCakesPaired).notes).toEqual([
      'extra_allergen:grain base=gluten',
      'extra_food:shredded chicken/diced potatoes/grain base',
      'matched_foreign:grain base',
      'missing_main:Turkey cold cuts/Apple'
    ]);
    expect(judged(...PRODUCTION.stewExtra).notes).toContain('extra_allergen:meatballs=eggs+gluten+milk');
    expect(flaggedExtras(judged(...PRODUCTION.pancakesExtra))).toEqual([{ foreignAllergens: ['gluten'], mappedTo: ['tortitas-americanas'] }]);
  });
});

/*
 * One family of forms per block (report `0006`, annex): the faithful pictures
 * of dishes that have their own version, then the pictures that must stay
 * rejected — the form with a qualifier that carries an allergen, a form of
 * another family, and the form on a dish that neither has nor names it.
 */
describe('judgePicture — bread: bread, toast, bun, roll, croutons', () => {
  accepts([
    ['glutenFreeToast', 'toast', 'pan-sin-gluten', 'both'],
    ['glutenFreeToast', 'bread', 'pan-sin-gluten', 'extra'],
    ['cornBreadEn', 'bread', 'harina-de-maiz', 'both']
  ]);

  rejects([
    ['glutenFreeToast', 'cheese sandwich', null, 'milk'],
    ['glutenFreeToast', 'wheat bread', null, 'gluten'],
    ['glutenFreeToast', 'pancakes', null, 'gluten'],
    ['chickenWithRice', 'toast', null, 'gluten']
  ]);
});

describe('judgePicture — breading: breadcrumbs, breaded, batter, tempura', () => {
  accepts([
    ['glutenFreeBreaded', 'breaded chicken', 'pechuga-de-pollo', 'both'],
    ['glutenFreeBreaded', 'breadcrumbs', 'pan-rallado-sin-gluten', 'extra'],
    ['cornflakeChicken', 'breaded chicken', 'pechuga-de-pollo', 'both'],
    ['batteredHake', 'battered fish', 'merluza', 'both'],
    ['batteredHakeEn', 'battered fish', 'merluza', 'both'],
    ['riceTempura', 'tempura', null, 'extra']
  ]);

  rejects([
    ['glutenFreeBreaded', 'breaded prawns', null, 'crustaceans'],
    ['glutenFreeBreaded', 'toast', null, 'gluten'],
    ['grilledChicken', 'breaded chicken', 'pechuga-de-pollo', 'gluten'],
    // The breading family has title keys only: cornflakes as a cereal, gluten-free breadcrumbs as a binder, excuse no coating.
    ['cornflakeYoghurt', 'breaded chicken', null, 'gluten'],
    ['turkeyMeatballsGlutenFree', 'breaded chicken', 'pavo-picado', 'gluten']
  ]);
});

describe('judgePicture — pancakes: pancakes, crepes, waffles, fritters', () => {
  accepts([
    ['ricePancakes', 'pancakes', 'harina-de-arroz', 'both'],
    ['ricePancakesEn', 'pancakes', 'harina-de-arroz', 'both'],
    ['riceWaffles', 'waffles', 'harina-de-arroz', 'both'],
    // Accepted today only because the two names map to nothing (`judge.holes.test.ts`): they must still be once that hole is closed.
    ['crepes', 'crepes', 'harina-de-trigo-sarraceno', 'neither'],
    ['courgetteFritters', 'fritters', 'calabacin', 'neither']
  ]);

  rejects([
    ['ricePancakes', 'cheese pancakes', null, 'milk'],
    ['ricePancakes', 'toast', null, 'gluten'],
    ['polenta', 'pancakes', 'polenta-cocida', 'gluten']
  ]);
});

describe('judgePicture — cakes: cake, muffin, cupcake, brownie', () => {
  accepts([
    ['lemonCake', 'cake', 'harina-de-arroz', 'both'],
    ['lemonCakeEn', 'cake', 'harina-de-arroz', 'both'],
    ['riceMuffins', 'muffins', 'harina-de-arroz', 'both'],
    ['beanBrownie', 'brownie', 'alubias-negras-cocidas', 'both']
  ]);

  rejects([
    ['lemonCake', 'walnut cake', null, 'tree_nuts'],
    ['lemonCake', 'cookies', null, 'gluten'],
    ['chickenWithRice', 'cake', null, 'gluten'],
    // A rice cake is a cracker, not a sponge (the crackers family): a cake beside it is a cake.
    ['riceCakes', 'cake', null, 'gluten'],
    ['riceCakes', 'carrot cake', null, 'gluten']
  ]);
});

describe('judgePicture — biscuits: biscuit, cookie', () => {
  accepts([
    ['glutenFreeBiscuits', 'cookies', 'galletas-sin-gluten', 'both'],
    ['glutenFreeBiscuits', 'biscuits', 'galletas-sin-gluten', 'extra'],
    ['riceCookies', 'cookies', 'harina-de-arroz', 'both'],
    ['riceCookiesEn', 'cookies', 'harina-de-arroz', 'both']
  ]);

  rejects([
    ['glutenFreeBiscuits', 'butter cookies', null, 'milk'],
    ['glutenFreeBiscuits', 'cake', null, 'gluten'],
    ['fruitSalad', 'cookies', null, 'gluten']
  ]);
});

describe('judgePicture — crackers', () => {
  accepts([
    ['riceCakes', 'crackers', 'tortitas-de-arroz', 'both'],
    ['cornCakes', 'crackers', 'tortitas-de-maiz', 'both']
  ]);

  rejects([
    ['riceCakes', 'cheese crackers', null, 'milk'],
    ['riceCakes', 'toast', null, 'gluten'],
    ['fruitSalad', 'crackers', null, 'gluten']
  ]);
});

describe('judgePicture — wraps: tortilla, wrap, taco, flatbread, pita', () => {
  accepts([
    ['cornTacos', 'wrap', 'tortilla-de-maiz', 'both'],
    ['cornTacos', 'flatbread', 'tortilla-de-maiz', 'both'],
    ['cornTacos', 'tacos', 'tortilla-de-maiz', 'both'],
    // A hole today, as "crepes" is.
    ['cornTacos', 'tortillas', 'tortilla-de-maiz', 'neither'],
    ['nachos', 'tortilla chips', 'nachos', 'neither'],
    ['arepas', 'flatbread', 'harina-de-maiz', 'both']
  ]);

  rejects([
    ['cornTacos', 'wheat tortilla', null, 'gluten'],
    ['cornTacos', 'bun', null, 'gluten'],
    ['chickenSalad', 'wrap', null, 'gluten']
  ]);
});

describe('judgePicture — pizza and pastry: pizza, crust, dough, pastry, pie, quiche, empanada, dumpling', () => {
  accepts([
    ['cauliflowerPizza', 'pizza base', 'coliflor', 'both'],
    ['cauliflowerPizzaEn', 'pizza base', 'coliflor', 'both'],
    // A hole today, as "crepes" is.
    ['cauliflowerPizza', 'pizza', 'coliflor', 'neither'],
    ['cornEmpanadillas', 'pastry', 'harina-de-maiz', 'both'],
    ['cornEmpanadillas', 'empanadas', 'harina-de-maiz', 'both'],
    ['ricePaperGyozas', 'dumplings', 'papel-de-arroz', 'both']
  ]);

  rejects([
    ['cauliflowerPizza', 'cheese pizza', null, 'milk'],
    ['cauliflowerPizza', 'bread', null, 'gluten'],
    ['lentilStew', 'pastry', null, 'gluten']
  ]);
});

describe('judgePicture — pasta: pasta, noodles, spaghetti, penne, macaroni', () => {
  accepts([
    ['glutenFreeSpaghetti', 'spaghetti', 'pasta-sin-gluten', 'both'],
    ['glutenFreeSpaghetti', 'pasta', 'pasta-sin-gluten', 'extra'],
    ['riceNoodles', 'noodles', 'fideos-de-arroz-cocidos', 'extra'],
    ['glassNoodles', 'noodles', 'fideos-de-cristal', 'extra'],
    ['lentilPasta', 'penne', 'pasta-de-lentejas', 'both']
  ]);

  rejects([
    ['riceNoodles', 'wheat noodles', null, 'gluten'],
    ['riceNoodles', 'egg noodles', 'fideos-de-arroz-cocidos', 'eggs'],
    ['riceNoodles', 'bread', null, 'gluten'],
    ['chickenWithRice', 'noodles', null, 'gluten']
  ]);
});

/*
 * The family counts for a plant protein, firm tofu and minced meat alike
 * (report § 14, question 3): what is at stake is the binder of a jarred
 * meatball, which no picture shows.
 */
describe('judgePicture — meat forms: meatball, burger, patty, sausage', () => {
  accepts([
    ['heuraStirFry', 'meatballs', 'heura', 'both'],
    ['heuraStirFry', 'burger patty', 'heura', 'both'],
    // "sausages" carries no allergen today: the row is here so that the word has its case.
    ['heuraStirFry', 'sausages', 'heura', 'neither'],
    ['seitan', 'meatballs', 'seitan', 'both'],
    ['tofu', 'burger patty', 'tofu-firme', 'both'],
    ['tempeh', 'meatballs', 'tempeh', 'both'],
    ['texturedSoy', 'meatballs', 'soja-texturizada', 'both'],
    ['veggieBurger', 'meatballs', 'hamburguesa-vegetal', 'both'],
    ['minceWithRice', 'meatballs', 'carne-picada-de-ternera', 'both'],
    ['minceWithRice', 'burger patty', 'carne-picada-de-ternera', 'both'],
    ['chickenMeatballs', 'meatballs', 'pollo-picado', 'both'],
    ['chickenMeatballsEn', 'meatballs', 'pollo-picado', 'both'],
    ['lentilBurgers', 'burger patty', 'lentejas-cocidas', 'both']
  ]);

  rejects([
    ['heuraStirFry', 'cheese burger', null, 'milk'],
    // A bare "burger" is a burger in its bun: its gluten is the bun's, which no plant protein excuses. "burger patty" is the meat alone.
    ['heuraStirFry', 'burger', null, 'gluten'],
    ['tofu', 'burger', null, 'gluten'],
    ['heuraStirFry', 'breaded chicken', null, 'gluten'],
    ['heuraStirFry', 'battered tofu', null, 'gluten'],
    ['heuraStirFry', 'bun', null, 'gluten'],
    ['lentilStew', 'meatballs', null, 'gluten']
  ]);
});

/* A breaded form is seen to be breaded: the title excuses it, the protein under it never does (report § 7.3). */
describe('judgePicture — breaded forms: nuggets, croquettes', () => {
  accepts([
    ['heuraNuggets', 'nuggets', 'heura', 'both'],
    ['sweetPotatoCroquettes', 'croquettes', 'boniato', 'both'],
    ['sweetPotatoCroquettesEn', 'croquettes', 'boniato', 'both']
  ]);

  rejects([
    ['heuraStirFry', 'nuggets', 'heura', 'gluten'],
    ['heuraStirFry', 'croquettes', 'heura', 'gluten'],
    ['sweetPotatoCroquettes', 'cheese croquettes', null, 'milk'],
    ['heuraNuggets', 'bread', null, 'gluten']
  ]);
});

describe('judgePicture — milk: milk, milkshake', () => {
  accepts([
    ['soyMilkShake', 'milk', 'leche-de-soja', 'extra'],
    ['soyMilkShake', 'milkshake', 'leche-de-soja', 'both'],
    ['oatMilkRicePudding', 'milk', 'leche-de-avena', 'extra'],
    ['lactoseFreeRicePudding', 'milk', 'leche-sin-lactosa', 'extra'],
    ['riceDrinkShake', 'milk', 'bebida-de-arroz', 'both'],
    ['coconutCurry', 'milk', 'leche-de-coco', 'extra']
  ]);

  rejects([
    ['soyMilkShake', 'almond milk', null, 'tree_nuts'],
    ['soyMilkShake', 'yogurt', null, 'milk'],
    ['fruitSalad', 'milk', null, 'milk']
  ]);
});

describe('judgePicture — yogurt', () => {
  accepts([
    // The catalogue writes "Soya yoghurt"; the judge writes it the American way.
    ['soyYoghurt', 'yogurt', 'yogur-de-soja', 'both'],
    ['soyYoghurt', 'yoghurt', 'yogur-de-soja', 'extra'],
    ['soyYoghurt', 'soy yogurt', 'yogur-de-soja', 'both'],
    ['coconutYoghurt', 'yogurt', 'yogur-de-coco', 'both'],
    ['coconutYoghurt', 'coconut yogurt', 'yogur-de-coco', 'both']
  ]);

  rejects([
    ['coconutYoghurt', 'soy yogurt', null, 'soy'],
    ['soyYoghurt', 'greek yogurt', null, 'milk'],
    ['soyYoghurt', 'milk', null, 'milk'],
    ['fruitSalad', 'yogurt', null, 'milk']
  ]);
});

/* Tofu is not a cheese (report § 6): a dish of tofu excuses no cheese. */
describe('judgePicture — cheese', () => {
  accepts([
    ['veganCheeseSalad', 'cheese', 'queso-vegano', 'extra'],
    ['veganCheeseSalad', 'grated cheese', 'queso-vegano', 'extra']
  ]);

  rejects([
    ['veganCheeseSalad', 'feta cheese', 'queso-vegano', 'milk'],
    ['veganCheeseSalad', 'yogurt', null, 'milk'],
    ['tofu', 'cheese', 'tofu-firme', 'milk'],
    ['tofu', 'feta cheese', 'tofu-firme', 'milk']
  ]);
});

describe('judgePicture — cream', () => {
  accepts([
    ['coconutSoup', 'cream', 'crema-de-coco', 'extra'],
    ['coconutCurry', 'cream', 'leche-de-coco', 'both'],
    ['soyCreamMushrooms', 'cream', 'nata-vegetal-de-soja', 'extra']
  ]);

  rejects([
    ['coconutSoup', 'cream cheese', null, 'milk'],
    ['coconutSoup', 'yogurt', null, 'milk'],
    ['tomatoSoup', 'cream', null, 'milk']
  ]);
});

/* In Spanish "tortitas" are pancakes, and rice cakes too: on a dish that holds the cakes, the title names the cakes (report § 7.3). */
describe('judgePicture — a title’s "tortitas" on a dish of rice or corn cakes', () => {
  rejects([
    ['riceCakes', 'pancakes', 'tortitas-de-arroz', 'gluten'],
    ['cornCakes', 'pancakes', 'tortitas-de-maiz', 'gluten']
  ]);
});

/*
 * Project 006's second food, kept and no longer resting on the match call
 * (report § 7.3): a short name seen beside a fuller name of the same form is
 * another food, however the match call paired the two. The three tests of
 * `judge.test.ts` pin the same on its own catalogue, and are not touched.
 */
describe('judgePicture — a form beside its fuller name is a second food, on the seed catalogue', () => {
  const beside = (recipe: PictureRecipe, slug: string, fuller: string, bare: string): readonly (readonly [string, Picture])[] => {
    const whole = picture(recipe);
    const own = recipe.ingredients.find(ingredient => ingredient.slug === slug)?.name.toLowerCase();
    const foods = [
      ...whole.seen.foods.filter(food => food.name !== own),
      ...[fuller, bare].map(name => ({ amount: 'main' as const, name, specific: true }))
    ];
    const matching = (extras: readonly string[], matched: readonly string[]): Picture => ({
      match: {
        extras,
        ingredients: whole.match.ingredients.map(ingredient =>
          ingredient.slug === slug ? { matched, slug, status: matched.length > 0 ? ('seen' as const) : ('not_seen' as const) } : ingredient
        )
      },
      seen: { foods }
    });

    return [
      ['both paired with the ingredient', matching([], [fuller, bare])],
      ['the fuller one paired, the bare one an extra', matching([bare], [fuller])],
      ['both left as extras', matching([fuller, bare], [])]
    ];
  };

  describe.each([
    ['soyMilkShake', 'leche-de-soja', 'soy milk', 'milk', 'milk'],
    ['soyYoghurt', 'yogur-de-soja', 'soy yogurt', 'yogurt', 'milk'],
    ['veganCheeseSalad', 'queso-vegano', 'vegan cheese', 'cheese', 'milk'],
    ['riceNoodles', 'fideos-de-arroz-cocidos', 'rice noodles', 'noodles', 'gluten'],
    ['riceCakes', 'tortitas-de-arroz', 'rice cakes', 'cake', 'gluten']
  ] as const)('on %s (%s)', (key, slug, fuller, bare, allergen) => {
    it.each(beside(DISHES[key], slug, fuller, bare))(`rejects "${bare}" beside "${fuller}", %s, for ${allergen}`, (_way, shown) => {
      const verdict = judged(DISHES[key], shown);

      expect(verdict.accepted).toBe(false);
      expect(verdict.extras.find(extra => extra.name === bare)?.foreignAllergens).toContain(allergen);
    });
  });
});

/* The same on a dish whose own form is named by its title only: "pancakes" beside "corn pancakes" is a second batch. */
describe('judgePicture — a form beside its fuller name, on a dish keyed by its title', () => {
  const seen = [...PANCAKES_SEEN, 'corn pancakes'];

  const others = { fresa: 'strawberries', miel: 'honey' };

  it.each([
    ['both paired with the corn flour', answered(CORN_PANCAKES, seen, { ...others, 'harina-de-maiz': ['corn pancakes', 'pancakes'] })],
    ['the fuller one paired, the bare one an extra', answered(CORN_PANCAKES, seen, { ...others, 'harina-de-maiz': 'corn pancakes' })],
    ['both left as extras', answered(CORN_PANCAKES, seen, others)]
  ] as const)('rejects "pancakes" beside "corn pancakes", %s, for gluten', (_way, shown) => {
    const verdict = judged(CORN_PANCAKES, shown);

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras.find(extra => extra.name === 'pancakes')?.foreignAllergens).toContain('gluten');
  });
});

/* The three vocabulary fixes that go with the rule (report § 7.4). */
describe('judgePicture — a word that is not a food is not mapped on its own', () => {
  accepts([
    ['riceCakes', 'grain base', 'tortitas-de-arroz', 'both'],
    ['chickenWithRice', 'rice base', 'arroz-blanco-cocido', 'both'],
    ['soyMilkShake', 'glass of milk', 'leche-de-soja', 'both'],
    // "bowl" and "glass" carry no allergen today; "base" does, from the one catalogue row that has the word.
    ['chickenWithRice', 'rice bowl', 'arroz-blanco-cocido', 'neither']
  ]);

  rejects([
    // A whole catalogue name, not a loose word: a pizza base is still a pizza base.
    ['lentilStew', 'pizza base', null, 'gluten'],
    ['fruitSalad', 'glass of milk', null, 'milk'],
    ['fruitSalad', 'yogurt bowl', null, 'milk']
  ]);
});

describe('judgePicture — a plant qualifier before a dairy word maps the qualifier, not the dairy', () => {
  accepts([
    ['fruitSalad', 'coconut milk', null, 'extra'],
    ['coconutCurry', 'coconut milk', 'leche-de-coco', 'extra'],
    ['oatMilkRicePudding', 'plant milk', 'leche-de-avena', 'both']
  ]);

  rejects([
    ['fruitSalad', 'soy milk', null, 'soy'],
    ['oatMilkRicePudding', 'almond milk', null, 'tree_nuts'],
    ['oatMilkRicePudding', 'soy milk', null, 'soy'],
    ['fruitSalad', 'almond milk', null, 'tree_nuts'],
    ['fruitSalad', 'soy yogurt', null, 'soy']
  ]);
});

/* The owner's decision (2026-09-30): a sulphite a food only may contain never rejects; one it contains still does. */
describe('judgePicture — a sulphite a food only may contain never rejects a picture', () => {
  accepts([
    // The catalogue's king prawns may contain sulphites, which its fresh prawns do not.
    ['prawnsWithRice', 'king prawns', 'gambas', 'both']
  ]);

  rejects([
    ['chickenWithRice', 'king prawns', null, 'crustaceans'],
    ['fruitSalad', 'dried apricots', null, 'sulphites'],
    ['chickenWithRice', 'glass of wine', null, 'sulphites']
  ]);
});
