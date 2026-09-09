import { Fragment } from 'react';

import { redirect } from 'next/navigation';

import styles from '../../../components/AuthForm/AuthForm.module.css';

import { getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { CtaLink } from 'components/CtaLink';
import { SignOutLink } from 'components/SignOutLink';

import { interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import type { UserView } from 'core/controllers/User';

export const dynamic = 'force-dynamic';

/**
 * Where a signed-in but not yet activated account lands (0017). Honest about
 * what is happening — accounts are opened by hand while the product runs on a
 * free-tier provider — and about the one thing they can do: check again later.
 */
export default async function PendingPage() {
  const [dictionary, user] = await Promise.all([getDictionary(), serverApi<UserView>('/users/me')]);

  if (!user) {redirect('/acceder');}

  if (user.emailVerified) {redirect('/inicio');}

  return (
    <Fragment>
      <h1 className={styles.title}>{dictionary.auth.pendingTitle}</h1>
      <Text tone="secondary">{interpolate(dictionary.auth.pendingBody, { email: user.email })}</Text>

      <div className={styles.footer}>
        <CtaLink href="/inicio" variant="secondary">
          {dictionary.auth.pendingCheck}
        </CtaLink>
        <SignOutLink>{dictionary.auth.pendingSignOut}</SignOutLink>
      </div>
    </Fragment>
  );
}
