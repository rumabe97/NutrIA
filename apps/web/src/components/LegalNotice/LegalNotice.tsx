'use client';
import Link from 'next/link';

import styles from './LegalNotice.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { withLocale } from 'i18n/routes';

/** The two placeholders the sentence may carry, and the page each one opens. */
const LINKS = { '{privacy}': '/privacidad', '{terms}': '/condiciones' } as const;

type Placeholder = keyof typeof LINKS;

function isPlaceholder(part: string): part is Placeholder {
  return part in LINKS;
}

/**
 * "By continuing you accept the terms and the privacy policy", under the way in.
 *
 * It sits above the provider buttons, not under the form: on a phone the buttons
 * fill the first screen, and a notice below the fold is not read before the tap
 * that creates the account (`legal`, D5 § 4.1). No checkbox: the law asks for a
 * clear notice beside the control, and a box would read like the health consents.
 *
 * On sign-in as well as sign-up, because "Continue with Google" on the sign-in
 * page creates an account for somebody who has none (`0058`), and that person
 * never sees the sign-up page.
 *
 * One sentence in the dictionary with two placeholders, rather than three
 * fragments to glue together: word order is the translator's, and a sentence
 * assembled from halves is only ever right in the language it was written in.
 */
export function LegalNotice({ variant = 'signUp' }: Readonly<{ variant?: 'signIn' | 'signUp' }>) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const sentence = variant === 'signIn' ? dictionary.auth.legalNoticeSignIn : dictionary.auth.legalNotice;
  const labels: Record<Placeholder, string> = { '{privacy}': dictionary.auth.legalPrivacy, '{terms}': dictionary.auth.legalTerms };

  return (
    <div className={styles.notice}>
      <Text align="center" size="xs" tone="secondary">
        {sentence.split(/(\{terms\}|\{privacy\})/).map(part =>
          isPlaceholder(part) ? (
            <Link className={styles.link} href={withLocale(LINKS[part], locale)} key={part}>
              {labels[part]}
            </Link>
          ) : (
            part
          )
        )}
      </Text>
      {/* Stated where the terms are accepted, not only inside them: the one
          fact somebody must read before any control here does anything. */}
      <Text align="center" size="xs" tone="secondary">
        {dictionary.auth.legalAge}
      </Text>
    </div>
  );
}
