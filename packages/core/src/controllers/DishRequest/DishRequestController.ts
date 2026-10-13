import { countedStanding } from 'core/domain/Allowance';
import { DishRequestRepository } from '#repositories/DishRequest';
import { PlanController } from 'core/controllers/Plan';

import type { CountedStanding } from 'core/domain/Allowance';
import type { RecipeDraft } from 'core/entities/Plan';

/** The first instant of the calendar month a date falls in, in UTC — the window the allowance is counted over. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export const DishRequestController = {
  /** What is left of this month's dish requests, for a screen to say before somebody types. */
  async standing(userId: string, now: Date = new Date()): Promise<CountedStanding> {
    const [stored, limits] = await Promise.all([DishRequestRepository.storedThisMonth(userId, monthStart(now)), PlanController.limitsOf(userId)]);

    return countedStanding(stored, limits.dishRequestsPerMonth);
  },

  /**
   * Stores a dish somebody asked us to write, inside the lock that re-counts
   * the month (`0011` § 4 a).
   *
   * The allowance is spent on the **stored dish**, never on the request: the
   * output gate can refuse what the model wrote, and a refusal leaves no row, so
   * it costs the person nothing. That is also why the count can be read from the
   * rows themselves — `source: 'user'`, which no other path writes — and why
   * nothing has to record what anybody typed.
   */
  async store(userId: string, draft: RecipeDraft, locale: string, now: Date = new Date()): Promise<string> {
    const since = monthStart(now);

    return DishRequestRepository.storeWithinQuota(
      userId,
      draft,
      locale,
      async stored => countedStanding(stored, (await PlanController.limitsOf(userId)).dishRequestsPerMonth).allowed,
      since
    );
  }
};
