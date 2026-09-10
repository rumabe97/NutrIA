import { z } from 'zod';

/**
 * What kind of message this is, so a wall of text can be read as a queue.
 *
 * Three, and no more: the point of the field is to let the owner decide what to
 * open first, and a taxonomy with eight branches is one nobody fills in
 * honestly.
 */
export const FEEDBACK_KINDS = ['idea', 'problem', 'other'] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/**
 * Long enough for somebody to explain what went wrong, short enough that the
 * inbox stays readable and a paste of a whole log is refused at the door.
 */
export const FEEDBACK_MAX_LENGTH = 2000;

export const submitFeedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS).default('other'),
  message: z.string().trim().min(1).max(FEEDBACK_MAX_LENGTH)
});

export type SubmitFeedback = z.infer<typeof submitFeedbackSchema>;

/** The owner's own note to themselves, and reversible. */
export const handleFeedbackSchema = z.object({ handled: z.boolean() });

export type HandleFeedback = z.infer<typeof handleFeedbackSchema>;
