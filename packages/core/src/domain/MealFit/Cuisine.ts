import { normaliseForMatching } from 'core/domain/Safety';
import { toDry } from 'core/domain/Yield';

import type { MealSlot } from 'core/entities/Plan';

/**
 * A dish fits a meal by its cuisine (`0079`, tables 1 and 2).
 *
 * `0062`'s lists say which meals a food belongs to, the same for everybody.
 * They cannot say "rice is a dinner in Asia and a lunch in Spain". So for five
 * food groups — rice, pasta, couscous and the other grains, potato, stewed
 * pulses — a dish's meals are decided here, by the family its stated cuisine
 * belongs to, and the lists are not read for those rows (option B, owner's
 * answer 1). Every other food still follows its list.
 */

/** The six families of Table 1. `other` is judged with the Spanish table. */
export type CuisineFamily = 'arab' | 'asian' | 'italian' | 'latin' | 'other' | 'spanish';

/** The normalised `cuisine` values of Table 1, by family. Anything not here is `other`. */
const FAMILY_VALUES: Readonly<Record<Exclude<CuisineFamily, 'other'>, readonly string[]>> = {
  arab: ['marroqui', 'moroccan', 'magrebi', 'arabe', 'libanesa', 'oriente medio', 'levantina', 'turca'],
  asian: ['asiatica', 'asian', 'oriental', 'china', 'japonesa', 'coreana', 'tailandesa', 'vietnamita', 'india', 'indio', 'indian', 'hawaiana'],
  italian: ['italiana', 'italian'],
  latin: ['mexicana', 'mexican', 'latina', 'peruana', 'venezolana', 'colombiana', 'argentina', 'cubana', 'caribena'],
  spanish: [
    'mediterranea',
    'mediterranean',
    'espanola',
    'spanish',
    'espana',
    'mediterranea espana',
    'mediterranea espana italia',
    'griega',
    'greek',
    'tapa',
    'vasca',
    'riojana',
    'gallega',
    'madrilena',
    'valenciana',
    'catalana',
    'asturiana',
    'aragonesa',
    'manchega',
    'andaluza',
    'castellana',
    'extremena',
    'canaria',
    'murciana',
    'navarra',
    'cantabra',
    'leonesa'
  ]
};

const FAMILY_OF: ReadonlyMap<string, CuisineFamily> = new Map(
  (Object.entries(FAMILY_VALUES) as [CuisineFamily, readonly string[]][]).flatMap(([family, values]) => values.map(value => [value, family] as const))
);

/**
 * The family of a recipe's free-text `cuisine`, normalised exactly as `0077`
 * normalises it. Null, empty and every value nobody mapped is `other` — judged
 * with the Spanish table, the strictest, so a mislabel can only take a meal
 * away from a dish, never give it one.
 */
export function cuisineFamily(cuisine: string | null | undefined): CuisineFamily {
  if (!cuisine) {
    return 'other';
  }

  return FAMILY_OF.get(normaliseForMatching(cuisine)) ?? 'other';
}

/** The five food groups of Table 2. */
export type FoodGroup = 'grains' | 'pasta' | 'potato' | 'pulses' | 'rice';

/** The catalogue rows of each group, as Table 2 lists them against the catalogue (checked 2026-10-02). */
export const FOOD_GROUP_SLUGS: Readonly<Record<FoodGroup, ReadonlySet<string>>> = {
  grains: new Set([
    'amaranto',
    'bulgur-cocido',
    'bulgur-crudo',
    'cebada-cocida',
    'cebada-perlada',
    'cuscus-cocido',
    'cuscus-crudo',
    'espelta-cocida',
    'espelta-en-grano',
    'freekeh',
    'mijo',
    'mijo-cocido',
    'polenta',
    'polenta-cocida',
    'quinoa-cocida',
    'quinoa-cruda',
    'trigo-sarraceno',
    'trigo-sarraceno-cocido'
  ]),
  pasta: new Set([
    'canelones-preparados',
    'espaguetis-secos',
    'fideos-de-arroz-cocidos',
    'fideos-de-arroz-secos',
    'fideos-de-cristal',
    'fideos-finos',
    'fideos-soba',
    'lasana-preparada',
    'macarrones-secos',
    'noodles-de-trigo',
    'noodles-udon',
    'pasta-cocida',
    'pasta-de-garbanzos',
    'pasta-de-lentejas',
    'pasta-fresca-al-huevo',
    'pasta-integral-cocida',
    'pasta-integral-seca',
    'pasta-sin-gluten',
    'placas-de-lasana',
    'ramen-instantaneo',
    'raviolis-frescos',
    'sopa-de-fideos-envasada',
    'tortellini'
  ]),
  potato: new Set(['boniato', 'patata', 'patata-nueva', 'patatas-fritas-congeladas', 'patatas-gajo-congeladas', 'pure-de-patatas-en-copos', 'yuca']),
  // The 23 rows of `seed/ingredients/meals.ts`, rule 1.
  pulses: new Set([
    'alubias-blancas-cocidas',
    'alubias-blancas-secas',
    'alubias-con-verduras-en-lata',
    'alubias-negras-cocidas',
    'alubias-pintas-cocidas',
    'alubias-pintas-secas',
    'azukis',
    'cocido-madrileno-en-lata',
    'fabada-en-lata',
    'garbanzos-cocidos',
    'garbanzos-con-espinacas-en-lata',
    'garbanzos-secos',
    'guisantes-secos-partidos',
    'habas-secas',
    'judia-mungo',
    'judias-rojas-cocidas',
    'judiones',
    'lentejas-cocidas',
    'lentejas-con-chorizo-en-lata',
    'lentejas-rojas-cocidas',
    'lentejas-secas',
    'soja-cocida',
    'soja-en-grano'
  ]),
  rice: new Set([
    'arroz-basmati-cocido',
    'arroz-basmati-crudo',
    'arroz-blanco-cocido',
    'arroz-bomba-crudo',
    'arroz-integral-cocido',
    'arroz-integral-crudo',
    'arroz-jazmin-crudo',
    'arroz-largo-crudo',
    'arroz-negro-crudo',
    'arroz-para-sushi',
    'arroz-salvaje-cocido',
    'arroz-salvaje-crudo',
    'arroz-tres-delicias-congelado',
    'arroz-vaporizado',
    'paella-congelada'
  ])
};

const FOOD_GROUPS = Object.keys(FOOD_GROUP_SLUGS) as readonly FoodGroup[];

/** The group a catalogue row belongs to, or null for every other food. */
export function foodGroupOf(slug: string): FoodGroup | null {
  return FOOD_GROUPS.find(group => FOOD_GROUP_SLUGS[group].has(slug)) ?? null;
}

/**
 * Grams per serving from which a dish belongs to a group (Table 2): two thirds
 * of a plate of rice or pasta, dry (AESAN 60–80 g); 100 g of potato; any
 * amount of a stewed pulse, as `0062` already judged them. Below it the group
 * is an ingredient, not the dish — the spoonful of rice in a soup.
 */
export const FOOD_GROUP_GRAMS: Readonly<Record<FoodGroup, number>> = { grains: 40, pasta: 40, potato: 100, pulses: 0, rice: 40 };

/**
 * The groups a dish belongs to, per serving. A cooked grain reads dry through
 * the `0078` yields (150 g of `arroz-blanco-cocido` is 50 g of rice); any other
 * row counts as stored. An ingredient without grams counts as belonging: the
 * table can only narrow then, never widen by not knowing. `ignore` takes a row
 * out of the reckoning — a pulse for somebody plant-based (`0062` § 4).
 */
export function dishGroups(
  dish: { readonly ingredients: readonly { readonly grams?: number; readonly slug: string }[]; readonly servings?: number },
  ignore: (slug: string) => boolean = () => false
): ReadonlySet<FoodGroup> {
  const grams = new Map<FoodGroup, number>();
  const unknown = new Set<FoodGroup>();
  const servings = dish.servings && dish.servings > 0 ? dish.servings : 1;

  for (const item of dish.ingredients) {
    const group = foodGroupOf(item.slug);

    if (group === null || ignore(item.slug)) {
      continue;
    }

    if (item.grams === undefined) {
      unknown.add(group);
      continue;
    }

    const perServing = (toDry(item.slug, item.grams)?.dryGrams ?? item.grams) / servings;

    grams.set(group, (grams.get(group) ?? 0) + perServing);
  }

  return new Set(FOOD_GROUPS.filter(group => unknown.has(group) || (grams.has(group) && (grams.get(group) ?? 0) >= FOOD_GROUP_GRAMS[group])));
}

const MAINS = ['lunch', 'dinner'] as const satisfies readonly MealSlot[];

/**
 * Table 2: the meals each group may be served at, by family. `other` reads the
 * Spanish row. Supper is in no cell: it is the late snack (`0062`).
 *
 * Italian pasta and rice are lunch only, like Spanish (owner, 2026-10-02,
 * `0079`'s amendment): a real fortnight put an "Italiana" whole-wheat pasta at
 * four dinners and a risotto at a fifth, which is not how the person eats.
 * Asian rice and noodles keep dinner.
 */
const FAMILY_FIT: Readonly<Record<Exclude<CuisineFamily, 'other'>, Readonly<Record<FoodGroup, readonly MealSlot[]>>>> = {
  arab: { grains: ['lunch'], pasta: ['lunch'], potato: MAINS, pulses: ['lunch'], rice: ['lunch'] },
  asian: { grains: MAINS, pasta: MAINS, potato: MAINS, pulses: MAINS, rice: ['morning_snack', 'lunch', 'afternoon_snack', 'dinner'] },
  italian: { grains: MAINS, pasta: ['lunch'], potato: MAINS, pulses: MAINS, rice: ['lunch'] },
  latin: { grains: MAINS, pasta: ['lunch'], potato: MAINS, pulses: ['breakfast', 'lunch', 'dinner'], rice: MAINS },
  spanish: { grains: ['lunch'], pasta: ['lunch'], potato: ['morning_snack', 'lunch', 'dinner'], pulses: ['lunch'], rice: ['lunch'] }
};

/** Whether a group may be in a dish of this family served at this meal. */
export function groupFits(family: CuisineFamily, group: FoodGroup, slot: MealSlot): boolean {
  return FAMILY_FIT[family === 'other' ? 'spanish' : family][group].includes(slot);
}
