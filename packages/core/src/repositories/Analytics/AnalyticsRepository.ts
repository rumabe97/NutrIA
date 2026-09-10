import { and, count, countDistinct, eq, gte } from 'drizzle-orm';

import { analyticsEvents } from 'database/schema/platform';
import { database } from 'database';

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
        .where(and(gte(analyticsEvents.createdAt, since), eq(analyticsEvents.event, 'session_started')))
    ]);

    return { people: people[0]?.n ?? 0, rows: rows.map(row => ({ event: row.event, n: row.n })) };
  },

  /**
   * Every provider request since a moment, with what it cost.
   *
   * Rows rather than a sum, because the screen wants three answers from one
   * read: how many requests, how many tokens, and how many of them the provider
   * refused for want of quota.
   */
  async aiCallsSince(since: Date): Promise<readonly { readonly at: Date; readonly properties: Record<string, unknown> }[]> {
    const rows = await database()
      .select({ at: analyticsEvents.createdAt, properties: analyticsEvents.properties })
      .from(analyticsEvents)
      .where(and(gte(analyticsEvents.createdAt, since), eq(analyticsEvents.event, 'ai_call')))
      .orderBy(analyticsEvents.createdAt);

    return rows.map(row => ({ at: row.at, properties: row.properties ?? {} }));
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
  }
};
