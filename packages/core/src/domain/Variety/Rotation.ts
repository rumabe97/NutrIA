import { normaliseForMatching } from 'core/domain/Safety';

import type { Appliance } from 'core/entities/Kitchen';
import type { CandidateDish, MealSlot } from 'core/entities/Plan';

/** Days a plan covers: the number of picks each slot has to fill. */
const PLAN_DAYS = 14;

/**
 * Distinct dishes a fortnight needs per slot.
 *
 * One per day, plus slack.
 *
 * It used to be `ceil(14 / maxOccurrencesPerPlan)` — seven — on the reasoning
 * that a dish may be served twice. That is what the *rules* allow, not what
 * anybody wants: twelve dishes against fourteen days made two repeats per slot
 * an arithmetic certainty rather than a scheduler's choice, and users said so.
 * Fourteen is the number that lets a fortnight be fourteen different dinners.
 *
 * The slack on top is what lets the scheduler choose a combination that meets
 * the targets instead of being forced into one: without it, one protein-dense
 * outlier lands on several days and takes them out of band.
 *
 * Read by the pool builder as the total the model's shortfall is measured
 * against (`needPerSlot`) — not, any more, as the library rotation's own cap;
 * see `REUSED_DISHES_PER_SLOT`.
 */
export const DISHES_NEEDED_PER_SLOT = PLAN_DAYS + 5;

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

/**
 * Dishes per slot the model is always asked for — the pool's fresh floor.
 *
 * `PoolBuilder` applies this as a floor on the shortfall it computes
 * (`max(FRESH_DISHES_PER_SLOT, needPerSlot - libraryDishesOnHand)`), not only
 * as the library rotation's complement any more — see `REUSED_DISHES_PER_SLOT`'s
 * own note. Its value is unchanged by that: `ceil(19 * 1/3)` is still seven.
 */
export const FRESH_DISHES_PER_SLOT = Math.ceil(DISHES_NEEDED_PER_SLOT * FRESH_SHARE);

/**
 * Dishes per slot the library's rotation may hand over — raised from
 * `DISHES_NEEDED_PER_SLOT - FRESH_DISHES_PER_SLOT` (twelve) to
 * `DISHES_NEEDED_PER_SLOT` itself (nineteen).
 *
 * Twelve gave a scheduler whose objective already favours the best-fitting
 * dish no room to spread: a real fortnight (owner, 2026-09-26, three meals)
 * landed every one of twenty-eight distinct dishes exactly twice, and two
 * whole days identical, on a library rich enough to have handed each slot
 * nineteen distinct dishes and only ever handing over twelve. See
 * [`0065`](../../../../docs/decisions/0065-a-fortnight-is-varied-because-it-is-built-to-be.md).
 *
 * Raising this cap can only let the library contribute *more* — it no longer
 * decides the model's shortfall by subtraction (`PoolBuilder` floors that at
 * `FRESH_DISHES_PER_SLOT` directly), so a rich library asking for zero fresh
 * dishes, which is what "hand the library the whole target" broke before
 * (`0013`'s amendment), cannot happen again by construction: the model is
 * always asked for at least its fixed floor, however much the library hands
 * over first.
 */
const REUSED_DISHES_PER_SLOT = DISHES_NEEDED_PER_SLOT;

/**
 * Dishes a slot keeps for the appliances they would rather cook with (`0102`) —
 * inside `REUSED_DISHES_PER_SLOT`, and after the food groups.
 *
 * **Why a share at all**, when `isPreferredDish` already puts these dishes at
 * the front of the pick: because that front is one bucket for all four
 * leanings, with no rank inside it. Measured on the owner's own fortnight
 * (2026-10-18, an air fryer `prefers` against a library that had just grown 30
 * air-fryer dishes): his four liked cuisines put **548 of his 672 servable
 * dishes** in that bucket, so an air-fryer dish was one in twenty-three of what
 * the cap took — **three reached the pool and none reached a plate**, while the
 * same code with the kitchen as the only leaning put 24 in the pool and 22 on
 * plates. A preference nobody can see is not a preference; the appliance is the
 * one leaning a person reads off the plate, so it gets a floor of its own
 * instead of a place in a queue.
 *
 * **Three quarters of the cap, and that figure is measured twice.** It began as
 * a third — `0013`'s fraction — on a measurement that said the share bought 0
 * plates at zero, 6 at three, 7 at five, 7 at seven and nothing above seven,
 * because the air fryer then held twelve lunches and twelve dinners and the
 * *supply* ran out before the cap did. The second batch (2026-10-18, 280
 * dishes) ended that condition: thirty lunches and thirty dinners. Measured
 * again across 42 fortnights with the sides production serves, raising the first
 * rung costs nothing and buys plates — 877 at seven, 888 at ten, 895 at
 * fourteen, and 895 at nineteen, with **588 of 588 days inside all four macros,
 * 8 rescues and a balance score of 78% at every one of them**, and the fourteen
 * food-group rules moving by at most one fortnight. It saturates at fourteen:
 * past that the person's own library, not the cap, is the limit. Fourteen is
 * therefore where the measurement stops paying and where this sits. The cost
 * of the share is real but it is all spent between zero and seven (fish and
 * shellfish 62% → 55% of fortnights, meat 79% → 67%, processed 90% → 82%),
 * which is `0102`'s own trade and was paid when the share shipped.
 *
 * **It can cost the bands, and then it must give way** (`0102` § *A rescued
 * fortnight has no kitchen, and the share is what sends it there*, 2026-10-18).
 * The share displaces most of a slot's nineteen, and the dishes it displaces
 * may be the ones that were reaching the macros: on the owner's own fortnight
 * the rotation's pool went from 14 of 14 days in band to 12, which is the entry
 * fee to the `wider_rotation` rescue — and a rescued fortnight is scheduled
 * from the whole library, where a share has nothing left to be scarce against.
 * Asking for the appliance returned **fewer** of its dishes than not asking.
 * So this is a **ceiling and not a floor**: `narrowerShares` is the ladder a
 * caller walks down when the bands are missed, and `Rotation.applianceShare`
 * is how it says which rung it is on.
 */
const APPLIANCE_DISHES_PER_SLOT = Math.floor((REUSED_DISHES_PER_SLOT * 3) / 4);

/** How many of a slot's cap this rotation keeps for a preferred appliance: its own rung, or the full share. */
function shareOf(rotation: Rotation): number {
  if (!rotation.preferAppliances || rotation.preferAppliances.size === 0) {
    return 0;
  }

  return Math.max(0, Math.min(rotation.applianceShare ?? APPLIANCE_DISHES_PER_SLOT, APPLIANCE_DISHES_PER_SLOT));
}

/**
 * The shares to try, widest first, when a plan built on this rotation misses a
 * macro band — half the share, then none of it.
 *
 * **Why a gradient and why this order.** The bands outrank a preference
 * (`0045` before `0102`), and the rescue that honours that today replaces the
 * pool with the person's whole library — which costs them the rotation's
 * variety, its avoid list and its food-group reserves, *and* the preference,
 * all at once. Giving up an appliance costs a person less than giving up the
 * rotation, so it is given up first and by degrees. Empty when nobody named an
 * appliance: there is no rung below zero and nothing to walk down.
 */
export function narrowerShares(rotation: Rotation): readonly number[] {
  const share = shareOf(rotation);

  return share <= 0 ? [] : [...new Set([Math.floor(share / 2), 0])].filter(rung => rung < share);
}

/**
 * This rotation on one rung of `narrowerShares`, and the **only** way to build
 * one — so that the bottom rung means the same thing everywhere it is walked to.
 *
 * At zero the appliance stops being a leaning at all rather than merely losing
 * its share: `isPreferredDish` would otherwise keep every dish that needs it at
 * the front of the pick, which is a share by another name and was measured as
 * enough to keep a fortnight out of band. Zero is therefore exactly the pick a
 * kitchen nobody filled in gets — the state that held 14 of 14 days in band on
 * the owner's own fortnight — and the last thing tried before the pool becomes
 * the whole library.
 */
export function withApplianceShare(rotation: Rotation, share: number): Rotation {
  return share <= 0 ? { ...rotation, applianceShare: 0, preferAppliances: new Set() } : { ...rotation, applianceShare: share };
}

/**
 * The dishes a slot takes first, chosen from that slot's dishes in shuffled
 * order, knowing which dishes an earlier slot already took: see `rotatePool`.
 */
export type PoolReserve = (inSlot: readonly CandidateDish[], slot: MealSlot, taken: ReadonlySet<string>) => readonly CandidateDish[];

export type Rotation = {
  /**
   * How many of each slot's cap `preferAppliances` may hold, when it is not
   * the full `APPLIANCE_DISHES_PER_SLOT`.
   *
   * A caller sets it only to walk **down** `narrowerShares` after a plan built
   * on the full share missed a band; it is clamped to the full share, so it can
   * never ask for more of a slot than the measurement allows. Absent — every
   * caller but that one — the share is the full one.
   */
  readonly applianceShare?: number;
  /** Slugs this user was served last fortnight, and dishes they disliked. Never offered. */
  readonly avoidSlugs: ReadonlySet<string>;
  /**
   * Appliances they would rather cook with (`0102`). A dish that needs one goes
   * to the front of the pick **and holds a share of every slot's cap**
   * (`APPLIANCE_DISHES_PER_SLOT`), which the other three leanings do not: the
   * front alone is one bucket they all share, and a person who had named four
   * cuisines saw none of their preferred appliance reach a plate because of it.
   *
   * **It takes nothing out of their library**: `servable` compares `missing`
   * and nothing else, so the library this picks from is the same one with the
   * preference and without it. What it moves is which dishes the per-slot cap
   * takes, and the cap keeps a tail rather than becoming a filter: somebody who
   * prefers an air fryer still eats on the days the library has none, and the
   * share is never taken from what the food groups keep.
   */
  readonly preferAppliances?: ReadonlySet<Appliance>;
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

/** The four reasons a dish goes to the front of the pick. */
export type Leaning = {
  readonly preferAppliances?: ReadonlySet<Appliance>;
  readonly preferCuisines?: ReadonlySet<string>;
  readonly preferIngredientSlugs?: ReadonlySet<string>;
  readonly preferSlugs?: ReadonlySet<string>;
};

/**
 * Whether the library should offer this dish before the others: they asked for
 * it by name, it comes from a kitchen they chose, it uses something they said
 * they like, or it is cooked with an appliance they would rather use.
 *
 * One function so the plan's rotation and a single swap agree about what
 * "prefers" means, and so a fifth reason can be added in one place.
 */
export function isPreferredDish(dish: CandidateDish, rotation: Leaning): boolean {
  if (rotation.preferSlugs?.has(dish.slug)) {
    return true;
  }

  if (dish.cuisine && rotation.preferCuisines?.has(normaliseForMatching(dish.cuisine))) {
    return true;
  }

  // What they would rather cook with (`0102`): a stable partition, so the rest
  // is still behind it and nothing leaves the library (`servable` reads
  // `missing` alone). Being in this bucket is **not** enough on its own — it is
  // one bucket for four leanings, and the measurement in
  // `APPLIANCE_DISHES_PER_SLOT` is what a wide taste does to an appliance
  // inside it — so `rotatePool` also keeps the appliance a share of each cap.
  if (prefersAppliance(dish, rotation)) {
    return true;
  }

  return dish.ingredients.some(item => rotation.preferIngredientSlugs?.has(item.slug) ?? false);
}

/** Whether this dish needs an appliance they said they would rather use (`0102`). */
function prefersAppliance(dish: CandidateDish, leaning: Leaning): boolean {
  return (dish.equipment ?? []).some(appliance => leaning.preferAppliances?.has(appliance) ?? false);
}

/**
 * The dishes of a slot kept for a preferred appliance: as many as this
 * rotation's share leaves once what the food groups already reserved is counted
 * — a fish cooked in the air fryer is not paid for twice — and **nothing at all
 * when no appliance is preferred**, so a kitchen nobody filled in rotates
 * exactly as it did before `0102`. A rotation on a lower rung of
 * `narrowerShares` keeps that many and no more, down to none.
 */
function applianceShare(inSlot: readonly CandidateDish[], rotation: Rotation, reserved: readonly CandidateDish[]): readonly CandidateDish[] {
  const share = shareOf(rotation);

  if (share <= 0) {
    return [];
  }

  const already = new Set(reserved.map(dish => dish.slug));
  const wanted = share - reserved.filter(dish => prefersAppliance(dish, rotation)).length;

  return wanted <= 0 ? [] : inSlot.filter(dish => !already.has(dish.slug) && prefersAppliance(dish, rotation)).slice(0, wanted);
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
 *
 * `reserve` (project 019 phase 2) names, per slot, the dishes taken before the
 * rest: given that slot's dishes in shuffled order, it returns the ones the
 * fortnight's food groups need (`reserveGroups`), and they come first; the
 * rest fill the slot as before. Without it, the pick is what it always was.
 */
export function rotatePool(
  dishes: readonly CandidateDish[],
  slots: readonly MealSlot[],
  rotation: Rotation,
  perSlot: number = REUSED_DISHES_PER_SLOT,
  reserve?: PoolReserve
): CandidateDish[] {
  const eligible = seededShuffle(
    dishes.filter(dish => !rotation.avoidSlugs.has(dish.slug)),
    rotation.seed
  );
  // A stable partition: what they lean towards first in its shuffled order, then
  // the rest in theirs. Never a filter — the tail is still there, so a thin
  // library or a narrow taste costs variety, never a plan.
  const shuffled = [...eligible.filter(dish => isPreferredDish(dish, rotation)), ...eligible.filter(dish => !isPreferredDish(dish, rotation))];
  const taken = new Map<string, CandidateDish>();

  for (const slot of slots) {
    let count = 0;
    const inSlot = shuffled.filter(dish => dish.slots.includes(slot));
    const reserved = reserve ? reserve(inSlot, slot, new Set(taken.keys())) : [];
    // After the groups, never instead of them: a legume minimum is what
    // validation refuses a fortnight for, and a preference is not — so the
    // share takes from what the cap has left once the groups are kept.
    const kitchen = applianceShare(inSlot, rotation, reserved);
    const ordered = reserved.length + kitchen.length > 0 ? [...new Set([...reserved, ...kitchen, ...inSlot])] : inSlot;

    for (const dish of ordered) {
      if (count >= perSlot) {
        break;
      }

      if (!taken.has(dish.slug)) {
        taken.set(dish.slug, dish);
      }

      count += 1;
    }
  }

  // In shuffled order, whatever was reserved: the pick changes, never the order it is handed over in.
  return reserve ? shuffled.filter(dish => taken.has(dish.slug)) : [...taken.values()];
}
