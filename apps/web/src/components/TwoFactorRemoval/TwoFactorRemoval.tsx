'use client';
import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './TwoFactorRemoval.module.css';

import { Button } from 'ui/components/Button';
import { Dialog } from 'ui/components/Dialog';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { useKeepFocus } from 'components/AdminTable/useKeepFocus';

import { api, ApiError, messageFor } from 'lib/api';
import { formatInstant, interpolate } from 'lib/format';

import type { AccountView } from 'core/controllers/User';
import type { TwoFactorRemovalView } from 'core/controllers/TwoFactor';

interface TwoFactorRemovalProps {
  account: Pick<AccountView, 'email' | 'id' | 'twoFactorEnabled' | 'twoFactorRemovalDueAt'>;
}

/** The daily job removes it on its first run after this: the date and the hour, in Madrid like the rest of the console. */
const DUE = { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'long', timeZone: 'Europe/Madrid' } as const;

/**
 * Taking an account's second factor away when its owner lost the app and the codes
 * (project 011, phase 4), from its row on Cuentas. Only asked here: the request mails
 * the address at once, and the daily job removes the factor 48–72 h later unless the
 * person signs in with a code first, which cancels it. The dialog says all of that
 * before anything is asked.
 *
 * A pending removal shows its date and "Cancelar", which needs no confirmation: it
 * leaves the account as it was. Focus follows `AccountActions`: kept on the pressed
 * button, or moved to what is left of this part of the row when the button went away.
 */
export function TwoFactorRemoval({ account }: TwoFactorRemovalProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.adminAccounts.twoFactorRemoval;
  // `undefined` until this row acts; then what the API said, until the page is read again.
  const [dueAt, setDueAt] = useState<string | null>();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<'cancel' | 'request'>();
  const [error, setError] = useState<string>();
  const [dialogError, setDialogError] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const requested = useRef(false);
  const keepFocus = useKeepFocus(pending !== undefined, root);
  const path = `/admin/accounts/${encodeURIComponent(account.id)}/two-factor/removal`;
  const due = dueAt === undefined ? account.twoFactorRemovalDueAt : dueAt;

  async function request() {
    setPending('request');
    setDialogError(undefined);
    setError(undefined);

    try {
      const answer = await api<TwoFactorRemovalView>(path, { method: 'POST' });
      requested.current = true;
      setDueAt(answer.dueAt);
      setConfirming(false);
      router.refresh();
    } catch (caught) {
      // Both mean the row is out of date: it is read again, and the sentence goes on the row, which outlives the dialog.
      if (caught instanceof ApiError && (caught.code === 'TWO_FACTOR_REMOVAL_PENDING' || caught.code === 'TWO_FACTOR_NOT_ENABLED')) {
        requested.current = true;
        setError(messageFor(caught, dictionary));
        setConfirming(false);
        router.refresh();
      } else {
        setDialogError(messageFor(caught, dictionary));
      }
    } finally {
      setPending(undefined);
    }
  }

  async function cancel() {
    setPending('cancel');
    setError(undefined);

    try {
      await api(path, { method: 'DELETE' });
      setDueAt(null);
      router.refresh();
    } catch (caught) {
      // None pending: the person signed in with a code and cancelled it first.
      if (caught instanceof ApiError && caught.code === 'NOT_FOUND') {
        setDueAt(null);
        setError(t.notPending);
        router.refresh();
      } else {
        setError(messageFor(caught, dictionary));
      }
    } finally {
      setPending(undefined);
    }
  }

  if (!due && !account.twoFactorEnabled && !error) {
    return null;
  }

  return (
    <div className={styles.root} ref={root}>
      {due ? (
        <div className={styles.pending}>
          <Text size="xs" tone="secondary">
            {interpolate(t.pending, { date: formatInstant(Date.parse(due), locale, DUE) })}
          </Text>
          <Button
            aria-label={interpolate(t.cancelFor, { email: account.email })}
            loading={pending === 'cancel'}
            onClick={event => {
              keepFocus(event.currentTarget);
              void cancel();
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t.cancel}
          </Button>
        </div>
      ) : account.twoFactorEnabled ? (
        <Dialog
          description={t.body}
          onCloseAutoFocus={event => {
            // The button that opened this is gone; `useKeepFocus` has placed focus already.
            if (requested.current) {
              requested.current = false;
              event.preventDefault();
            }
          }}
          onOpenChange={open => {
            // A request on its way finishes before the dialog may close under it.
            if (pending === 'request') {
              return;
            }

            setDialogError(undefined);
            setConfirming(open);
          }}
          open={confirming}
          title={interpolate(t.title, { email: account.email })}
          trigger={
            <Button aria-label={interpolate(t.removeFor, { email: account.email })} size="sm" type="button" variant="secondary">
              {t.remove}
            </Button>
          }
        >
          <div className={styles.actions}>
            <Text className={styles.dialogError} role="alert" size="sm">
              {dialogError ?? ''}
            </Text>
            {/* Cancel first: the dialog opens on it, so two presses of Enter never ask for a removal. */}
            <div className={styles.buttons}>
              <Button disabled={pending === 'request'} onClick={() => setConfirming(false)} type="button" variant="secondary">
                {dictionary.common.cancel}
              </Button>
              <Button
                loading={pending === 'request'}
                onClick={event => {
                  keepFocus(event.currentTarget);
                  void request();
                }}
                type="button"
                variant="destructive"
              >
                {t.confirm}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}

      {/* Always in the page while the row draws this, so a new sentence in it is announced. */}
      <Text className={styles.error} role="alert" size="xs">
        {error ?? ''}
      </Text>
    </div>
  );
}
