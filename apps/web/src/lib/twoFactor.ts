import type { Dictionary } from '../i18n/dictionaries/es-ES';

/** An authenticator's code: six digits, every 30 seconds. */
export const TOTP_LENGTH = 6;

/** How many backup codes the API hands out at a time (`backupCodeOptions.amount`). */
export const BACKUP_CODE_COUNT = 10;

/**
 * The code as the API wants it, from what was typed or pasted: authenticators show it
 * as `123 456`, and a paste can carry a space or a dash. `undefined` when what is left
 * is not six digits — the form says so before the round trip.
 */
export function totpCode(typed: string): string | undefined {
  const digits = typed.replace(/[\s-]/g, '');

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

/**
 * The key inside an `otpauth://` address, in groups of four — the way an authenticator
 * that has no camera asks for it. `undefined` when the address carries none.
 */
export function totpSecret(uri: string): string | undefined {
  try {
    const secret = new URL(uri).searchParams.get('secret');

    return secret ? (secret.match(/.{1,4}/g) ?? []).join(' ') : undefined;
  } catch {
    return undefined;
  }
}

/** The file "Descargar" saves: a title, the codes one a line, and what each is for. */
export function backupCodesFile(codes: readonly string[], email: string, dictionary: Dictionary): string {
  const t = dictionary.twoFactor;

  return [t.fileTitle, email, '', ...codes, '', t.fileNote, ''].join('\n');
}

/**
 * What a refusal from a two-factor route means, by its code — never by its message.
 *
 * - `field`: about what was typed; it goes on the field as well as in the alert.
 * - `restart`: the pending sign-in is gone — expired, or out of attempts — and only
 *   signing in again starts a new one.
 */
export interface TwoFactorRefusal {
  field: 'code' | 'password' | null;
  message: string;
  restart: boolean;
}

export function twoFactorRefusal(code: string | undefined, status: number, dictionary: Dictionary): TwoFactorRefusal {
  const t = dictionary.twoFactor;

  switch (code) {
    case 'INVALID_CODE':
      return { field: 'code', message: t.wrongCode, restart: false };
    case 'INVALID_BACKUP_CODE':
      return { field: 'code', message: t.wrongBackupCode, restart: false };
    case 'INVALID_PASSWORD':
      return { field: 'password', message: t.wrongPassword, restart: false };
    case 'ACCOUNT_TEMPORARILY_LOCKED':
      return { field: null, message: t.locked, restart: false };
    case 'INVALID_TWO_FACTOR_COOKIE':
    case 'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE':
      return { field: null, message: t.expired, restart: true };
    default:
      // Better Auth's rate limit answers 429: that one is a wait, not a failure.
      return { field: null, message: status === 429 ? dictionary.auth.tooManyAttempts : dictionary.errors.internal, restart: false };
  }
}
