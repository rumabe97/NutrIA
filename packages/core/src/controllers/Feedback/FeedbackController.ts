import { FeedbackRepository } from '#repositories/Feedback';
import { feedbackQuerySchema } from 'core/entities/AdminQuery';
import { NotFoundError } from 'core/entities/Error';

import type { FeedbackQuery } from 'core/entities/AdminQuery';
import type { FeedbackRow } from '#repositories/Feedback';
import type { Paged } from 'core/controllers/User';
import type { SubmitFeedback } from 'core/entities/Feedback';

// --- Presenters ---------------------------------------------------------------

/** One message in the owner's inbox. */
export interface FeedbackView {
  id: string;
  createdAt: string;
  email: string;
  handled: boolean;
  kind: string;
  message: string;
}

function present(row: FeedbackRow): FeedbackView {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    email: row.email,
    handled: row.handledAt !== null,
    kind: row.kind,
    message: row.message
  };
}

// --- Controller ---------------------------------------------------------------

/**
 * What people write to the owner (`0037`).
 *
 * The only place in this product where somebody's own words are stored to be
 * read by another person — and the only reason that is not a leak is that they
 * were written for exactly that. Nothing infers, nothing summarises, nothing
 * reaches a model: the message is delivered as typed.
 */
export const FeedbackController = {
  /**
   * One page of the inbox as the query asks — newest first when it asks
   * nothing — how many messages match, and how many are still waiting in all.
   */
  async list(query: FeedbackQuery = feedbackQuerySchema.parse({})): Promise<Paged<FeedbackView> & { readonly waiting: number }> {
    const { rows, total, waiting } = await FeedbackRepository.findAll(query);

    return { offset: query.offset, rows: rows.map(present), size: query.size, total, waiting };
  },

  /**
   * Marks a message dealt with, or puts it back.
   *
   * Reversible on purpose: "handled" is the owner's own note to themselves, and
   * a note you cannot take back is one people stop making.
   */
  async setHandled(id: string, handled: boolean): Promise<void> {
    if (!(await FeedbackRepository.setHandled(id, handled))) {
      throw new NotFoundError(`Feedback "${id}" not found`);
    }
  },

  async submit(userId: string, input: SubmitFeedback): Promise<void> {
    await FeedbackRepository.create(userId, input);
  }
};
