import { AdminNotificationRepository, REMINDER_CHANNELS } from '#repositories/Admin';
import { fillWeeks, madridWeekKeys, windowFor } from 'core/domain/Period';

import { presentWindow } from './AdminSeriesController';

import type { Period } from 'core/entities/Period';
import type { PeriodWindowView } from './AdminSeriesController';

/**
 * Notificaciones (`GET /admin/notifications?period=`, `0071`): who can be
 * reached by push, the check-in reminders sent per week and channel, and how
 * many of the people reminded made their check-in within three days. Counts
 * only — no endpoint, no key and nobody's name (`0028`).
 */
export type AdminNotificationsView = {
  /** People sent a reminder in the period, and how many made a check-in within three days of one. Distinct people. */
  readonly checkIns: { readonly answered: number; readonly reminded: number };
  readonly period: Period;
  readonly push: {
    /** Distinct people with at least one subscribed browser. */
    readonly people: number;
    /** Subscribed browsers. */
    readonly subscriptions: number;
  };
  /**
   * Reminders sent per Madrid week (its Monday) over the period, one series
   * per channel — `email` and `push`, both always present. One row is kept per
   * channel a reminder left by, so this counts sends; a reminder sent by both
   * counts once in each. Before 0071's phase 1 a reminder that left by both
   * kept only one row.
   */
  readonly remindersPerWeek: {
    readonly series: readonly { readonly channel: string; readonly values: readonly number[] }[];
    readonly weeks: readonly string[];
  };
  readonly window: PeriodWindowView;
};

export const AdminNotificationController = {
  async notifications(period: Period, now = new Date()): Promise<AdminNotificationsView> {
    const window = windowFor(period, now);
    const weeks = madridWeekKeys(window.from, window.to);
    const [push, reminders, checkIns] = await Promise.all([
      AdminNotificationRepository.pushSubscriptionTotals(),
      AdminNotificationRepository.remindersPerDay(window.from, window.to),
      AdminNotificationRepository.answeredReminders(window.from, window.to)
    ]);

    return {
      checkIns,
      period,
      push,
      remindersPerWeek: {
        series: REMINDER_CHANNELS.map(channel => ({
          channel,
          values: fillWeeks(
            weeks,
            reminders.filter(row => row.channel === channel)
          )
        })),
        weeks
      },
      window: presentWindow(window)
    };
  }
};
