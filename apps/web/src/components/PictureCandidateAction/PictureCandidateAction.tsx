'use client';
import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './PictureCandidateAction.module.css';

import { Button } from 'ui/components/Button';
import { Dialog } from 'ui/components/Dialog';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { useKeepFocus } from 'components/AdminTable/useKeepFocus';

import { api, ApiError, messageFor } from 'lib/api';

import { focusReviewBack, sayReview } from './reviewStatus';

import type { PictureDiscardView, PictureRetryView } from 'core/controllers/Admin';

interface PictureCandidateActionProps {
  /** `discard` deletes the rejected picture and nothing else; `retry` deletes it and draws another. */
  kind: 'discard' | 'retry';
  recipeId: string;
}

/**
 * One of the two things the owner can do with a picture the judge rejected (`0072`), from
 * its review page: discard it, or retry the drawing — which deletes it too, and costs.
 *
 * Both are confirmed first, in a dialog that says what is deleted and whether it costs
 * before anything is done. Done, the picture is gone and so are these buttons: the page is
 * read again, focus goes to the link back to Recetas, and what happened is said in the
 * page's one region once it is there. A picture that was already gone (expired, or acted on
 * from another tab) ends the same way, with its own words. Any other refusal is said in
 * the dialog.
 */
export function PictureCandidateAction({ kind, recipeId }: PictureCandidateActionProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.adminPictureReview;
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  // What to say once the picture is gone; set, the action is done and the dialog is closing for good.
  const finished = useRef<string | null>(null);
  const keepFocus = useKeepFocus(pending);
  const recipe = `/admin/catalogue/recipes/${encodeURIComponent(recipeId)}/picture`;
  const words =
    kind === 'discard'
      ? { body: t.discardBody, confirm: t.discardConfirm, done: t.discardDone, label: t.discard, title: t.discardTitle }
      : { body: t.retryBody, confirm: t.retryConfirm, done: t.retryDone, label: t.retry, title: t.retryTitle };

  function finish(message: string) {
    finished.current = message;
    setConfirming(false);
    router.refresh();
  }

  async function act() {
    setPending(true);
    setError(undefined);

    try {
      if (kind === 'discard') {
        await api<PictureDiscardView>(`${recipe}/candidate/discard`, { method: 'POST' });
      } else {
        await api<PictureRetryView>(`${recipe}/retry`, { method: 'POST' });
      }

      finish(words.done);
    } catch (caught) {
      // Nothing left to discard: the page is out of date, not the request wrong.
      if (kind === 'discard' && caught instanceof ApiError && caught.status === 404) {
        finish(t.gone);
      } else {
        // The retry has its own hourly limit, and its own words for reaching it.
        setError(
          kind === 'retry' && caught instanceof ApiError && caught.status === 429
            ? dictionary.adminRecipes.retryTooMany
            : messageFor(caught, dictionary)
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      description={words.body}
      onCloseAutoFocus={event => {
        const message = finished.current;

        if (message !== null) {
          event.preventDefault();
          focusReviewBack();
          // Said after focus has landed: a polite message written before it is dropped for the link's own name.
          requestAnimationFrame(() => sayReview(message));
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
      title={words.title}
      trigger={
        <Button type="button" variant="secondary">
          {words.label}
        </Button>
      }
    >
      <div className={styles.actions}>
        <Text className={styles.error} role="alert" size="sm">
          {error ?? ''}
        </Text>
        {/* Cancel first: the dialog opens on it, so two presses of Enter never delete. */}
        <div className={styles.buttons}>
          <Button
            disabled={pending}
            onClick={() => {
              setError(undefined);
              setConfirming(false);
            }}
            type="button"
            variant="secondary"
          >
            {dictionary.common.cancel}
          </Button>
          <Button
            loading={pending}
            onClick={event => {
              keepFocus(event.currentTarget);
              void act();
            }}
            type="button"
            variant={kind === 'discard' ? 'destructive' : 'primary'}
          >
            {words.confirm}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
