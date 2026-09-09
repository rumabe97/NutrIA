'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './AccountList.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { formatDate } from 'lib/format';

import type { AccountView } from 'core/controllers/User';

interface AccountListProps {
  accounts: readonly AccountView[];
}

/**
 * Every account and the state of its two locks (`0030`, `0031`), with a button
 * on the ones the owner still has to open.
 *
 * The same act the link in the owner's mail performs, from the screen instead —
 * for when the mail is buried, or for the accounts that signed up before any of
 * this existed. Optimistic: the row changes at once and reverts if the request
 * fails.
 *
 * Address, date and role, and nothing else. What somebody eats is not on this
 * page and never will be (`0028`).
 */
export function AccountList({ accounts }: AccountListProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.admin;
  const [rows, setRows] = useState(accounts);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();

  async function activate(id: string) {
    const previous = rows;

    setPending(id);
    setError(undefined);
    setRows(list => list.map(account => (account.id === id ? { ...account, activated: true } : account)));

    try {
      await api(`/admin/accounts/${id}/activate`, { method: 'POST' });
      router.refresh();
    } catch (caught) {
      setRows(previous);
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(undefined);
    }
  }

  if (rows.length === 0) {
    return (
      <Text size="sm" tone="tertiary">
        {t.noAccounts}
      </Text>
    );
  }

  return (
    <div className={styles.root}>
      <ul className={styles.list}>
        {rows.map(account => (
          <li className={styles.row} key={account.id}>
            <span className={styles.who}>
              <span className={styles.email}>{account.email}</span>
              <span className={styles.state}>
                <span className={styles.chip} data-on={account.emailVerified}>
                  {account.emailVerified ? t.confirmed : t.unconfirmed}
                </span>
                <span className={styles.chip} data-on={account.activated}>
                  {account.activated ? t.opened : t.notOpened}
                </span>
                <Text as="span" className={styles.role} size="xs">
                  {formatDate(account.createdAt.slice(0, 10), locale, { day: 'numeric', month: 'short' })}
                  {account.role === 'admin' ? ` · ${t.roleAdmin}` : ''}
                </Text>
              </span>
            </span>

            {account.activated ? null : (
              <Button disabled={pending !== undefined} loading={pending === account.id} onClick={() => void activate(account.id)} size="sm" type="button">
                {t.activate}
              </Button>
            )}
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
