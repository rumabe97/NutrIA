import type { Dictionary } from '../i18n/dictionaries/es-ES';

/**
 * What the browser's WebAuthn prompt answers when nobody finished it: the person closed
 * it or let it time out (`NotAllowedError`, passed through by SimpleWebAuthn), another
 * prompt took its place (an abort), or the passkey client gave up before asking. None of
 * these is a failure the screen reports: the person knows they cancelled.
 */
const CANCELLED = new Set(['AUTH_CANCELLED', 'ERROR_CEREMONY_ABORTED', 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY']);

/** The browser can make and use a passkey at all. Without it, nothing about passkeys is drawn. */
export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
}

/**
 * For `useSyncExternalStore` over something a page cannot see change — the browser's
 * WebAuthn, the page's host: nothing to subscribe to. The server's answer (`false`, `''`)
 * is what hydration renders, and the client's follows straight after.
 */
export function unchanging(): () => void {
  return () => undefined;
}

/**
 * The browser offers saved passkeys in the email field's suggestions (conditional UI),
 * which is what `autocomplete="username webauthn"` asks for. False when it cannot say.
 */
export async function passkeyAutofillAvailable(): Promise<boolean> {
  if (!passkeysSupported() || typeof PublicKeyCredential.isConditionalMediationAvailable !== 'function') {
    return false;
  }

  try {
    return await PublicKeyCredential.isConditionalMediationAvailable();
  } catch {
    return false;
  }
}

/** A refusal from the passkey client, as much of it as the screens read: never its message. */
export interface PasskeyError {
  code?: string;
  status: number;
}

/**
 * What a failed passkey sign-in says, by code — `undefined` when it says nothing because
 * the prompt was cancelled. Every refusal the API gives (`PASSKEY_NOT_FOUND`,
 * `AUTHENTICATION_FAILED`, `CHALLENGE_NOT_FOUND`, anything else) is the same sentence,
 * so the screen never says whether a key is known; only the rate limit is a wait.
 */
export function passkeySignInRefusal(error: PasskeyError, dictionary: Dictionary): string | undefined {
  if (error.code && CANCELLED.has(error.code)) {
    return undefined;
  }

  return error.status === 429 ? dictionary.auth.tooManyAttempts : dictionary.passkeys.signInFailed;
}

/**
 * What a failed attempt to add a passkey means, by code.
 *
 * - `cancelled`: the prompt was closed; nothing is said.
 * - `password`: the password typed first is wrong; it goes on the field.
 * - `stale`: the session is too old for this; only signing in again goes on.
 * - `failed`: anything else, with the words to say.
 */
export type PasskeyAddRefusal =
  { kind: 'cancelled' } | { kind: 'failed'; message: string } | { kind: 'password'; message: string } | { kind: 'stale' };

export function passkeyAddRefusal(error: PasskeyError, dictionary: Dictionary): PasskeyAddRefusal {
  const t = dictionary.passkeys;

  if (error.code && CANCELLED.has(error.code)) {
    return { kind: 'cancelled' };
  }

  switch (error.code) {
    case 'INVALID_PASSWORD':
      return { kind: 'password', message: dictionary.twoFactor.wrongPassword };
    case 'SESSION_NOT_FRESH':
      return { kind: 'stale' };
    case 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED':
      // Said by the browser, before anything reached the API: this device already holds one.
      return { kind: 'failed', message: t.alreadyAdded };
    default:
      return { kind: 'failed', message: error.status === 429 ? dictionary.auth.tooManyAttempts : t.addFailed };
  }
}
