import { PASSWORD_MIN_LENGTH } from 'core/entities/Password';

import { interpolate } from '../../lib/format';

import type { Dictionary } from 'i18n/dictionaries/es-ES';

/**
 * Where a length is "long", not just enough: about a phrase of three or four words. Past it
 * the bar is full. It measures length and nothing else — a long password can still be one
 * that appears in a breach, which only the API can tell — so no step is called "strong".
 */
export const PASSWORD_LONG_LENGTH = 20;

/**
 * - `empty`: nothing typed.
 * - `short`: under the minimum; the meter also says how many characters are missing.
 * - `enough`: the minimum or more.
 * - `long`: `PASSWORD_LONG_LENGTH` or more.
 */
export type PasswordMeterStep = 'empty' | 'enough' | 'long' | 'short';

export interface PasswordMeterReading {
  /** How much of the bar is filled, 0 to 1. */
  fill: number;
  /** Characters still missing to reach the minimum; 0 from the minimum on. */
  missing: number;
  step: PasswordMeterStep;
}

/** What the meter shows for a password of `length` characters (JavaScript `.length`, as the API counts). */
export function readPasswordMeter(length: number): PasswordMeterReading {
  const fill = Math.min(length / PASSWORD_LONG_LENGTH, 1);
  const missing = Math.max(PASSWORD_MIN_LENGTH - length, 0);

  if (length === 0) {
    return { fill, missing, step: 'empty' };
  }

  if (missing > 0) {
    return { fill, missing, step: 'short' };
  }

  return { fill, missing, step: length >= PASSWORD_LONG_LENGTH ? 'long' : 'enough' };
}

/**
 * The level, in words: what the bar shows, so colour and length are never the only signal.
 * Empty before anything is typed. It changes only when the step does — it is the meter's
 * live region, and a region that changed with every character would be read out on every
 * keystroke. It names the length, never strength: the API may still refuse the password.
 */
export function passwordMeterLevel({ step }: PasswordMeterReading, dictionary: Dictionary): string {
  switch (step) {
    case 'empty':
      return '';
    case 'short':
      return dictionary.auth.passwordMeterShort;
    case 'enough':
      return dictionary.auth.passwordMeterEnough;
    case 'long':
      return dictionary.auth.passwordMeterLong;
  }
}

/** How many characters are still missing, while the password is short; shown, never announced. */
export function passwordMeterMissing({ missing, step }: PasswordMeterReading, dictionary: Dictionary): string | undefined {
  if (step !== 'short') {
    return undefined;
  }

  return missing === 1 ? dictionary.auth.passwordMeterMissingOne : interpolate(dictionary.auth.passwordMeterMissing, { count: missing });
}

/** The two standing hints: the minimum, and that a phrase is best. */
export function passwordMeterHint(dictionary: Dictionary): string {
  return `${interpolate(dictionary.auth.passwordHint, { count: PASSWORD_MIN_LENGTH })} ${dictionary.auth.passwordStrengthHint}`;
}
