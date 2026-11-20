import styles from './BadgeLetter.module.css';

import { interpolate } from 'lib/format';

interface BadgeLetterValues {
  code: string;
  email: string;
  expires: string;
  name: string;
  number: string;
  privacyUrl: string;
  register: string;
  registerName: string;
}

interface BadgeLetterProps {
  /** `adminBadge.letter`: the approved letter's paragraphs, `textos/06` § S, with its placeholders. */
  letter: { readonly body: readonly string[]; readonly head: string };
  values: BadgeLetterValues;
}

/**
 * The letter the owner prints and posts to the register's own professional address
 * (`docs/legal/textos/06` § S), filled in on screen: the code and its day, the college
 * and the number as the application declared them, and the name as the register shows
 * it — typed by the owner on this screen and kept nowhere. The text is the approved
 * one, in Spanish: it goes to a Spanish register, so the block says `lang="es"`
 * whatever the console's language is. The code is the one paragraph that is only its
 * code, drawn large, so it is read and copied whole.
 */
export function BadgeLetter({ letter, values }: BadgeLetterProps) {
  const filled = { ...values, registerName: values.registerName.trim() === '' ? '…' : values.registerName.trim() };

  return (
    <article className={styles.letter} lang="es">
      <p className={styles.head}>{interpolate(letter.head, filled)}</p>
      {letter.body.map(paragraph =>
        paragraph === '{code}' ? (
          <p className={styles.code} key={paragraph}>
            {values.code}
          </p>
        ) : (
          <p key={paragraph}>{interpolate(paragraph, filled)}</p>
        )
      )}
    </article>
  );
}
