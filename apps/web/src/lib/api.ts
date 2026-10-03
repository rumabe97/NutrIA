import { API_URL } from './env';
import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale } from '../i18n/config';
import { withLocale } from '../i18n/routes';

import type { Dictionary } from '../i18n/dictionaries/es-ES';

/**
 * Error codes the API returns. Stable — the API is free to reword `message`,
 * so UI copy switches on the code, never on the text.
 */
export type ApiErrorCode =
  | 'ACCOUNT_NOT_ACTIVATED'
  | 'CARE_LINK_EXISTS'
  | 'CONFLICT'
  | 'EMAIL_NOT_VERIFIED'
  | 'INTERNAL_ERROR'
  | 'INVALID_INPUT'
  | 'MEAL_IN_FUTURE'
  | 'NETWORK'
  | 'NOT_FOUND'
  | 'ONBOARDING_INCOMPLETE'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'PICTURE_ALLERGENS_MISMATCH'
  | 'PICTURE_CAP_REACHED'
  | 'PICTURE_DRAWING'
  | 'PICTURE_FLAG_OFF'
  | 'PICTURE_NO_CANDIDATE'
  | 'PICTURE_NOT_ACCEPTABLE'
  | 'PICTURE_NOT_REMOVABLE'
  | 'PICTURE_NOT_RETRYABLE'
  | 'PICTURE_UNAVAILABLE'
  | 'PLAN_PAUSED'
  | 'PRACTICE_FULL'
  | 'PROFILE_CONSENT_REQUIRED'
  | 'QUOTA_EXCEEDED'
  | 'REAUTHENTICATION_REQUIRED'
  | 'REQUEST_ERROR'
  | 'TWO_FACTOR_NOT_ENABLED'
  | 'TWO_FACTOR_REMOVAL_PENDING'
  | 'UNDER_MINIMUM_AGE'
  | 'UNSAFE_CONTENT';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, readonly string[]> = {},
    /** ISO date a spent allowance renews, when the API said so. */
    public readonly retryAt: string | null = null,
    /** The link `CARE_LINK_EXISTS` names — the professional, since when, its status. Null for every other code. */
    public readonly link: { professionalName: string; since: string; status: 'active' | 'paused' } | null = null,
    /** The number `PRACTICE_FULL` names — how many clients the practice's plan includes. Null for every other code. */
    public readonly practice: { includedClients: number } | null = null
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
  ACCOUNT_NOT_ACTIVATED: 'accountNotActivated',
  CARE_LINK_EXISTS: 'careLinkExists',
  CONFLICT: 'conflict',
  EMAIL_NOT_VERIFIED: 'emailNotVerified',
  INTERNAL_ERROR: 'internal',
  INVALID_INPUT: 'invalidInput',
  MEAL_IN_FUTURE: 'mealInFuture',
  NETWORK: 'network',
  NOT_FOUND: 'notFound',
  ONBOARDING_INCOMPLETE: 'onboardingIncomplete',
  PASSWORD_CHANGE_REQUIRED: 'passwordChangeRequired',
  PICTURE_ALLERGENS_MISMATCH: 'pictureAllergensMismatch',
  PICTURE_CAP_REACHED: 'pictureCapReached',
  PICTURE_DRAWING: 'pictureDrawing',
  PICTURE_FLAG_OFF: 'pictureFlagOff',
  PICTURE_NO_CANDIDATE: 'pictureNoCandidate',
  PICTURE_NOT_ACCEPTABLE: 'pictureNotAcceptable',
  PICTURE_NOT_REMOVABLE: 'pictureNotRemovable',
  PICTURE_NOT_RETRYABLE: 'pictureNotRetryable',
  PICTURE_UNAVAILABLE: 'pictureUnavailable',
  PLAN_PAUSED: 'planPaused',
  PRACTICE_FULL: 'practiceFull',
  PROFILE_CONSENT_REQUIRED: 'profileConsentRequired',
  QUOTA_EXCEEDED: 'quotaExceeded',
  REAUTHENTICATION_REQUIRED: 'reauthenticationRequired',
  REQUEST_ERROR: 'request',
  TWO_FACTOR_NOT_ENABLED: 'twoFactorNotEnabled',
  TWO_FACTOR_REMOVAL_PENDING: 'twoFactorRemovalPending',
  UNDER_MINIMUM_AGE: 'underMinimumAge',
  UNSAFE_CONTENT: 'unsafeContent'
};

export function messageFor(error: unknown, dictionary: Dictionary): string {
  if (!(error instanceof ApiError)) {
    return dictionary.errors.internal;
  }

  // A code this build does not know yet (the API adds them — `AUTH_*` from Better Auth's
  // refusals, say) still says something, rather than an empty alert.
  return dictionary.errors[MESSAGE_KEYS[error.code] ?? 'request'];
}

/** Where an account whose password must be changed is sent (`PASSWORD_CHANGE_REQUIRED`). */
export const PASSWORD_CHANGE_PATH = '/cambiar-contrasena';

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

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const { code, fieldErrors, link, message, practice, retryAt } = payload as {
      code?: ApiErrorCode;
      fieldErrors?: Record<string, string[]>;
      link?: { professionalName: string; since: string; status: 'active' | 'paused' };
      message?: string;
      practice?: { includedClients: number };
      retryAt?: string;
    };

    // A password found in a breach locks every route but the change itself (project 011):
    // whatever was being done, the one way forward is the screen that changes it. The
    // server-rendered pages get there through `redirectUnlessReady`; this is the same for a
    // request made from the browser. The error is still thrown, so the caller stops.
    if (code === 'PASSWORD_CHANGE_REQUIRED' && typeof window !== 'undefined') {
      window.location.assign(withLocale(PASSWORD_CHANGE_PATH, parseLocale(readLocaleCookie()) ?? DEFAULT_LOCALE));
    }

    throw new ApiError(
      code ?? 'REQUEST_ERROR',
      message ?? 'Request failed',
      response.status,
      fieldErrors ?? {},
      retryAt ?? null,
      link ?? null,
      practice ?? null
    );
  }

  return payload as T;
}

/** The presentation locale, from the cookie the switcher writes. */
function readLocaleCookie(): string {
  if (typeof document === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const match = document.cookie.split('; ').find(entry => entry.startsWith(`${LOCALE_COOKIE}=`));

  return parseLocale(match?.slice(LOCALE_COOKIE.length + 1)) ?? DEFAULT_LOCALE;
}
