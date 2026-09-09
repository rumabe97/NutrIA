import { Fragment } from 'react';

import { redirect } from 'next/navigation';

import own from './page.module.css';
import styles from '../../../components/AuthForm/AuthForm.module.css';

import { getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { CheckAgainButton } from 'components/CheckAgainButton';
import { SignOutLink } from 'components/SignOutLink';

import { interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import type { SettingsView } from 'core/controllers/Settings';
import type { UserView } from 'core/controllers/User';

export const dynamic = 'force-dynamic';

/**
 * Where a signed-in but not yet activated account lands (0017). Honest about
 * what is happening — accounts are opened by hand while the product runs on a
 * free-tier provider — and about the one thing they can do: check again later.
 */
export default async function PendingPage() {
  const [dictionary, user, settings] = await Promise.all([
    getDictionary(),
    serverApi<UserView>('/users/me'),
    serverApi<SettingsView>('/settings')
  ]);

  if (!user) {redirect('/acceder');}

  // The owner's switch, not the address (`0030`) — asking about the address here
  // sent a confirmed-but-unopened account straight back into the app.
  if (user.activated) {redirect('/inicio');}

  /*
   * Which of the two waits this is (`0031`). While the door is open, confirming
   * the address is the whole gate and there is nobody to wait for; while it is
   * closed, the owner turns the key. Unknown counts as closed: promising
   * somebody they are one click away when we could not ask is the worse lie.
   */
  const selfService = settings?.registrationOpen === true && !user.emailVerified;

  return (
    <Fragment>
      <h1 className={styles.title}>{selfService ? dictionary.auth.pendingConfirmTitle : dictionary.auth.pendingTitle}</h1>
      <Text tone="secondary">
        {interpolate(selfService ? dictionary.auth.pendingConfirmBody : dictionary.auth.pendingBody, { email: user.email })}
      </Text>

      {/* Two different waits, and only one of them is ours (0030): the account
          opens when the owner opens it, the address is confirmed by them. */}
      {user.emailVerified || selfService ? null : (
        <Text size="sm" tone="tertiary">
          {dictionary.auth.pendingConfirm}
        </Text>
      )}

      <div className={`${styles.footer} ${own.actions}`}>
        <CheckAgainButton>{dictionary.auth.pendingCheck}</CheckAgainButton>
        <SignOutLink>{dictionary.auth.pendingSignOut}</SignOutLink>
      </div>
    </Fragment>
  );
}
