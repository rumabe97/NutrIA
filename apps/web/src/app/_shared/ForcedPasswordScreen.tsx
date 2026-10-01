import { Fragment } from 'react';

import { redirect } from 'next/navigation';

import own from './PendingScreen.module.css';
import styles from 'components/AuthForm/AuthForm.module.css';

import { dictionaryFor } from 'i18n/server';
import { Text } from 'ui/components/Text';
import { withLocale } from 'i18n/routes';

import { ChangePasswordForm } from 'components/ChangePasswordForm';
import { SignOutLink } from 'components/SignOutLink';

import { serverApi } from 'lib/server-api';

import type { Locale } from 'i18n/config';
import type { UserView } from 'core/controllers/User';

/**
 * Where an account whose password turned up in a breach is held until it chooses a new one
 * (project 011). The API answers 409 `PASSWORD_CHANGE_REQUIRED` on everything but
 * `/users/me` and Better Auth's own routes meanwhile, so this screen is the change and the
 * way out, and nothing else.
 *
 * Outside the signed-in tree on purpose, beside `/pendiente`: that tree's layout is what
 * sends people here, and a screen under it would send itself here forever. It repeats the
 * same order as `redirectUnlessReady` — a closed lock first, then this — so the two
 * screens can never pass somebody back and forth.
 */
export async function ForcedPasswordScreen({ locale }: Readonly<{ locale: Locale }>) {
  const dictionary = dictionaryFor(locale);
  const user = await serverApi<UserView>('/users/me');

  if (!user) {
    redirect(withLocale('/acceder', locale));
  }

  if (!user.activated || !user.emailVerified) {
    redirect(withLocale('/pendiente', locale));
  }

  if (!user.passwordChangeRequired) {
    redirect('/inicio');
  }

  const t = dictionary.security;

  return (
    <Fragment>
      <h1 className={styles.title}>{t.forcedTitle}</h1>
      <Text className={styles.subtitle} tone="secondary">
        {t.forcedBody}
      </Text>

      <ChangePasswordForm email={user.email} forced={true} />

      <div className={`${styles.footer} ${own.actions}`}>
        <SignOutLink>{t.forcedSignOut}</SignOutLink>
      </div>
    </Fragment>
  );
}
