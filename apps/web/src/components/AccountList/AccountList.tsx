'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './AccountList.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, ApiError, messageFor } from 'lib/api';
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
  /** The accounts already granted as professionals (`0059`), so their row says so instead of offering it again. */
  professionalIds: readonly string[];
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
export function AccountList({ accounts, premium, professionalIds }: AccountListProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.admin;
  const [rows, setRows] = useState(accounts);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const [granting, setGranting] = useState<string>();
  const [numberError, setNumberError] = useState<string>();

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

  /** Makes an account a professional with the collegiate number the owner has checked (`0059`). */
  async function grant(id: string, collegiateNumber: string) {
    setPending(id);
    setError(undefined);
    setNumberError(undefined);

    try {
      await api(`/admin/accounts/${id}/professional`, { body: { collegiateNumber }, method: 'POST' });
      setGranting(undefined);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'INVALID_INPUT') {
        setNumberError(t.professionalCollegiateHint);
      } else {
        setError(messageFor(caught, dictionary));
      }
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
                {professionalIds.includes(account.id) ? (
                  <span className={styles.chip} data-on={true}>
                    {t.professionalChip}
                  </span>
                ) : null}
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

              {professionalIds.includes(account.id) || granting === account.id ? null : (
                <Button
                  aria-label={interpolate(t.makeProfessionalFor, { email: account.email })}
                  disabled={pending !== undefined}
                  onClick={() => {
                    setNumberError(undefined);
                    setGranting(account.id);
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {t.makeProfessional}
                </Button>
              )}
            </span>

            {/* The number is required, not a declaration: the owner types what they checked with the college. */}
            {granting === account.id ? (
              <form
                aria-label={interpolate(t.makeProfessionalFor, { email: account.email })}
                className={styles.grant}
                onSubmit={event => {
                  event.preventDefault();
                  void grant(account.id, String(new FormData(event.currentTarget).get('collegiateNumber') ?? '').trim());
                }}
              >
                <Input
                  autoComplete="off"
                  // The form was opened for this and nothing else: typing is the next thing to do.
                  autoFocus={true}
                  error={numberError}
                  hint={numberError ? undefined : t.professionalCollegiateHint}
                  label={t.professionalCollegiate}
                  name="collegiateNumber"
                  required={true}
                />
                <span className={styles.actions}>
                  <Button disabled={pending === undefined ? false : pending !== account.id} loading={pending === account.id} size="sm" type="submit">
                    {t.professionalGrant}
                  </Button>
                  <Button disabled={pending === account.id} onClick={() => setGranting(undefined)} size="sm" type="button" variant="secondary">
                    {dictionary.common.cancel}
                  </Button>
                </span>
              </form>
            ) : null}
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
