import { and, count, countDistinct, eq, inArray, sql } from 'drizzle-orm';

import { checkIns } from 'database/schema/progress';
import { database } from 'database';
import { notifications, pushSubscriptions } from 'database/schema/platform';

import { DatabaseOperationError } from 'core/entities/Error';

import { madridDay, qualified, within } from './AdminSql';

import type { DayCountRow } from './AdminSeriesRepository';

/** The two channels a check-in reminder leaves by. `in_app` is the bell, which no reminder is sent through. */
export const REMINDER_CHANNELS = ['email', 'push'] as const;

export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

/** How many reminders left on one Madrid day by one channel. */
export type ReminderDayRow = DayCountRow & { readonly channel: string };

/** The window, in days, a check-in counts as an answer to a reminder. */
const ANSWER_DAYS = 3;

function reminded() {
  return and(eq(notifications.type, 'checkin_due'), inArray(notifications.channel, [...REMINDER_CHANNELS]));
}

/**
 * Push and the check-in reminders as counts (`0071`, Notificaciones). Nothing
 * selected is a person, an endpoint or a key: a subscription is counted, not
 * read (`0028`).
 */
export const AdminNotificationRepository = {
  /**
   * People who were sent a reminder in `[from, to)`, and how many of them made
   * their check-in within three days of one — distinct people, so one who was
   * reminded twice counts once on each side. Mode: one aggregate.
   */
  async answeredReminders(from: Date, to: Date): Promise<{ readonly answered: number; readonly reminded: number }> {
    try {
      // The inner rows are named in full: inside a sub-select a bare `user_id` binds to the inner table.
      const answered = sql`exists (select 1 from ${checkIns}
        where ${qualified(checkIns, 'user_id')} = ${qualified(notifications, 'user_id')}
          and ${qualified(checkIns, 'created_at')} >= ${qualified(notifications, 'sent_at')}
          and ${qualified(checkIns, 'created_at')} < ${qualified(notifications, 'sent_at')} + make_interval(days => ${ANSWER_DAYS}))`;
      const [row] = await database()
        .select({
          answered: sql<number>`count(distinct ${notifications.userId}) filter (where ${answered})`.mapWith(Number),
          reminded: countDistinct(notifications.userId)
        })
        .from(notifications)
        .where(and(reminded(), within(notifications.sentAt, from, to)));

      return { answered: row?.answered ?? 0, reminded: row?.reminded ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Push subscriptions (a browser each) and the distinct people who hold at least one. Mode: one aggregate. */
  async pushSubscriptionTotals(): Promise<{ readonly people: number; readonly subscriptions: number }> {
    try {
      const [row] = await database()
        .select({ people: countDistinct(pushSubscriptions.userId), subscriptions: count() })
        .from(pushSubscriptions);

      return { people: row?.people ?? 0, subscriptions: row?.subscriptions ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Reminders sent per Madrid day and channel. One row per channel a reminder
   * left by, since 0071 phase 1: a count of rows is a count of sends, not of
   * reminders. Mode: one grouped query.
   */
  async remindersPerDay(from: Date, to: Date): Promise<readonly ReminderDayRow[]> {
    try {
      const day = madridDay(notifications.sentAt);

      return await database()
        .select({ channel: notifications.channel, day, n: count() })
        .from(notifications)
        .where(and(reminded(), within(notifications.sentAt, from, to)))
        .groupBy(day, notifications.channel);
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
