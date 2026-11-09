/**
 * One stored turn of a conversation, as the service read it back.
 *
 * `replay` is false for a turn that must never reach a model again: a question
 * that was cut (off topic, clinical) and the decline that answered it, and an
 * answer that was withheld. Replaying them would put back in front of the model
 * exactly what a screen took out.
 */
export type StoredTurn = { readonly replay: boolean; readonly role: 'assistant' | 'user'; readonly text: string };

/** A turn as the model is sent it. */
export type ReplayedTurn = { readonly role: 'assistant' | 'user'; readonly text: string };

export type HistoryLimits = { readonly maxCharacters: number; readonly maxTurns: number };

/**
 * How much of a kept thread is replayed to the model: six exchanges, and about
 * two thousand tokens of them. What a long conversation costs is decided here,
 * once, as a tested property — not discovered on a bill.
 */
export const HISTORY_LIMITS: HistoryLimits = { maxCharacters: 8000, maxTurns: 12 };

/**
 * The turns of a kept thread that are replayed to the model, oldest first.
 *
 * - **Newest first** when choosing: the question being asked is about what was
 *   just said, not about the first message of the week.
 * - **Never a question without its answer, or an answer without its question**:
 *   a turn is replayed only inside a complete exchange, and an exchange is taken
 *   whole or not at all — the model is never shown half a conversation.
 * - **Contiguous**: the first exchange that does not fit ends the window. Skipping
 *   it to fit an older one would hand the model a conversation with a hole in it.
 * - **Bounded twice**, by turns and by characters, because one long recipe can
 *   cost what ten short questions do.
 */
export function historyWindow(turns: readonly StoredTurn[], limits: HistoryLimits = HISTORY_LIMITS): readonly ReplayedTurn[] {
  const exchanges: (readonly [StoredTurn, StoredTurn])[] = [];

  for (let index = 0; index < turns.length - 1; index += 1) {
    const question = turns[index];
    const answer = turns[index + 1];

    if (question?.role === 'user' && answer?.role === 'assistant') {
      if (question.replay && answer.replay) {
        exchanges.push([question, answer]);
      }

      index += 1;
    }
  }

  const window: (readonly [StoredTurn, StoredTurn])[] = [];
  let characters = 0;

  for (const exchange of exchanges.reverse()) {
    const size = exchange[0].text.length + exchange[1].text.length;

    if ((window.length + 1) * 2 > limits.maxTurns || characters + size > limits.maxCharacters) {
      break;
    }

    window.unshift(exchange);
    characters += size;
  }

  return window.flatMap(([question, answer]) => [
    { role: question.role, text: question.text },
    { role: answer.role, text: answer.text }
  ]);
}
