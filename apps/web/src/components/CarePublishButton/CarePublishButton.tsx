'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './CarePublishButton.module.css';

import { Button } from 'ui/components/Button';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, ApiError, messageFor } from 'lib/api';

/** The current plan's heading on the client's page, which is where the published plan is shown next. */
const PUBLISHED_HEADING = 'plan-title';

/**
 * *Publicar* (`0060`): the plan under review becomes the client's, and the one
 * they were living is completed in the same transaction. The page is read
 * again, where the pending plan is gone and the new one is current.
 */
export function CarePublishButton({ linkId }: Readonly<{ linkId: string }>) {
  const router = useRouter();
  const dictionary = useDictionary();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function publish() {
    setPending(true);
    setError(undefined);

    try {
      await api(`/care/clients/${encodeURIComponent(linkId)}/plan/publish`, { method: 'POST' });
      // This button leaves with the plan it published; focus goes to the plan that is now current rather than to <body>.
      document.getElementById(PUBLISHED_HEADING)?.focus();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError && caught.code === 'NOT_FOUND' ? dictionary.practice.gone : messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.root}>
      <Button loading={pending} onClick={() => void publish()} type="button">
        {dictionary.practice.publish}
      </Button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
