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
  /** It fits that meal, but not beside the rule the day already holds (`0101`). */
  | 'clashes_with_fixed'
  /** Their way of eating rules it out — vegetarian, halal, gluten-free. */
  | 'disliked'
  | 'excluded'
  /**
   * It needs an appliance they said they do not have (`0102`). Actionable, and
   * said apart from `too_slow` and `clashes_with_fixed` because the way forward
   * is a different one: another dish, or an appliance they do not own.
   */
  | 'missing_equipment'
  /** Longer than the cooking time they said they wanted. The most actionable, and the owner's own case. */
  | 'no_method'
  /** The recipe never says how to cook it, so the product will not serve it to anybody. */
  | 'too_big_or_small'
  /** It is not a dish for this meal, for this person (`0062` § 5). */
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
  /** It cannot be sized into this meal's plate — the commonest, and it usually fits another meal. */
  | 'wrong_slot';

export type FixableVerdict = { readonly fixable: false; readonly why: NotFixable } | { readonly fixable: true };

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
