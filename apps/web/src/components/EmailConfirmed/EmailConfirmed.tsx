'use client';
import { Fragment, useEffect, useRef } from 'react';

import Link from 'next/link';

import styles from 'components/AuthForm/AuthForm.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { withLocale } from 'i18n/routes';

/**
 * Where the confirmation link lands (hotfix, PLAN 011 phase 8). Opening it
 * confirms the address and signs nobody in — a stranger may have signed this
 * address up with a password of their own — so the page says the next step is
 * to sign in, and that a password you do not know is reset, not guessed: the
 * reset also closes every other session on the account.
 *
 * Better Auth sends a refused link (expired, already used) to the same page
 * with `?error=…`; `refused` is that case. The page arrives by a full load from
 * the API's redirect, so focus goes to the heading here: it is the whole news.
 */
export function EmailConfirmed({ refused }: Readonly<{ refused: boolean }>) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const t = dictionary.auth;

  useEffect(() => {
    titleRef.current?.focus();
  }, [refused]);

  return (
    <Fragment>
      <h1 className={styles.title} ref={titleRef} tabIndex={-1}>
        {refused ? t.verifyFailedTitle : t.verifyTitle}
      </h1>
      <p className={refused ? undefined : styles.success}>{refused ? t.verifyFailedBody : t.verifyBody}</p>

      {refused ? null : (
        <Text size="sm" style={{ marginTop: 'var(--space-05)' }} tone="secondary">
          {t.verifyNotYours}{' '}
          <Link className={styles.link} href={withLocale('/recuperar', locale)}>
            {t.verifyReset}
          </Link>
        </Text>
      )}

      <div className={styles.footer}>
        <Link className={`${styles.link} ${styles.standaloneLink}`} href={withLocale('/acceder', locale)}>
          {t.verifySignIn}
        </Link>
      </div>
    </Fragment>
  );
}
