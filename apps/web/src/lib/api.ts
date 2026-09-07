import { API_URL } from './env';
import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale } from '../i18n/config';

import type { Dictionary } from '../i18n/dictionaries/es-ES';

/**
 * Error codes the API returns. Stable — the API is free to reword `message`,
 * so UI copy switches on the code, never on the text.
 */
export type ApiErrorCode =
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'INVALID_INPUT'
  | 'NETWORK'
  | 'NOT_FOUND'
  | 'ONBOARDING_INCOMPLETE'
  | 'REQUEST_ERROR'
  | 'UNSAFE_CONTENT';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, readonly string[]> = {}
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Code → dictionary key. The API's own `message` is never shown: it is written
 * server-side in one language and the reader may not have that one.
 */
const MESSAGE_KEYS: Record<ApiErrorCode, keyof Dictionary['errors']> = {
  CONFLICT: 'conflict',
  INTERNAL_ERROR: 'internal',
  INVALID_INPUT: 'invalidInput',
  NETWORK: 'network',
  NOT_FOUND: 'notFound',
  ONBOARDING_INCOMPLETE: 'onboardingIncomplete',
  REQUEST_ERROR: 'request',
  UNSAFE_CONTENT: 'unsafeContent'
};

export function messageFor(error: unknown, dictionary: Dictionary): string {
  return dictionary.errors[error instanceof ApiError ? MESSAGE_KEYS[error.code] : 'internal'];
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown };

/**
 * The single way this app talks to the API.
 *
 * `credentials: 'include'` is what carries the session cookie; the cookie is
 * httpOnly, so the token is never readable from JavaScript. Nothing here ever
 * sends a user id — the API takes it from the session.
 */
export async function api<T>(path: string, { body, headers, ...options }: Options = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        // The active locale travels with every request. Nothing reads it yet —
        // localising the ingredient catalogue and the generated dishes is phase
        // 6 — but the plumbing belongs with the locale decision, not with the
        // first feature that needs it.
        'Accept-Language': readLocaleCookie(),
        ...headers
      }
    });
  } catch {
    // A machine string: the reader never sees it, `messageFor` supplies the copy.
    throw new ApiError('NETWORK', 'Network error', 0);
  }

  if (response.status === 204) {return undefined as T;}

  const payload: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const { code, fieldErrors, message } = payload as { code?: ApiErrorCode; fieldErrors?: Record<string, string[]>; message?: string };

    throw new ApiError(code ?? 'REQUEST_ERROR', message ?? 'Request failed', response.status, fieldErrors ?? {});
  }

  return payload as T;
}

/** The presentation locale, from the cookie the switcher writes. */
function readLocaleCookie(): string {
  if (typeof document === 'undefined') {return DEFAULT_LOCALE;}

  const match = document.cookie.split('; ').find(entry => entry.startsWith(`${LOCALE_COOKIE}=`));

  return parseLocale(match?.slice(LOCALE_COOKIE.length + 1)) ?? DEFAULT_LOCALE;
}
