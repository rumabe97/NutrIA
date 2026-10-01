'use client';
import { Fragment, useState } from 'react';

import styles from './SecurityCard.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';
import { ChangePasswordForm } from 'components/ChangePasswordForm';
import { SessionList } from 'components/SessionList';

/** Google's own page for turning on its second step — the one that protects an account signed in with Google. */
const GOOGLE_TWO_STEP_URL = 'https://myaccount.google.com/signinoptions/twosv';

interface SecurityCardProps {
  /** A password account exists (`UserView.hasPassword`); without one, there is nothing here to change. */
  hasPassword: boolean;
}

/**
 * The profile's "Seguridad": the password, and where the account is signed in.
 *
 * One client component for both because a password change closes every other session:
 * the list is drawn again after it, by remounting it, rather than showing devices that
 * are already signed out.
 */
export function SecurityCard({ hasPassword }: SecurityCardProps) {
  const dictionary = useDictionary();
  const t = dictionary.security;
  const [generation, setGeneration] = useState(0);

  return (
    <Fragment>
      <Card as="section" className={styles.card}>
        <h3 className={styles.title}>{t.passwordTitle}</h3>
        {hasPassword ? (
          <Fragment>
            <Text size="sm" tone="secondary">
              {t.passwordBody}
            </Text>
            <ChangePasswordForm onChanged={() => setGeneration(previous => previous + 1)} />
          </Fragment>
        ) : (
          <Fragment>
            <Text size="sm" tone="secondary">
              {t.googleOnly}
            </Text>
            <a className={styles.link} href={GOOGLE_TWO_STEP_URL} rel="noopener noreferrer">
              {t.googleOnlyLink}
            </a>
          </Fragment>
        )}
      </Card>

      <Card as="section">
        <SessionList key={generation} />
      </Card>
    </Fragment>
  );
}
