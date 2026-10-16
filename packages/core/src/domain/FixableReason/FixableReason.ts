import { dishSafety } from 'core/domain/Safety';
import { hasUsableMethod } from 'core/domain/Method';
import { withinEquipment, withinTime } from 'core/domain/Preference';

import type { CandidateDish, Catalogue, MealSlot } from 'core/entities/Plan';
import type { Kitchen } from 'core/entities/Kitchen';
import type { SafetyProfile } from 'core/entities/Safety';

/**
 * Why a dish somebody searched for is not offered to be fixed to a meal
 * (report `0011` § 2).
 *
 * **The defect this exists for is an absence that explains nothing.** The owner
 * searched for *patatas a la riojana*, a dish his library has, and the screen
 * showed him a shorter list and said nothing. Measured, the library was not the
 * reason in his case or in most: that dish takes 50 minutes and his profile said
 * 30, and raising that one preference unlocked 102 dishes for him.
 *
 * Six of the nine reasons below are things the person can act on; of the other
 * three, an allergen is a refusal, a missing method is ours to fix and not
 * theirs, and the wrong meal is simply not that dish's. The point is that they
 * are different sentences. A list that silently gets shorter cannot be any of
 * them.
 */

/**
 * Ordered as they are checked, which is also how they should be said: safety
 * first because it is the only one that is a refusal rather than a route
 * forward, then the things the person chose, then the arithmetic.
 */
export type NotFixable =
  | 'allergen'
  /**
   * It fits that meal, but the day cannot reach its four macros with it beside
   * the rule it already holds (`0101`). **A warning somebody may accept since
   * `0103`** — see `ACCEPTABLE_REASONS`.
   */
  | 'clashes_with_fixed'
  /** A dish they told us they do not like. */
  | 'disliked'
  /** Their way of eating rules it out — vegetarian, halal, gluten-free. */
  | 'excluded'
  /**
   * It needs an appliance they said they do not have (`0102`). Actionable, and
   * said apart from `too_slow` and `clashes_with_fixed` because the way forward
   * is a different one: another dish, or an appliance they do not own.
   */
  | 'missing_equipment'
  /** The recipe never says how to cook it, so the product will not serve it to anybody. */
  | 'no_method'
  /**
   * It cannot be sized into this meal's plate — the commonest, and it usually
   * fits another meal. **A refusal and not a warning**, although it is
   * arithmetic: it is `fitsPlate`, which is one of the three bounds
   * `honouredPin` drops a pin for, so accepting it would promise a meal the
   * generation never serves (`ACCEPTABLE_REASONS`).
   */
  | 'too_big_or_small'
  /** Longer than the cooking time they said they wanted. The most actionable, and the owner's own case. */
  | 'too_slow'
  /**
   * The dish a rule names is not in this person's library at all any more: it
   * was dropped from the catalogue, or the account changed language and the
   * pool will never hold it again (021 phase 5b).
   *
   * **Only ever said about a rule somebody already wrote**, never about a
   * search: a dish the library does not have is not a dish anybody can type
   * the name of and be refused. Not actionable, for the same reason
   * `no_method` is not — the dish is gone, and that is ours rather than
   * theirs.
   */
  | 'unknown_dish'
  /** It is not a dish for this meal, for this person (`0062` § 5). */
  | 'wrong_slot';

export type FixableVerdict = { readonly fixable: false; readonly why: NotFixable } | { readonly fixable: true };

/**
 * The one reason that is a day's arithmetic rather than a thing somebody cannot
 * eat — **a warning they may accept, not a refusal** (`0103`).
 *
 * The test is not "is it about numbers", it is **whether accepting it ends with
 * the meal on the plate**. The owner's own requirement: *"aunque no se cumplan
 * las macros, el plan se tiene que generar con esas comidas"*. Checked against
 * `honouredPin`, which yields a pin to three bounds and three only — the pool,
 * the slot the dish declares, and `fitsPlate`:
 *
 * - `clashes_with_fixed` is **not** one of them. The pin is placed and the day
 *   is simply built out of band, which is exactly what was asked for. Measured
 *   on the real library: both rules of a clashing pair served, the day 5.8%
 *   under on energy.
 * - `too_big_or_small` **is** one of them: that reason *is* `fitsPlate` failing,
 *   so accepting it would promise a meal the generation then drops (`0070`,
 *   `0076`, `0078` — the gram ceiling and `PLATE_LIMIT`, which exist so the
 *   product never serves a plate it refuses to serve). Taking somebody's
 *   acceptance and still not serving the dish is worse than saying no, so it
 *   keeps its refusal and keeps its sentence, which already says to try the dish
 *   in another meal.
 *
 * The other seven fail the same test for plainer reasons: an allergen is safety
 * and never theirs to overrule (`0004`), an exclusion and a dislike are their
 * own standing instructions, a missing appliance means they cannot cook it
 * (`0102`), a missing method is ours rather than theirs, a dish gone from the
 * library is not there to eat, and the wrong meal is not a dish for that meal.
 */
export const ACCEPTABLE_REASONS = ['clashes_with_fixed'] as const;

export type AcceptableReason = (typeof ACCEPTABLE_REASONS)[number];

/**
 * Whether this is a reason somebody may accept and fix the dish anyway (`0103`).
 *
 * **Not the same question as `actionable`**, and the difference is what each one
 * buys a screen. `actionable` says whether there is a way forward at all — a
 * preference to raise, another dish to choose. This says whether *this* dish can
 * still be fixed, over the reason, by somebody who reads what it will cost. Five
 * reasons are actionable without being acceptable (`excluded`, `disliked`,
 * `too_slow`, `missing_equipment`, `too_big_or_small`): the way forward is to
 * change the thing they said or to choose another meal, not to overrule it here.
 *
 * The predicate's own type is the check that the reason is really a reason:
 * TypeScript only allows a narrowing to a type assignable to the parameter's.
 */
export function acceptable(why: NotFixable): why is AcceptableReason {
  return (ACCEPTABLE_REASONS as readonly NotFixable[]).includes(why);
}

/**
 * Why this dish is not offered for this slot, or that it is.
 *
 * `fits` is the caller's — it is `pinnable`'s own answer for the slot, which
 * needs the day's budget and the season and therefore cannot be computed here.
 * Everything before it is a property of the dish and the person, in the order
 * `reusablePool` filters them, so the first reason returned is the first one a
 * person would have to deal with.
 */
export function whyNotFixable(
  dish: CandidateDish,
  slot: MealSlot,
  context: {
    readonly catalogue: Catalogue;
    readonly disliked: ReadonlySet<string>;
    /** What they do not have, from the resolved preferences — never read a second time here (`0052`). */
    readonly kitchen: Kitchen | null;
    readonly maxMinutes: number | null;
    readonly safety: SafetyProfile;
  },
  excluded: boolean,
  fits: boolean,
  /**
   * Whether the day still reaches its four macros with this dish beside what is
   * already fixed there. True when the day holds nothing, which is every case
   * before `0101` and the common one after it.
   */
  holdsTheDay = true
): FixableVerdict {
  if (dishSafety(dish.ingredients, context.catalogue, context.safety).kind !== 'safe') {
    return { fixable: false, why: 'allergen' };
  }

  if (excluded) {
    return { fixable: false, why: 'excluded' };
  }

  if (context.disliked.has(dish.slug)) {
    return { fixable: false, why: 'disliked' };
  }

  if (!withinTime(dish, context.maxMinutes)) {
    return { fixable: false, why: 'too_slow' };
  }

  // After the time and before the product's own faults: both are things they
  // said about how they cook, and of the two the time is the one two taps can
  // change — so a dish that is both too slow and needs an oven they do not have
  // is named for the time first (`0102`).
  if (!withinEquipment(dish, context.kitchen)) {
    return { fixable: false, why: 'missing_equipment' };
  }

  if (!hasUsableMethod(dish)) {
    return { fixable: false, why: 'no_method' };
  }

  if (!dish.slots.includes(slot)) {
    return { fixable: false, why: 'wrong_slot' };
  }

  if (!fits) {
    return { fixable: false, why: 'too_big_or_small' };
  }

  // Last, and only reachable when the day already carries a rule: the dish is
  // servable at this meal for this person, and the day cannot reach its macros
  // with both. Said apart from `too_big_or_small` because the way forward is a
  // different one — another dish, or the other rule removed.
  return holdsTheDay ? { fixable: true } : { fixable: false, why: 'clashes_with_fixed' };
}

/**
 * Whether the person can do something about it themselves.
 *
 * Not cosmetic: it decides whether the screen offers a way forward or states a
 * refusal. An allergen is never softened into advice, and a recipe with no
 * method is this product's fault and not theirs.
 */
export function actionable(why: NotFixable): boolean {
  return (
    why === 'too_slow' ||
    why === 'disliked' ||
    why === 'too_big_or_small' ||
    why === 'excluded' ||
    why === 'clashes_with_fixed' ||
    // An appliance is not two taps away the way a time limit is, but there is a
    // way forward and it is theirs: another dish, or say they have one (`0102`).
    why === 'missing_equipment'
  );
}
