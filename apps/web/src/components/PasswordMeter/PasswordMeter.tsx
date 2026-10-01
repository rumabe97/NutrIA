'use client';
import styles from './PasswordMeter.module.css';

import { useDictionary } from 'i18n/LocaleProvider';

import { passwordMeterHint, passwordMeterLevel, passwordMeterMissing, readPasswordMeter } from './passwordMeter';

const FULL = 100;

interface PasswordMeterProps {
  /** Id of the standing hints — the minimum and the phrase. Goes on the field's `describedBy`. */
  hintId: string;
  /** The password's length — the meter never sees the password itself. */
  length: number;
  /** Id of the level line, the missing count included. Goes on the field's `describedBy`, after `hintId`. */
  levelId: string;
}

/**
 * Under a new-password field: a bar that advances with the length, the level in words, and
 * the hints that say the minimum and that a phrase is best (report `0007` § 4.1). Length
 * only — no guess at strength, no dependency — because the rule is length and the breach
 * check is the API's.
 *
 * The bar is decoration (`aria-hidden`); the level says the same in words and is the one
 * live region, mounted from the first render and changing only when the level does. The
 * count of missing characters sits beside it, outside the region, so it is never announced
 * on every keystroke; the whole line carries `levelId`, so the field's description reads it
 * on focus. A refusal is the form's and the field's, not this.
 */
export function PasswordMeter({ hintId, length, levelId }: PasswordMeterProps) {
  const dictionary = useDictionary();
  const reading = readPasswordMeter(length);
  const missing = passwordMeterMissing(reading, dictionary);

  return (
    <div className={styles.meter}>
      <div aria-hidden={true} className={styles.track}>
        <div className={styles.bar} style={{ inlineSize: `${reading.fill * FULL}%` }} />
      </div>
      <p className={styles.status} id={levelId}>
        <span aria-atomic={true} aria-live="polite">
          {passwordMeterLevel(reading, dictionary)}
        </span>
        {missing ? ` ${missing}` : null}
      </p>
      <p className={styles.hint} id={hintId}>
        {passwordMeterHint(dictionary)}
      </p>
    </div>
  );
}
