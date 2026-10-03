import { proteinKind } from './Protein';

import type { KindCheck, KindRule } from './Kinds';
import type { CandidateDish, Catalogue, MealSlot } from 'core/entities/Plan';

/** The snacks: mid-morning, afternoon and the late one (`0062`). */
export const SNACK_KIND_SLOTS: ReadonlySet<MealSlot> = new Set(['morning_snack', 'afternoon_snack', 'supper']);

/** Aisles that never name a snack: the fruit beside the yoghurt, the water in the shake. */
const NOT_A_BASE = new Set(['beverages', 'produce']);

const YOGHURT = /^(yogur|skyr|kefir|cuajada)/;
const FRESH_CHEESE = /^(requeson|queso-cottage|queso-batido|queso-de-burgos|queso-fresco)/;

/**
 * What kind of snack a dish is, by its main ingredient (owner, 2026-10-02): a
 * yoghurt cup, a fresh cheese, something on bread, an egg, a tin of tuna.
 *
 * The main ingredient is the heaviest one outside the fruit and vegetable and
 * drinks aisles — the fruit on a yoghurt changes, the cup is the same. Every
 * yoghurt, skyr and kefir is one kind, so is every fresh cheese and every
 * bread, toast or cracker; anything else is named by its protein kind
 * (`proteinKind`), or by its slug's first word. A real fortnight served six
 * "different" protein-yoghurt cups on fourteen mornings. Null for a dish with
 * nothing outside those aisles.
 */
export function snackKind(dish: Pick<CandidateDish, 'ingredients'>, catalogue: Catalogue): string | null {
  let main: string | null = null;
  let most = 0;

  for (const item of dish.ingredients) {
    const category = catalogue.get(item.slug)?.category;

    if (category === undefined || NOT_A_BASE.has(category) || item.grams <= most) {
      continue;
    }

    main = item.slug;
    most = item.grams;
  }

  if (main === null) {
    return null;
  }

  if (YOGHURT.test(main)) {
    return 'yogur';
  }

  if (FRESH_CHEESE.test(main)) {
    return 'queso-fresco';
  }

  return catalogue.get(main)?.category === 'bakery' ? 'pan' : proteinKind(main, catalogue);
}

/** **The same kind of snack three times a fortnight at most** (owner, 2026-10-02; plan 017 phase 2). Priced like `STARCH_RULES`. */
export const SNACK_RULES = { apart: false, perFortnight: 3 } as const satisfies KindRule;

/** `SNACK_RULES` as the scheduler applies it: only the snacks count, read from the pool. */
export function snackCheck(dishes: readonly Pick<CandidateDish, 'ingredients' | 'slug'>[], catalogue: Catalogue): KindCheck {
  return { index: new Map(dishes.map(dish => [dish.slug, snackKind(dish, catalogue)])), rule: SNACK_RULES, slots: SNACK_KIND_SLOTS };
}
