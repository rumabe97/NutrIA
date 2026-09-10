import type { FeedbackView } from 'core/controllers/Feedback';
import type { Paged } from 'core/controllers/User';

/**
 * One page of messages plus how many are unhandled — the count is what makes it
 * an inbox rather than a growing wall, and it belongs to the page, not a row.
 */
export type FeedbackInboxDto = Paged<FeedbackView> & { readonly waiting: number };
