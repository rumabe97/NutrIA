import { composePerServing } from 'core/domain/Composition';

import type { CandidateDish, Catalogue, MealSlot } from 'core/entities/Plan';

/**
 * The most energy one serving of a dish may be designed to, per meal (`0070`).
 *
 * `0047` briefs each dish per serving at the person's own share of the day, and
 * nothing bounded it: a 3,700 kcal day with a large lunch asked one serving of
 * lunch for 2,700 kcal, and the model wrote exactly that — 350 g of dry rice and
 * 55 g of oil as one plate, `servings: 1`, into the library every other person
 * is served from. Four plates declared as one.
 *
 * The figures are the validated seed library's own ceiling, where 500 dishes
 * were designed and tuned by hand to what a person recognises as one plate:
 * lunch and dinner never pass 1,000 kcal there and 95% sit under ~870; breakfast
 * tops out at ~810 (95% under ~700); no snack passes ~450 (95% under ~400).
 * Measured on the dev library, 2026-09-29.
 *
 * A person who eats more is served more servings, not a bigger one: the
 * scheduler scales a portion up to `SERVING_BOUNDS.max` (4), so 900 kcal lunches
 * serve a lunch of up to 3,600 kcal.
 */
export const SERVING_KCAL_CAP: Readonly<Record<MealSlot, number>> = {
  afternoon_snack: 400,
  breakfast: 700,
  dinner: 900,
  lunch: 900,
  morning_snack: 400,
  supper: 400
};

/**
 * How far past its cap a dish the model returned may be before it is refused
 * (`oversized`). The cap is what the prompt asks; a dish is not refused for
 * landing a little over it — the scheduler sizes portions anyway — only for
 * being a pot declared as one plate. Also the line the stored library was
 * repaired at (migration `0047`).
 */
export const OVERSIZED_FACTOR = 1.5;

/**
 * The cap of a dish served at several meals: the largest of theirs. A dish that
 * may be a lunch may be the size of one.
 */
export function servingCap(slots: readonly MealSlot[]): number {
  return Math.max(...slots.map(slot => SERVING_KCAL_CAP[slot]));
}

/**
 * What to multiply a brief of `kcal` per serving by so one serving stays at its
 * meal's cap: 1 when it already does. One factor for energy, protein,
 * carbohydrate, fat and fibre alike, so the split `0047` asks for is kept
 * exactly — only the plate gets smaller.
 */
export function servingFactor(kcal: number, slot: MealSlot): number {
  const cap = SERVING_KCAL_CAP[slot];

  return kcal > cap ? cap / kcal : 1;
}

/**
 * Whether one serving of a dish is past `OVERSIZED_FACTOR` times its meals'
 * cap, composed from the catalogue by the same arithmetic as every other
 * figure (`composePerServing`). A dish whose slugs the catalogue does not know
 * is not judged here: that is the catalogue gate's refusal, not this one's.
 */
export function isOversized(dish: Pick<CandidateDish, 'ingredients' | 'servings' | 'slots'>, catalogue: Catalogue): boolean {
  const composed = composePerServing(dish, catalogue);

  return composed.ok && composed.macros.kcal > servingCap(dish.slots) * OVERSIZED_FACTOR;
}
