import { z } from 'zod';

/**
 * The one home of the password rule (report `0007` § 4.1, PLAN 011 phase 1).
 * `apps/api` hands these numbers to Better Auth and the web app draws its forms
 * with them; neither spells a length of its own.
 *
 * Twelve, not NIST's fifteen, on purpose: the iPhone keychain proposes a much
 * longer generated password on both forms, the breached-password check adds
 * more than three characters would, and a person typing on a phone pays for
 * every one. No composition rule, anywhere — NIST says not to, and a rule of
 * that shape only teaches `Password1!`.
 *
 * Lengths are JavaScript string lengths (UTF-16 code units), the way Better
 * Auth counts them, so the form and the server never disagree by an emoji.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * A password being set: on sign-up, on a reset, on a change. Signing in never
 * runs it — an older, shorter password still opens its account.
 *
 * Not `.min().max()`: Zod 4 counts code points there, Better Auth counts
 * `.length`, and six emoji would pass one and fail the other. The issues are
 * the same `too_small` / `too_big` that `.min().max()` raise.
 */
export const newPasswordSchema = z.string().superRefine((password, context) => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    context.addIssue({ code: 'too_small', inclusive: true, input: password, minimum: PASSWORD_MIN_LENGTH, origin: 'string' });
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    context.addIssue({ code: 'too_big', inclusive: true, input: password, maximum: PASSWORD_MAX_LENGTH, origin: 'string' });
  }
});

/**
 * The codes a refused new password answers with, beside Better Auth's own
 * `PASSWORD_TOO_SHORT` and `PASSWORD_TOO_LONG`. One code for every context
 * word, so a refusal never says which word matched.
 */
export const PASSWORD_ERROR_CODES = { compromised: 'PASSWORD_COMPROMISED', hasContext: 'PASSWORD_HAS_CONTEXT' } as const;

export type PasswordErrorCode = (typeof PASSWORD_ERROR_CODES)[keyof typeof PASSWORD_ERROR_CODES];

/** The service's own name: the first word anybody guesses for an account here. */
const SERVICE_WORD = 'nutria';
/** Shorter fragments — `ana`'s `an`, an initial — would refuse half the dictionary and protect nothing. */
const CONTEXT_WORD_MIN_LENGTH = 3;

/** Lower case, accents dropped: `José` and `JOSE` are the same word to somebody guessing. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Whether a password contains a word the account itself gives away — what NIST
 * calls context-specific words: the address's local part, any word of the
 * name, or the service's name. Compared case- and accent-insensitively, as a
 * substring, because `MariaGarcia2026` is no better than `maria`.
 */
export function passwordHasContext(password: string, context: { email?: string | null; name?: string | null }): boolean {
  const folded = fold(password);
  const localPart = context.email ? fold(context.email.split('@')[0] ?? '') : '';
  const nameWords = context.name ? fold(context.name).split(/[\s-]+/) : [];

  return [localPart, ...nameWords, SERVICE_WORD].some(word => word.length >= CONTEXT_WORD_MIN_LENGTH && folded.includes(word));
}
