import { z } from 'zod';

/**
 * Why the assistant did not answer, as a **code** — the words are the web
 * app's, in its dictionaries, the way every refusal in this product reaches a
 * screen (`passkeySignInRefusal`). A stored thread then re-renders in the
 * language it is read in, instead of freezing in the one it was written in.
 *
 * - `off_topic` — not nutrition or dietetics; cut before anything was written.
 * - `clinical` — a dose, a medication or a situation § Users sends to a
 *   professional; cut before anything was written.
 * - `allergen` — the answer named a food this person cannot eat; withheld.
 * - `invented_figure` — the answer stated a nutritional figure nobody supplied;
 *   withheld.
 * - `acting` — the answer claimed to have changed something, or wrote a plan;
 *   withheld, because it changes nothing and somebody would believe it did.
 *
 * Here, at the bottom of the package, because both the domain's checks and the
 * stored turn name it; `ai_messages`' check in the database holds the same list,
 * and a test keeps the two equal.
 */
export const ASSISTANT_DECLINES = ['acting', 'allergen', 'clinical', 'invented_figure', 'off_topic'] as const;

export type AssistantDecline = (typeof ASSISTANT_DECLINES)[number];

/**
 * The longest question the assistant takes. A question about a plan is a few
 * lines; a paste of a whole diet or a log is refused at the door, which also
 * bounds what one message can cost before anything is labelled.
 */
export const ASSISTANT_MESSAGE_MAX_LENGTH = 1000;

/**
 * One message to the assistant (project 023): the question, and the
 * conversation it continues — absent to start one.
 *
 * **The client sends no history.** The server owns the thread, so the turns a
 * model is replayed come from the store and never from the request: a forged
 * history cannot buy a long call, and there is nothing to defend against
 * because there is nothing to accept.
 *
 * The question is **a person's own words** reaching a prompt — the second such
 * field in the product after `dishRequest` — and it stops at the prompt: no log
 * line, no error report, no analytics property ever carries it.
 */
export const askAssistantSchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(ASSISTANT_MESSAGE_MAX_LENGTH)
});

export type AskAssistant = z.infer<typeof askAssistantSchema>;

/** A conversation as its list shows it: no turn, only what names it. */
export type AssistantConversation = {
  readonly id: string;
  readonly createdAt: Date;
  /** From the first question, by the service — never written by the model. */
  readonly title: string;
  readonly updatedAt: Date;
};

/** One stored turn. A declined one carries its code and no prose. */
export type AssistantTurn = {
  readonly id: string;
  readonly content: string;
  readonly createdAt: Date;
  readonly decline: AssistantDecline | null;
  readonly role: 'assistant' | 'user';
};

/**
 * A person's own copy of everything they said to the assistant and what it
 * answered (art. 20 RGPD): built for them alone, downloaded by them, read by
 * nobody else on the way (PRD 11). A declined turn carries its code, as stored.
 */
export type AssistantExport = {
  readonly conversations: readonly {
    readonly id: string;
    readonly createdAt: Date;
    readonly title: string;
    readonly turns: readonly {
      readonly content: string;
      readonly createdAt: Date;
      readonly decline: AssistantDecline | null;
      /** Who wrote it, machine-readably: a model's answer is marked as such (AI Act art. 50.2). */
      readonly generatedBy: 'ai' | 'person';
      readonly role: 'assistant' | 'user';
    }[];
    readonly updatedAt: Date;
  }[];
  readonly exportedAt: Date;
};
