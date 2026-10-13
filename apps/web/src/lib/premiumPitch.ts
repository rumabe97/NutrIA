import { interpolate } from '../i18n/interpolate';

import type { Allowances } from 'core/domain/Allowance';

/** What each tier allows, as the billing status carries it (`0099`). */
export type PitchAllowances = Readonly<Record<'free' | 'premium', Allowances>>;

/**
 * The premium pitch, with every number read from what the tiers actually allow
 * (`0097`, `0099`).
 *
 * Written by hand, this sentence promised **ten events** on the page that asks
 * for money — for three weeks after the domain stopped allowing more than
 * seven. A limit nobody could reach, said to somebody being asked to pay for
 * it, and nothing could have caught it: the number was a word in a dictionary.
 *
 * The numbers now come from the same registry the console moves, so the
 * sentence cannot drift from the product again. It lives here rather than in
 * the card because a sentence that has already been wrong once deserves a test,
 * and `premiumPitch.test.ts` is that test: it reads the placeholders out of both
 * dictionaries and fails if one of them is not filled.
 *
 * `fixedMeals` joined the sentence with the screen that makes it true, and not
 * before (`0099`): the limit shipped one change earlier, and a pitch selling
 * three fixed meals a week while nobody could fix one would have been the same
 * defect as the ten events, promising what the product does not give.
 */
export function premiumPitch(template: string, allowances: PitchAllowances): string {
  return interpolate(template, pitchValues(allowances));
}

/**
 * The values the pitch may name, by placeholder.
 *
 * Exported for the test, which is the point: a placeholder the dictionary writes
 * and this does not supply is left on screen as a literal `{redos}` by
 * `interpolate` — a bug report rather than the word "undefined", but a bug
 * report the reader files, which is one reader too late.
 */
export function pitchValues(allowances: PitchAllowances): Readonly<Record<string, number>> {
  const { free, premium } = allowances;

  return {
    /**
     * Only ever beside "it only counts when a dish arrives". The digit is honest
     * because a refused dish does not spend one, and the sentence that says so
     * is what makes the number sayable at all (`marketing`, dish-requests).
     */
    dishRequests: premium.dishRequestsPerMonth,
    events: premium.eventsPerPlan,
    fixedMeals: premium.fixedMeals,
    freeEvents: free.eventsPerPlan,
    freeFixedMeals: free.fixedMeals,
    freeRedos: free.planRedosPerFortnight,
    freeSwaps: free.mealSwapsPerPlan,
    midPlan: premium.midPlanEventsPerPlan,
    redos: premium.planRedosPerFortnight,
    swaps: premium.mealSwapsPerPlan
  };
}
