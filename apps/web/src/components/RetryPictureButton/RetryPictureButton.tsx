'use client';
import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './RetryPictureButton.module.css';

import { Button } from 'ui/components/Button';
import { useDictionary } from 'i18n/LocaleProvider';

import { focusIsLost, focusTableStatus } from 'components/AdminTable/tableStatus';
import { useKeepFocus } from 'components/AdminTable/useKeepFocus';

import { api, ApiError, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

import { sayRetry } from './retryStatus';

import type { PictureRetryView } from 'core/controllers/Admin';

interface RetryPictureButtonProps {
  /** The dish's name, for the button's accessible name. */
  dish: string;
  recipeId: string;
  /** Changes when the row's reason or retry date does, so a new failure starts from a live button. */
  version: string;
}

/**
 * "Reintentar" on a recipe whose picture failed or was given back (`0066`): asks the API to
 * draw it now, ignoring the cool-off. The API answers 202 and draws after the response, so
 * the page is read again and the row stops being a failed one. Progress ("Reintentando…",
 * "Dibujándose") is said in the page's one long-lived region, never in the row; the button
 * stays (`aria-disabled`) until the row changes under it, and when it goes, focus stays in
 * the row's cell. A refusal (the switch is off, the cap is reached, somebody else got there
 * first) is said in words under the button.
 */
export function RetryPictureButton({ dish, recipeId, version }: RetryPictureButtonProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.adminRecipes;
  const [pending, setPending] = useState(false);
  const [startedFor, setStartedFor] = useState<string>();
  const [error, setError] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const cell = useRef<HTMLElement | null>(null);
  const startedRef = useRef(false);
  const keepFocus = useKeepFocus(pending, root);
  // Started for this state of the row only: when the reason or date changes, it is a fresh chance.
  const started = startedFor === version;

  // When the refresh takes the button away, focus stays in its table cell — or, when the
  // whole row left the table, goes to the table's status line — instead of falling to the page.
  useEffect(
    () => () => {
      const target = cell.current;

      if (!startedRef.current || !target) {
        return;
      }

      requestAnimationFrame(() => {
        if (!focusIsLost()) {
          return;
        }

        if (target.isConnected) {
          target.tabIndex = -1;
          target.focus();
        } else {
          focusTableStatus();
        }
      });
    },
    []
  );

  async function retry() {
    setPending(true);
    setError(undefined);
    sayRetry(`${dish}: ${t.retrying}`);

    try {
      await api<PictureRetryView>(`/admin/catalogue/recipes/${encodeURIComponent(recipeId)}/picture/retry`, { method: 'POST' });
      startedRef.current = true;
      setStartedFor(version);
      sayRetry(`${dish}: ${t.retryStarted}`);
      router.refresh();
    } catch (caught) {
      sayRetry('');
      // The retry has its own hourly limit, and its own words for reaching it.
      setError(caught instanceof ApiError && caught.status === 429 ? t.retryTooMany : messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.root} ref={root}>
      <Button
        aria-disabled={started || undefined}
        aria-label={interpolate(t.retryFor, { dish })}
        disabled={pending}
        loading={pending}
        onClick={event => {
          if (started) {
            return;
          }

          cell.current = event.currentTarget.closest('td');
          keepFocus(event.currentTarget);
          void retry();
        }}
        size="sm"
        type="button"
        variant="secondary"
      >
        {t.retry}
      </Button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
