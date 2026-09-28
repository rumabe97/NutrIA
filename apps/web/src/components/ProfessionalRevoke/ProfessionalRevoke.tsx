'use client';
import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './ProfessionalRevoke.module.css';

import { Button } from 'ui/components/Button';
import { Dialog } from 'ui/components/Dialog';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { focusTableStatus } from 'components/AdminTable/tableStatus';
import { useKeepFocus } from 'components/AdminTable/useKeepFocus';

import { api, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

interface ProfessionalRevokeProps {
  email: string;
  userId: string;
}

/**
 * Taking a professional's grant back (`0059`), from their row on Profesionales.
 * Confirmed first, with what it does said before it is done — the same words and
 * the same errors as the old list.
 *
 * The confirmation is a dialog, not part of the cell: the table's pinned first
 * column covered a confirmation drawn inside a row on a phone. Cancelled, focus goes
 * back to "Retirar"; confirmed, the row is about to leave the table, so focus goes to
 * the line over it, which says the new count once the list is read again.
 */
export function ProfessionalRevoke({ email, userId }: ProfessionalRevokeProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.adminProfessionals;
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const revoked = useRef(false);
  const keepFocus = useKeepFocus(pending);

  async function revoke() {
    setPending(true);
    setError(undefined);

    try {
      await api(`/admin/accounts/${encodeURIComponent(userId)}/professional`, { method: 'DELETE' });
      revoked.current = true;
      setConfirming(false);
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      description={t.revokeBody}
      onCloseAutoFocus={event => {
        if (revoked.current) {
          event.preventDefault();
          focusTableStatus();
        }
      }}
      onOpenChange={open => {
        // A request on its way finishes before the dialog may close under it.
        if (pending) {
          return;
        }

        setError(undefined);
        setConfirming(open);
      }}
      open={confirming}
      title={interpolate(t.revokeTitle, { email })}
      trigger={
        <Button aria-label={interpolate(t.revokeFor, { email })} size="sm" type="button" variant="secondary">
          {t.revoke}
        </Button>
      }
    >
      <div className={styles.actions}>
        <Text className={styles.error} role="alert" size="sm">
          {error ?? ''}
        </Text>
        {/* Cancel first: the dialog opens on it, so two presses of Enter never revoke. */}
        <div className={styles.buttons}>
          <Button disabled={pending} onClick={() => setConfirming(false)} type="button" variant="secondary">
            {dictionary.common.cancel}
          </Button>
          <Button
            loading={pending}
            onClick={event => {
              keepFocus(event.currentTarget);
              void revoke();
            }}
            type="button"
            variant="destructive"
          >
            {t.revokeConfirm}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
