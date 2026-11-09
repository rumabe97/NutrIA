import { and, count, eq, gte, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { assistantUsage } from 'database/schema/ai';

import { DatabaseOperationError } from 'core/entities/Error';

import type { SQL } from 'drizzle-orm';

/** What the usage ledger counted since a window began: every message sent, and how many were cut as off topic. */
export type AssistantUsage = { readonly messages: number; readonly offTopic: number };

/** The ledger's `WHERE`: this person's rows since the window began. Exported for its spec. */
export function usageWindow(userId: string, since: Date): SQL | undefined {
  return and(eq(assistantUsage.userId, userId), gte(assistantUsage.createdAt, since));
}

/**
 * The assistant's usage ledger (project 023, PRD 9 and PRD 3) — one row per
 * message a person sent, and no text.
 *
 * **The only place the allowance and the off-topic ceiling are counted from.**
 * Not the conversation, which the person may delete (and a count read from it
 * would hand the allowance back for every deletion), and not the `ai_call`
 * events, which are the month's spend and name nobody on purpose.
 */
export const AssistantRepository = {
  /**
   * One message sent. Written for **every** outcome — answered, cut, refused,
   * withheld — because the unit is a message a person sent, which they can count
   * themselves (`docs/reference/marketing/assistant-messages.md` § 6).
   */
  async recordUse(userId: string, offTopic: boolean): Promise<void> {
    try {
      await database().insert(assistantUsage).values({ offTopic, userId });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** How many messages since `since`, and how many of them were cut as off topic — one query, one row. */
  async usageSince(userId: string, since: Date): Promise<AssistantUsage> {
    try {
      const [row] = await database()
        .select({ messages: count(), offTopic: sql<number>`count(*) filter (where ${assistantUsage.offTopic})`.mapWith(Number) })
        .from(assistantUsage)
        .where(usageWindow(userId, since));

      return { messages: row?.messages ?? 0, offTopic: row?.offTopic ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on assistant_usage: ${error.message}`);
  }

  return new DatabaseOperationError();
}
