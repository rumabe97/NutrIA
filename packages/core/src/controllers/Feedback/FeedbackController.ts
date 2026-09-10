import { FeedbackRepository } from '#repositories/Feedback';
import { NotFoundError } from 'core/entities/Error';

import type { FeedbackRow } from '#repositories/Feedback';
import type { Page, Paged } from 'core/controllers/User';
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

/** Enough messages to read in one sitting. */
const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * What people write to the owner (`0037`).
 *
 * The only place in this product where somebody's own words are stored to be
 * read by another person — and the only reason that is not a leak is that they
 * were written for exactly that. Nothing infers, nothing summarises, nothing
 * reaches a model: the message is delivered as typed.
 */
export const FeedbackController = {
  /** One page of the inbox, newest first, and how many are still waiting. */
  async list(page: Page = {}): Promise<Paged<FeedbackView> & { readonly waiting: number }> {
    const size = Math.min(Math.max(page.size ?? PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const offset = Math.max(page.offset ?? 0, 0);
    const { rows, total, waiting } = await FeedbackRepository.findAll(size, offset);

    return { offset, rows: rows.map(present), size, total, waiting };
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
