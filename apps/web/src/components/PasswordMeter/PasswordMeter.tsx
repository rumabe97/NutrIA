'use client';
import styles from './PasswordMeter.module.css';

import { useDictionary } from 'i18n/LocaleProvider';

import { passwordMeterText, readPasswordMeter } from './passwordMeter';

const FULL = 100;

interface PasswordMeterProps {
  /** Put on the password field's `aria-describedby`: the sentence and the hint are its description. */
  id: string;
  /** The password's length — the meter never sees the password itself. */
  length: number;
}

/**
 * Under a new-password field: a bar that advances with the length, a sentence saying where
 * the length stands, and the hint that a phrase is best (report `0007` § 4.1). Length only — no
 * guess at strength, no dependency — because the rule is length and the breach check is the
 * API's.
 *
 * The bar is decoration; the sentence carries the same thing in words. Neither is a live
 * region: a count read out on every keystroke is noise, and the field's description is read
 * when it takes focus. A refusal is the form's alert, not this.
 */
export function PasswordMeter({ id, length }: PasswordMeterProps) {
  const dictionary = useDictionary();
  const reading = readPasswordMeter(length);

  return (
    <div className={styles.meter} id={id}>
      <div aria-hidden={true} className={styles.track}>
        <div className={styles.bar} data-step={reading.step} style={{ inlineSize: `${reading.fill * FULL}%` }} />
      </div>
      <p className={styles.status}>{passwordMeterText(reading, dictionary)}</p>
      <p className={styles.hint}>{dictionary.auth.passwordStrengthHint}</p>
    </div>
  );
}
