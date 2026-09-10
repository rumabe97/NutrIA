import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { feedback } from 'database/schema/platform';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';

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

export const FeedbackRepository = {
  async create(userId: string, input: SubmitFeedback): Promise<void> {
    try {
      await database().insert(feedback).values({ kind: input.kind, message: input.message, userId });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * A page of messages, newest first, with the count still waiting.
   *
   * The address is joined in on purpose. Every other admin read is careful to
   * carry nothing about a person; this one carries the one thing that makes a
   * reply possible, and the message was written to be read.
   */
  async findAll(limit: number, offset: number): Promise<{ readonly rows: readonly FeedbackRow[]; readonly total: number; readonly waiting: number }> {
    try {
      const db = database();
      const [rows, counted, unhandled] = await Promise.all([
        db
          .select({ id: feedback.id, createdAt: feedback.createdAt, email: user.email, handledAt: feedback.handledAt, kind: feedback.kind, message: feedback.message })
          .from(feedback)
          .innerJoin(user, eq(user.id, feedback.userId))
          .orderBy(desc(feedback.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ n: count() }).from(feedback),
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
  if (error instanceof ZodError) {return new DatabaseOperationError(`Schema mismatch on feedback: ${error.message}`);}

  return new DatabaseOperationError();
}
