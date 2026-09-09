import { and, eq, exists, gte, lte, not, sql } from 'drizzle-orm';

import { checkIns } from 'database/schema/progress';
import { database } from 'database';
import { mealPlans } from 'database/schema/plan';
import { notificationPreferences, notifications } from 'database/schema/platform';
import { profiles } from 'database/schema/profile';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';

export type Recipient = {
  readonly email: string;
  readonly endDate: string;
  readonly locale: string | null;
  readonly planId: string;
  readonly userId: string;
};

export const NotificationRepository = {
  /**
   * Who should be told their fortnight has closed, and has not been told yet.
   *
   * Five conditions, and every one of them is a way of not sending a mail
   * somebody would resent:
   *
   *  - the account is activated (`0017`) — mailing someone who cannot use the
   *    product is worse than silence;
   *  - their plan has reached its last day;
   *  - they have not already done the check-in;
   *  - nothing of this kind was sent since that plan began, which is what makes
   *    a daily sweep send one mail per fortnight rather than one a day;
   *  - they have not turned it off.
   *
   * The last two are `not exists` rather than a flag on the plan: the record of
   * having sent is the notification row itself, so a send and its proof cannot
   * disagree.
   */
  async findCheckInDue(today: string, limit: number): Promise<readonly Recipient[]> {
    try {
      const db = database();
      const alreadySent = db
        .select({ one: sql`1` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, user.id),
            eq(notifications.type, 'checkin_due'),
            eq(notifications.channel, 'email'),
            gte(notifications.sentAt, sql`${mealPlans.startDate}::timestamptz`)
          )
        );
      const optedOut = db
        .select({ one: sql`1` })
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.userId, user.id),
            eq(notificationPreferences.type, 'checkin_due'),
            eq(notificationPreferences.channel, 'email'),
            eq(notificationPreferences.enabled, false)
          )
        );
      const checkedIn = db
        .select({ one: sql`1` })
        .from(checkIns)
        .where(eq(checkIns.planId, mealPlans.id));

      const rows = await db
        .select({ id: user.id, email: user.email, endDate: mealPlans.endDate, locale: profiles.locale, planId: mealPlans.id })
        .from(user)
        .innerJoin(mealPlans, and(eq(mealPlans.userId, user.id), eq(mealPlans.status, 'active')))
        .leftJoin(profiles, eq(profiles.userId, user.id))
        .where(and(eq(user.emailVerified, true), lte(mealPlans.endDate, today), not(exists(checkedIn)), not(exists(alreadySent)), not(exists(optedOut))))
        .limit(limit);

      return rows.map(row => ({ email: row.email, endDate: row.endDate, locale: row.locale, planId: row.planId, userId: row.id }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Their answer to "do you want these", per kind and per channel. Absent means yes. */
  async findPreference(userId: string, type: 'checkin_due', channel: 'email'): Promise<boolean> {
    try {
      const [row] = await database()
        .select({ enabled: notificationPreferences.enabled })
        .from(notificationPreferences)
        .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type), eq(notificationPreferences.channel, channel)))
        .limit(1);

      return row?.enabled ?? true;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** The proof that a mail went out. Written after the provider accepted it, never before. */
  async recordSent(userId: string, input: { readonly body: string; readonly title: string; readonly type: 'checkin_due' }): Promise<void> {
    try {
      await database()
        .insert(notifications)
        .values({ body: input.body, channel: 'email', sentAt: new Date(), title: input.title, type: input.type, userId });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async setPreference(userId: string, type: 'checkin_due', channel: 'email', enabled: boolean): Promise<void> {
    try {
      const db = database();
      const [existing] = await db
        .select({ id: notificationPreferences.id })
        .from(notificationPreferences)
        .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type), eq(notificationPreferences.channel, channel)))
        .limit(1);

      if (existing) {
        await db.update(notificationPreferences).set({ enabled, updatedAt: new Date() }).where(eq(notificationPreferences.id, existing.id));

        return;
      }

      await db.insert(notificationPreferences).values({ channel, enabled, type, userId });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
