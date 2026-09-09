'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './ActivateAccount.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { formatDate } from 'lib/format';

interface ActivateAccountProps {
  accounts: readonly { id: string; createdAt: string; email: string; emailVerified: boolean; }[];
}

/**
 * The queue of accounts waiting for the owner, and one button each.
 *
 * The same act the link in the owner's mail performs (`0030`), from the screen
 * instead — for when the mail is buried, or for the accounts that signed up
 * before any of this existed. Optimistic: the row leaves the list at once and
 * comes back if the request fails.
 */
export function ActivateAccount({ accounts }: ActivateAccountProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.admin;
  const [waiting, setWaiting] = useState(accounts);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();

  async function activate(id: string) {
    const previous = waiting;

    setPending(id);
    setError(undefined);
    setWaiting(list => list.filter(account => account.id !== id));

    try {
      await api(`/admin/accounts/${id}/activate`, { method: 'POST' });
      router.refresh();
    } catch (caught) {
      setWaiting(previous);
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(undefined);
    }
  }

  if (waiting.length === 0) {
    return (
      <Text size="sm" tone="tertiary">
        {t.noneWaiting}
      </Text>
    );
  }

  return (
    <div className={styles.root}>
      <ul className={styles.list}>
        {waiting.map(account => (
          <li className={styles.row} key={account.id}>
            <span className={styles.who}>
              <span className={styles.email}>{account.email}</span>
              <Text as="span" size="xs" tone="tertiary">
                {formatDate(account.createdAt.slice(0, 10), locale, { day: 'numeric', month: 'short' })}
                {account.emailVerified ? '' : ` · ${t.unconfirmed}`}
              </Text>
            </span>
            <Button disabled={pending !== undefined} loading={pending === account.id} onClick={() => void activate(account.id)} size="sm" type="button">
              {t.activate}
            </Button>
          </li>
        ))}
      </ul>

      {error ? (
        <Text className={styles.error} size="xs">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
