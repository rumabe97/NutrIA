'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './AccountList.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { formatDate, interpolate } from 'lib/format';

import type { AccountView } from 'core/controllers/User';

interface AccountListProps {
  accounts: readonly AccountView[];
  /**
   * Whether the paid tier exists today. With the switch off the tier control is
   * not drawn at all: a button that moves an account to a tier that grants
   * nothing is a button that lies about what it did.
   */
  premium: boolean;
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
export function AccountList({ accounts, premium }: AccountListProps) {
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

  async function setTier(id: string, tier: 'free' | 'premium') {
    const previous = rows;

    setPending(id);
    setError(undefined);
    setRows(list => list.map(account => (account.id === id ? { ...account, tier } : account)));

    try {
      await api(`/admin/accounts/${id}/tier`, { body: { tier }, method: 'PATCH' });
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
                {premium && account.tier === 'premium' ? (
                  <span className={styles.chip} data-on={true}>
                    {t.tierPremium}
                  </span>
                ) : null}
                <Text as="span" className={styles.role} size="xs">
                  {formatDate(account.createdAt.slice(0, 10), locale, { day: 'numeric', month: 'short' })}
                  {account.role === 'admin' ? ` · ${t.roleAdmin}` : ''}
                </Text>
              </span>
            </span>

            <span className={styles.actions}>
              {account.activated ? null : (
                <Button
                  aria-label={interpolate(t.activateFor, { email: account.email })}
                  disabled={pending !== undefined}
                  loading={pending === account.id}
                  onClick={() => void activate(account.id)}
                  size="sm"
                  type="button"
                >
                  {t.activate}
                </Button>
              )}

              {premium ? (
                <Button
                  aria-label={interpolate(account.tier === 'premium' ? t.makeFreeFor : t.makePremiumFor, { email: account.email })}
                  disabled={pending !== undefined}
                  onClick={() => void setTier(account.id, account.tier === 'premium' ? 'free' : 'premium')}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {account.tier === 'premium' ? t.makeFree : t.makePremium}
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {error ? (
        <Text className={styles.error} role="alert" size="xs">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
