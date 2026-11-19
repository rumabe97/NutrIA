'use client';
import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './AccountActions.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { TwoFactorRemoval } from 'components/TwoFactorRemoval';
import { useKeepFocus } from 'components/AdminTable/useKeepFocus';

import { api, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

import type { AccountView } from 'core/controllers/User';

type Tier = AccountView['tier'];

interface AccountActionsProps {
  account: Pick<AccountView, 'activated' | 'email' | 'id' | 'tier' | 'twoFactorEnabled' | 'twoFactorRemovalDueAt'>;
  /**
   * Whether the paid tier exists today. With the switch off the tier control is
   * not drawn at all: a button that moves an account to a tier that grants
   * nothing is a button that lies about what it did.
   */
  premium: boolean;
}

/**
 * One account's row actions on Cuentas (`0068`): open it (`0030`, `0031`), move its
 * tier, and remove its second factor (`TwoFactorRemoval`, project 011), its own
 * island below. Nobody is made a professional from here any more: since PRD 025
 * an account opens its own practice, and what the owner may do to one belongs on
 * Profesionales.
 *
 * Each row is its own island. After an action the page is read again, so the row's
 * columns say the new state; until then this row says it already, and the button
 * that pressed it shows it is working. Focus stays on that button through the
 * request (`useKeepFocus`), or moves to what is left of the row when it went away.
 */
export function AccountActions({ account, premium }: AccountActionsProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.adminAccounts;
  const [done, setDone] = useState<{ activated?: true; tier?: Tier }>({});
  const [pending, setPending] = useState<'activate' | 'tier'>();
  const [error, setError] = useState<string>();
  const row = useRef<HTMLDivElement>(null);
  const keepFocus = useKeepFocus(pending !== undefined, row);
  const activated = done.activated ?? account.activated;
  const tier = done.tier ?? account.tier;

  async function activate() {
    setPending('activate');
    setError(undefined);

    try {
      await api(`/admin/accounts/${encodeURIComponent(account.id)}/activate`, { method: 'POST' });
      setDone(current => ({ ...current, activated: true }));
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(undefined);
    }
  }

  async function changeTier(next: Tier) {
    setPending('tier');
    setError(undefined);

    try {
      await api(`/admin/accounts/${encodeURIComponent(account.id)}/tier`, { body: { tier: next }, method: 'PATCH' });
      setDone(current => ({ ...current, tier: next }));
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(undefined);
    }
  }

  return (
    <div className={styles.root} ref={row}>
      {/* The button just pressed is `aria-disabled` while its request is out, never `disabled`:
          it keeps the focus it holds and ignores a second press. The others in the row cannot be
          focused at that moment, so they are merely `disabled`. */}
      <div className={`${styles.buttons} button-row`}>
        {activated ? null : (
          <Button
            aria-disabled={pending === 'activate' || undefined}
            aria-label={interpolate(t.activateFor, { email: account.email })}
            disabled={pending === undefined ? false : pending !== 'activate'}
            loading={pending === 'activate'}
            onClick={event => {
              keepFocus(event.currentTarget);
              void activate();
            }}
            size="sm"
            type="button"
          >
            {t.activate}
          </Button>
        )}

        {premium ? (
          <Button
            aria-disabled={pending === 'tier' || undefined}
            aria-label={interpolate(tier === 'premium' ? t.makeFreeFor : t.makePremiumFor, { email: account.email })}
            disabled={pending === undefined ? false : pending !== 'tier'}
            loading={pending === 'tier'}
            onClick={event => {
              keepFocus(event.currentTarget);
              void changeTier(tier === 'premium' ? 'free' : 'premium');
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {tier === 'premium' ? t.makeFree : t.makePremium}
          </Button>
        ) : null}

        {/* In the row with the others: its own wrapper holds its button and its failure line. */}
        <TwoFactorRemoval account={account} />
      </div>

      {error ? (
        <Text className={styles.error} role="alert" size="xs">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
