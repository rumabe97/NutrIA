'use client';
import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './ConversationDelete.module.css';

import { Button } from 'ui/components/Button';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';

/**
 * Deleting a whole conversation (project 023, PRD 10). The consequence is said
 * before the button that does it — everything in it, for good, and still
 * counted — and the first press only asks.
 */
export function ConversationDelete({
  compact = false,
  conversationId
}: {
  /** In the assistant's bar on a phone: the opener is a bin with the same name. */
  readonly compact?: boolean;
  readonly conversationId: string;
}) {
  const dictionary = useDictionary();
  const t = dictionary.assistant;
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  // Opening moves focus to the confirmation; cancelling gives it back to the button that opened it.
  useEffect(() => {
    if (confirming) {
      opened.current = true;
      confirm.current?.focus();
    } else if (opened.current) {
      opener.current?.focus();
    }
  }, [confirming]);

  async function remove() {
    setDeleting(true);
    setProblem(null);

    try {
      await api(`/assistant/conversations/${conversationId}`, { method: 'DELETE' });
      router.push('/asistente');
      router.refresh();
    } catch (error: unknown) {
      setProblem(messageFor(error, dictionary));
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        aria-label={compact ? t.deleteConversation : undefined}
        className={compact ? styles.bin : undefined}
        onClick={() => setConfirming(true)}
        ref={opener}
        size="sm"
        variant="tertiary"
      >
        {compact ? (
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        ) : (
          t.deleteConversation
        )}
      </Button>
    );
  }

  return (
    <div aria-label={t.deleteConversation} className={`${styles.confirm} motion-drop-in`} role="group">
      <p className={styles.text}>{t.deleteConversationBody}</p>
      <div className={`${styles.actions} button-row`}>
        <Button loading={deleting} onClick={() => void remove()} ref={confirm} size="sm" variant="destructive">
          {t.deleteConversationConfirm}
        </Button>
        <Button disabled={deleting} onClick={() => setConfirming(false)} size="sm" variant="tertiary">
          {t.cancel}
        </Button>
      </div>
      {problem ? (
        <p className={styles.text} role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
