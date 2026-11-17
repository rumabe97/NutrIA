import type { AssistantConversation, AssistantDecline, AssistantExport, AssistantTurn } from 'core/entities/Assistant';
import type { AssistantNotice } from 'core/domain/Assistant';

/**
 * One line of the answer stream (`POST /assistant/messages`), as NDJSON — one
 * JSON object per line, written as each is ready.
 *
 * - `conversation` first, always: the thread this message landed in, so a
 *   screen that started a new one knows its id before any text arrives.
 * - `text`, any number of times: a sentence (or several) that **every check has
 *   already passed** — the owner's choice of 2026-11-09. Nothing unchecked is
 *   ever sent.
 * - `end`, last, always: `decline` null for an answer that finished, or the code
 *   for why it was cut or stopped. A decline after some `text` lines means those
 *   lines were safe and the rest was not shown.
 *   `notice` is the fixed notice the screen draws under what was shown — today,
 *   the one an answer about a food supplement carries (`0108`) — decided by code
 *   from the words, never written by the model.
 * - `error` instead of `end` when the provider failed mid-answer: what was
 *   shown stays shown; the rest never came.
 */
export type AssistantEventDto =
  | { readonly decline: AssistantDecline | null; readonly notice: AssistantNotice | null; readonly type: 'end' }
  | { readonly id: string; readonly type: 'conversation' }
  | { readonly notice: AssistantNotice | null; readonly type: 'error' }
  | { readonly text: string; readonly type: 'text' };

/** Where this person stands this fortnight — for the screen's «18 de 20». */
export type AssistantStandingDto = {
  readonly allowed: boolean;
  /** False once the fortnight's off-topic cuts reach their ceiling: every message then gets the standing sentence. */
  readonly labelling: boolean;
  readonly limit: number;
  readonly remaining: number;
  /** The day the count resets, or null for a rolling fourteen days («en los últimos 14 días»). */
  readonly resetsOn: string | null;
  readonly used: number;
};

export type AssistantConversationDto = AssistantConversation;

/** A stored turn as a thread shows it: with the notice its words call for, worked out on every read. */
export type AssistantTurnDto = AssistantTurn & { readonly notice: AssistantNotice | null };

export type AssistantThreadDto = { readonly conversation: AssistantConversation; readonly turns: readonly AssistantTurnDto[] };

/** A person's own copy of every conversation, for them to download (art. 20). */
export type AssistantExportDto = AssistantExport;
