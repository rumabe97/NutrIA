import { PASSWORD_ERROR_CODES, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from 'core/entities/Password';

import { interpolate } from './format';

import type { Dictionary } from '../i18n/dictionaries/es-ES';
import type { PasswordErrorCode } from 'core/entities/Password';

/**
 * What a new-password field tells a password manager about the rule, in the `passwordrules`
 * syntax Safari reads: the length and nothing else, because there is no composition rule
 * (report `0007` § 3.2 D2). Generated from the same bounds the API enforces.
 */
export const PASSWORD_RULES = `minlength: ${PASSWORD_MIN_LENGTH}; maxlength: ${PASSWORD_MAX_LENGTH};`;

/**
 * The refusals a new password can meet, by the code the API answers with (report `0007` § 4.1):
 * Better Auth's own two for the length, and ours for a password that names its owner or
 * appears in a known breach. One code covers every context word, so the copy never says
 * which one matched.
 */
export type PasswordRefusal = 'PASSWORD_TOO_LONG' | 'PASSWORD_TOO_SHORT' | PasswordErrorCode;

/**
 * The length check the form runs before the round trip, with the same bounds as the API
 * (both read them from `core`). A courtesy, not the boundary: the API checks again.
 */
export function passwordLengthRefusal(password: string): PasswordRefusal | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return 'PASSWORD_TOO_SHORT';
  }

  return password.length > PASSWORD_MAX_LENGTH ? 'PASSWORD_TOO_LONG' : undefined;
}

/**
 * The copy for a refused password, or `undefined` when `code` is not a password refusal —
 * the caller then says what it said before. Only the code decides, never the message: the
 * API is free to reword that.
 */
export function passwordRefusalMessage(code: string | undefined, dictionary: Dictionary): string | undefined {
  switch (code) {
    case 'PASSWORD_TOO_SHORT':
      return interpolate(dictionary.auth.passwordTooShort, { count: PASSWORD_MIN_LENGTH });
    case 'PASSWORD_TOO_LONG':
      return interpolate(dictionary.auth.passwordTooLong, { count: PASSWORD_MAX_LENGTH });
    case PASSWORD_ERROR_CODES.hasContext:
      return dictionary.auth.passwordHasContext;
    case PASSWORD_ERROR_CODES.compromised:
      return dictionary.auth.passwordCompromised;
    default:
      return undefined;
  }
}
