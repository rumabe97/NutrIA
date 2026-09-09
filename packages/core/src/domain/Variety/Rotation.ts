import { normaliseForMatching } from 'core/domain/Safety';
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

/**
 * The share of every slot's pool that is written fresh for this plan, whatever
 * the library could fill ([`0013`](../../../../docs/decisions/0013-a-third-of-every-plan-is-fresh.md)).
 *
 * Reuse-first ([`0006`](../../../../docs/decisions/0006-reuse-before-generating.md))
 * with a library of a hundred dishes shared by every user means every user eats
 * from the same hundred. Rotation ([`0009`](../../../../docs/decisions/0009-rotate-reuse-per-user.md))
 * keeps one person from repeating their own fortnight; it cannot make two people's
 * plans differ when both are drawn from the same shelf. The only thing that does
 * is dishes that did not exist before this plan — and each one joins the library,
 * so the shelf grows with every plan instead of with none.
 *
 * A third, not a half: the scheduler spreads a pool evenly, so a third of the
 * pool is close to a third of the fortnight, and one model call per plan is what
 * the free tier can carry. The owner chose the fraction.
 *
 * A preference, like every variety rule: when the provider is out, the library
 * fills the whole pool and the plan is delivered anyway.
 */
export const FRESH_SHARE = 1 / 3;

/** Dishes per slot the model is always asked for — the pool's fresh floor. */
export const FRESH_DISHES_PER_SLOT = Math.ceil(DISHES_NEEDED_PER_SLOT * FRESH_SHARE);

/** Dishes per slot the library may contribute: the rest. */
export const REUSED_DISHES_PER_SLOT = DISHES_NEEDED_PER_SLOT - FRESH_DISHES_PER_SLOT;

export type Rotation = {
  /** Slugs this user was served last fortnight, and dishes they disliked. Never offered. */
  readonly avoidSlugs: ReadonlySet<string>;
  /**
   * Kitchens they chose. A dish of one goes to the front of the pick — never
   * to the exclusion of the rest, because a fortnight of one cuisine is not
   * what "prefiero mediterránea" asks for, and a library short of it would
   * otherwise cost them a plan (0026).
   */
  readonly preferCuisines?: ReadonlySet<string>;
  /** Foods they said they like, as catalogue slugs. A dish that uses one goes to the front. */
  readonly preferIngredientSlugs?: ReadonlySet<string>;
  /**
   * Dishes this user asked to see again. They go to the front of the pick, so a
   * favourite is in the pool whenever the library may offer it — still never
   * from last fortnight, which is what `avoidSlugs` says.
   */
  readonly preferSlugs?: ReadonlySet<string>;
  /** Anything stable per user and per plan — the same seed always yields the same pick. */
  readonly seed: string;
};

/** The three reasons a dish goes to the front of the pick. */
export type Leaning = {
  readonly preferCuisines?: ReadonlySet<string>;
  readonly preferIngredientSlugs?: ReadonlySet<string>;
  readonly preferSlugs?: ReadonlySet<string>;
};

/**
 * Whether the library should offer this dish before the others: they asked for
 * it by name, it comes from a kitchen they chose, or it uses something they
 * said they like.
 *
 * One function so the plan's rotation and a single swap agree about what
 * "prefers" means, and so a fourth reason can be added in one place.
 */
export function isPreferredDish(dish: CandidateDish, rotation: Leaning): boolean {
  if (rotation.preferSlugs?.has(dish.slug)) {return true;}

  if (dish.cuisine && rotation.preferCuisines?.has(normaliseForMatching(dish.cuisine))) {return true;}

  return dish.ingredients.some(item => rotation.preferIngredientSlugs?.has(item.slug) ?? false);
}

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
  perSlot: number = REUSED_DISHES_PER_SLOT
): CandidateDish[] {
  const eligible = seededShuffle(dishes.filter(dish => !rotation.avoidSlugs.has(dish.slug)), rotation.seed);
  // A stable partition: what they lean towards first in its shuffled order, then
  // the rest in theirs. Never a filter — the tail is still there, so a thin
  // library or a narrow taste costs variety, never a plan.
  const shuffled = [...eligible.filter(dish => isPreferredDish(dish, rotation)), ...eligible.filter(dish => !isPreferredDish(dish, rotation))];
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
