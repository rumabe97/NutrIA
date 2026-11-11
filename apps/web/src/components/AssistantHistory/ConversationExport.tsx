'use client';
import { useState } from 'react';

import styles from './AssistantHistory.module.css';

import { Button } from 'ui/components/Button';
import { interpolate } from 'i18n/interpolate';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';

/**
 * A copy of every conversation, for the person to keep or take elsewhere
 * (art. 20 RGPD, project 023): asked for by them, built for them alone, and
 * saved on their device — nobody else reads it on the way (PRD 11). JSON,
 * because a copy meant for another service has to be read by a machine.
 */
export function ConversationExport() {
  const dictionary = useDictionary();
  const t = dictionary.assistant.export;
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setSaid(null);

    try {
      const copy = await api<unknown>('/assistant/conversations/export');
      const fileName = interpolate(t.fileName, { date: new Date().toISOString().slice(0, 10) });
      const url = URL.createObjectURL(new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');

      link.href = url;
      link.download = fileName;
      // In the document for the click, the safe form for older WebKit; the address is kept a
      // while, because Safari starts the download after the click has returned.
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setSaid(interpolate(t.downloading, { file: fileName }));
    } catch (error: unknown) {
      setSaid(messageFor(error, dictionary));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.export}>
      <Button loading={busy} onClick={() => void download()} size="sm" variant="tertiary">
        {t.label}
      </Button>
      <p className={styles.exportNote} role="status">
        {said ?? ''}
      </p>
    </div>
  );
}
