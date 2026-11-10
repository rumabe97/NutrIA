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
export function ConversationDelete({ conversationId }: { readonly conversationId: string }) {
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
      <Button onClick={() => setConfirming(true)} ref={opener} size="sm" variant="tertiary">
        {t.deleteConversation}
      </Button>
    );
  }

  return (
    <div aria-label={t.deleteConversation} className={styles.confirm} role="group">
      <p className={styles.text}>{t.deleteConversationBody}</p>
      <div className={styles.actions}>
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
