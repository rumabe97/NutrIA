import { interpolate } from '../i18n/interpolate';
import { passwordRefusalMessage } from './newPassword';

import type { Dictionary } from '../i18n/dictionaries/es-ES';

/** What the sign-up form shows once the API has answered. */
export type SignUpOutcome =
  | { readonly kind: 'password'; readonly message: string }
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'sent'; readonly message: string };

/**
 * The sign-up form's answer (PLAN 011 phase 8). The API answers a new address
 * and one that already has an account the same 200, with no session, so a
 * success is "we have written to {email}" for both: what the mail says is the
 * rest. A refused password says why, on the field. A 429 is a wait. There is no
 * "email taken" any more: the API never says so.
 */
export function signUpOutcome(
  error: { readonly code?: string; readonly status: number } | null,
  email: string,
  dictionary: Dictionary
): SignUpOutcome {
  if (!error) {
    return { kind: 'sent', message: interpolate(dictionary.auth.signUpSent, { email }) };
  }

  const refusal = passwordRefusalMessage(error.code, dictionary);

  if (refusal) {
    return { kind: 'password', message: refusal };
  }

  return { kind: 'refused', message: error.status === 429 ? dictionary.auth.tooManyAttempts : dictionary.auth.signUpFailed };
}

/**
 * The sign-in form's words for a refusal. One message for a wrong password, an
 * unknown address and an unconfirmed account's right password: the API answers
 * all three the same 401, and telling them apart would make this form an
 * account-enumeration oracle — so the message says, for everybody, what an
 * unconfirmed person must do. A 429 is a wait — the per-IP limit or the
 * per-address brake (PLAN 011 phase 7). Anything else that is *not* a refusal —
 * the service down, a rejected origin, a database the API cannot reach — says
 * so instead: for a whole afternoon those read as "wrong password" and sent the
 * owner looking in the wrong place.
 */
export function signInRefusal(status: number, dictionary: Dictionary): string {
  if (status === 401) {
    return dictionary.auth.invalidCredentials;
  }

  return status === 429 ? dictionary.auth.signInPaused : interpolate(dictionary.auth.signInUnavailable, { status });
}
