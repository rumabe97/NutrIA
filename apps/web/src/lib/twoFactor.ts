import { interpolate } from './format';

import type { Dictionary } from '../i18n/dictionaries/es-ES';

/** An authenticator's code: six digits, every 30 seconds. */
export const TOTP_LENGTH = 6;

/**
 * The code as the API wants it, from what was typed or pasted: authenticators show it
 * as `123 456`, and a paste can carry a space, a dash or a dot. `undefined` when what
 * is left is not six digits — the form says so before the round trip.
 */
export function totpCode(typed: string): string | undefined {
  const digits = typed.replace(/[\s.-]/g, '');

  return new RegExp(`^\\d{${TOTP_LENGTH}}$`).test(digits) ? digits : undefined;
}

/**
 * A backup code as the API stores it: ten letters and digits, `abcde-12345`, compared
 * exactly — case included. Spaces are dropped, and ten characters typed without the
 * dash get it back; the case is left alone, since `A` and `a` are different codes.
 * `undefined` when it cannot be one.
 */
export function backupCode(typed: string): string | undefined {
  const compact = typed.replace(/\s/g, '');
  const code = /^[A-Za-z0-9]{10}$/.test(compact) ? `${compact.slice(0, 5)}-${compact.slice(5)}` : compact;

  return /^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/.test(code) ? code : undefined;
}

/** The key inside an `otpauth://` address, for an authenticator that has no camera. `undefined` when it carries none. */
export function totpSecret(uri: string): string | undefined {
  try {
    return new URL(uri).searchParams.get('secret') ?? undefined;
  } catch {
    return undefined;
  }
}

/** The key in groups of four, the way it is read off one screen and typed into another; `at` is where each starts, a stable key. */
export function secretGroups(secret: string): { at: number; text: string }[] {
  return (secret.match(/.{1,4}/g) ?? []).map((text, index) => ({ at: index * 4, text }));
}

/** The file "Descargar" saves: what it is, for which account and when, the codes one a line, and what each is for. */
export function backupCodesFile(codes: readonly string[], email: string, date: string, dictionary: Dictionary): string {
  const t = dictionary.twoFactor;

  return [t.fileTitle, email, interpolate(t.fileDate, { date }), '', ...codes, '', t.fileNote, ''].join('\n');
}

/**
 * What a refusal from a two-factor route means, by its code — never by its message.
 *
 * - `field`: about what was typed; it goes on the field as well as in the alert.
 * - `restart`: the pending sign-in is gone — expired, out of attempts, or the account
 *   locked for longer than the challenge lives — and only signing in again goes on.
 *
 * `where` picks the words: the challenge says a failure is a failure to sign in, and
 * the setup in /perfil, checking a code against an app just added, says it does not match.
 */
export interface TwoFactorRefusal {
  field: 'code' | 'password' | null;
  message: string;
  restart: boolean;
}

export function twoFactorRefusal(
  code: string | undefined,
  status: number,
  dictionary: Dictionary,
  where: 'challenge' | 'settings'
): TwoFactorRefusal {
  const t = dictionary.twoFactor;

  switch (code) {
    case 'INVALID_CODE':
      return { field: 'code', message: where === 'challenge' ? t.wrongCode : t.setupWrongCode, restart: false };
    case 'INVALID_BACKUP_CODE':
      return { field: 'code', message: t.wrongBackupCode, restart: false };
    case 'INVALID_PASSWORD':
      return { field: 'password', message: t.wrongPassword, restart: false };
    case 'ACCOUNT_TEMPORARILY_LOCKED':
      // In /perfil there is no sign-in to go back to: only a wait.
      return where === 'challenge' ? { field: null, message: t.locked, restart: true } : { field: null, message: t.lockedSettings, restart: false };
    case 'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE':
      return { field: null, message: t.attemptsSpent, restart: true };
    case 'INVALID_TWO_FACTOR_COOKIE':
      return { field: null, message: t.expired, restart: true };
    default:
      // Better Auth's rate limit answers 429 with no code of its own: that one is a wait.
      if (status === 429) {
        return { field: null, message: dictionary.auth.tooManyAttempts, restart: false };
      }

      return {
        field: null,
        message: where === 'challenge' ? interpolate(dictionary.auth.signInUnavailable, { status }) : dictionary.errors.internal,
        restart: false
      };
  }
}
