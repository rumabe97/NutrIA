import { and, count, countDistinct, eq, gte, inArray, sql } from 'drizzle-orm';

import { analyticsEvents } from 'database/schema/platform';
import { database } from 'database';

import { ACTIVE_EVENTS } from 'core/entities/Analytics';

import type { AnalyticsEvent } from 'core/entities/Analytics';

export type ActivityRow = { readonly event: string; readonly n: number };

export const AnalyticsRepository = {
  /** How many of each event since a date, and how many distinct people came back. */
  async activitySince(since: Date): Promise<{ readonly people: number; readonly rows: readonly ActivityRow[] }> {
    const db = database();
    const [rows, people] = await Promise.all([
      db
        .select({ event: analyticsEvents.event, n: count() })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, since))
        .groupBy(analyticsEvents.event),
      db
        .select({ n: countDistinct(analyticsEvents.userId) })
        .from(analyticsEvents)
        .where(and(gte(analyticsEvents.createdAt, since), inArray(analyticsEvents.event, [...ACTIVE_EVENTS])))
    ]);

    return { people: people[0]?.n ?? 0, rows: rows.map(row => ({ event: row.event, n: row.n })) };
  },

  /**
   * Takes the right to tell the owner about `kind`: writes an `owner_alerted`
   * event unless one of that kind exists since `since`, and returns its id, or
   * `null` when the owner was already told (or another request is telling them
   * right now). The check and the write share a transaction behind a lock on
   * the kind, because the moments this runs are the moments several background
   * jobs fail together; a bare read-then-send would send two mails.
   *
   * The event carries the kind and nothing else, and no user (`0071`). Never
   * throws: an alert that cannot be claimed is not sent, which is the safe side.
   */
  async claimOwnerAlert(kind: string, since: Date): Promise<string | null> {
    try {
      return await database().transaction(async tx => {
        const [lock] = await tx.execute<{ locked: boolean }>(
          sql`select pg_try_advisory_xact_lock(hashtext('owner_alerted'), hashtext(${kind})) as locked`
        );

        if (!lock?.locked) {
          return null;
        }

        const [already] = await tx
          .select({ n: count() })
          .from(analyticsEvents)
          .where(
            and(
              eq(analyticsEvents.event, 'owner_alerted'),
              sql`${analyticsEvents.properties} ->> 'kind' = ${kind}`,
              gte(analyticsEvents.createdAt, since)
            )
          );

        if ((already?.n ?? 0) > 0) {
          return null;
        }

        const [row] = await tx
          .insert(analyticsEvents)
          .values({ event: 'owner_alerted', properties: { kind }, userId: null })
          .returning({ id: analyticsEvents.id });

        return row?.id ?? null;
      });
    } catch (error: unknown) {
      console.info(`[analytics] "owner_alerted" not claimed: ${error instanceof Error ? error.message : 'unknown error'}`);

      return null;
    }
  },

  /** When the owner was last told about `kind`, if ever. */
  async lastOwnerAlert(kind: string): Promise<Date | null> {
    const [row] = await database()
      .select({ at: sql<Date | null>`max(${analyticsEvents.createdAt})`.mapWith(analyticsEvents.createdAt) })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.event, 'owner_alerted'), sql`${analyticsEvents.properties} ->> 'kind' = ${kind}`));

    return row?.at ?? null;
  },
  /**
   * Writes one event, and never throws.
   *
   * Analytics is the least important write in the system: a person's plan must
   * not fail because a counter could not be incremented. Callers do not check
   * the result and there is nothing useful for them to do with it.
   *
   * `properties` is for the shape of the thing, never its content — the axis of
   * a swap, not the dish it produced.
   */
  async record(event: AnalyticsEvent, userId: string | null, properties?: Record<string, unknown>): Promise<void> {
    try {
      await database()
        .insert(analyticsEvents)
        .values({ event, properties: properties ?? null, userId });
    } catch (error: unknown) {
      console.info(`[analytics] "${event}" not recorded: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  },

  /**
   * Writes one event for a person unless they already have one since `since`,
   * and never throws — `record`'s rule.
   *
   * The check and the write share a transaction behind a lock on the person
   * and the event, because the moment this runs is the moment several requests
   * arrive at once: a page's server render asks the API for three things with
   * one session, and each of them renews it. Without the lock, each would see
   * no row and write one. With it, only the first goes on; the others do not
   * wait for it — the one holding the lock is about to write the row, and a
   * renewal must never queue behind a stalled connection. Losing a day's use
   * when that holder then fails is the price, and an acceptable one.
   *
   * The transaction — begin, lock, count, insert, commit — is paid by the
   * renewing request, once per session per day (`updateAge`). Never call this
   * from a path that runs on every request.
   */
  async recordOnceSince(event: AnalyticsEvent, userId: string, since: Date): Promise<void> {
    try {
      await database().transaction(async tx => {
        const [lock] = await tx.execute<{ locked: boolean }>(
          sql`select pg_try_advisory_xact_lock(hashtext(${event}), hashtext(${userId})) as locked`
        );

        if (!lock?.locked) {
          return;
        }

        const [already] = await tx
          .select({ n: count() })
          .from(analyticsEvents)
          .where(and(eq(analyticsEvents.event, event), eq(analyticsEvents.userId, userId), gte(analyticsEvents.createdAt, since)));

        if ((already?.n ?? 0) > 0) {
          return;
        }

        await tx.insert(analyticsEvents).values({ event, properties: null, userId });
      });
    } catch (error: unknown) {
      console.info(`[analytics] "${event}" not recorded: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  },

  /** Gives back a claim whose mail did not leave, so the next check may try again. Never throws. */
  async releaseOwnerAlert(id: string): Promise<void> {
    try {
      await database()
        .delete(analyticsEvents)
        .where(and(eq(analyticsEvents.id, id), eq(analyticsEvents.event, 'owner_alerted')));
    } catch (error: unknown) {
      console.info(`[analytics] "owner_alerted" not released: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
};
