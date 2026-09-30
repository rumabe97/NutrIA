import { judgePicture, pictureParts } from 'core/domain/DishPicture';

// The seed is not one of `database`'s exports; its source is read directly, for the judge's acceptance set only.
import { INGREDIENT_NAMES_EN_GB } from '../../../../database/src/seed/ingredient-names';
import { INGREDIENT_SEED } from '../../../../database/src/seed/ingredients';

import type { PictureCatalogueEntry, PictureMatch, PictureRecipe, PictureVerdict, SeenPicture } from 'core/domain/DishPicture';

/*
 * What the acceptance set of the picture judge is built from (project 010,
 * `0073`): the catalogue, the example dishes and the pictures of them. Shared
 * by `judge.pilot.test.ts`, `judge.forms.test.ts`, `judge.reverse.test.ts` and
 * `judge.holes.test.ts`, which sit beside the rule.
 */

/**
 * The whole seed catalogue in the shape `RecipeRepository.pictureCatalogue`
 * gives the rule in production: each ingredient's names in es-ES and en-GB,
 * the allergens it contains and those it may contain, as the seed writes them.
 */
export const SEED_CATALOGUE: readonly PictureCatalogueEntry[] = INGREDIENT_SEED.map(seed => {
  const english = INGREDIENT_NAMES_EN_GB[seed.slug];

  if (english === undefined) {
    throw new Error(`No en-GB name for ingredient "${seed.slug}"`);
  }

  return {
    allergens: (seed.allergens ?? []).filter(link => (link.presence ?? 'contains') === 'contains').map(link => link.key),
    mayContain: (seed.allergens ?? []).filter(link => link.presence === 'may_contain').map(link => link.key),
    names: [seed.name, english],
    slug: seed.slug
  };
});

const ENTRIES = new Map(SEED_CATALOGUE.map(entry => [entry.slug, entry]));

/** A dish as its picture is drawn from: each ingredient under its en-GB name, as `RecipeRepository.pictureRecipe` reads it. */
export function dish(name: string, ...ingredients: readonly (readonly [slug: string, grams: number])[]): PictureRecipe {
  return {
    ingredients: ingredients.map(([slug, grams]) => {
      const english = ENTRIES.get(slug)?.names[1];

      if (english === undefined) {
        throw new Error(`"${slug}" is not in the seed catalogue`);
      }

      return { grams, name: english, slug };
    }),
    name
  };
}

/** The judge's two answers about one picture. */
export type Picture = { readonly match: PictureMatch; readonly seen: SeenPicture };

/**
 * One food a picture shows beyond the dish's own foods under their own names.
 * With no `of`, a food the dish does not have, which the match call listed as
 * an extra. With `of`, the judge's name for that ingredient of the dish: the
 * match call either paired the two (`paired`), or left the name as an extra
 * and answered that the ingredient was not seen.
 */
export type Shown = { readonly name: string; readonly of?: string; readonly paired?: boolean };

/**
 * A faithful picture of `recipe`: every ingredient the prompt draws as visible
 * is seen under its own English name and matched to itself, and the rest are
 * not seen. `shown` is what else the judge named — always a main, and specific,
 * the hardest reading for the rule.
 */
export function picture(recipe: PictureRecipe, ...shown: readonly Shown[]): Picture {
  const visible = new Set(pictureParts(recipe).visible.map(ingredient => ingredient.slug));
  const renamed = new Map(shown.flatMap(food => (food.of === undefined ? [] : [[food.of, food] as const])));

  for (const slug of renamed.keys()) {
    if (!recipe.ingredients.some(ingredient => ingredient.slug === slug)) {
      throw new Error(`"${slug}" is not an ingredient of "${recipe.name}"`);
    }
  }

  return {
    match: {
      extras: shown.filter(food => food.paired !== true).map(food => food.name),
      ingredients: recipe.ingredients.map(({ name, slug }) => {
        const other = renamed.get(slug);

        if (other !== undefined) {
          return other.paired === true ? { matched: [other.name], slug, status: 'seen' } : { matched: [], slug, status: 'not_seen' };
        }

        return visible.has(slug) ? { matched: [name.toLowerCase()], slug, status: 'seen' } : { matched: [], slug, status: 'not_seen' };
      })
    },
    seen: {
      foods: [
        ...recipe.ingredients
          .filter(({ slug }) => visible.has(slug) && !renamed.has(slug))
          .map(({ name }) => ({ amount: 'main' as const, name: name.toLowerCase(), specific: true })),
        ...shown.map(({ name }) => ({ amount: 'main' as const, name, specific: true }))
      ]
    }
  };
}

/** The rule's verdict on a picture of `recipe`, against the whole seed catalogue. */
export function judged(recipe: PictureRecipe, { match, seen }: Picture): PictureVerdict {
  return judgePicture({ catalogue: SEED_CATALOGUE, match, recipe, seen });
}

const OIL = ['aceite-de-oliva-virgen-extra', 5] as const;

/*
 * The example dishes. Written for these tests, with the seed's own slugs and
 * the kind of title a generated dish has; none comes from the private library
 * or from production. `OWN_FORM` is one dish per way a dish can have its own
 * version of a form (`0073`): an ingredient that is the form, or a title that
 * names it, in Spanish and in English. `NO_FORM` is dishes that have none, to
 * stand beside them.
 */
const OWN_FORM = {
  arepas: dish('Arepas de maíz con aguacate y alubias negras', ['harina-de-maiz', 80], ['alubias-negras-cocidas', 80], ['aguacate', 60], OIL),
  batteredHake: dish(
    'Merluza rebozada con harina de garbanzo y pimientos',
    ['merluza', 160],
    ['pimiento-rojo', 100],
    ['harina-de-garbanzo', 30],
    OIL
  ),
  batteredHakeEn: dish('Battered hake with chickpea flour and peppers', ['merluza', 160], ['pimiento-rojo', 100], ['harina-de-garbanzo', 30], OIL),
  beanBrownie: dish(
    'Brownie de alubias negras y cacao',
    ['alubias-negras-cocidas', 120],
    ['clara-de-huevo', 60],
    ['cacao-en-polvo-puro', 20],
    ['miel', 20]
  ),
  cauliflowerPizza: dish(
    'Pizza con base de coliflor y champiñones',
    ['coliflor', 200],
    ['champinon', 80],
    ['tomate-triturado', 60],
    ['clara-de-huevo', 40],
    OIL
  ),
  cauliflowerPizzaEn: dish(
    'Cauliflower-crust pizza with mushrooms',
    ['coliflor', 200],
    ['champinon', 80],
    ['tomate-triturado', 60],
    ['clara-de-huevo', 40],
    OIL
  ),
  chickenMeatballs: dish('Albóndigas de pollo en salsa de tomate', ['pollo-picado', 150], ['tomate-triturado', 150], ['cebolla', 40], OIL),
  chickenMeatballsEn: dish('Chicken meatballs in tomato sauce', ['pollo-picado', 150], ['tomate-triturado', 150], ['cebolla', 40], OIL),
  coconutCurry: dish(
    'Garbanzos guisados al curry con leche de coco y espinacas',
    ['garbanzos-cocidos', 200],
    ['leche-de-coco', 100],
    ['espinaca', 60],
    ['curry-en-polvo', 3]
  ),
  coconutSoup: dish('Crema de calabaza con crema de coco', ['calabaza', 300], ['crema-de-coco', 40], ['cebolla', 40], OIL),
  coconutYoghurt: dish('Yogur de coco con mango', ['yogur-de-coco', 150], ['mango', 100]),
  cornBreadEn: dish('Corn bread with avocado and black beans', ['harina-de-maiz', 80], ['alubias-negras-cocidas', 80], ['aguacate', 60], OIL),
  cornCakes: dish('Tortitas de maíz con aguacate y tomate', ['aguacate', 80], ['tomate', 80], ['tortitas-de-maiz', 40], OIL),
  cornEmpanadillas: dish('Empanadillas de harina de maíz con pollo', ['pechuga-de-pollo', 100], ['harina-de-maiz', 70], ['pimiento-rojo', 40], OIL),
  cornflakeChicken: dish('Pollo empanado con copos de maíz y boniato', ['pechuga-de-pollo', 150], ['boniato', 150], ['copos-de-maiz', 30], OIL),
  cornflakeYoghurt: dish('Yogur de coco con copos de maíz y fresas', ['yogur-de-coco', 150], ['fresa', 80], ['copos-de-maiz', 30]),
  cornTacos: dish('Tacos de pollo con tortilla de maíz', ['pechuga-de-pollo', 120], ['tortilla-de-maiz', 60], ['aguacate', 50], ['tomate', 50], OIL),
  courgetteFritters: dish('Buñuelos de calabacín con harina de garbanzo', ['calabacin', 150], ['harina-de-garbanzo', 50], OIL),
  crepes: dish(
    'Crepes de trigo sarraceno con espinacas y champiñones',
    ['espinaca', 100],
    ['champinon', 100],
    ['clara-de-huevo', 60],
    ['harina-de-trigo-sarraceno', 50],
    OIL
  ),
  glassNoodles: dish('Ensalada de fideos de cristal con pepino', ['fideos-de-cristal', 80], ['pepino', 80], ['zanahoria', 50], OIL),
  glutenFreeBiscuits: dish('Yogur de coco con galletas sin gluten y fresas', ['yogur-de-coco', 125], ['fresa', 80], ['galletas-sin-gluten', 30]),
  glutenFreeBreaded: dish(
    'Pollo empanado sin gluten con ensalada',
    ['pechuga-de-pollo', 150],
    ['lechuga', 80],
    ['tomate', 60],
    ['pan-rallado-sin-gluten', 30],
    OIL
  ),
  glutenFreeSpaghetti: dish(
    'Espaguetis sin gluten con tomate y albahaca',
    ['tomate-triturado', 150],
    ['pasta-sin-gluten', 90],
    ['albahaca-fresca', 5],
    OIL
  ),
  glutenFreeToast: dish('Tostadas de pan sin gluten con aguacate y tomate', ['pan-sin-gluten', 80], ['aguacate', 80], ['tomate', 60], OIL),
  heuraNuggets: dish('Nuggets de heura al horno con ensalada', ['heura', 140], ['lechuga', 80], ['tomate', 60], OIL),
  heuraStirFry: dish('Salteado de heura con verduras', ['heura', 140], ['calabacin', 100], ['pimiento-rojo', 80], ['cebolla', 50], OIL),
  lactoseFreeRicePudding: dish('Arroz con leche sin lactosa', ['leche-sin-lactosa', 250], ['arroz-blanco-cocido', 120]),
  lemonCake: dish('Bizcocho de harina de arroz y limón', ['harina-de-arroz', 60], ['clara-de-huevo', 60], ['miel', 20], ['limon', 10], OIL),
  lemonCakeEn: dish('Lemon cake with rice flour', ['harina-de-arroz', 60], ['clara-de-huevo', 60], ['miel', 20], ['limon', 10], OIL),
  lentilBurgers: dish('Hamburguesas de lentejas con ensalada', ['lentejas-cocidas', 180], ['lechuga', 80], ['tomate', 60], OIL),
  lentilPasta: dish('Pasta de lentejas con calabacín', ['calabacin', 120], ['pasta-de-lentejas', 80], ['tomate-triturado', 80], OIL),
  minceWithRice: dish(
    'Carne picada de ternera con arroz y verduras',
    ['arroz-blanco-cocido', 150],
    ['carne-picada-de-ternera', 130],
    ['calabacin', 80],
    OIL
  ),
  nachos: dish('Nachos con frijoles y aguacate', ['frijoles-refritos', 100], ['aguacate', 60], ['nachos', 50], ['tomate', 50]),
  oatMilkRicePudding: dish('Arroz cremoso cocido en leche de avena', ['leche-de-avena', 250], ['arroz-blanco-cocido', 120], ['canela-molida', 1]),
  prawnsWithRice: dish('Gambas al ajillo con arroz', ['gambas', 150], ['arroz-blanco-cocido', 150], ['ajo', 8], OIL),
  riceCakes: dish('Tortitas de arroz untadas de hummus con pepino en rodajas', ['pepino', 80], ['hummus', 60], ['tortitas-de-arroz', 40], OIL),
  riceCookies: dish('Galletas de plátano y harina de arroz', ['platano', 100], ['harina-de-arroz', 60], ['miel', 10]),
  riceCookiesEn: dish('Banana and rice flour cookies', ['platano', 100], ['harina-de-arroz', 60], ['miel', 10]),
  riceDrinkShake: dish('Batido de bebida de arroz con mango', ['bebida-de-arroz', 250], ['mango', 120]),
  riceMuffins: dish('Magdalenas de harina de arroz y plátano', ['platano', 80], ['harina-de-arroz', 60], ['clara-de-huevo', 60], OIL),
  riceNoodles: dish('Salteado de fideos de arroz con verduras', ['fideos-de-arroz-cocidos', 200], ['zanahoria', 60], ['calabacin', 60], OIL),
  ricePancakes: dish('Tortitas de harina de arroz con plátano', ['platano', 100], ['harina-de-arroz', 60], ['clara-de-huevo', 60], OIL),
  ricePancakesEn: dish('Rice flour pancakes with banana', ['platano', 100], ['harina-de-arroz', 60], ['clara-de-huevo', 60], OIL),
  ricePaperGyozas: dish('Gyozas de papel de arroz con pollo y zanahoria', ['pollo-picado', 100], ['papel-de-arroz', 40], ['zanahoria', 40], OIL),
  riceTempura: dish('Verduras en tempura de harina de arroz', ['calabacin', 120], ['zanahoria', 80], ['harina-de-arroz', 40], OIL),
  riceWaffles: dish('Gofres de harina de arroz con fresas', ['fresa', 100], ['harina-de-arroz', 60], ['clara-de-huevo', 60], OIL),
  seitan: dish('Seitán a la plancha con pimientos', ['seitan', 150], ['pimiento-rojo', 120], ['cebolla', 50], OIL),
  soyCreamMushrooms: dish('Champiñones con nata vegetal de soja', ['champinon', 200], ['nata-vegetal-de-soja', 60], OIL),
  soyMilkShake: dish('Batido de leche de soja con plátano y fresas', ['leche-de-soja', 250], ['platano', 100], ['fresa', 80]),
  soyYoghurt: dish('Yogur de soja con fresas y nueces', ['yogur-de-soja', 150], ['fresa', 80], ['nueces', 15]),
  sweetPotatoCroquettes: dish('Croquetas de boniato y harina de arroz', ['boniato', 200], ['harina-de-arroz', 40], OIL),
  sweetPotatoCroquettesEn: dish('Sweet potato croquettes with rice flour', ['boniato', 200], ['harina-de-arroz', 40], OIL),
  tempeh: dish('Tempeh salteado con zanahoria', ['tempeh', 140], ['zanahoria', 100], OIL),
  texturedSoy: dish('Soja texturizada con tomate y arroz', ['arroz-blanco-cocido', 150], ['soja-texturizada', 120], ['tomate-triturado', 100], OIL),
  tofu: dish('Tofu firme a la plancha con brócoli', ['tofu-firme', 160], ['brocoli', 150], OIL),
  turkeyMeatballsGlutenFree: dish(
    'Albóndigas de pavo con pan rallado sin gluten',
    ['pavo-picado', 150],
    ['tomate-triturado', 150],
    ['pan-rallado-sin-gluten', 20],
    OIL
  ),
  veganCheeseSalad: dish('Ensalada de tomate con queso vegano', ['tomate', 180], ['lechuga', 60], ['queso-vegano', 50], OIL),
  veggieBurger: dish('Hamburguesa vegetal al plato con ensalada', ['hamburguesa-vegetal', 120], ['lechuga', 80], ['tomate', 60], OIL)
} as const satisfies Record<string, PictureRecipe>;

/* No form of their own, with and without allergens of their own. */
const NO_FORM = {
  beefBurgerInBun: dish(
    'Hamburguesa de ternera con pan y ensalada',
    ['hamburguesa-de-ternera', 120],
    ['pan-de-hamburguesa', 70],
    ['lechuga', 40],
    ['tomate', 40]
  ),
  chickenSalad: dish('Ensalada de pollo con aguacate', ['pechuga-de-pollo', 130], ['lechuga', 100], ['aguacate', 60], ['tomate', 60], OIL),
  chickenWithRice: dish(
    'Arroz con pollo y verduras',
    ['arroz-blanco-cocido', 180],
    ['pechuga-de-pollo', 120],
    ['zanahoria', 60],
    ['calabacin', 60],
    OIL
  ),
  fetaSalad: dish('Ensalada de tomate con queso feta y aceitunas', ['tomate', 180], ['queso-feta', 60], ['aceitunas-negras', 30], OIL),
  fruitSalad: dish('Macedonia de frutas', ['manzana', 100], ['platano', 100], ['fresa', 80]),
  grilledChicken: dish('Pechuga de pollo a la plancha con brócoli', ['pechuga-de-pollo', 160], ['brocoli', 150], OIL),
  hummusPlate: dish('Hummus con zanahoria y pepino', ['hummus', 120], ['zanahoria', 80], ['pepino', 80]),
  lentilStew: dish('Guiso de lentejas con verduras', ['lentejas-cocidas', 220], ['zanahoria', 80], ['calabacin', 80], ['cebolla', 50], OIL),
  musselsWithRice: dish('Arroz con mejillones', ['arroz-blanco-cocido', 180], ['mejillon', 120], ['tomate-triturado', 60], OIL),
  peanutNoodles: dish(
    'Noodles de trigo con salsa de cacahuete',
    ['noodles-de-trigo', 90],
    ['zanahoria', 60],
    ['mantequilla-de-cacahuete', 20],
    ['salsa-de-soja', 10]
  ),
  polenta: dish('Polenta cremosa con champiñones', ['polenta-cocida', 200], ['champinon', 120], OIL),
  ricePudding: dish('Arroz con leche', ['leche-entera', 250], ['arroz-blanco-cocido', 120]),
  salmonWithRice: dish('Salmón con arroz y brócoli', ['salmon', 150], ['arroz-blanco-cocido', 150], ['brocoli', 100], OIL),
  scrambledEggs: dish('Revuelto de huevo con espinacas', ['huevo', 120], ['espinaca', 100], OIL),
  tomatoSoup: dish('Sopa de tomate', ['tomate-triturado', 300], ['cebolla', 50], OIL),
  turkeySandwich: dish(
    'Sándwich de fiambre de pavo con queso curado y lechuga',
    ['pan-de-molde', 60],
    ['fiambre-de-pavo', 50],
    ['queso-curado', 30],
    ['lechuga', 20]
  ),
  wheatSpaghetti: dish('Espaguetis con tomate y parmesano', ['tomate-triturado', 150], ['espaguetis-secos', 90], ['queso-parmesano', 20], OIL),
  yoghurtWithOats: dish('Yogur con avena y nueces', ['yogur-natural-desnatado', 150], ['copos-de-avena', 40], ['nueces', 15])
} as const satisfies Record<string, PictureRecipe>;

export const DISHES = { ...OWN_FORM, ...NO_FORM } as const;
