// Straight to the file, not 'core/domain/MealFit': see `Starch.ts`.
import { FOOD_GROUP_SLUGS } from '../MealFit/Cuisine';

import type { KindCheck, KindRule } from './Kinds';
import type { CandidateDish } from 'core/entities/Plan';

/**
 * Which legume a dish is a dish *of*, read from its stewed pulses (`0079`'s
 * `pulses` group): chickpeas, lentils, white beans, other beans, broad beans,
 * split peas, soya. A tin of cocido is chickpeas, a fabada white beans.
 *
 * Legumes vary (owner, 2026-10-02). AESAN's three or four a week is a floor,
 * so the total is never capped; what was wrong in a real fortnight was the
 * kind — chickpeas at six of fourteen lunches, twice on days running.
 */
const KIND_OF_PULSE: Readonly<Record<string, string>> = {
  'alubias-blancas-cocidas': 'alubias-blancas',
  'alubias-blancas-secas': 'alubias-blancas',
  'alubias-con-verduras-en-lata': 'alubias-blancas',
  'alubias-negras-cocidas': 'otras-alubias',
  'alubias-pintas-cocidas': 'otras-alubias',
  'alubias-pintas-secas': 'otras-alubias',
  azukis: 'otras-alubias',
  'cocido-madrileno-en-lata': 'garbanzos',
  'fabada-en-lata': 'alubias-blancas',
  'garbanzos-cocidos': 'garbanzos',
  'garbanzos-con-espinacas-en-lata': 'garbanzos',
  'garbanzos-secos': 'garbanzos',
  'guisantes-secos-partidos': 'guisantes',
  'habas-secas': 'habas',
  'judia-mungo': 'otras-alubias',
  'judias-rojas-cocidas': 'otras-alubias',
  judiones: 'alubias-blancas',
  'lentejas-cocidas': 'lentejas',
  'lentejas-con-chorizo-en-lata': 'lentejas',
  'lentejas-rojas-cocidas': 'lentejas',
  'lentejas-secas': 'lentejas',
  'soja-cocida': 'soja',
  'soja-en-grano': 'soja'
};

/** The legume a pulse row is, or null for a row outside `0079`'s pulses. */
export function pulseKind(slug: string): string | null {
  return FOOD_GROUP_SLUGS.pulses.has(slug) ? (KIND_OF_PULSE[slug] ?? slug) : null;
}

type Dish = { readonly ingredients: readonly { readonly grams?: number; readonly slug: string }[] };

/** The kind of the dish's heaviest pulse — any amount, as `0062` and `0079` judge a pulse — or null for a dish with none. */
export function legumeKind(dish: Dish): string | null {
  let kind: string | null = null;
  let most = -1;

  for (const item of dish.ingredients) {
    const pulse = pulseKind(item.slug);
    const grams = item.grams ?? Number.POSITIVE_INFINITY;

    if (pulse !== null && grams > most) {
      kind = pulse;
      most = grams;
    }
  }

  return kind;
}

/**
 * **The same legume three times a fortnight at most, never on two days
 * running** (owner, 2026-10-02; plan 017 phase 2). The same dish is held to
 * twice a fortnight by `VARIETY_RULES` as ever.
 *
 * The three is held like the starches' four (`0082`, `legumeCapCheck`): the
 * scheduler serves no fourth while another dish keeps the day as close to its
 * macros. The days running stay priced, like the other kind rules.
 */
export const LEGUME_RULES = { apart: true, perFortnight: 3 } as const satisfies KindRule;

/** Each pool dish's legume, by slug. */
export function legumeIndex(dishes: readonly Pick<CandidateDish, 'ingredients' | 'slug'>[]): ReadonlyMap<string, string | null> {
  return new Map(dishes.map(dish => [dish.slug, legumeKind(dish)]));
}

/** `LEGUME_RULES` as the scheduler applies it; a placement's own legume is read first (`Placement.legume`). */
export function legumeCheck(index: ReadonlyMap<string, string | null>): KindCheck {
  return { index, named: placement => placement.legume, rule: LEGUME_RULES };
}

/** `LEGUME_RULES`' cap alone — the part the scheduler holds (`0082`); its days running are `legumeCheck`'s, priced. */
export function legumeCapCheck(index: ReadonlyMap<string, string | null>): KindCheck {
  return { index, named: placement => placement.legume, rule: { apart: false, perFortnight: LEGUME_RULES.perFortnight } };
}
