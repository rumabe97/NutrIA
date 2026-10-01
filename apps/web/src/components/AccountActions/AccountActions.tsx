'use client';
import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './AccountActions.module.css';

import { Button } from 'ui/components/Button';
import { Dialog } from 'ui/components/Dialog';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { TwoFactorRemoval } from 'components/TwoFactorRemoval';
import { useKeepFocus } from 'components/AdminTable/useKeepFocus';

import { COLLEGIATE_NUMBER_PATTERN } from 'core/entities/Professional';

import { api, ApiError, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

import type { AccountView } from 'core/controllers/User';

type Tier = AccountView['tier'];

interface AccountActionsProps {
  account: Pick<AccountView, 'activated' | 'email' | 'id' | 'professional' | 'tier' | 'twoFactorEnabled' | 'twoFactorRemovalDueAt'>;
  /**
   * Whether the paid tier exists today. With the switch off the tier control is
   * not drawn at all: a button that moves an account to a tier that grants
   * nothing is a button that lies about what it did.
   */
  premium: boolean;
}

/**
 * One account's row actions on Cuentas (`0068`): open it (`0030`, `0031`), move its
 * tier, make it a professional (`0059`) — the controls the old account list had,
 * with the same words, the same collegiate-number check and the same errors — and
 * remove its second factor (`TwoFactorRemoval`, project 011), its own island below.
 *
 * Each row is its own island. After an action the page is read again, so the row's
 * columns say the new state; until then this row says it already, and the button
 * that pressed it shows it is working. Focus stays on that button through the
 * request (`useKeepFocus`), or moves to what is left of the row when it went away.
 *
 * The collegiate number is asked in a dialog, not in the cell: the table's pinned
 * first column covered a form drawn inside a row on a phone.
 */
export function AccountActions({ account, premium }: AccountActionsProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.adminAccounts;
  const [done, setDone] = useState<{ activated?: true; professional?: true; tier?: Tier }>({});
  const [pending, setPending] = useState<'activate' | 'grant' | 'tier'>();
  const [error, setError] = useState<string>();
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState<string>();
  const [numberError, setNumberError] = useState<string>();
  const row = useRef<HTMLDivElement>(null);
  const numberField = useRef<HTMLInputElement>(null);
  const granted = useRef(false);
  const keepFocus = useKeepFocus(pending !== undefined, row);
  const activated = done.activated ?? account.activated;
  const professional = done.professional ?? account.professional;
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

  /** The number is wrong: said under the field and out loud, and the field is where to fix it. */
  function refuseNumber() {
    setNumberError(t.professionalCollegiateInvalid);
    numberField.current?.focus();
    numberField.current?.select();
  }

  /** Makes the account a professional with the collegiate number the owner has checked (`0059`). */
  async function grant(collegiateNumber: string, submit: HTMLButtonElement | null) {
    setGrantError(undefined);
    setNumberError(undefined);

    // The API's own pattern: a typo is caught here without a round trip. The API checks again.
    if (!COLLEGIATE_NUMBER_PATTERN.test(collegiateNumber)) {
      refuseNumber();

      return;
    }

    keepFocus(submit);
    setPending('grant');

    try {
      await api(`/admin/accounts/${encodeURIComponent(account.id)}/professional`, { body: { collegiateNumber }, method: 'POST' });
      // The dialog and the button that opened it go together; focus goes to what is left of the row.
      granted.current = true;
      setDone(current => ({ ...current, professional: true }));
      setGranting(false);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'INVALID_INPUT') {
        refuseNumber();
      } else {
        setGrantError(messageFor(caught, dictionary));
      }
    } finally {
      setPending(undefined);
    }
  }

  return (
    <div className={styles.root} ref={row}>
      <div className={styles.buttons}>
        {activated ? null : (
          <Button
            aria-label={interpolate(t.activateFor, { email: account.email })}
            disabled={pending !== undefined}
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
            aria-label={interpolate(tier === 'premium' ? t.makeFreeFor : t.makePremiumFor, { email: account.email })}
            disabled={pending !== undefined}
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

        {professional ? null : (
          <Dialog
            onCloseAutoFocus={event => {
              // After a grant the button that opened this is gone; `useKeepFocus` has placed focus already.
              if (granted.current) {
                event.preventDefault();
              }
            }}
            onOpenChange={open => {
              // A grant on its way finishes before the dialog may close under it.
              if (pending === 'grant') {
                return;
              }

              setGrantError(undefined);
              setNumberError(undefined);
              setGranting(open);
            }}
            open={granting}
            title={interpolate(t.makeProfessionalFor, { email: account.email })}
            trigger={
              <Button
                aria-label={interpolate(t.makeProfessionalFor, { email: account.email })}
                disabled={pending !== undefined}
                size="sm"
                type="button"
                variant="secondary"
              >
                {t.makeProfessional}
              </Button>
            }
          >
            {/* The number is required, not a declaration: the owner types what they checked with the college. */}
            <form
              className={styles.grant}
              noValidate={true}
              onSubmit={event => {
                event.preventDefault();
                const form = event.currentTarget;

                void grant(String(new FormData(form).get('collegiateNumber') ?? '').trim(), form.querySelector('button[type="submit"]'));
              }}
            >
              <Input
                autoComplete="off"
                error={numberError}
                hint={t.professionalCollegiateHint}
                label={t.professionalCollegiate}
                name="collegiateNumber"
                ref={numberField}
                required={true}
              />
              {grantError ? (
                <Text className={styles.error} size="sm">
                  {grantError}
                </Text>
              ) : null}
              {/* Always in the page, so a new sentence in it is announced — whether or not focus moves. */}
              <p className="visually-hidden" role="alert">
                {numberError ?? grantError ?? ''}
              </p>
              <div className={styles.buttons}>
                <Button loading={pending === 'grant'} type="submit">
                  {t.professionalGrant}
                </Button>
                <Button disabled={pending === 'grant'} onClick={() => setGranting(false)} type="button" variant="secondary">
                  {dictionary.common.cancel}
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </div>

      {error ? (
        <Text className={styles.error} role="alert" size="xs">
          {error}
        </Text>
      ) : null}

      <TwoFactorRemoval account={account} />
    </div>
  );
}
