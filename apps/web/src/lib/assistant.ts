import { API_URL } from './env';
import { ApiError } from './api';

import type { ApiErrorCode } from './api';

/** Why an answer was not given, or stopped — each is the assistant saying what it is for, not a failure. */
export type AssistantDecline = 'acting' | 'allergen' | 'clinical' | 'invented_figure' | 'off_topic';

/** One line of the answer's stream (`AssistantEventDto`). */
export type AssistantEvent =
  | { readonly decline: AssistantDecline | null; readonly type: 'end' }
  | { readonly id: string; readonly type: 'conversation' }
  | { readonly text: string; readonly type: 'text' }
  | { readonly type: 'error' };

export type AssistantTurn = {
  readonly id: string;
  readonly content: string;
  readonly createdAt: string;
  readonly decline: AssistantDecline | null;
  readonly role: 'assistant' | 'user';
};

export type AssistantConversation = { readonly id: string; readonly createdAt: string; readonly title: string; readonly updatedAt: string };

export type AssistantThread = { readonly conversation: AssistantConversation; readonly turns: readonly AssistantTurn[] };

export type AssistantStanding = {
  readonly allowed: boolean;
  readonly labelling: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetsOn: string | null;
  readonly used: number;
};

/** Splits what has arrived into whole lines and the part of a line still on its way. */
export function readLines(buffer: string): { readonly lines: readonly string[]; readonly rest: string } {
  const parts = buffer.split('\n');
  const rest = parts.pop() ?? '';

  return { lines: parts.filter(line => line.trim() !== ''), rest };
}

/**
 * One question, and its answer as it is written.
 *
 * A refusal that has a status — over the allowance (429), the assistant down
 * for everybody (503), a conversation that is not this person's (404) — is
 * thrown as an `ApiError` **before** any event, the same error every other
 * call in this app throws. After the first event the answer can only end: an
 * `end` with its decline, an `error`, or — when the connection drops — a
 * `NETWORK` error thrown mid-answer, with what was shown left as it was.
 *
 * The question goes to this service and nowhere else. Nothing is stored in the
 * browser by this function.
 */
export async function askAssistant(
  body: { readonly conversationId?: string; readonly message: string },
  onEvent: (event: AssistantEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/assistant/messages`, {
      body: JSON.stringify(body),
      credentials: 'include',
      headers: { Accept: 'application/x-ndjson', 'Content-Type': 'application/json' },
      method: 'POST',
      signal
    });
  } catch {
    throw new ApiError('NETWORK', 'Network error', 0);
  }

  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => ({}))) as {
      code?: ApiErrorCode;
      fieldErrors?: Record<string, string[]>;
      message?: string;
      retryAt?: string;
    };

    throw new ApiError(
      payload.code ?? 'REQUEST_ERROR',
      payload.message ?? 'Request failed',
      response.status,
      payload.fieldErrors ?? {},
      payload.retryAt ?? null
    );
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += value;

      const { lines, rest } = readLines(buffer);

      buffer = rest;

      for (const line of lines) {
        onEvent(JSON.parse(line) as AssistantEvent);
      }
    }
  } catch {
    throw new ApiError('NETWORK', 'The answer was cut off', 0);
  }
}

/** One line of a conversation on screen: the warning, or a turn. */
export type ThreadItem<T> = { readonly kind: 'turn'; readonly turn: T } | { readonly kind: 'warning' };

/**
 * What a conversation shows, in order: **the warning first, always**, then the
 * turns (PRD 12). The one place the order is decided, so no conversation — new,
 * reopened or carried on — can be drawn without it, and it is never something a
 * person dismisses once.
 */
export function threadItems<T>(turns: readonly T[]): readonly ThreadItem<T>[] {
  return [{ kind: 'warning' }, ...turns.map(turn => ({ kind: 'turn' as const, turn }))];
}
