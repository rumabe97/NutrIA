import { describe, expect, it } from 'vitest';

import { flaggedExtras } from 'core/domain/DishPicture';

import { dish, DISHES, judged, picture } from '#test/dish-picture/acceptance';

import type { PictureRecipe } from 'core/domain/DishPicture';
import type { Picture } from '#test/dish-picture/acceptance';

/*
 * What the rule does now that it knows a dish's own form (project 010,
 * `0073`), written in phase 1 while the rule was still the one that did not: a
 * word that names a form — pancakes, bread, meatballs, milk — brings no
 * allergens when the dish has its own version of that form, by an ingredient
 * that is the form or by a title that names it, and every other word of the
 * name counts as before. The faithful cases the old rule rejected were marked
 * as expected to fail; phase 2 made each pass and took its mark away. The
 * cases that must stay rejected never carried one.
 *
 * Two families have title keys only (`0073`): breading and the breaded forms
 * (nuggets, croquettes). Breadcrumbs or cornflakes in a dish can be a binder
 * or a cereal, and are not seen as a coating; only a title that says
 * "empanado", "rebozado", "nuggets" or "croquetas" excuses the form.
 *
 * A bare "burger" is not in the meat family: a burger is seen in its bun, and
 * the bun's gluten is what rejects it. "burger patty" and "patty" are the meat
 * alone, and are excused.
 *
 * Every dish is an example written for these tests, except the three of
 * production, which are rebuilt and say what they assume. The tables row by
 * row are in `forms.test.ts`.
 */
type Dish = keyof typeof DISHES;

/**
 * A faithful picture: the judge calls the dish's own food `name`. With `of`,
 * the ingredient the name stands for — tried both ways the match call can
 * answer, paired with it and left as an extra. With `null`, the name is for
 * something the title says and no single ingredient is, so it is an extra.
 */
type Faithful = readonly [dish: Dish, name: string, of: string | null];

function accepts(rows: readonly Faithful[]): void {
  for (const [key, name, of] of rows) {
    const recipe = DISHES[key];

    if (of !== null) {
      const paired = picture(recipe, { name, of, paired: true });

      it(`accepts "${name}" paired with ${of} on "${recipe.name}"`, () => {
        expect(judged(recipe, paired).accepted).toBe(true);
      });
    }

    const extra = picture(recipe, of === null ? { name } : { name, of });

    it(`accepts "${name}" left as an extra on "${recipe.name}"`, () => {
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
  it.each([
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
   * What each verdict says, so the pictures the new rule accepts can be found
   * afterwards (PRD 7): the pancakes and the meatballs through the dish's own
   * form, noted `own_form`; the rice cakes through the vocabulary ("base" is
   * not a food), which is no exemption and is noted as before. The
   * `missing_main` notes are this rebuild's: the ingredients it does not name.
   */
  it('notes the exemption where it took an allergen away, and only there', () => {
    const notes = Object.fromEntries(Object.entries(PRODUCTION).map(([key, [recipe, shown]]) => [key, judged(recipe, shown).notes]));

    expect(notes).toEqual({
      pancakesExtra: ['extra_food:pancakes', 'own_form:pancakes', 'missing_main:Egg'],
      pancakesPaired: ['own_form:pancakes', 'missing_main:Egg'],
      riceCakesExtra: ['extra_food:shredded chicken/diced potatoes/grain base', 'missing_main:Turkey cold cuts/Apple/Rice cakes'],
      riceCakesPaired: ['extra_food:shredded chicken/diced potatoes', 'missing_main:Turkey cold cuts/Apple'],
      stewExtra: ['extra_food:meatballs', 'own_form:meatballs', 'missing_main:Heura/Crushed tomatoes'],
      stewPaired: ['own_form:meatballs', 'missing_main:Crushed tomatoes']
    });
    expect(flaggedExtras(judged(...PRODUCTION.pancakesExtra))).toEqual([]);
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
    ['glutenFreeToast', 'toast', 'pan-sin-gluten'],
    ['glutenFreeToast', 'bread', 'pan-sin-gluten'],
    ['cornBreadEn', 'bread', 'harina-de-maiz']
  ]);

  rejects([
    ['glutenFreeToast', 'cheese sandwich', null, 'milk'],
    ['glutenFreeToast', 'wheat bread', null, 'gluten'],
    ['glutenFreeToast', 'pancakes', null, 'gluten'],
    ['chickenWithRice', 'toast', null, 'gluten']
  ]);

  // Phase 2's review (P1-A): a qualifier that carries nothing on its own still makes the whole another food.
  rejects([
    ['glutenFreeToast', 'spring roll', 'pan-sin-gluten', 'gluten'],
    ['glutenFreeToast', 'sushi roll', 'pan-sin-gluten', 'gluten'],
    ['glutenFreeToast', 'california roll', 'pan-sin-gluten', 'gluten'],
    ['glutenFreeToast', 'swiss roll', 'pan-sin-gluten', 'gluten'],
    ['glutenFreeToast', 'cinnamon roll', 'pan-sin-gluten', 'gluten'],
    ['glutenFreeToast', 'soda bread', 'pan-sin-gluten', 'gluten']
  ]);
});

describe('judgePicture — breading: breadcrumbs, breaded, batter, tempura', () => {
  accepts([
    ['glutenFreeBreaded', 'breaded chicken', 'pechuga-de-pollo'],
    ['glutenFreeBreaded', 'breadcrumbs', 'pan-rallado-sin-gluten'],
    ['cornflakeChicken', 'breaded chicken', 'pechuga-de-pollo'],
    ['batteredHake', 'battered fish', 'merluza'],
    ['batteredHakeEn', 'battered fish', 'merluza'],
    ['riceTempura', 'tempura', null]
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
    ['ricePancakes', 'pancakes', 'harina-de-arroz'],
    ['ricePancakesEn', 'pancakes', 'harina-de-arroz'],
    ['riceWaffles', 'waffles', 'harina-de-arroz'],
    // Accepted today only because the two names map to nothing (`judge.holes.test.ts`): they must still be once that hole is closed.
    ['crepes', 'crepes', 'harina-de-trigo-sarraceno'],
    ['courgetteFritters', 'fritters', 'calabacin']
  ]);

  rejects([
    ['ricePancakes', 'cheese pancakes', null, 'milk'],
    ['ricePancakes', 'toast', null, 'gluten'],
    ['polenta', 'pancakes', 'polenta-cocida', 'gluten']
  ]);
});

describe('judgePicture — cakes: cake, muffin, cupcake, brownie', () => {
  accepts([
    ['lemonCake', 'cake', 'harina-de-arroz'],
    ['lemonCakeEn', 'cake', 'harina-de-arroz'],
    ['riceMuffins', 'muffins', 'harina-de-arroz']
  ]);

  /*
   * Rewritten on purpose in phase 2's third round (the lead's decision, with
   * the reviewer; phase 1 wrote it as accepted): the bare "brownie" reads as
   * the catalogue's only brownie, which holds walnuts, and a family excuses
   * only its closed set (`FormFamily.carries`) — never a filling. Phase 5:
   * map the bare form word to the unfilled form, and this is accepted again.
   */
  rejects([['beanBrownie', 'brownie', 'alubias-negras-cocidas', 'tree_nuts']]);

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
    ['glutenFreeBiscuits', 'cookies', 'galletas-sin-gluten'],
    ['glutenFreeBiscuits', 'biscuits', 'galletas-sin-gluten'],
    ['riceCookies', 'cookies', 'harina-de-arroz'],
    ['riceCookiesEn', 'cookies', 'harina-de-arroz']
  ]);

  rejects([
    ['glutenFreeBiscuits', 'butter cookies', null, 'milk'],
    ['glutenFreeBiscuits', 'cake', null, 'gluten'],
    ['fruitSalad', 'cookies', null, 'gluten']
  ]);
});

describe('judgePicture — crackers', () => {
  accepts([['riceCakes', 'crackers', 'tortitas-de-arroz']]);

  /*
   * Rewritten on purpose in phase 2's third round (the lead's decision, with
   * the reviewer; phase 1 wrote it as accepted): "crackers" read as the
   * catalogue's crackers, which may contain sesame, and the crackers family
   * excuses its flour only (`FormFamily.carries`). The rice-cake dish above
   * passes because it holds hummus, and so sesame. Phase 5: map the bare form
   * word to the unfilled form, and this is accepted again.
   */
  rejects([['cornCakes', 'crackers', 'tortitas-de-maiz', 'sesame']]);

  rejects([
    ['riceCakes', 'cheese crackers', null, 'milk'],
    ['riceCakes', 'toast', null, 'gluten'],
    ['fruitSalad', 'crackers', null, 'gluten']
  ]);
});

describe('judgePicture — wraps: tortilla, wrap, taco, flatbread, pita', () => {
  accepts([
    ['cornTacos', 'wrap', 'tortilla-de-maiz'],
    ['cornTacos', 'flatbread', 'tortilla-de-maiz'],
    ['cornTacos', 'tacos', 'tortilla-de-maiz'],
    // A hole today, as "crepes" is.
    ['cornTacos', 'tortillas', 'tortilla-de-maiz'],
    ['nachos', 'tortilla chips', 'nachos'],
    ['arepas', 'flatbread', 'harina-de-maiz']
  ]);

  rejects([
    ['cornTacos', 'wheat tortilla', null, 'gluten'],
    ['cornTacos', 'bun', null, 'gluten'],
    ['chickenSalad', 'wrap', null, 'gluten']
  ]);
});

describe('judgePicture — pizza and pastry: pizza, crust, dough, pastry, pie, quiche, empanada, dumpling', () => {
  accepts([
    ['cauliflowerPizza', 'pizza base', 'coliflor'],
    ['cauliflowerPizzaEn', 'pizza base', 'coliflor'],
    // A hole today, as "crepes" is.
    ['cauliflowerPizza', 'pizza', 'coliflor'],
    ['cornEmpanadillas', 'pastry', 'harina-de-maiz'],
    ['ricePaperGyozas', 'dumplings', 'papel-de-arroz']
  ]);

  /*
   * Rewritten on purpose in phase 2's third round (the lead's decision, with
   * the reviewer; phase 1 wrote it as accepted): the bare "empanadas" read as
   * the catalogue's only empanada, a tuna one, and the pastry family excuses
   * its dough only (`FormFamily.carries`) — never a filling's fish. Phase 5:
   * map the bare form word to the unfilled form, and this is accepted again.
   */
  rejects([['cornEmpanadillas', 'empanadas', 'harina-de-maiz', 'fish']]);

  rejects([
    ['cauliflowerPizza', 'cheese pizza', null, 'milk'],
    ['cauliflowerPizza', 'bread', null, 'gluten'],
    ['lentilStew', 'pastry', null, 'gluten']
  ]);
});

describe('judgePicture — pasta: pasta, noodles, spaghetti, penne, macaroni', () => {
  accepts([
    ['glutenFreeSpaghetti', 'spaghetti', 'pasta-sin-gluten'],
    ['glutenFreeSpaghetti', 'pasta', 'pasta-sin-gluten'],
    ['riceNoodles', 'noodles', 'fideos-de-arroz-cocidos'],
    ['glassNoodles', 'noodles', 'fideos-de-cristal'],
    ['lentilPasta', 'penne', 'pasta-de-lentejas']
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
    ['heuraStirFry', 'meatballs', 'heura'],
    ['heuraStirFry', 'burger patty', 'heura'],
    // "sausages" carries no allergen today: the row is here so that the word has its case.
    ['heuraStirFry', 'sausages', 'heura'],
    ['seitan', 'meatballs', 'seitan'],
    ['tofu', 'burger patty', 'tofu-firme'],
    ['tempeh', 'meatballs', 'tempeh'],
    ['texturedSoy', 'meatballs', 'soja-texturizada'],
    ['veggieBurger', 'meatballs', 'hamburguesa-vegetal'],
    ['minceWithRice', 'meatballs', 'carne-picada-de-ternera'],
    ['minceWithRice', 'burger patty', 'carne-picada-de-ternera'],
    ['chickenMeatballs', 'meatballs', 'pollo-picado'],
    ['chickenMeatballsEn', 'meatballs', 'pollo-picado'],
    ['lentilBurgers', 'burger patty', 'lentejas-cocidas']
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
    ['heuraNuggets', 'nuggets', 'heura'],
    ['sweetPotatoCroquettes', 'croquettes', 'boniato'],
    ['sweetPotatoCroquettesEn', 'croquettes', 'boniato']
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
    ['soyMilkShake', 'milk', 'leche-de-soja'],
    ['soyMilkShake', 'milkshake', 'leche-de-soja'],
    ['oatMilkRicePudding', 'milk', 'leche-de-avena'],
    ['lactoseFreeRicePudding', 'milk', 'leche-sin-lactosa'],
    ['riceDrinkShake', 'milk', 'bebida-de-arroz'],
    ['coconutCurry', 'milk', 'leche-de-coco']
  ]);

  rejects([
    ['soyMilkShake', 'almond milk', null, 'tree_nuts'],
    ['soyMilkShake', 'yogurt', null, 'milk'],
    ['fruitSalad', 'milk', null, 'milk']
  ]);

  // Phase 2's review (P1-A).
  rejects([
    ['soyMilkShake', "cow's milk", 'leche-de-soja', 'milk'],
    ['soyMilkShake', 'cow milk', 'leche-de-soja', 'milk'],
    ['soyMilkShake', 'dairy milk', 'leche-de-soja', 'milk'],
    ['soyMilkShake', 'goat milk', 'leche-de-soja', 'milk']
  ]);
});

describe('judgePicture — yogurt', () => {
  accepts([
    // The catalogue writes "Soya yoghurt"; the judge writes it the American way.
    ['soyYoghurt', 'yogurt', 'yogur-de-soja'],
    ['soyYoghurt', 'yoghurt', 'yogur-de-soja'],
    ['soyYoghurt', 'soy yogurt', 'yogur-de-soja'],
    ['coconutYoghurt', 'yogurt', 'yogur-de-coco'],
    ['coconutYoghurt', 'coconut yogurt', 'yogur-de-coco']
  ]);

  rejects([
    ['coconutYoghurt', 'soy yogurt', null, 'soy'],
    ['soyYoghurt', 'greek yogurt', null, 'milk'],
    ['soyYoghurt', 'milk', null, 'milk'],
    ['fruitSalad', 'yogurt', null, 'milk']
  ]);

  // Phase 2's review (P1-A).
  rejects([
    ['soyYoghurt', 'dairy yogurt', 'yogur-de-soja', 'milk'],
    ['soyYoghurt', 'goat yogurt', 'yogur-de-soja', 'milk']
  ]);
});

/* Tofu is not a cheese (report § 6): a dish of tofu excuses no cheese. */
describe('judgePicture — cheese', () => {
  accepts([
    ['veganCheeseSalad', 'cheese', 'queso-vegano'],
    ['veganCheeseSalad', 'grated cheese', 'queso-vegano']
  ]);

  rejects([
    ['veganCheeseSalad', 'feta cheese', 'queso-vegano', 'milk'],
    ['veganCheeseSalad', 'yogurt', null, 'milk'],
    ['tofu', 'cheese', 'tofu-firme', 'milk'],
    ['tofu', 'feta cheese', 'tofu-firme', 'milk']
  ]);

  // Phase 2's review (P1-A): a catalogue cheese of its own, named by a word that carries nothing alone.
  rejects([
    ['veganCheeseSalad', 'goat cheese', 'queso-vegano', 'milk'],
    ['veganCheeseSalad', "goat's cheese", 'queso-vegano', 'milk'],
    ['veganCheeseSalad', 'blue cheese', 'queso-vegano', 'milk']
  ]);
});

describe('judgePicture — cream', () => {
  accepts([
    ['coconutSoup', 'cream', 'crema-de-coco'],
    ['coconutCurry', 'cream', 'leche-de-coco'],
    ['soyCreamMushrooms', 'cream', 'nata-vegetal-de-soja']
  ]);

  rejects([
    ['coconutSoup', 'cream cheese', null, 'milk'],
    ['coconutSoup', 'yogurt', null, 'milk'],
    ['tomatoSoup', 'cream', null, 'milk']
  ]);

  // Phase 2's review (P1-A).
  rejects([
    ['coconutCurry', 'heavy cream', 'leche-de-coco', 'milk'],
    ['coconutCurry', 'double cream', 'leche-de-coco', 'milk'],
    ['coconutCurry', 'dairy cream', 'leche-de-coco', 'milk']
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
    ['riceCakes', 'grain base', 'tortitas-de-arroz'],
    ['chickenWithRice', 'rice base', 'arroz-blanco-cocido'],
    ['soyMilkShake', 'glass of milk', 'leche-de-soja'],
    // "bowl" and "glass" carry no allergen today; "base" does, from the one catalogue row that has the word.
    ['chickenWithRice', 'rice bowl', 'arroz-blanco-cocido']
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
    ['fruitSalad', 'coconut milk', null],
    ['coconutCurry', 'coconut milk', 'leche-de-coco']
  ]);

  /*
   * Rewritten on purpose in phase 2's third round (the lead's decision, with
   * the reviewer; phase 1 wrote it as accepted): "plant" names no plant — it
   * could be soy or nuts — so "plant milk" is read as it always was: milk,
   * and the loose "plant" as the catalogue's plant protein.
   */
  rejects([['oatMilkRicePudding', 'plant milk', 'leche-de-avena', 'milk']]);

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
    ['prawnsWithRice', 'king prawns', 'gambas']
  ]);

  rejects([
    ['chickenWithRice', 'king prawns', null, 'crustaceans'],
    ['fruitSalad', 'dried apricots', null, 'sulphites'],
    ['chickenWithRice', 'glass of wine', null, 'sulphites']
  ]);
});

/*
 * Phase 2's review (P1-B): a title word that does not name the dish's form —
 * an adjective, a negated word, a word in another sense, a form's word before
 * what stands in for it — excuses nothing. The last three are phase 1's open
 * cases, decided conservative: lettuce tacos, a crustless quiche and
 * sweet-potato toast have no tortilla, pastry or bread, and a picture of one
 * named so is rejected (the owner's hand-accept is for it). Dishes written for
 * these tests; none holds a slug of the family.
 */
describe('judgePicture — a title word that names no form of the dish', () => {
  const SEEDS = ['semillas-de-calabaza', 20] as const;
  const cases: readonly (readonly [PictureRecipe, readonly string[]])[] = [
    [dish('Crema de calabaza con semillas tostadas', ['calabaza', 300], ['cebolla', 40], SEEDS, OIL), ['croutons', 'bread', 'toast', 'bun']],
    [dish('Ensalada de quinoa tostada con pepino', ['quinoa-cocida', 150], ['pepino', 80], OIL), ['bread', 'toast']],
    [dish('Yogur con almendras tostadas y miel', ['yogur-natural-desnatado', 150], ['almendras', 20], ['miel', 10]), ['toast', 'bread']],
    [dish('Hamburguesa sin pan con ensalada', ['carne-picada-de-ternera', 150], ['lechuga', 80], ['tomate', 60], OIL), ['bun', 'bread']],
    [dish('Salmorejo sin pan', ['tomate', 300], ['ajo', 5], OIL), ['croutons', 'bread']],
    [dish('Chicken without bread, with greens', ['pechuga-de-pollo', 150], ['lechuga', 80], OIL), ['bread', 'bun']],
    [dish('Bread-free chicken bowl', ['pechuga-de-pollo', 150], ['arroz-blanco-cocido', 150], OIL), ['bread']],
    [dish('Rebanadas de berenjena al horno', ['berenjena', 250], ['tomate', 60], OIL), ['bread', 'toast']],
    [dish('Ensalada con tacos de queso feta', ['lechuga', 100], ['queso-feta', 50], ['tomate', 60], OIL), ['wrap', 'flatbread']],
    [dish('Pechuga empanada al horno', ['pechuga-de-pollo', 160], ['harina-de-arroz', 20], OIL), ['pastry', 'pizza base', 'dough']],
    [dish('Pastel de verduras al horno', ['calabacin', 150], ['huevo', 120], ['cebolla', 50], OIL), ['cake', 'muffin', 'brownie']],
    [dish('Salmon fish cakes with salad', ['salmon', 150], ['patata', 100], ['lechuga', 60], OIL), ['cake', 'muffin', 'brownie']],
    [dish('Potato cakes with spinach', ['patata', 200], ['espinaca', 80], OIL), ['cake', 'muffin', 'brownie']],
    [dish('Cottage pie de ternera', ['carne-picada-de-ternera', 150], ['patata', 200], OIL), ['pastry', 'pizza base', 'dough']],
    // Phase 1's three open cases.
    [dish('Tacos de lechuga con pollo', ['pechuga-de-pollo', 120], ['lechuga', 80], ['tomate', 50], OIL), ['wrap', 'flatbread']],
    [dish('Quiche sin masa de espinacas', ['huevo', 180], ['espinaca', 100], ['cebolla', 40], OIL), ['pastry', 'dough']],
    [dish('Tostadas de boniato con aguacate', ['boniato', 200], ['aguacate', 80], OIL), ['bread', 'toast']],
    // The second review (P1-3): a negation reaches past the next word.
    [dish('Hamburguesa sin queso ni pan', ['carne-picada-de-ternera', 150], ['lechuga', 80], OIL), ['bun', 'bread']],
    [dish('Hamburguesa de pavo sin gluten ni lactosa ni pan', ['pavo-picado', 150], ['lechuga', 80], OIL), ['bun', 'bread']],
    [dish('Hamburguesa sin su pan, con ensalada', ['carne-picada-de-ternera', 150], ['lechuga', 80], OIL), ['bun', 'bread']],
    [dish('Hamburguesa con lechuga en vez de pan', ['carne-picada-de-ternera', 150], ['lechuga', 80], OIL), ['bun', 'bread']],
    [dish('Hamburguesa en lugar de pan, con lechuga', ['carne-picada-de-ternera', 150], ['lechuga', 80], OIL), ['bun', 'bread']],
    [dish('Burger with lettuce instead of bread', ['carne-picada-de-ternera', 150], ['lechuga', 80], OIL), ['bun', 'bread']],
    // The second review (P1-4): a form's word before what stands in for it, or beside "bowl".
    [dish('Wraps de lechuga con pavo', ['pavo-picado', 120], ['lechuga', 80], OIL), ['wrap', 'flatbread']],
    [dish('Lettuce wraps with turkey', ['pavo-picado', 120], ['lechuga', 80], OIL), ['wrap', 'flatbread']],
    [dish('Sándwich de lechuga con pavo', ['fiambre-de-pavo', 60], ['lechuga', 80], ['tomate', 50]), ['bread', 'toast']],
    [dish('Quesadilla de boniato al horno', ['boniato', 200], ['cebolla', 40], OIL), ['wrap', 'flatbread']],
    [dish('Enchiladas de calabacín con pavo', ['calabacin', 200], ['pavo-picado', 100], OIL), ['wrap', 'flatbread']],
    [dish('Montadito de berenjena asada', ['berenjena', 200], ['tomate', 60], OIL), ['bread', 'toast']],
    [dish('Burrito bowl de pavo', ['pavo-picado', 120], ['arroz-blanco-cocido', 150], OIL), ['wrap', 'flatbread']],
    [dish('Taco bowl con pavo', ['pavo-picado', 120], ['arroz-blanco-cocido', 150], OIL), ['wrap', 'flatbread']],
    // The second review (P2): a crustless tart or quiche has no pastry and no sponge.
    [dish('Crustless quiche with spinach', ['huevo', 180], ['espinaca', 100], OIL), ['pastry', 'dough']],
    [dish('Tarta salada sin masa de verduras', ['huevo', 180], ['calabacin', 100], OIL), ['cake', 'pastry']]
  ];

  it.each(cases.flatMap(([recipe, names]) => names.map(name => [recipe.name, name, recipe] as const)))(
    'rejects "%s" + "%s", for gluten, with no own form',
    (_title, name, recipe) => {
      const verdict = judged(recipe, picture(recipe, { name }));

      expect(verdict.accepted).toBe(false);
      expect(verdict.extras.find(extra => extra.name === name)?.foreignAllergens).toContain('gluten');
      expect(verdict.notes.some(note => note.startsWith('own_form:'))).toBe(false);
    }
  );
});

/*
 * Phase 2's second review, the names (P1-1, P1-2, P2). Each was a name that
 * held a form the dish owns and more: a second form ("cream cheese", "milk
 * roll"), a word that says what kind of milk it is ("whole milk"), a word of
 * the dish's own ingredients ("cinnamon roll" on a dish with cinnamon). None
 * is a row of its family, so each is read as it was before the rule —
 * whichever way the match call answered. Dishes written for these tests.
 */
describe('judgePicture — a name that is more than the dish’s own form is read as before', () => {
  const SHAKE = dish('Batido de soja con plátano', ['leche-de-soja', 250], ['platano', 100]);
  const MILKS = ['whole milk', 'skimmed milk', 'semi skimmed milk', 'fresh milk'];
  const cases: readonly (readonly [PictureRecipe, string, string, string])[] = [
    [
      dish('Tarta de queso vegana', ['queso-vegano', 150], ['nata-vegetal-de-soja', 100], ['harina-de-arroz', 50]),
      'cream cheese',
      'queso-vegano',
      'milk'
    ],
    [dish('Pan sin gluten con leche de soja', ['pan-sin-gluten', 80], ['leche-de-soja', 200]), 'milk roll', 'pan-sin-gluten', 'gluten'],
    [dish('Pan sin gluten con leche de soja', ['pan-sin-gluten', 80], ['leche-de-soja', 200]), 'milk bun', 'pan-sin-gluten', 'gluten'],
    ...MILKS.map(name => [SHAKE, name, 'leche-de-soja', 'milk'] as const),
    [dish('Curry de garbanzos con leche de coco', ['garbanzos-cocidos', 200], ['leche-de-coco', 150], OIL), 'light cream', 'leche-de-coco', 'milk'],
    [
      dish('Curry de garbanzos con leche de coco ligera', ['garbanzos-cocidos', 200], ['leche-de-coco-ligera', 150], OIL),
      'light cream',
      'leche-de-coco-ligera',
      'milk'
    ],
    [
      dish('Tostadas sin gluten con canela', ['pan-sin-gluten', 80], ['canela-molida', 3], ['platano', 80]),
      'cinnamon roll',
      'pan-sin-gluten',
      'gluten'
    ],
    [
      dish('Tostadas sin gluten con canela', ['pan-sin-gluten', 80], ['canela-molida', 3], ['platano', 80]),
      'cinnamon bun',
      'pan-sin-gluten',
      'gluten'
    ],
    [dish('Tostadas sin gluten con cebolleta', ['pan-sin-gluten', 80], ['cebolleta', 20], ['huevo', 60]), 'spring roll', 'pan-sin-gluten', 'gluten'],
    [dish('Pan sin gluten con arroz para sushi', ['pan-sin-gluten', 80], ['arroz-para-sushi', 100]), 'sushi roll', 'pan-sin-gluten', 'gluten'],
    [dish('Tostadas sin gluten con huevo', ['pan-sin-gluten', 80], ['huevo', 60]), 'egg roll', 'pan-sin-gluten', 'gluten']
  ];

  it.each(
    cases.flatMap(([recipe, name, of, allergen]) =>
      (
        [
          ['left as an extra', picture(recipe, { name })],
          [`left as an extra for ${of}`, picture(recipe, { name, of })],
          // Below: a kind of milk paired with the soy milk was always read as its name cut short.
          ...(MILKS.includes(name) ? [] : ([[`paired with ${of}`, picture(recipe, { name, of, paired: true })]] as const))
        ] as const
      ).map(([way, shown]) => [name, way, recipe.name, allergen, recipe, shown] as const)
    )
  )('rejects "%s" %s on "%s", for %s, with no own form', (name, _way, _title, allergen, recipe, shown) => {
    const verdict = judged(recipe, shown);

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras.find(extra => extra.name === name)?.foreignAllergens).toContain(allergen);
    expect(verdict.notes.some(note => note.startsWith('own_form:'))).toBe(false);
  });

  /*
   * The lead's decision (round 3): a family excuses a closed set of allergens
   * (`FormFamily.carries`), never what a catalogue product of the form
   * happens to hold. The catalogue's brownie holds walnuts; a brownie beside
   * a nut-free sponge is excused its flour, egg and milk, and rejected for
   * the nuts.
   */
  it.each(['brownie', 'brownies'])('rejects "%s" beside a nut-free sponge, for tree nuts, every way the match call answers', name => {
    const sponge = DISHES.lemonCake;

    for (const shown of [
      picture(sponge, { name }),
      picture(sponge, { name, of: 'harina-de-arroz' }),
      picture(sponge, { name, of: 'harina-de-arroz', paired: true })
    ]) {
      const verdict = judged(sponge, shown);

      expect(verdict.accepted).toBe(false);
      expect(verdict.extras.find(extra => extra.name === name)?.foreignAllergens).toEqual(['tree_nuts']);
      expect(verdict.notes).toContain(`own_form:${name}`);
    }
  });

  /*
   * Not this rule, and unchanged by it: a name the match call paired with an
   * ingredient, made of words of that ingredient's own name once the
   * descriptors are gone ("whole milk" → "milk", of "Soy milk"), is that
   * ingredient's name cut short (project 006, `shortened` in `judge.ts`). The
   * rule before project 010 accepted these as well; pinned so a change is seen.
   */
  it.each(MILKS)('accepts "%s" paired with the soy milk, as the rule before project 010 did, with no own form', name => {
    const verdict = judged(SHAKE, picture(SHAKE, { name, of: 'leche-de-soja', paired: true }));

    expect(verdict.accepted).toBe(true);
    expect(verdict.notes.some(note => note.startsWith('own_form:'))).toBe(false);
  });
});
