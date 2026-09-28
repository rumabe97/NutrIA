'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './FeedbackToggle.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { useKeepFocus } from 'components/AdminTable/useKeepFocus';

import { api, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

interface FeedbackToggleProps {
  id: string;
  email: string;
  handled: boolean;
}

/**
 * Marks a message seen, or opens it again (`0037`), from its row on Buzón.
 *
 * Reversible, and that is the point: "seen" is a note the owner leaves themselves,
 * and a note you cannot take back is one people stop making. The button keeps its
 * place, and its words change once the request has gone through. It is disabled while
 * the request is out, which drops focus, so `useKeepFocus` gives it back; on "Sin ver"
 * the row leaves the table once it is read again, and focus goes to the line over it.
 */
export function FeedbackToggle({ id, email, handled }: FeedbackToggleProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.adminInbox;
  const [done, setDone] = useState<boolean>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const seen = done ?? handled;
  const keepFocus = useKeepFocus(pending);

  async function toggle() {
    setPending(true);
    setError(undefined);

    try {
      await api(`/admin/feedback/${encodeURIComponent(id)}`, { body: { handled: !seen }, method: 'PATCH' });
      setDone(!seen);
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.root}>
      <Button
        aria-label={interpolate(seen ? t.reopenFor : t.handledFor, { email })}
        loading={pending}
        onClick={event => {
          keepFocus(event.currentTarget);
          void toggle();
        }}
        size="sm"
        type="button"
        variant="secondary"
      >
        {seen ? t.reopen : t.handled}
      </Button>
      {error ? (
        <Text className={styles.error} role="alert" size="xs">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
