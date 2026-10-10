import { mealGroups } from 'core/domain/Balance';
import { composeMacros, scaleMacros } from 'core/domain/Composition';
import { cuisineFamily, dishGroups, foodGroupOf, groupFits } from 'core/domain/MealFit';
import { breaksDishRule, FOREIGN_FAMILIES } from 'core/domain/Preference';
import { bestEffortExclusions, dishSafety, mentionsUnresolvedAllergy } from 'core/domain/Safety';

import type { CuisineFamily, FoodGroup } from 'core/domain/MealFit';
import type { PreferenceExclusions } from 'core/domain/Preference';
import type { Catalogue, Macros, MealAccompanimentDraft, MealSlot, ScheduledAccompaniment } from 'core/entities/Plan';
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
  return { families: 'all', key: slug, months: 'all', portions: [[{ grams: 30, slug }], [{ grams: 60, slug }]], role: 'starch', slots: BLD };
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
 * Table 3 of `0079`, and project 018's first batch (architect report `0009`).
 * No BEDCA row but `queso-de-burgos`, which `0079` names as the one still
 * waiting to be re-sourced; five rows of Table 3 are `manual` (`requeson`,
 * `pan-sin-gluten`, `alga-wakame`, `salsa-de-soja-baja-en-sal`,
 * `vinagre-de-arroz`), and every row 018 added is USDA. `pan-de-semillas`
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
  fruit('nispero', 150),
  fruit('cereza', 150),
  fruit('albaricoque', 140),
  fruit('granada', 150),
  {
    families: 'all',
    key: 'yogur-natural-desnatado',
    months: 'all',
    portions: [[{ grams: 125, slug: 'yogur-natural-desnatado' }]],
    role: 'dessert',
    slots: BLD
  },
  {
    families: 'all',
    key: 'yogur-griego-natural',
    months: 'all',
    portions: [[{ grams: 125, slug: 'yogur-griego-natural' }]],
    role: 'dessert',
    slots: BLD
  },
  {
    families: 'all',
    key: 'yogur-con-miel',
    months: 'all',
    portions: [
      [
        { grams: 125, slug: 'yogur-natural-desnatado' },
        { grams: 10, slug: 'miel' }
      ]
    ],
    role: 'dessert',
    slots: BLD
  },
  {
    families: 'all',
    key: 'macedonia',
    months: [11, 12, 1, 2, 3],
    portions: [
      [
        { grams: 80, slug: 'naranja' },
        { grams: 60, slug: 'manzana' },
        { grams: 40, slug: 'platano' }
      ]
    ],
    role: 'dessert',
    slots: BLD
  },
  // Nuts and cheese: breakfast only (owner's answer 7). In the third place beside the plate.
  {
    families: 'all',
    key: 'nueces',
    months: 'all',
    portions: [[{ grams: 20, slug: 'nueces' }], [{ grams: 30, slug: 'nueces' }]],
    role: 'dessert',
    slots: ['breakfast']
  },
  {
    families: 'all',
    key: 'almendras',
    months: 'all',
    portions: [[{ grams: 20, slug: 'almendras' }], [{ grams: 30, slug: 'almendras' }]],
    role: 'dessert',
    slots: ['breakfast']
  },
  {
    families: 'all',
    key: 'queso-de-burgos',
    months: 'all',
    portions: [[{ grams: 60, slug: 'queso-de-burgos' }]],
    role: 'dessert',
    slots: ['breakfast']
  },
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
  {
    families: ['arab'],
    key: 'hummus',
    months: 'all',
    portions: [[{ grams: 30, slug: 'hummus' }], [{ grams: 60, slug: 'hummus' }]],
    role: 'vegetable',
    slots: LD
  },
  { families: ['asian'], key: 'kimchi', months: 'all', portions: [[{ grams: 60, slug: 'kimchi' }]], role: 'vegetable', slots: LD },
  { families: ['latin'], key: 'guacamole', months: 'all', portions: [[{ grams: 60, slug: 'guacamole' }]], role: 'vegetable', slots: LD },
  { families: ['arab'], key: 'datiles', months: 'all', portions: [[{ grams: 30, slug: 'datiles' }]], role: 'dessert', slots: BLD },
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
  composed(
    'ensalada-de-invierno',
    'vegetable',
    SPANISH,
    [11, 12, 1, 2, 3],
    [{ grams: 40, slug: 'canonigos' }, { grams: 80, slug: 'naranja' }, { grams: 40, slug: 'zanahoria' }, ...DRESSING]
  ),
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
  composed(
    'brocoli-salteado',
    'vegetable',
    SPANISH,
    [10, 11, 12, 1, 2, 3, 4, 5, 6],
    [
      { grams: 150, slug: 'brocoli' },
      { grams: 3, slug: 'ajo' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'judias-verdes-rehogadas',
    'vegetable',
    SPANISH,
    [8, 9, 10],
    [
      { grams: 150, slug: 'judia-verde' },
      { grams: 3, slug: 'ajo' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'crema-de-calabacin',
    'vegetable',
    SPANISH,
    [5, 6, 7, 8, 9],
    [
      { grams: 250, slug: 'calabacin' },
      { grams: 40, slug: 'cebolla' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'crema-de-calabaza',
    'vegetable',
    SPANISH,
    [9, 10, 11, 12, 1, 2, 3],
    [
      { grams: 250, slug: 'calabaza' },
      { grams: 40, slug: 'zanahoria' },
      { grams: 30, slug: 'cebolla' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed('crema-de-puerros', 'vegetable', SPANISH, 'all', [
    { grams: 120, slug: 'puerro' },
    { grams: 80, slug: 'patata' },
    { grams: 20, slug: 'cebolla' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed(
    'pimientos-asados',
    'vegetable',
    SPANISH,
    [7, 8, 9, 10],
    [
      { grams: 150, slug: 'pimiento-rojo' },
      { grams: 2, slug: 'ajo' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed('menestra-de-verduras', 'vegetable', SPANISH, 'all', [
    { grams: 50, slug: 'judia-verde-congelada' },
    { grams: 30, slug: 'guisantes-congelados' },
    { grams: 40, slug: 'coliflor-congelada' },
    { grams: 30, slug: 'zanahoria' },
    { grams: 20, slug: 'cebolla' },
    { grams: 2, slug: 'ajo' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('champinones-al-ajillo', 'vegetable', SPANISH, 'all', [
    { grams: 150, slug: 'champinon' },
    { grams: 4, slug: 'ajo' },
    { grams: 3, slug: 'perejil' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('tomate-alinado', 'vegetable', [...SPANISH, 'italian'], SUMMER, [
    { grams: 180, slug: 'tomate' },
    { grams: 1, slug: 'ajo' },
    { grams: 3, slug: 'perejil' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed(
    'escalivada',
    'vegetable',
    SPANISH,
    [7, 8, 9, 10],
    [
      { grams: 100, slug: 'berenjena' },
      { grams: 80, slug: 'pimiento-rojo' },
      { grams: 40, slug: 'cebolla' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'espinacas-a-la-catalana',
    'vegetable',
    SPANISH,
    [10, 11, 12, 1, 2, 3, 4, 5, 6],
    [
      { grams: 150, slug: 'espinaca' },
      { grams: 10, slug: 'pasas' },
      { grams: 5, slug: 'pinones' },
      { grams: 2, slug: 'ajo' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'acelgas-rehogadas',
    'vegetable',
    SPANISH,
    [8, 9, 10, 11, 12, 1, 2, 3, 4, 5],
    [
      { grams: 200, slug: 'acelga' },
      { grams: 3, slug: 'ajo' },
      { grams: 0.5, slug: 'pimenton-dulce' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'coliflor-al-ajoarriero',
    'vegetable',
    SPANISH,
    [9, 10, 11, 12, 1, 2, 3, 4],
    [
      { grams: 150, slug: 'coliflor' },
      { grams: 3, slug: 'ajo' },
      { grams: 1, slug: 'pimenton-dulce' },
      { grams: 3, slug: 'vinagre-de-vino-tinto' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'alcachofas-a-la-plancha',
    'vegetable',
    [...SPANISH, 'italian'],
    [12, 1, 2, 3, 4, 5],
    [
      { grams: 150, slug: 'alcachofa' },
      { grams: 5, slug: 'limon' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'esparragos-trigueros-a-la-plancha',
    'vegetable',
    [...SPANISH, 'italian'],
    [3, 4, 5, 6, 9],
    [
      { grams: 150, slug: 'esparrago-verde' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed('zanahorias-alinadas', 'vegetable', SPANISH, 'all', [
    { grams: 120, slug: 'zanahoria' },
    { grams: 2, slug: 'ajo' },
    { grams: 0.5, slug: 'comino-molido' },
    { grams: 0.5, slug: 'oregano-seco' },
    { grams: 5, slug: 'vinagre-de-vino-tinto' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('patata-cocida', 'starch', SPANISH, 'all', [
    { grams: 150, slug: 'patata' },
    { grams: 2, slug: 'perejil' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('pure-de-patata', 'starch', SPANISH, 'all', [
    { grams: 150, slug: 'patata' },
    { grams: 40, slug: 'leche-semidesnatada' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('salmorejo', 'vegetable', SPANISH, SUMMER, [
    { grams: 200, slug: 'tomate' },
    { grams: 30, slug: 'pan-blanco' },
    { grams: 2, slug: 'ajo' },
    { grams: 10, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 1, slug: 'sal' }
  ]),
  composed(
    'pan-con-tomate',
    'starch',
    SPANISH,
    'all',
    [
      { grams: 50, slug: 'pan-blanco' },
      { grams: 40, slug: 'tomate-triturado' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ],
    BLD
  ),
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
  composed('arroz-jazmin', 'starch', ['asian'], 'all', [{ grams: 50, slug: 'arroz-jazmin-crudo' }]),
  composed('edamame', 'vegetable', ['asian'], 'all', [
    { grams: 100, slug: 'edamame-congelado' },
    { grams: 1, slug: 'sal' }
  ]),
  composed(
    'espinacas-con-sesamo',
    'vegetable',
    ['asian'],
    [10, 11, 12, 1, 2, 3, 4, 5, 6],
    [
      { grams: 150, slug: 'espinaca' },
      { grams: 5, slug: 'sesamo' },
      { grams: 5, slug: 'salsa-de-soja' }
    ]
  ),
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
  composed('yuca-con-mojo', 'starch', ['latin'], 'all', [
    { grams: 120, slug: 'yuca' },
    { grams: 2, slug: 'ajo' },
    { grams: 5, slug: 'lima' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('platano-macho-al-horno', 'starch', ['latin'], 'all', [
    { grams: 120, slug: 'platano-macho' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed(
    'elote',
    'starch',
    ['latin'],
    [7, 8, 9],
    [
      { grams: 150, slug: 'mazorca-de-maiz' },
      { grams: 5, slug: 'lima' },
      { grams: 0.5, slug: 'cayena-molida' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'curtido',
    'vegetable',
    ['latin'],
    [9, 10, 11, 12, 1, 2, 3],
    [
      { grams: 100, slug: 'col-blanca' },
      { grams: 30, slug: 'zanahoria' },
      { grams: 15, slug: 'cebolla' },
      { grams: 10, slug: 'vinagre-de-manzana' },
      { grams: 0.5, slug: 'oregano-seco' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'ensalada-de-aguacate',
    'vegetable',
    ['latin'],
    [11, 12, 1, 2, 3, 4],
    [
      { grams: 70, slug: 'aguacate' },
      { grams: 10, slug: 'cebolla-morada' },
      { grams: 3, slug: 'cilantro' },
      { grams: 5, slug: 'lima' },
      { grams: 0.5, slug: 'sal' }
    ]
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
  composed(
    'cuscus',
    'starch',
    ['arab'],
    'all',
    [
      { grams: 50, slug: 'cuscus-crudo' },
      { grams: 0.5, slug: 'sal' }
    ],
    ['lunch']
  ),
  composed(
    'mutabal',
    'vegetable',
    ['arab'],
    [6, 7, 8, 9, 10],
    [
      { grams: 150, slug: 'berenjena' },
      { grams: 10, slug: 'tahini' },
      { grams: 5, slug: 'limon' },
      { grams: 2, slug: 'ajo' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed('ensalada-de-zanahoria-marroqui', 'vegetable', ['arab'], 'all', [
    { grams: 120, slug: 'zanahoria' },
    { grams: 10, slug: 'limon' },
    { grams: 0.5, slug: 'comino-molido' },
    { grams: 5, slug: 'perejil' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed('ensalada-de-remolacha', 'vegetable', ['arab'], 'all', [
    { grams: 120, slug: 'remolacha-cocida' },
    { grams: 5, slug: 'limon' },
    { grams: 0.5, slug: 'comino-molido' },
    { grams: 5, slug: 'perejil' },
    { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 0.5, slug: 'sal' }
  ]),
  composed(
    'naranja-con-canela',
    'dessert',
    ['arab'],
    [11, 12, 1, 2, 3, 4, 5],
    [
      { grams: 130, slug: 'naranja' },
      { grams: 1, slug: 'canela-molida' }
    ]
  )
];

/**
 * What a portion or a set carries of the two groups the table asks for by the
 * day rather than by the fortnight (`0087`): vegetables in grams, fruit in
 * portions. Read off the catalogue once, where the catalogue is already at hand
 * (`larderFor`), so the day's search can price a side's vegetables without a
 * catalogue lookup inside its hot loop.
 */
export type AccompanimentGroups = {
  /** Cereal, dry, whole or refined — what the whole-grain share is measured against. */
  readonly cerealDryG: number;
  readonly fruitPortions: number;
  readonly vegetablesG: number;
  /** The part of `cerealDryG` that is whole grain. */
  readonly wholeDryG: number;
};

/** One accompaniment at one portion, with what it carries. */
export type AccompanimentPortion = {
  readonly accompaniment: Accompaniment;
  readonly grams: number;
  /** Its vegetables and fruit, for `0087`'s two rules — see `AccompanimentGroups`. */
  readonly groups: AccompanimentGroups;
  readonly items: readonly AccompanimentItem[];
  /** Rounded to a tenth, as `scaleMacros` rounds a plate. */
  readonly macros: Macros;
};

/** What goes beside one plate: nothing, or one portion of up to three accompaniments, one per role. */
export type AccompanimentSet = {
  /** Its portions' vegetables and fruit, summed — see `AccompanimentGroups`. */
  readonly groups: AccompanimentGroups;
  /** Every row of every portion, in role order — what enters `meal.ingredients`. */
  readonly items: readonly AccompanimentItem[];
  /** Summed from the portions' rounded macros, so a plate plus its set adds as the plan adds. */
  readonly macros: Macros;
  readonly portions: readonly AccompanimentPortion[];
};

export const NO_ACCOMPANIMENT: AccompanimentSet = {
  groups: { cerealDryG: 0, fruitPortions: 0, vegetablesG: 0, wholeDryG: 0 },
  items: [],
  macros: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 },
  portions: []
};

/**
 * Whoever is eating: what the gate, their way of eating and their dislikes allow.
 *
 * Generation, a swap and an event rebuild all hand `larderFor` the
 * `GenerationContext` itself — its `preferences` and `safety` as
 * `RecipeController.generationContext` merged them (free-from, supplements and
 * unresolved allergies included), never a fresh `resolvePreferences` — so
 * `pan-sin-gluten` reaches only the people it is for.
 */
export type AccompanimentDiner = {
  readonly catalogue: Catalogue;
  readonly preferences: Pick<PreferenceExclusions, 'excludedIngredientIds' | 'keepsMeatFromDairy' | 'refusesForeignDishes'>;
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
 *
 * Whoever refuses foreign dishes (`traditional_spanish`, `0077`) is offered no
 * side that only a foreign family serves, whatever its rows: a couscous or an
 * elote holds nothing `0077` lists, and beside a dish of no stated cuisine the
 * dish filter (`breaksPatternDish`) has no family to refuse.
 */
export function larderFor(diner: AccompanimentDiner): Larder {
  const unresolved = bestEffortExclusions(diner.safety.unenforceableLabels, [...diner.catalogue.values()]);
  const portions: AccompanimentPortion[] = [];

  for (const accompaniment of ACCOMPANIMENTS) {
    if (diner.preferences.refusesForeignDishes && isForeignOnly(accompaniment)) {
      continue;
    }

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
        const groups = mealGroups(items, diner.catalogue);

        portions.push({
          accompaniment,
          grams: items.reduce((sum, item) => sum + item.grams, 0),
          groups: {
            cerealDryG: groups.cerealDry,
            fruitPortions: groups.fruitPortions,
            vegetablesG: groups.vegetables,
            wholeDryG: groups.wholeGrainDry
          },
          items,
          macros: scaleMacros(composed.macros, 1)
        });
      }
    }
  }

  return { diner, portions };
}

/** A side only foreign families serve: never one every family shares, nor one a Spanish or Italian table does. */
function isForeignOnly(accompaniment: Accompaniment): boolean {
  return accompaniment.families !== 'all' && accompaniment.families.every(family => FOREIGN_FAMILIES.has(family));
}

/** The fruits a dish may already be carrying, so a fruit dessert is not served beside a fruit plate. */
const FRUIT: ReadonlySet<string> = new Set([
  ...ACCOMPANIMENTS.filter(entry => entry.months === 'catalogue').map(entry => entry.key),
  'arandanos-congelados',
  'chirimoya',
  'ciruela',
  'datiles',
  'frambuesa',
  'frambuesas-congeladas',
  'frutos-rojos-congelados',
  'higo',
  'lichi',
  'mango',
  'mango-congelado',
  'maracuya',
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

/**
 * The groups a portion belongs to. A starch is the plate's starch whatever its
 * grams, so a tabulé (30 g of bulgur) is grains and never goes beside a
 * couscous. Any other side takes the dish's threshold (`FOOD_GROUP_GRAMS`,
 * through `dishGroups`; a portion is one serving): a few grams of noodles in a
 * broth do not make it pasta.
 */
function itemGroups(portion: AccompanimentPortion): ReadonlySet<FoodGroup> {
  if (portion.accompaniment.role === 'starch') {
    return new Set(portion.items.map(item => foodGroupOf(item.slug)).filter((group): group is FoodGroup => group !== null));
  }

  return dishGroups({ ingredients: portion.items });
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
    const own = itemGroups(portion);

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
 * What the scheduler and a swap both read. `keep`, when given, narrows the
 * portions before they are combined (the scheduler's per-role pruning, 018
 * phase 3); it must return a subset, in table order.
 */
export function setsBeside(
  larder: Larder,
  dish: {
    readonly cuisine?: string | null;
    readonly ingredients: readonly { readonly grams: number; readonly slug: string }[];
    readonly servings: number;
  },
  slot: MealSlot,
  month: number,
  keep: (portions: readonly AccompanimentPortion[]) => readonly AccompanimentPortion[] = portions => portions
): readonly AccompanimentSet[] {
  const { catalogue, preferences } = larder.diner;

  return setsOf(keep(portionsBeside(larder, dish, slot, month))).filter(
    set => !breaksDishRule([...dish.ingredients, ...set.items], catalogue, preferences)
  );
}

function toSet(portions: readonly AccompanimentPortion[]): AccompanimentSet {
  if (portions.length === 0) {
    return NO_ACCOMPANIMENT;
  }

  const sum = (key: keyof Macros): number => Math.round(portions.reduce((total, portion) => total + portion.macros[key] * 10, 0)) / 10;

  return {
    groups: {
      cerealDryG: portions.reduce((total, portion) => total + portion.groups.cerealDryG, 0),
      fruitPortions: portions.reduce((total, portion) => total + portion.groups.fruitPortions, 0),
      vegetablesG: portions.reduce((total, portion) => total + portion.groups.vegetablesG, 0),
      wholeDryG: portions.reduce((total, portion) => total + portion.groups.wholeDryG, 0)
    },
    items: portions.flatMap(portion => portion.items),
    macros: { carbsG: sum('carbsG'), fatG: sum('fatG'), fiberG: sum('fiberG'), kcal: sum('kcal'), proteinG: sum('proteinG') },
    portions
  };
}

/**
 * What the screen calls a composed accompaniment, by locale (`es-ES` the
 * fallback, as for every name). A simple one is its food, and is called what
 * the catalogue calls that food in the reader's language.
 */
const COMPOSED_NAMES: Readonly<Record<string, Readonly<Record<'en-GB' | 'es-ES', string>>>> = {
  'acelgas-rehogadas': { 'en-GB': 'Sautéed Swiss chard', 'es-ES': 'Acelgas rehogadas' },
  'alcachofas-a-la-plancha': { 'en-GB': 'Griddled artichokes', 'es-ES': 'Alcachofas a la plancha' },
  'arroz-blanco': { 'en-GB': 'Plain rice', 'es-ES': 'Arroz blanco' },
  'arroz-jazmin': { 'en-GB': 'Jasmine rice', 'es-ES': 'Arroz jazmín' },
  'arroz-rojo': { 'en-GB': 'Mexican red rice', 'es-ES': 'Arroz rojo' },
  'brocoli-salteado': { 'en-GB': 'Sautéed broccoli', 'es-ES': 'Brócoli salteado' },
  'champinones-al-ajillo': { 'en-GB': 'Garlic mushrooms', 'es-ES': 'Champiñones al ajillo' },
  'coliflor-al-ajoarriero': { 'en-GB': 'Cauliflower with garlic and paprika', 'es-ES': 'Coliflor al ajoarriero' },
  'crema-de-calabacin': { 'en-GB': 'Courgette soup', 'es-ES': 'Crema de calabacín' },
  'crema-de-calabaza': { 'en-GB': 'Pumpkin soup', 'es-ES': 'Crema de calabaza' },
  'crema-de-puerros': { 'en-GB': 'Leek and potato soup', 'es-ES': 'Crema de puerros' },
  curtido: { 'en-GB': 'Curtido (pickled cabbage slaw)', 'es-ES': 'Curtido' },
  cuscus: { 'en-GB': 'Couscous', 'es-ES': 'Cuscús' },
  edamame: { 'en-GB': 'Edamame', 'es-ES': 'Edamame' },
  elote: { 'en-GB': 'Corn on the cob with lime and chilli', 'es-ES': 'Elote' },
  'ensalada-de-aguacate': { 'en-GB': 'Avocado salad', 'es-ES': 'Ensalada de aguacate' },
  'ensalada-de-invierno': { 'en-GB': 'Winter salad', 'es-ES': 'Ensalada de invierno' },
  'ensalada-de-pepino': { 'en-GB': 'Cucumber salad', 'es-ES': 'Ensalada de pepino' },
  'ensalada-de-remolacha': { 'en-GB': 'Beetroot salad', 'es-ES': 'Ensalada de remolacha' },
  'ensalada-de-zanahoria-marroqui': { 'en-GB': 'Moroccan carrot salad', 'es-ES': 'Ensalada de zanahoria a la marroquí' },
  'ensalada-marroqui': { 'en-GB': 'Moroccan salad', 'es-ES': 'Ensalada marroquí' },
  'ensalada-mixta': { 'en-GB': 'Mixed salad', 'es-ES': 'Ensalada mixta' },
  'ensalada-verde': { 'en-GB': 'Green salad', 'es-ES': 'Ensalada verde' },
  escalivada: { 'en-GB': 'Catalan roasted vegetables', 'es-ES': 'Escalivada' },
  'esparragos-trigueros-a-la-plancha': { 'en-GB': 'Griddled green asparagus', 'es-ES': 'Espárragos trigueros a la plancha' },
  'espinacas-a-la-catalana': { 'en-GB': 'Catalan spinach with raisins and pine nuts', 'es-ES': 'Espinacas a la catalana' },
  'espinacas-con-sesamo': { 'en-GB': 'Sesame spinach', 'es-ES': 'Espinacas con sésamo' },
  frijoles: { 'en-GB': 'Black beans', 'es-ES': 'Frijoles' },
  gazpacho: { 'en-GB': 'Gazpacho', 'es-ES': 'Gazpacho' },
  'insalata-mista': { 'en-GB': 'Insalata mista', 'es-ES': 'Insalata mista' },
  'judias-verdes-rehogadas': { 'en-GB': 'Sautéed green beans', 'es-ES': 'Judías verdes rehogadas' },
  macedonia: { 'en-GB': 'Fruit salad', 'es-ES': 'Macedonia de fruta' },
  'menestra-de-verduras': { 'en-GB': 'Mixed vegetable menestra', 'es-ES': 'Menestra de verduras' },
  mutabal: { 'en-GB': 'Moutabal', 'es-ES': 'Mutabal' },
  'naranja-con-canela': { 'en-GB': 'Orange with cinnamon', 'es-ES': 'Naranja con canela' },
  'pak-choi-salteado': { 'en-GB': 'Stir-fried pak choi', 'es-ES': 'Pak choi salteado' },
  'pan-con-tomate': { 'en-GB': 'Bread with tomato', 'es-ES': 'Pan con tomate' },
  'patata-cocida': { 'en-GB': 'Boiled potatoes', 'es-ES': 'Patata cocida' },
  'pico-de-gallo': { 'en-GB': 'Pico de gallo', 'es-ES': 'Pico de gallo' },
  'pimientos-asados': { 'en-GB': 'Roasted red peppers', 'es-ES': 'Pimientos asados' },
  'platano-macho-al-horno': { 'en-GB': 'Baked plantain', 'es-ES': 'Plátano macho al horno' },
  'pure-de-patata': { 'en-GB': 'Mashed potato', 'es-ES': 'Puré de patata' },
  salmorejo: { 'en-GB': 'Salmorejo', 'es-ES': 'Salmorejo' },
  'sopa-de-miso': { 'en-GB': 'Miso soup', 'es-ES': 'Sopa de miso' },
  tabule: { 'en-GB': 'Tabbouleh', 'es-ES': 'Tabulé' },
  'tomate-alinado': { 'en-GB': 'Dressed tomatoes', 'es-ES': 'Tomate aliñado' },
  'verduras-a-la-plancha': { 'en-GB': 'Grilled vegetables', 'es-ES': 'Verduras a la plancha' },
  'yogur-con-miel': { 'en-GB': 'Yoghurt with honey', 'es-ES': 'Yogur con miel' },
  'yuca-con-mojo': { 'en-GB': 'Cassava with garlic and lime', 'es-ES': 'Yuca con mojo' },
  'zanahorias-alinadas': { 'en-GB': 'Marinated carrots', 'es-ES': 'Zanahorias aliñadas' }
};

/**
 * How a composed accompaniment is made, one practical sentence per locale,
 * fixed here and never asked of a model (016 phase 6). Each line uses exactly
 * the foods its portion lists, and the oil it lists — a teaspoon is its 5 g,
 * two are the gazpacho's 10 g — and no more. A simple one is a food served as
 * it comes, and has none.
 */
const COMPOSED_PREPARATIONS: Readonly<Record<string, Readonly<Record<'en-GB' | 'es-ES', string>>>> = {
  'acelgas-rehogadas': {
    'en-GB':
      'Boil the chopped chard in water with the salt for about 6 minutes, drain and sauté with the sliced garlic and a teaspoon of oil; take off the heat and dust with the paprika.',
    'es-ES':
      'Cuece las acelgas troceadas en agua con la sal unos 6 minutos, escúrrelas y rehógalas con el ajo laminado y una cucharadita de aceite; aparta del fuego y espolvorea el pimentón.'
  },
  'alcachofas-a-la-plancha': {
    'en-GB':
      'Trim the artichokes down to their hearts, halve them, rub them with the lemon and griddle them with a teaspoon of oil for about 8 minutes a side; salt at the end.',
    'es-ES':
      'Limpia las alcachofas hasta dejar los corazones, pártelos por la mitad, frótalos con el limón y hazlos a la plancha con una cucharadita de aceite unos 8 minutos por lado; sala al final.'
  },
  'arroz-blanco': {
    'en-GB': 'Rinse the rice, simmer it covered in twice its volume of salted water for about 15 minutes and let it rest for 5.',
    'es-ES': 'Lava el arroz, cuécelo tapado en el doble de su volumen de agua con la sal unos 15 minutos y déjalo reposar 5.'
  },
  'arroz-jazmin': {
    'en-GB':
      'Rinse the rice, cook it covered in one and a half times its volume of water over the lowest heat for about 12 minutes and let it rest for 10.',
    'es-ES': 'Lava el arroz, cuécelo tapado con vez y media su volumen de agua a fuego mínimo unos 12 minutos y déjalo reposar 10.'
  },
  'arroz-rojo': {
    'en-GB':
      'Soften the onion and garlic in a teaspoon of oil, stir in the rice and tomato, add twice the water and the salt and simmer covered for about 15 minutes.',
    'es-ES':
      'Sofríe la cebolla y el ajo con una cucharadita de aceite, añade el arroz y el tomate, cubre con el doble de agua, sala y cuécelo tapado unos 15 minutos.'
  },
  'brocoli-salteado': {
    'en-GB':
      'Cut the broccoli into florets and sauté over high heat with the sliced garlic and a teaspoon of oil, adding a splash of water to steam it; salt at the end.',
    'es-ES':
      'Separa el brócoli en ramilletes y saltéalo a fuego vivo con el ajo laminado y una cucharadita de aceite, con un chorrito de agua para que se haga al vapor; sala al final.'
  },
  'champinones-al-ajillo': {
    'en-GB':
      'Sauté the sliced mushrooms over high heat in a teaspoon of oil until golden, add the sliced garlic for one more minute and finish with the chopped parsley and the salt.',
    'es-ES':
      'Saltea los champiñones laminados a fuego vivo con una cucharadita de aceite hasta que se doren, añade el ajo laminado un minuto más y termina con el perejil picado y la sal.'
  },
  'coliflor-al-ajoarriero': {
    'en-GB':
      'Boil the cauliflower florets in water with the salt for about 8 minutes and drain; brown the sliced garlic in a teaspoon of oil, take off the heat, stir in the paprika and vinegar and pour over the cauliflower.',
    'es-ES':
      'Cuece la coliflor en ramilletes en agua con la sal unos 8 minutos y escúrrela; dora el ajo laminado con una cucharadita de aceite, aparta del fuego, añade el pimentón y el vinagre y riega la coliflor.'
  },
  'crema-de-calabacin': {
    'en-GB':
      'Soften the chopped onion in a teaspoon of oil, add the chopped courgette and just enough water to cover, simmer for about 15 minutes, salt and blend until smooth.',
    'es-ES':
      'Rehoga la cebolla picada con una cucharadita de aceite, añade el calabacín troceado y agua justo hasta cubrir, cuécelo unos 15 minutos, sala y tritúralo fino.'
  },
  'crema-de-calabaza': {
    'en-GB':
      'Soften the chopped onion in a teaspoon of oil, add the pumpkin and carrot in chunks and just enough water to cover, simmer for about 20 minutes, salt and blend until smooth.',
    'es-ES':
      'Rehoga la cebolla picada con una cucharadita de aceite, añade la calabaza y la zanahoria en trozos y agua justo hasta cubrir, cuécelo unos 20 minutos, sala y tritúralo fino.'
  },
  'crema-de-puerros': {
    'en-GB':
      'Soften the sliced leek and onion in a teaspoon of oil, add the potato in chunks and just enough water to cover, simmer for about 20 minutes, salt and blend until smooth.',
    'es-ES':
      'Rehoga el puerro y la cebolla en rodajas con una cucharadita de aceite, añade la patata en trozos y agua justo hasta cubrir, cuécelo unos 20 minutos, sala y tritúralo fino.'
  },
  curtido: {
    'en-GB':
      'Finely shred the cabbage, grate the carrot, chop the onion and mix them with the vinegar, the oregano and the salt; leave it in the fridge for at least an hour.',
    'es-ES':
      'Corta la col en juliana fina, ralla la zanahoria, pica la cebolla y mézclalas con el vinagre, el orégano y la sal; déjalo reposar al menos una hora en la nevera.'
  },
  cuscus: {
    'en-GB': 'Put the couscous in a bowl with the salt, pour over the same volume of boiling water, cover for 5 minutes and fluff it with a fork.',
    'es-ES': 'Pon el cuscús en un bol con la sal, cúbrelo con el mismo volumen de agua hirviendo, tápalo 5 minutos y suéltalo con un tenedor.'
  },
  edamame: {
    'en-GB': 'Boil the edamame for about 5 minutes, drain it and sprinkle with the salt.',
    'es-ES': 'Cuece el edamame en agua hirviendo unos 5 minutos, escúrrelo y espolvorea la sal.'
  },
  elote: {
    'en-GB': 'Boil the corn cob for about 10 minutes, or grill it, and serve it with the lime juice, the cayenne and the salt.',
    'es-ES': 'Cuece la mazorca en agua hirviendo unos 10 minutos, o ásala a la plancha, y sírvela con el zumo de lima, la cayena y la sal.'
  },
  'ensalada-de-aguacate': {
    'en-GB': 'Dice the avocado and mix it with the thinly sliced red onion, the chopped coriander, the lime juice and the salt.',
    'es-ES': 'Corta el aguacate en dados y mézclalo con la cebolla morada en juliana fina, el cilantro picado, el zumo de lima y la sal.'
  },
  'ensalada-de-invierno': {
    'en-GB':
      "Segment the orange, grate the carrot, toss both with the lamb's lettuce and dress with a teaspoon of oil, the vinegar and a pinch of salt.",
    'es-ES':
      'Pela la naranja en gajos, ralla la zanahoria, mézclalas con los canónigos y aliña con una cucharadita de aceite, el vinagre y una pizca de sal.'
  },
  'ensalada-de-pepino': {
    'en-GB': 'Slice the cucumber thinly, dress it with the rice vinegar and sprinkle with the sesame.',
    'es-ES': 'Corta el pepino en rodajas finas, alíñalo con el vinagre de arroz y espolvorea el sésamo.'
  },
  'ensalada-de-remolacha': {
    'en-GB': 'Dice the cooked beetroot and dress it with the lemon juice, the cumin, the chopped parsley, a teaspoon of oil and the salt.',
    'es-ES': 'Corta la remolacha cocida en dados y alíñala con el zumo de limón, el comino, el perejil picado, una cucharadita de aceite y la sal.'
  },
  'ensalada-de-zanahoria-marroqui': {
    'en-GB': 'Grate the carrot and dress it with the lemon juice, the cumin, the chopped parsley, a teaspoon of oil and the salt.',
    'es-ES': 'Ralla la zanahoria y alíñala con el zumo de limón, el comino, el perejil picado, una cucharadita de aceite y la sal.'
  },
  'ensalada-marroqui': {
    'en-GB': 'Dice the tomato, cucumber and onion small, add the parsley and dress with the lemon, a teaspoon of oil and the salt.',
    'es-ES': 'Pica en dados pequeños el tomate, el pepino y la cebolla, añade el perejil y aliña con el limón, una cucharadita de aceite y la sal.'
  },
  'ensalada-mixta': {
    'en-GB': 'Chop the lettuce and tomato, add thinly sliced onion and dress with a teaspoon of oil, the vinegar and a pinch of salt.',
    'es-ES': 'Trocea la lechuga y el tomate, añade la cebolla en juliana fina y aliña con una cucharadita de aceite, el vinagre y una pizca de sal.'
  },
  'ensalada-verde': {
    'en-GB': 'Wash and tear the lettuce, add thinly sliced onion and dress with a teaspoon of oil, the vinegar and a pinch of salt.',
    'es-ES': 'Lava y trocea la lechuga, añade la cebolla en juliana fina y aliña con una cucharadita de aceite, el vinagre y una pizca de sal.'
  },
  escalivada: {
    'en-GB':
      'Roast the whole aubergine, pepper and onion at 200 °C for about 45 minutes, peel them, cut them into strips and dress with a teaspoon of oil and the salt.',
    'es-ES':
      'Asa la berenjena, el pimiento y la cebolla enteros en el horno a 200 °C unos 45 minutos, pélalos, córtalos en tiras y alíñalos con una cucharadita de aceite y la sal.'
  },
  'esparragos-trigueros-a-la-plancha': {
    'en-GB':
      'Snap off the woody ends, brush the asparagus with a teaspoon of oil and cook on a very hot griddle for about 5 minutes, turning them; salt at the end.',
    'es-ES':
      'Quita la parte dura de los espárragos, úntalos con una cucharadita de aceite y hazlos a la plancha bien caliente unos 5 minutos, dándoles la vuelta; sala al final.'
  },
  'espinacas-a-la-catalana': {
    'en-GB': 'Toast the pine nuts and sliced garlic in a teaspoon of oil, add the raisins and the spinach and stir until it wilts; salt at the end.',
    'es-ES':
      'Dora los piñones y el ajo laminado con una cucharadita de aceite, añade las pasas y las espinacas y saltéalas hasta que pierdan volumen; sala al final.'
  },
  'espinacas-con-sesamo': {
    'en-GB': 'Blanch the spinach for a minute, cool it in cold water, squeeze it dry and dress it with the soy sauce and the toasted sesame.',
    'es-ES': 'Escalda las espinacas un minuto, enfríalas en agua fría, escúrrelas apretando bien y alíñalas con la salsa de soja y el sésamo tostado.'
  },
  frijoles: {
    'en-GB': 'Warm the beans with the chopped onion and garlic and a splash of water for about 10 minutes, mash some of them and add the salt.',
    'es-ES': 'Calienta las alubias con la cebolla y el ajo picados y un chorrito de agua unos 10 minutos, aplasta una parte y sala.'
  },
  gazpacho: {
    'en-GB': 'Blend the tomato, cucumber, pepper and garlic with two teaspoons of oil, the vinegar and the salt, strain and serve well chilled.',
    'es-ES': 'Tritura el tomate, el pepino, el pimiento y el ajo con dos cucharaditas de aceite, el vinagre y la sal, cuélalo y sírvelo bien frío.'
  },
  'insalata-mista': {
    'en-GB':
      'Tear the lettuce, halve the cherry tomatoes, grate the carrot and dress with a teaspoon of oil, the balsamic vinegar and a pinch of salt.',
    'es-ES':
      'Trocea la lechuga, parte los tomates cherry por la mitad, ralla la zanahoria y aliña con una cucharadita de aceite, el balsámico y una pizca de sal.'
  },
  'judias-verdes-rehogadas': {
    'en-GB': 'Boil the beans in salted water for about 8 minutes, drain and toss them for a minute with the sliced garlic and a teaspoon of oil.',
    'es-ES': 'Cuece las judías en agua con sal unos 8 minutos, escúrrelas y rehógalas un minuto con el ajo laminado y una cucharadita de aceite.'
  },
  macedonia: {
    'en-GB': 'Chop the peeled orange, the apple and the banana and toss them in a bowl in their own juice.',
    'es-ES': 'Trocea la naranja pelada, la manzana y el plátano y mézclalos en un bol con su propio zumo.'
  },
  'menestra-de-verduras': {
    'en-GB':
      'Boil the frozen vegetables and the sliced carrot in water with the salt for about 8 minutes, drain and toss them for a couple of minutes with the chopped onion and garlic and a teaspoon of oil.',
    'es-ES':
      'Cuece las verduras congeladas y la zanahoria en rodajas en agua con la sal unos 8 minutos, escúrrelas y rehógalas un par de minutos con la cebolla y el ajo picados y una cucharadita de aceite.'
  },
  mutabal: {
    'en-GB':
      'Roast the whole aubergine at 200 °C for about 40 minutes, scoop out the flesh, drain it and mash it with the tahini, the lemon juice, the chopped garlic and the salt.',
    'es-ES':
      'Asa la berenjena entera en el horno a 200 °C unos 40 minutos, saca la pulpa, escúrrela y cháfala con el tahini, el zumo de limón, el ajo picado y la sal.'
  },
  'naranja-con-canela': {
    'en-GB': 'Peel and slice the orange and dust it with the cinnamon.',
    'es-ES': 'Pela la naranja, córtala en rodajas y espolvoréala con la canela.'
  },
  'pak-choi-salteado': {
    'en-GB':
      'Stir-fry the pak choi over high heat with the garlic, grated ginger and a teaspoon of oil for two or three minutes, then finish with the soy sauce.',
    'es-ES':
      'Saltea el pak choi a fuego vivo con el ajo, el jengibre rallado y una cucharadita de aceite dos o tres minutos y termina con la salsa de soja.'
  },
  'pan-con-tomate': {
    'en-GB': 'Toast the bread, spread the crushed tomato over it and finish with a teaspoon of oil and the salt.',
    'es-ES': 'Tuesta el pan, extiende encima el tomate triturado y termina con una cucharadita de aceite y la sal.'
  },
  'patata-cocida': {
    'en-GB': 'Boil the potato in chunks in water with the salt for about 20 minutes, drain and dress with a teaspoon of oil and the chopped parsley.',
    'es-ES': 'Cuece la patata en trozos en agua con la sal unos 20 minutos, escúrrela y alíñala con una cucharadita de aceite y el perejil picado.'
  },
  'pico-de-gallo': {
    'en-GB': 'Finely chop the tomato, onion, jalapeño and coriander and mix them with the lime juice and the salt.',
    'es-ES': 'Pica fino el tomate, la cebolla, el jalapeño y el cilantro y mézclalos con el zumo de lima y la sal.'
  },
  'pimientos-asados': {
    'en-GB':
      'Roast the whole peppers at 200 °C for about 40 minutes, leave them to rest covered, peel them, cut them into strips and dress with the chopped garlic, a teaspoon of oil and the salt.',
    'es-ES':
      'Asa los pimientos enteros en el horno a 200 °C unos 40 minutos, déjalos reposar tapados, pélalos, córtalos en tiras y alíñalos con el ajo picado, una cucharadita de aceite y la sal.'
  },
  'platano-macho-al-horno': {
    'en-GB':
      'Peel the plantain, cut it into thick slices, brush them with a teaspoon of oil and bake at 200 °C for about 20 minutes, turning them halfway; salt at the end.',
    'es-ES':
      'Pela el plátano macho, córtalo en rodajas gruesas, úntalas con una cucharadita de aceite y hornéalas a 200 °C unos 20 minutos, dándoles la vuelta a mitad; sala al final.'
  },
  'pure-de-patata': {
    'en-GB':
      'Boil the potato in chunks in water with the salt for about 20 minutes, drain and mash with the warm milk and a teaspoon of oil until smooth.',
    'es-ES':
      'Cuece la patata en trozos en agua con la sal unos 20 minutos, escúrrela y cháfala con la leche caliente y una cucharadita de aceite hasta que quede fina.'
  },
  salmorejo: {
    'en-GB':
      'Blend the tomatoes with the garlic, add the torn bread, let it soak for a few minutes and blend again with two teaspoons of oil and the salt until thick; serve well chilled.',
    'es-ES':
      'Tritura el tomate con el ajo, añade el pan troceado, deja que se empape unos minutos y vuelve a triturar con dos cucharaditas de aceite y la sal hasta que quede espeso; sírvelo bien frío.'
  },
  'sopa-de-miso': {
    'en-GB':
      'Soak the wakame, heat 200 ml of water without letting it boil, dissolve the miso, add the diced tofu and serve with the chopped spring onion.',
    'es-ES': 'Hidrata el wakame, calienta 200 ml de agua sin que hierva, disuelve el miso, añade el tofu en dados y sirve con la cebolleta picada.'
  },
  tabule: {
    'en-GB':
      'Soak the bulgur in hot water for 15 minutes, drain it and mix with the chopped tomato and cucumber, the herbs, the lemon, a teaspoon of oil and the salt.',
    'es-ES':
      'Hidrata el bulgur en agua caliente 15 minutos, escúrrelo y mézclalo con el tomate y el pepino picados, las hierbas, el limón, una cucharadita de aceite y la sal.'
  },
  'tomate-alinado': {
    'en-GB': 'Slice the tomatoes and dress them with the finely chopped garlic and parsley, a teaspoon of oil and the salt.',
    'es-ES': 'Corta el tomate en rodajas y alíñalo con el ajo y el perejil muy picados, una cucharadita de aceite y la sal.'
  },
  'verduras-a-la-plancha': {
    'en-GB': 'Slice the vegetables, brush them with a teaspoon of oil and cook them on a very hot griddle for a few minutes a side; salt at the end.',
    'es-ES':
      'Corta las verduras en láminas, úntalas con una cucharadita de aceite y hazlas a la plancha bien caliente unos minutos por lado; sala al final.'
  },
  'yogur-con-miel': { 'en-GB': 'Serve the yoghurt with the honey drizzled over it.', 'es-ES': 'Sirve el yogur con la miel por encima.' },
  'yuca-con-mojo': {
    'en-GB':
      'Boil the peeled cassava in chunks in water with the salt for about 25 minutes, until tender, drain and pour over the chopped garlic, the lime juice and a teaspoon of oil.',
    'es-ES':
      'Cuece la yuca pelada y en trozos en agua con la sal unos 25 minutos, hasta que esté tierna, escúrrela y riégala con el ajo picado, el zumo de lima y una cucharadita de aceite.'
  },
  'zanahorias-alinadas': {
    'en-GB':
      'Boil the sliced carrots in water with the salt for about 8 minutes, drain and dress with the chopped garlic, cumin, oregano, vinegar and a teaspoon of oil; serve cold.',
    'es-ES':
      'Cuece la zanahoria en rodajas en agua con la sal unos 8 minutos, escúrrela y alíñala con el ajo picado, el comino, el orégano, el vinagre y una cucharadita de aceite; sírvela fría.'
  }
};

/** Whether an accompaniment needs its own name: more than one food, or a food that is not its key. */
export function isComposed(accompaniment: Accompaniment): boolean {
  return accompaniment.portions.some(items => items.length !== 1 || items[0]?.slug !== accompaniment.key);
}

/**
 * An accompaniment's name in the reader's language: a composed one from
 * `COMPOSED_NAMES`, a simple one as the catalogue names its food
 * (`foodName`, already resolved to the locale), and the key as the last resort.
 */
export function accompanimentName(key: string, locale: string, foodName: string | undefined): string {
  const composed = COMPOSED_NAMES[key];

  if (composed) {
    return locale === 'en-GB' ? composed['en-GB'] : composed['es-ES'];
  }

  return foodName ?? key;
}

/**
 * How a composed accompaniment is made, in the reader's language (`es-ES` the
 * fallback); `undefined` for a simple one, or a key the catalogue does not know.
 */
export function accompanimentPreparation(key: string, locale: string): string | undefined {
  const preparation = COMPOSED_PREPARATIONS[key];

  if (!preparation) {
    return undefined;
  }

  return locale === 'en-GB' ? preparation['en-GB'] : preparation['es-ES'];
}

/** One stored row of what goes beside a meal: `MealAccompanimentDraft`. */
export type AccompanimentRow = MealAccompanimentDraft;

/**
 * A scheduled meal's accompaniments as the rows that store them: one per food,
 * in the order they are served, each with its own macros from the catalogue,
 * rounded to the hundredth the column keeps. The meal's own macros stay the
 * whole meal's; these are what the screen breaks it into. Every food must be
 * in the catalogue — the caller has checked (`unresolvedSlugs`) — or this throws.
 */
export function accompanimentRows(accompaniments: readonly ScheduledAccompaniment[] | undefined, catalogue: Catalogue): readonly AccompanimentRow[] {
  const rows: AccompanimentRow[] = [];
  const hundredth = (value: number): number => Math.round(value * 100) / 100;

  for (const accompaniment of accompaniments ?? []) {
    for (const item of accompaniment.ingredients) {
      const ingredient = catalogue.get(item.slug);
      const composed = composeMacros([item], catalogue);

      if (!ingredient || !composed.ok) {
        throw new Error(`Accompaniment ${accompaniment.key} uses ${item.slug}, which the catalogue does not hold`);
      }

      rows.push({
        accompanimentKey: accompaniment.key,
        carbsG: hundredth(composed.macros.carbsG),
        fatG: hundredth(composed.macros.fatG),
        grams: item.grams,
        ingredientId: ingredient.id,
        kcal: hundredth(composed.macros.kcal),
        proteinG: hundredth(composed.macros.proteinG),
        sortOrder: rows.length
      });
    }
  }

  return rows;
}
