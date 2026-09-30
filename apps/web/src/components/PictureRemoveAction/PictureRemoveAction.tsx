'use client';
import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './PictureRemoveAction.module.css';

import { Button } from 'ui/components/Button';
import { Dialog } from 'ui/components/Dialog';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { focusReviewBack, sayReview } from 'components/PictureCandidateAction/reviewStatus';
import { useKeepFocus } from 'components/AdminTable/useKeepFocus';

import { api, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';
import { pictureRefusal, REMOVE_STALE } from 'lib/pictureRefusal';

import type { PictureRemoveView } from 'core/controllers/Admin';

interface PictureRemoveActionProps {
  /** The dish's name, as the page shows it: the dialog names what it removes, heard on its own by a screen reader. */
  dish: string;
  recipeId: string;
}

/**
 * "Retirar" on a published picture, whoever accepted it — the owner by hand (`0072`) or the
 * judge (project 010): how a mistaken acceptance is undone without a migration.
 *
 * Confirmed first, in a dialog that names the dish and says what it does to everybody who
 * gets it, how long it then waits, and that it is recorded. Removed, the page is read again, focus
 * goes to the link back to Recetas and what happened is said in the page's one region once
 * it is there.
 *
 * Two endings stay in the dialog until it is closed, because they are to be read: the
 * picture removed but its public file not deleted, and a picture that was no longer
 * published (another tab got there first). Closing either reads the page again.
 */
export function PictureRemoveAction({ dish, recipeId }: PictureRemoveActionProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.adminPictureReview;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  // Set, the request is over and the page out of date: the dialog only says how it ended, and closes.
  const [ended, setEnded] = useState<{ readonly message: string; readonly title: string }>();
  // What to say once the page has been read again; set, the dialog is closing for good.
  const finished = useRef<string | null>(null);
  const reload = useRef<HTMLButtonElement>(null);
  const keepFocus = useKeepFocus(pending);

  // The buttons that were there are gone: focus goes to the one that is left.
  useEffect(() => {
    if (ended !== undefined) {
      reload.current?.focus();
    }
  }, [ended]);

  function leave(message: string) {
    // The dialog is closing on its way out: focus goes to the back link, not back to the confirm it fades with.
    keepFocus(null);
    finished.current = message;
    setOpen(false);
    router.refresh();
  }

  function close() {
    setError(undefined);

    if (ended === undefined) {
      setOpen(false);
    } else {
      leave(ended.message);
    }
  }

  async function remove() {
    setPending(true);
    setError(undefined);

    try {
      const { fileDeleted } = await api<PictureRemoveView>(`/admin/catalogue/recipes/${encodeURIComponent(recipeId)}/picture/remove`, {
        method: 'POST'
      });

      if (fileDeleted) {
        leave(t.removeDone);
      } else {
        // Removed, and something is left for the owner to do by hand: it is read before the page moves on.
        setEnded({ message: t.removeLeftover, title: t.removeLeftoverTitle });
      }
    } catch (caught) {
      const refusal = pictureRefusal(caught, REMOVE_STALE);

      if (refusal === 'stale') {
        setEnded({ message: messageFor(caught, dictionary), title: t.removeStaleTitle });
      } else {
        setError(refusal === 'tooMany' ? t.removeTooMany : messageFor(caught, dictionary));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      description={ended === undefined ? t.removeBody : undefined}
      onCloseAutoFocus={event => {
        const message = finished.current;

        if (message !== null) {
          finished.current = null;
          event.preventDefault();
          focusReviewBack();
          // Said after focus has landed: a polite message written before it is dropped for the link's own name.
          requestAnimationFrame(() => sayReview(message));
        }
      }}
      onOpenChange={next => {
        // A request on its way finishes before the dialog may close under it.
        if (pending) {
          return;
        }

        if (next) {
          setError(undefined);
          setEnded(undefined);
          setOpen(true);
        } else {
          close();
        }
      }}
      open={open}
      title={ended === undefined ? interpolate(t.removeTitle, { dish }) : ended.title}
      trigger={
        <Button type="button" variant="secondary">
          {t.remove}
        </Button>
      }
    >
      <div className={styles.actions}>
        <Text className={styles.error} role="alert" size="sm">
          {ended?.message ?? error ?? ''}
        </Text>
        {ended === undefined ? (
          // Cancel first: the dialog opens on it, so two presses of Enter never remove.
          <div className={styles.buttons}>
            <Button disabled={pending} onClick={close} type="button" variant="secondary">
              {dictionary.common.cancel}
            </Button>
            <Button
              loading={pending}
              onClick={event => {
                keepFocus(event.currentTarget);
                void remove();
              }}
              type="button"
              variant="destructive"
            >
              {t.removeConfirm}
            </Button>
          </div>
        ) : (
          <div className={styles.buttons}>
            <Button onClick={close} ref={reload} type="button" variant="secondary">
              {t.reload}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
