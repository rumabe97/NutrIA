import { and, asc, count, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { feedback } from 'database/schema/platform';
import { user } from 'database/schema/auth';

import { contains, ordered } from '#repositories/Search';
import { DatabaseOperationError } from 'core/entities/Error';

import type { FeedbackQuery } from 'core/entities/AdminQuery';
import type { SQL } from 'drizzle-orm';
import type { SubmitFeedback } from 'core/entities/Feedback';

export type FeedbackRow = {
  readonly id: string;
  readonly createdAt: Date;
  /** Whose words these are, so the owner can answer them. */
  readonly email: string;
  readonly handledAt: Date | null;
  readonly kind: string;
  readonly message: string;
};

/**
 * The inbox's `WHERE`: the text in the message or in the sender's address, and
 * the state. The search is bound and escaped into a literal "contains".
 * Exported for its spec.
 */
export function feedbackFilters(query: Pick<FeedbackQuery, 'q' | 'state'>): SQL | undefined {
  const state = { all: undefined, seen: isNotNull(feedback.handledAt), waiting: isNull(feedback.handledAt) }[query.state];

  return and(query.q === undefined ? undefined : or(contains(feedback.message, query.q), contains(user.email, query.q)), state);
}

/** By date in the chosen direction, then the id, so a page boundary never splits a tie differently. Exported for its spec. */
export function feedbackOrder(query: Pick<FeedbackQuery, 'dir'>): readonly SQL[] {
  return [ordered(feedback.createdAt, query.dir), asc(feedback.id)];
}

export const FeedbackRepository = {
  async create(userId: string, input: SubmitFeedback): Promise<void> {
    try {
      await database().insert(feedback).values({ kind: input.kind, message: input.message, userId });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * A page of messages as the query asks — newest first when it asks nothing —
   * with how many match and how many are still waiting.
   *
   * The address is joined in on purpose. Every other admin read is careful to
   * carry nothing about a person; this one carries the one thing that makes a
   * reply possible, and the message was written to be read.
   *
   * `total` counts what the filters match; `waiting` counts every unhandled
   * message whatever the filters say, because it is the inbox's own figure.
   * Mode: one query for the page, one count under the same `WHERE`, one count
   * of the unhandled.
   */
  async findAll(query: FeedbackQuery): Promise<{ readonly rows: readonly FeedbackRow[]; readonly total: number; readonly waiting: number }> {
    try {
      const db = database();
      const where = feedbackFilters(query);
      const [rows, counted, unhandled] = await Promise.all([
        db
          .select({
            id: feedback.id,
            createdAt: feedback.createdAt,
            email: user.email,
            handledAt: feedback.handledAt,
            kind: feedback.kind,
            message: feedback.message
          })
          .from(feedback)
          .innerJoin(user, eq(user.id, feedback.userId))
          .where(where)
          .orderBy(...feedbackOrder(query))
          .limit(query.size)
          .offset(query.offset),
        db.select({ n: count() }).from(feedback).innerJoin(user, eq(user.id, feedback.userId)).where(where),
        db.select({ n: count() }).from(feedback).where(isNull(feedback.handledAt))
      ]);

      return { rows, total: counted[0]?.n ?? 0, waiting: unhandled[0]?.n ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Marks one message dealt with, or puts it back. Returns false when there is no such message. */
  async setHandled(id: string, handled: boolean): Promise<boolean> {
    try {
      const rows = await database()
        .update(feedback)
        .set({ handledAt: handled ? sql`now()` : null, updatedAt: new Date() })
        .where(and(eq(feedback.id, id)))
        .returning({ id: feedback.id });

      return rows.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on feedback: ${error.message}`);
  }

  return new DatabaseOperationError();
}
