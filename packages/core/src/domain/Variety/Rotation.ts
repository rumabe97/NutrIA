import { VARIETY_RULES } from './Variety';

import type { CandidateDish, MealSlot } from 'core/entities/Plan';

/**
 * Distinct dishes a fortnight needs per slot.
 *
 * The bare minimum is `ceil(14 / maxOccurrencesPerPlan)` — seven under the
 * current rules. Asking for exactly that leaves the scheduler no freedom: it
 * must use every dish the maximum number of times, so one protein-dense outlier
 * lands on several days and takes them out of band. The slack is what lets it
 * choose a combination that meets the targets, and it rises with the floor
 * because the thing it protects against is a *fraction* of the pool being
 * rejected, not a fixed count.
 *
 * Lives here, not in the pool builder, because two things need the same number:
 * how many dishes to ask a model for, and how many library dishes to hand one
 * user. Two copies of it would drift.
 */
export const DISHES_NEEDED_PER_SLOT = Math.ceil(14 / VARIETY_RULES.maxOccurrencesPerPlan) + 5;

export type Rotation = {
  /** Slugs this user was served last fortnight. Never offered again. */
  readonly avoidSlugs: ReadonlySet<string>;
  /** Anything stable per user and per plan — the same seed always yields the same pick. */
  readonly seed: string;
};

/** FNV-1a. A string in, a well-mixed 32-bit integer out; enough to seed a generator. */
function hash(seed: string): number {
  let value = 0x811c9dc5;

  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }

  return value >>> 0;
}

/** mulberry32: small, fast, and good enough to shuffle a menu. */
function generator(seed: string): () => number {
  let state = hash(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates over a copy, driven by the seed. Same seed, same order, always. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const copy = [...items];
  const next = generator(seed);

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(next() * (index + 1));

    [copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
  }

  return copy;
}

/**
 * Which library dishes *this* user gets, this fortnight.
 *
 * The scheduler is deterministic and ranks by usage, fit and slug — the order
 * of its pool changes nothing. So two people with a similar profile, handed the
 * same library, were handed the same plan; and the same person's next fortnight
 * began from the same library again. "Everyone gets the same plan" was not the
 * model's doing, it was this step not existing.
 *
 * Three moves, in order:
 *
 * 1. Drop what this user had last fortnight. Repetition across plans is the thing
 *    people notice first, and the pool builder generates the shortfall.
 * 2. Shuffle with a seed built from the user and the plan version, so the pick is
 *    theirs and reproducible, and next fortnight's is a different one.
 * 3. Take up to `perSlot` dishes for each slot — the number a generation would
 *    ask for anyway — so the library's size stops deciding how alike two plans
 *    are. A dish that suits several slots counts towards each.
 *
 * Reuse is still preferred over generation (0006). This decides *which* reuse.
 */
export function rotatePool(
  dishes: readonly CandidateDish[],
  slots: readonly MealSlot[],
  rotation: Rotation,
  perSlot: number = DISHES_NEEDED_PER_SLOT
): CandidateDish[] {
  const shuffled = seededShuffle(dishes.filter(dish => !rotation.avoidSlugs.has(dish.slug)), rotation.seed);
  const taken = new Map<string, CandidateDish>();

  for (const slot of slots) {
    let count = 0;

    for (const dish of shuffled) {
      if (count >= perSlot) {break;}

      if (!dish.slots.includes(slot)) {continue;}

      if (!taken.has(dish.slug)) {taken.set(dish.slug, dish);}

      count += 1;
    }
  }

  return [...taken.values()];
}
