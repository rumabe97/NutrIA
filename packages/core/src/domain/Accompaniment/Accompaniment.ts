import { composeMacros, scaleMacros } from 'core/domain/Composition';
import { cuisineFamily, dishGroups, foodGroupOf, groupFits } from 'core/domain/MealFit';
import { breaksDishRule } from 'core/domain/Preference';
import { bestEffortExclusions, dishSafety, mentionsUnresolvedAllergy } from 'core/domain/Safety';

import type { CuisineFamily, FoodGroup } from 'core/domain/MealFit';
import type { PreferenceExclusions } from 'core/domain/Preference';
import type { Catalogue, Macros, MealSlot } from 'core/entities/Plan';
import type { SafetyProfile } from 'core/entities/Safety';

/**
 * What goes beside the plate (`0079`, Table 3; design A of architect report
 * `0008`): bread, a salad, a piece of fruit — the way a Spanish meal is eaten,
 * and the way each other tradition eats its own.
 *
 * A fixed list in code, like `Yield`, never recipes: a recipe would enter the
 * library's reuse, the pictures and the image judge. Every portion is a few
 * catalogue rows at fixed grams, so its macros are the catalogue's and the
 * allergy gate reads it like any dish. Nothing here is asked of a model.
 */

/** The three places beside the plate (3c): at most one of each. */
export type AccompanimentRole = 'dessert' | 'starch' | 'vegetable';

export type AccompanimentItem = { readonly grams: number; readonly slug: string };

export type Accompaniment = {
  /** The families that may offer it, or every family (3c: the simple ones but the family breads and hummus). */
  readonly families: 'all' | readonly CuisineFamily[];
  /** Stable, for the meal's rows and the screen's words. */
  readonly key: string;
  /**
   * The months it is offered in, on the day it is served — a hard filter (owner's answer 8).
   * `catalogue` reads each row's own `seasonMonths` (fruit); `all` is every month.
   */
  readonly months: 'all' | 'catalogue' | readonly number[];
  /** Its discrete portions, smallest first. A composed accompaniment has one. */
  readonly portions: readonly (readonly AccompanimentItem[])[];
  readonly role: AccompanimentRole;
  /** The meals of Table 3's "Main meals" column. */
  readonly slots: readonly MealSlot[];
};

const BLD: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner'];
const LD: readonly MealSlot[] = ['lunch', 'dinner'];
const SUMMER = [6, 7, 8, 9];
const SPANISH: readonly CuisineFamily[] = ['spanish', 'other'];

const DRESSING: readonly AccompanimentItem[] = [
  { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
  { grams: 5, slug: 'vinagre-de-vino-tinto' },
  { grams: 0.5, slug: 'sal' }
];

function bread(slug: string): Accompaniment {
  return {
    families: 'all',
    key: slug,
    months: 'all',
    portions: [[{ grams: 30, slug }], [{ grams: 60, slug }]],
    role: 'starch',
    slots: BLD
  };
}

function fruit(slug: string, grams: number): Accompaniment {
  return { families: 'all', key: slug, months: 'catalogue', portions: [[{ grams, slug }]], role: 'dessert', slots: BLD };
}

function composed(
  key: string,
  role: AccompanimentRole,
  families: readonly CuisineFamily[],
  months: 'all' | readonly number[],
  items: readonly AccompanimentItem[],
  slots: readonly MealSlot[] = LD
): Accompaniment {
  return { families, key, months, portions: [items], role, slots };
}

/**
 * Table 3 of `0079`, literally. USDA rows only, except `queso-de-burgos`,
 * which `0079` names as the one still waiting to be re-sourced. `pan-de-semillas`
 * is not here on purpose: it may contain sesame and tree nuts. `pan-sin-gluten`
 * is, and reaches only the people `freeFromExclusions` leaves it to — which
 * holds only when the caller hands `larderFor` the preferences and safety of
 * `GenerationContext` as `buildContext` merges them (free-from, supplements and
 * unresolved allergies included), never a fresh `resolvePreferences`.
 */
export const ACCOMPANIMENTS: readonly Accompaniment[] = [
  // 3a — simple.
  bread('pan-blanco'),
  bread('pan-integral'),
  bread('pan-de-centeno'),
  bread('pan-de-masa-madre'),
  bread('pan-sin-gluten'),
  fruit('naranja', 130),
  fruit('mandarina', 160),
  fruit('manzana', 180),
  fruit('pera', 170),
  fruit('kiwi', 150),
  fruit('platano', 120),
  fruit('melocoton', 150),
  fruit('nectarina', 140),
  fruit('caqui', 170),
  fruit('uva', 150),
  fruit('fresa', 150),
  fruit('melon', 200),
  fruit('sandia', 200),
  fruit('pina', 150),
  { families: 'all', key: 'yogur-natural-desnatado', months: 'all', portions: [[{ grams: 125, slug: 'yogur-natural-desnatado' }]], role: 'dessert', slots: BLD },
  { families: 'all', key: 'yogur-griego-natural', months: 'all', portions: [[{ grams: 125, slug: 'yogur-griego-natural' }]], role: 'dessert', slots: BLD },
  // Nuts and cheese: breakfast only (owner's answer 7). In the third place beside the plate.
  { families: 'all', key: 'nueces', months: 'all', portions: [[{ grams: 20, slug: 'nueces' }], [{ grams: 30, slug: 'nueces' }]], role: 'dessert', slots: ['breakfast'] },
  { families: 'all', key: 'almendras', months: 'all', portions: [[{ grams: 20, slug: 'almendras' }], [{ grams: 30, slug: 'almendras' }]], role: 'dessert', slots: ['breakfast'] },
  { families: 'all', key: 'queso-de-burgos', months: 'all', portions: [[{ grams: 60, slug: 'queso-de-burgos' }]], role: 'dessert', slots: ['breakfast'] },
  { families: 'all', key: 'requeson', months: 'all', portions: [[{ grams: 60, slug: 'requeson' }]], role: 'dessert', slots: ['breakfast'] },
  {
    families: ['latin'],
    key: 'tortilla-de-maiz',
    months: 'all',
    portions: [[{ grams: 60, slug: 'tortilla-de-maiz' }], [{ grams: 90, slug: 'tortilla-de-maiz' }]],
    role: 'starch',
    slots: BLD
  },
  { families: ['arab'], key: 'pan-de-pita', months: 'all', portions: [[{ grams: 60, slug: 'pan-de-pita' }]], role: 'starch', slots: BLD },
  { families: ['arab'], key: 'hummus', months: 'all', portions: [[{ grams: 30, slug: 'hummus' }], [{ grams: 60, slug: 'hummus' }]], role: 'vegetable', slots: LD },
  // 3b — composed, g per person.
  composed('ensalada-verde', 'vegetable', [...SPANISH, 'italian', 'latin', 'arab'], 'all', [
    { grams: 80, slug: 'lechuga' },
    { grams: 15, slug: 'cebolla' },
    ...DRESSING
  ]),
  composed('ensalada-mixta', 'vegetable', SPANISH, SUMMER, [
    { grams: 60, slug: 'lechuga' },
    { grams: 100, slug: 'tomate' },
    { grams: 15, slug: 'cebolla' },
    ...DRESSING
  ]),
  composed('ensalada-de-invierno', 'vegetable', SPANISH, [11, 12, 1, 2, 3], [
    { grams: 40, slug: 'canonigos' },
    { grams: 80, slug: 'naranja' },
    { grams: 40, slug: 'zanahoria' },
    ...DRESSING
  ]),
  composed('gazpacho', 'vegetable', SPANISH, SUMMER, [
    { grams: 180, slug: 'tomate' },
    { grams: 30, slug: 'pepino' },
    { grams: 20, slug: 'pimiento-verde' },
    { grams: 2, slug: 'ajo' },
    { grams: 10, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 5, slug: 'vinagre-de-vino-tinto' },
    { grams: 1, slug: 'sal' }
  ]),
  composed('verduras-a-la-plancha', 'vegetable', [...SPANISH, 'italian'], SUMMER, [
    { grams: 100, slug: 'calabacin' },
    { grams: 50, slug: 'pimiento-rojo' },
    { grams: 50, slug: 'berenjena' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('brocoli-salteado', 'vegetable', SPANISH, [10, 11, 12, 1, 2, 3, 4, 5, 6], [
    { grams: 150, slug: 'brocoli' },
    { grams: 3, slug: 'ajo' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('judias-verdes-rehogadas', 'vegetable', SPANISH, [8, 9, 10], [
    { grams: 150, slug: 'judia-verde' },
    { grams: 3, slug: 'ajo' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('insalata-mista', 'vegetable', ['italian'], SUMMER, [
    { grams: 60, slug: 'lechuga' },
    { grams: 60, slug: 'tomate-cherry' },
    { grams: 30, slug: 'zanahoria' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 5, slug: 'vinagre-balsamico' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('arroz-blanco', 'starch', ['asian'], 'all', [
    { grams: 50, slug: 'arroz-largo-crudo' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('sopa-de-miso', 'vegetable', ['asian'], 'all', [
    { grams: 15, slug: 'miso' },
    { grams: 40, slug: 'tofu-sedoso' },
    { grams: 2, slug: 'alga-wakame' },
    { grams: 5, slug: 'cebolleta' }
  ]),
  composed('ensalada-de-pepino', 'vegetable', ['asian'], SUMMER, [
    { grams: 120, slug: 'pepino' },
    { grams: 10, slug: 'vinagre-de-arroz' },
    { grams: 3, slug: 'sesamo' }
  ]),
  composed('pak-choi-salteado', 'vegetable', ['asian'], 'all', [
    { grams: 150, slug: 'pak-choi' },
    { grams: 3, slug: 'ajo' },
    { grams: 3, slug: 'jengibre-fresco' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 5, slug: 'salsa-de-soja-baja-en-sal' }
  ]),
  composed('arroz-rojo', 'starch', ['latin'], 'all', [
    { grams: 40, slug: 'arroz-largo-crudo' },
    { grams: 40, slug: 'tomate-triturado' },
    { grams: 15, slug: 'cebolla' },
    { grams: 2, slug: 'ajo' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('pico-de-gallo', 'vegetable', ['latin'], SUMMER, [
    { grams: 80, slug: 'tomate' },
    { grams: 20, slug: 'cebolla' },
    { grams: 5, slug: 'cilantro' },
    { grams: 10, slug: 'lima' },
    { grams: 5, slug: 'jalapeno' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed(
    'frijoles',
    'vegetable',
    ['latin'],
    'all',
    [
      { grams: 100, slug: 'alubias-negras-cocidas' },
      { grams: 15, slug: 'cebolla' },
      { grams: 2, slug: 'ajo' },
      { grams: 0.5, slug: 'sal' }
    ],
    BLD
  ),
  composed('ensalada-marroqui', 'vegetable', ['arab'], SUMMER, [
    { grams: 80, slug: 'tomate' },
    { grams: 60, slug: 'pepino' },
    { grams: 15, slug: 'cebolla' },
    { grams: 5, slug: 'perejil' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 5, slug: 'limon' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed(
    'tabule',
    'starch',
    ['arab'],
    SUMMER,
    [
      { grams: 30, slug: 'bulgur-crudo' },
      { grams: 50, slug: 'tomate' },
      { grams: 30, slug: 'pepino' },
      { grams: 15, slug: 'perejil' },
      { grams: 5, slug: 'hierbabuena' },
      { grams: 10, slug: 'limon' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ],
    ['lunch']
  ),
  composed('naranja-con-canela', 'dessert', ['arab'], [11, 12, 1, 2, 3, 4, 5], [
    { grams: 130, slug: 'naranja' },
    { grams: 1, slug: 'canela-molida' }
  ])
];

/** One accompaniment at one portion, with what it carries. */
export type AccompanimentPortion = {
  readonly accompaniment: Accompaniment;
  readonly grams: number;
  readonly items: readonly AccompanimentItem[];
  /** Rounded to a tenth, as `scaleMacros` rounds a plate. */
  readonly macros: Macros;
};

/** What goes beside one plate: nothing, or one portion of up to three accompaniments, one per role. */
export type AccompanimentSet = {
  /** Every row of every portion, in role order — what enters `meal.ingredients`. */
  readonly items: readonly AccompanimentItem[];
  /** Summed from the portions' rounded macros, so a plate plus its set adds as the plan adds. */
  readonly macros: Macros;
  readonly portions: readonly AccompanimentPortion[];
};

export const NO_ACCOMPANIMENT: AccompanimentSet = { items: [], macros: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 }, portions: [] };

/**
 * Whoever is eating: what the gate, their way of eating and their dislikes allow.
 *
 * TODO(016 phase 4, docs/projects/016-a-spanish-meal/PLAN.md): build it from
 * `RecipeController.generationContext(userId)` — its `preferences` and `safety`
 * as merged there — on the generation, swap and event-rebuild paths alike, and
 * test through that context that a non-coeliac never gets `pan-sin-gluten` and a
 * coeliac does, and that a plan with sides passes `assertPlanIsSafe`.
 */
export type AccompanimentDiner = {
  readonly catalogue: Catalogue;
  readonly preferences: Pick<PreferenceExclusions, 'excludedIngredientIds' | 'keepsMeatFromDairy'>;
  readonly safety: SafetyProfile;
};

/** The accompaniments one person may ever be offered, priced: the part of the filter that does not depend on the plate. */
export type Larder = { readonly diner: AccompanimentDiner; readonly portions: readonly AccompanimentPortion[] };

/**
 * The portions this person may be offered at all (3d): every row known to the
 * catalogue, safe by `dishSafety` (allergies and intolerances, `contains`, and
 * `may_contain` for whoever set it), none excluded by their way of eating or
 * their dislikes (`traditional_spanish`'s rows among them), and none sharing a
 * word with an allergy the catalogue could not resolve — neither by its rows
 * nor by its own name, the way a dish is refused for naming one
 * (`mentionsUnresolvedAllergy`): somebody who typed "gazpacho" gets no gazpacho,
 * though tomato and cucumber share no word with it. A composed accompaniment
 * with one row out is out whole.
 */
export function larderFor(diner: AccompanimentDiner): Larder {
  const unresolved = bestEffortExclusions(diner.safety.unenforceableLabels, [...diner.catalogue.values()]);
  const portions: AccompanimentPortion[] = [];

  for (const accompaniment of ACCOMPANIMENTS) {
    for (const items of accompaniment.portions) {
      const known = items.every(item => diner.catalogue.has(item.slug));
      const allowed = items.every(item => {
        const id = diner.catalogue.get(item.slug)?.id;

        return id !== undefined && !diner.preferences.excludedIngredientIds.has(id) && !unresolved.has(id);
      });

      const named = mentionsUnresolvedAllergy({ name: accompaniment.key.replaceAll('-', ' '), steps: [] }, diner.safety.unenforceableLabels);

      if (!known || !allowed || named || dishSafety(items, diner.catalogue, diner.safety).kind !== 'safe') {
        continue;
      }

      const composed = composeMacros(items, diner.catalogue);

      if (composed.ok) {
        portions.push({ accompaniment, grams: items.reduce((sum, item) => sum + item.grams, 0), items, macros: scaleMacros(composed.macros, 1) });
      }
    }
  }

  return { diner, portions };
}

/** The fruits a dish may already be carrying, so a fruit dessert is not served beside a fruit plate. */
const FRUIT: ReadonlySet<string> = new Set([
  ...ACCOMPANIMENTS.filter(entry => entry.months === 'catalogue').map(entry => entry.key),
  'albaricoque',
  'arandanos-congelados',
  'cereza',
  'chirimoya',
  'ciruela',
  'frambuesa',
  'frambuesas-congeladas',
  'frutos-rojos-congelados',
  'granada',
  'higo',
  'lichi',
  'mango',
  'mango-congelado',
  'maracuya',
  'nispero',
  'papaya',
  'pomelo'
]);

/** "Not twice the same group" (3d): grams per serving from which a dish already has the thing. */
const ALREADY = { breadGrams: 30, fruitGrams: 100 } as const;

function inSeasonOn(portion: AccompanimentPortion, catalogue: Catalogue, month: number): boolean {
  const { months } = portion.accompaniment;

  if (months === 'all') {
    return true;
  }

  if (months === 'catalogue') {
    return portion.items.every(item => {
      const season = catalogue.get(item.slug)?.seasonMonths ?? [];

      return season.length === 0 || season.includes(month);
    });
  }

  return months.includes(month);
}

/** A bread, by what it is: the bakery aisle, or a row called bread. */
function isBread(slug: string, catalogue: Catalogue): boolean {
  return catalogue.get(slug)?.category === 'bakery' || (slug.startsWith('pan-') && slug !== 'pan-rallado');
}

function itemGroups(items: readonly AccompanimentItem[]): ReadonlySet<FoodGroup> {
  return new Set(items.map(item => foodGroupOf(item.slug)).filter((group): group is FoodGroup => group !== null));
}

/**
 * The portions that may go beside this dish at this meal, in this month (3d),
 * in table order: the dish's family offers it (owner's answer 6), the meal is
 * in its column and Table 2 lets its own group in there for that family, it is
 * in season that month (owner's answer 8), it does not repeat what the plate
 * already is — bread beside bread, rice beside rice, fruit beside fruit — and,
 * for somebody who keeps meat from dairy, the dish and it together break no
 * rule (`breaksDishRule` on the whole meal).
 */
export function portionsBeside(
  larder: Larder,
  dish: {
    readonly cuisine?: string | null;
    readonly ingredients: readonly { readonly grams: number; readonly slug: string }[];
    readonly servings: number;
  },
  slot: MealSlot,
  month: number
): readonly AccompanimentPortion[] {
  const { catalogue, preferences } = larder.diner;
  const family = cuisineFamily(dish.cuisine);
  const servings = dish.servings > 0 ? dish.servings : 1;
  const perServing = (test: (slug: string) => boolean): number =>
    dish.ingredients.filter(item => test(item.slug)).reduce((sum, item) => sum + item.grams, 0) / servings;
  const hasBread = perServing(slug => isBread(slug, catalogue)) >= ALREADY.breadGrams;
  const hasFruit = perServing(slug => FRUIT.has(slug)) >= ALREADY.fruitGrams;
  const groups = dishGroups(dish);

  return larder.portions.filter(portion => {
    const { accompaniment } = portion;
    const own = itemGroups(portion.items);

    return (
      (accompaniment.families === 'all' || accompaniment.families.includes(family)) &&
      accompaniment.slots.includes(slot) &&
      [...own].every(group => groupFits(family, group, slot) && !groups.has(group)) &&
      inSeasonOn(portion, catalogue, month) &&
      !(accompaniment.role === 'starch' && hasBread && portion.items.some(item => isBread(item.slug, catalogue))) &&
      !(hasFruit && portion.items.some(item => FRUIT.has(item.slug))) &&
      !breaksDishRule([...dish.ingredients, ...portion.items], catalogue, preferences)
    );
  });
}

const ROLES: readonly AccompanimentRole[] = ['starch', 'vegetable', 'dessert'];

/**
 * Every set those portions make (3c): nothing, or at most one per role, in a
 * fixed order — "none" first, then by role and table order — so whoever ranks
 * them can break a tie by position and get the same answer every time.
 */
export function setsOf(portions: readonly AccompanimentPortion[]): readonly AccompanimentSet[] {
  const byRole = ROLES.map(role => [null, ...portions.filter(portion => portion.accompaniment.role === role)]);
  const sets: AccompanimentSet[] = [];

  const visit = (index: number, chosen: AccompanimentPortion[]): void => {
    if (index === byRole.length) {
      sets.push(toSet(chosen));

      return;
    }

    for (const portion of byRole[index] ?? []) {
      visit(index + 1, portion === null ? chosen : [...chosen, portion]);
    }
  };

  visit(0, []);

  return sets;
}

/**
 * The sets that may go beside this dish at this meal, in this month:
 * `setsOf(portionsBeside(...))`, less every set that, with the dish, breaks a
 * whole-meal rule of their way of eating. `portionsBeside` judges each portion
 * beside the dish; a rule like kosher's is about the whole table, so the set
 * is judged again together — a meat side and a yoghurt would each pass alone.
 * What the scheduler and a swap both read.
 */
export function setsBeside(
  larder: Larder,
  dish: {
    readonly cuisine?: string | null;
    readonly ingredients: readonly { readonly grams: number; readonly slug: string }[];
    readonly servings: number;
  },
  slot: MealSlot,
  month: number
): readonly AccompanimentSet[] {
  const { catalogue, preferences } = larder.diner;

  return setsOf(portionsBeside(larder, dish, slot, month)).filter(set => !breaksDishRule([...dish.ingredients, ...set.items], catalogue, preferences));
}

function toSet(portions: readonly AccompanimentPortion[]): AccompanimentSet {
  if (portions.length === 0) {
    return NO_ACCOMPANIMENT;
  }

  const sum = (key: keyof Macros): number => Math.round(portions.reduce((total, portion) => total + portion.macros[key] * 10, 0)) / 10;

  return {
    items: portions.flatMap(portion => portion.items),
    macros: { carbsG: sum('carbsG'), fatG: sum('fatG'), fiberG: sum('fiberG'), kcal: sum('kcal'), proteinG: sum('proteinG') },
    portions
  };
}
