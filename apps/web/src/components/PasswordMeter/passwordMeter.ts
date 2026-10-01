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
 * - `empty`: nothing typed; the meter says the minimum.
 * - `short`: under the minimum; it says how many characters are missing.
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

/** The sentence under the bar: where the length stands, in words, so the bar is never the only signal. */
export function passwordMeterText({ missing, step }: PasswordMeterReading, dictionary: Dictionary): string {
  switch (step) {
    case 'empty':
      return interpolate(dictionary.auth.passwordHint, { count: PASSWORD_MIN_LENGTH });
    case 'short':
      return missing === 1 ? dictionary.auth.passwordMeterShortOne : interpolate(dictionary.auth.passwordMeterShort, { count: missing });
    case 'enough':
      return dictionary.auth.passwordMeterEnough;
    case 'long':
      return dictionary.auth.passwordMeterLong;
  }
}
