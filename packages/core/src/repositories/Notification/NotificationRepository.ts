import { and, eq, exists, gte, inArray, lte, not, or, sql } from 'drizzle-orm';

import { checkIns } from 'database/schema/progress';
import { database } from 'database';
import { mealPlans } from 'database/schema/plan';
import { notificationPreferences, notifications, pushSubscriptions } from 'database/schema/platform';
import { profiles } from 'database/schema/profile';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';

/** One browser that asked to be told things: where to send, and what to encrypt to. */
export type PushTarget = { readonly auth: string; readonly endpoint: string; readonly p256dh: string };

export type Recipient = {
  readonly email: string;
  readonly endDate: string;
  readonly locale: string | null;
  readonly planId: string;
  /** Every browser they subscribed (`0054`). Empty for most people. */
  readonly pushTargets: readonly PushTarget[];
  readonly userId: string;
  /** Whether they still want the mail. False only when they turned it off on their profile. */
  readonly wantsEmail: boolean;
};

export const NotificationRepository = {
  /** A subscription its push service says is gone: whoever it belonged to, it will never deliver again. */
  async dropPushSubscription(endpoint: string): Promise<void> {
    try {
      await database().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Who should be told their fortnight has closed, and has not been told yet.
   *
   * Five conditions, and every one of them is a way of not sending something
   * somebody would resent:
   *
   *  - the account is activated (`0017`) — telling someone who cannot use the
   *    product is worse than silence;
   *  - their plan has reached its last day;
   *  - they have not already done the check-in;
   *  - nothing of this kind was sent since that plan began, on any channel,
   *    which is what makes a daily sweep send one reminder per fortnight rather
   *    than one a day;
   *  - there is somewhere they still want it: the mail, if they have not turned
   *    it off, or a browser they subscribed (`0054`).
   *
   * The record of having sent is the notification row itself, a `not exists`
   * rather than a flag on the plan, so a send and its proof cannot disagree.
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
      const subscribed = db
        .select({ one: sql`1` })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, user.id));
      const checkedIn = db
        .select({ one: sql`1` })
        .from(checkIns)
        .where(eq(checkIns.planId, mealPlans.id));
      const wantsEmail = not(exists(optedOut));

      const rows = await db
        .select({
          id: user.id,
          email: user.email,
          endDate: mealPlans.endDate,
          locale: profiles.locale,
          planId: mealPlans.id,
          wantsEmail: sql<boolean>`${wantsEmail}`
        })
        .from(user)
        .innerJoin(mealPlans, and(eq(mealPlans.userId, user.id), eq(mealPlans.status, 'active')))
        .leftJoin(profiles, eq(profiles.userId, user.id))
        .where(
          and(
            eq(user.emailVerified, true),
            lte(mealPlans.endDate, today),
            not(exists(checkedIn)),
            not(exists(alreadySent)),
            or(wantsEmail, exists(subscribed))
          )
        )
        .limit(limit);

      const targets =
        rows.length === 0
          ? []
          : await db
              .select({
                auth: pushSubscriptions.auth,
                endpoint: pushSubscriptions.endpoint,
                p256dh: pushSubscriptions.p256dh,
                userId: pushSubscriptions.userId
              })
              .from(pushSubscriptions)
              .where(
                inArray(
                  pushSubscriptions.userId,
                  rows.map(row => row.id)
                )
              );

      return rows.map(row => ({
        email: row.email,
        endDate: row.endDate,
        locale: row.locale,
        planId: row.planId,
        pushTargets: targets.filter(target => target.userId === row.id).map(({ auth, endpoint, p256dh }) => ({ auth, endpoint, p256dh })),
        userId: row.id,
        wantsEmail: Boolean(row.wantsEmail)
      }));
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

  /**
   * The proof that a reminder went out. Written after a channel accepted it,
   * never before; `channel` says which carried it.
   */
  async recordSent(
    userId: string,
    input: { readonly body: string; readonly channel: 'email' | 'push'; readonly title: string; readonly type: 'checkin_due' }
  ): Promise<void> {
    try {
      await database()
        .insert(notifications)
        .values({ body: input.body, channel: input.channel, sentAt: new Date(), title: input.title, type: input.type, userId });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** One browser stops being told, and only if it is theirs. */
  async removePushSubscription(userId: string, endpoint: string): Promise<void> {
    try {
      await database()
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Keeps a browser's subscription, for whoever subscribed on it last. */
  async savePushSubscription(userId: string, target: PushTarget): Promise<void> {
    try {
      await database()
        .insert(pushSubscriptions)
        .values({ ...target, userId })
        .onConflictDoUpdate({ set: { auth: target.auth, p256dh: target.p256dh, updatedAt: new Date(), userId }, target: pushSubscriptions.endpoint });
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
