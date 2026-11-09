import type { AiCall, AiUsage } from './AiClient.js';
import type { AiFeature } from 'core/entities/Analytics';

/** One turn of a conversation as the model is told it: who said it, and what they said. */
export type AiTurn = { readonly role: 'assistant' | 'user'; readonly text: string };

export type AiStreamRequest = {
  /** Which part of the service is spending the call, recorded on its `ai_call` (`0071`). */
  readonly feature: AiFeature;
  /** The most the answer may write, in tokens; absent, the provider's own limit. */
  readonly maxOutputTokens?: number;
  /**
   * The conversation, oldest first, ending with what the person just asked.
   * **Already bounded by the caller** — this client sends what it is given, and
   * what a long thread costs is decided where the thread is read, not here
   * (`historyWindow`, project 023 phase 2).
   */
  readonly messages: readonly AiTurn[];
  /** Ends the stream when the caller's budget does; the answer then fails as a `timeout`. */
  readonly signal?: AbortSignal;
  readonly system: string;
};

/** How a finished stream went, for the caller's own record. Absent from one that failed. */
export type AiStreamEnd = { readonly call: AiCall; readonly usage: AiUsage };

/**
 * A stream in two halves: the text as it arrives, and what it turns out to have
 * cost.
 *
 * `finished` resolves only once `text` has been read to the end, because that is
 * when the provider says how many tokens it wrote. A caller that abandons the
 * text — somebody closing the tab — gets a rejection rather than a promise that
 * never settles.
 */
export type AiStream = { readonly finished: Promise<AiStreamEnd>; readonly text: AsyncIterable<string> };

/**
 * The boundary for an answer written as it is read, as `AiClient` is the boundary
 * for an answer with a schema.
 *
 * Deliberately a second boundary and not a method on the first: everything
 * downstream of `AiClient` depends on **structured output**, which is what
 * `docs/ARCHITECTURE.md` § Invariants means by never parsing free text. This one
 * returns prose, so it is only ever safe behind the screens project 023 builds —
 * the question labelled before it is asked, the figures checked against a set the
 * service supplied, the allergens checked before a word is shown. Giving the
 * structured client a `stream` method would have made that free text reachable
 * from every caller of `AiClient`, which is 1 import away from a plan built from
 * prose.
 */
export abstract class StreamingAiClient {
  /** False when no model is configured — no `ANTHROPIC_API_KEY`, so the assistant is off. */
  abstract get isAvailable(): boolean;

  abstract stream(request: AiStreamRequest): AiStream;
}
