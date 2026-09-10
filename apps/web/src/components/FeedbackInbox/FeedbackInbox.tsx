'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './FeedbackInbox.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { formatDate } from 'lib/format';

import type { FeedbackView } from 'core/controllers/Feedback';

/**
 * The owner's inbox (`0037`).
 *
 * Marking a message dealt with is reversible, and that is the point: "handled"
 * is a note the owner leaves themselves, and a note you cannot take back is one
 * people stop making. Optimistic, so the list answers immediately and reverts if
 * the request fails.
 */
export function FeedbackInbox({ messages }: { messages: readonly FeedbackView[] }) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.admin;
  const [rows, setRows] = useState(messages);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();

  async function toggle(id: string, handled: boolean) {
    const previous = rows;

    setPending(id);
    setError(undefined);
    setRows(list => list.map(row => (row.id === id ? { ...row, handled } : row)));

    try {
      await api(`/admin/feedback/${id}`, { body: { handled }, method: 'PATCH' });
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
        {t.noFeedback}
      </Text>
    );
  }

  return (
    <div className={styles.root}>
      <ul className={styles.list}>
        {rows.map(row => (
          <li className={row.handled ? `${styles.row} ${styles.handled}` : styles.row} key={row.id}>
            <div className={styles.head}>
              <span className={styles.chip}>{dictionary.feedback.kinds[row.kind as 'idea' | 'other' | 'problem'] ?? row.kind}</span>
              <Text as="span" size="xs" tone="tertiary">
                {row.email} · {formatDate(row.createdAt.slice(0, 10), locale, { day: 'numeric', month: 'short' })}
              </Text>
            </div>

            {/* Their words, as typed. Nothing here summarises or interprets. */}
            <p className={styles.message}>{row.message}</p>

            <Button disabled={pending !== undefined} loading={pending === row.id} onClick={() => void toggle(row.id, !row.handled)} size="sm" type="button" variant="secondary">
              {row.handled ? t.feedbackReopen : t.feedbackHandled}
            </Button>
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
