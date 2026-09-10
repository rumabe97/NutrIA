import { Fragment } from 'react';

import { redirect } from 'next/navigation';

import own from './PendingScreen.module.css';
import styles from 'components/AuthForm/AuthForm.module.css';

import { dictionaryFor } from 'i18n/server';
import { Text } from 'ui/components/Text';
import { withLocale } from 'i18n/routes';

import { CheckAgainButton } from 'components/CheckAgainButton';
import { SignOutLink } from 'components/SignOutLink';

import { interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import type { Locale } from 'i18n/config';
import type { SettingsView } from 'core/controllers/Settings';
import type { UserView } from 'core/controllers/User';

/**
 * Where a signed-in account lands while either of its two locks is closed
 * (0030, 0031), saying which one it is and who opens it.
 *
 * Three messages, because there are three waits:
 *   · the address is unconfirmed and confirming it is the whole gate — one click
 *   · the address is unconfirmed and the owner still has to open the account
 *   · the address is confirmed and only the owner is left
 *
 * Honest about the last one: accounts are opened by hand while the product runs
 * on a free-tier provider, and the only thing to do is check again later.
 */
export async function PendingScreen({ locale }: Readonly<{ locale: Locale }>) {
  const dictionary = dictionaryFor(locale);
  const [user, settings] = await Promise.all([serverApi<UserView>('/users/me'), serverApi<SettingsView>('/settings')]);

  if (!user) {redirect(withLocale('/acceder', locale));}

  if (user.activated && user.emailVerified) {redirect('/inicio');}

  const t = dictionary.auth;
  /*
   * Whether confirming the address is the last thing standing: it is if the
   * owner already opened this account, or if activation is automatic and
   * confirming will open it (0031). Unknown counts as manual — promising
   * somebody they are one click away when we could not ask is the worse lie.
   */
  const oneClickAway = user.activated || settings?.automaticActivation === true;
  const body = user.emailVerified ? t.pendingBody : oneClickAway ? t.pendingConfirmBody : t.pendingConfirmWaitBody;

  return (
    <Fragment>
      <h1 className={styles.title}>{user.emailVerified ? t.pendingTitle : t.pendingConfirmTitle}</h1>
      <Text tone="secondary">{interpolate(body, { email: user.email })}</Text>

      <div className={`${styles.footer} ${own.actions}`}>
        <CheckAgainButton>{t.pendingCheck}</CheckAgainButton>
        <SignOutLink>{t.pendingSignOut}</SignOutLink>
      </div>
    </Fragment>
  );
}
