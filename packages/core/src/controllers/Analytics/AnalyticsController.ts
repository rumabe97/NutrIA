import { AnalyticsRepository } from '#repositories/Analytics';
import { madridDayKey, madridMidnight } from 'core/domain/Period';

import type { AnalyticsEvent } from 'core/entities/Analytics';

/**
 * Recording that something happened (`0033`).
 *
 * The only way in: there is no HTTP route that writes an event, so the browser
 * cannot invent one. Every call site is server-side, at the moment the thing
 * actually happened, which is also the only moment it is true.
 */
export const AnalyticsController = {
  /**
   * Never throws — see the repository. Callers do not check it and have nothing
   * useful to do if it failed: a person's swap must not fail because a counter
   * could not be written.
   */
  async record(event: AnalyticsEvent, userId: string | null, properties?: Record<string, unknown>): Promise<void> {
    await AnalyticsRepository.record(event, userId, properties);
  },

  /**
   * Somebody used a session they already had (`0071`): one `app_used` per
   * person per Madrid day — the console's day — however many sessions they
   * renewed in it. Never throws, like `record`.
   */
  async recordUse(userId: string, now = new Date()): Promise<void> {
    await AnalyticsRepository.recordOnceSince('app_used', userId, madridMidnight(madridDayKey(now)));
  }
};
