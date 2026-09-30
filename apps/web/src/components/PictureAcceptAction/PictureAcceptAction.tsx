'use client';
import { Fragment, useEffect, useId, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './PictureAcceptAction.module.css';

import { Button } from 'ui/components/Button';
import { Checkbox } from 'ui/components/Checkbox';
import { Dialog } from 'ui/components/Dialog';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { focusReviewBack, sayReview } from 'components/PictureCandidateAction/reviewStatus';
import { useKeepFocus } from 'components/AdminTable/useKeepFocus';

import { ACCEPT_STALE, pictureRefusal } from 'lib/pictureRefusal';
import { api, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

import type { PictureAcceptView } from 'core/controllers/Admin';

/**
 * The candidate as the page was rendered with it: the allergen keys the judge flagged and the catalogue's
 * words for them, and when it expires — which is what tells one candidate of a dish from the next.
 */
interface Shown {
  readonly allergens: readonly { readonly key: string; readonly label: string }[];
  /** `pictureCandidate.expiresAt`, exactly as the API gave it. */
  readonly expiresAt: string;
  readonly ingredients: readonly string[];
}

interface PictureAcceptActionProps extends Shown {
  /** The dish's name, for the confirmation's sentence. */
  dish: string;
  recipeId: string;
}

/**
 * The owner accepts, against the judge, a picture it rejected (`0072`) — the one act on the
 * review page that puts a picture in front of people, so it takes two steps in one dialog.
 *
 * 1. **The warning**: each allergen the judge flagged and the catalogue ingredients it
 *    recognised, and what accepting means. Nothing here publishes.
 * 2. **The confirmation**: a box that repeats those allergens and must be ticked, then the
 *    button that names what it does. Pressing it without the box does nothing but say so.
 *
 * Cancel is first in both, the dialog opens on it, and the second step starts from the
 * dialog itself — so neither two presses of Enter nor two clicks in one place publish.
 *
 * The request repeats exactly what the dialog showed, taken when it opened: the allergen
 * keys, and the candidate's expiry, so a picture drawn since is never published unseen.
 * When the API answers that the picture changed or went, nothing was published: the dialog
 * says so, and closing it reads the page again for the owner to look — it never asks again
 * with new keys. Published, the page is read again, focus goes to the link back to Recetas
 * and what happened is said in the page's one region once it is there.
 */
export function PictureAcceptAction({ allergens, dish, expiresAt, ingredients, recipeId }: PictureAcceptActionProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.adminPictureReview;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'confirm' | 'warning'>('warning');
  const [shown, setShown] = useState<Shown>({ allergens, expiresAt, ingredients });
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  // Publish was pressed with the box unticked: the failure line is the box's own, and focus goes to the box.
  const [unticked, setUnticked] = useState(false);
  const boxId = useId();
  const errorId = useId();
  // Set, nothing was published and the page is out of date: the dialog only says so and closes.
  const [stale, setStale] = useState<string>();
  // What to say once the page has been read again; set, the dialog is closing for good.
  const finished = useRef<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const reload = useRef<HTMLButtonElement>(null);
  const keepFocus = useKeepFocus(pending);
  const labels = shown.allergens.map(allergen => allergen.label).join(', ');

  // A step that replaced the one before it starts from its top, not from where the last button was: the
  // second step from the dialog itself, which a screen reader then names; the refusal from its one button.
  useEffect(() => {
    if (unticked) {
      // What is left to do is tick it.
      document.getElementById(boxId)?.focus();
    }
  }, [boxId, unticked]);

  useEffect(() => {
    if (stale !== undefined) {
      reload.current?.focus();
    } else if (step === 'confirm') {
      const dialog = body.current?.closest<HTMLElement>('[role="dialog"]');

      if (dialog) {
        dialog.scrollTop = 0;
        dialog.focus();
      }
    }
  }, [stale, step]);

  function leave(message: string) {
    finished.current = message;
    setOpen(false);
    router.refresh();
  }

  function close() {
    setError(undefined);
    setUnticked(false);

    if (stale === undefined) {
      setOpen(false);
    } else {
      leave(stale);
    }
  }

  async function publish() {
    if (!acknowledged) {
      setError(t.acceptAckMissing);
      setUnticked(true);

      return;
    }

    setPending(true);
    setError(undefined);

    try {
      // Exactly what this dialog showed: the keys — the empty list when none was flagged — and which candidate it was.
      await api<PictureAcceptView>(`/admin/catalogue/recipes/${encodeURIComponent(recipeId)}/picture/candidate/accept`, {
        body: { allergens: shown.allergens.map(allergen => allergen.key), expiresAt: shown.expiresAt },
        method: 'POST'
      });
      leave(t.acceptDone);
    } catch (caught) {
      const refusal = pictureRefusal(caught, ACCEPT_STALE);

      if (refusal === 'stale') {
        setStale(messageFor(caught, dictionary));
      } else {
        setError(refusal === 'tooMany' ? t.acceptTooMany : messageFor(caught, dictionary));
      }
    } finally {
      setPending(false);
    }
  }

  const title = stale === undefined ? (step === 'warning' ? t.acceptWarningTitle : t.acceptConfirmTitle) : t.acceptStaleTitle;
  const description = stale === undefined ? (step === 'warning' ? t.acceptWarningBody : interpolate(t.acceptConfirmBody, { dish })) : undefined;

  return (
    <Dialog
      description={description}
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
          // Every opening starts at the warning, with what the page shows now.
          setShown({ allergens, expiresAt, ingredients });
          setStep('warning');
          setAcknowledged(false);
          setError(undefined);
          setUnticked(false);
          setStale(undefined);
          setOpen(true);
        } else {
          close();
        }
      }}
      open={open}
      title={title}
      trigger={
        <Button type="button" variant="secondary">
          {t.accept}
        </Button>
      }
    >
      <div className={styles.body} ref={body}>
        {stale === undefined && step === 'warning' ? (
          <Fragment>
            <dl className={styles.flagged}>
              <div>
                <dt>{t.flaggedAllergens}</dt>
                {/* The catalogue names allergens and ingredients in Spanish only: marked so, for a screen reader on the English page. */}
                <dd>{shown.allergens.length === 0 ? t.flaggedAllergensNone : <span lang="es">{labels}</span>}</dd>
              </div>
              <div>
                <dt>{t.flaggedIngredients}</dt>
                <dd>{shown.ingredients.length === 0 ? t.none : <span lang="es">{shown.ingredients.join(', ')}</span>}</dd>
              </div>
            </dl>
            <div>
              <h3 className={styles.heading}>{t.acceptEffectsTitle}</h3>
              <ul className={styles.effects}>
                {t.acceptEffects.map(effect => (
                  <li key={effect}>{effect}</li>
                ))}
              </ul>
            </div>
          </Fragment>
        ) : null}
        {stale === undefined && step === 'confirm' ? (
          <Checkbox
            aria-describedby={unticked ? errorId : undefined}
            aria-invalid={unticked || undefined}
            checked={acknowledged}
            className={styles.ack}
            disabled={pending}
            id={boxId}
            label={
              shown.allergens.length === 0 ? (
                t.acceptAckNone
              ) : (
                <Fragment>
                  {t.acceptAck} <span lang="es">{labels}</span>
                </Fragment>
              )
            }
            onCheckedChange={checked => {
              setAcknowledged(checked === true);
              setError(undefined);
              setUnticked(false);
            }}
          />
        ) : null}
        <div className={styles.actions}>
          <Text className={styles.error} id={errorId} role="alert" size="sm">
            {stale ?? error ?? ''}
          </Text>
          {stale === undefined ? (
            // Cancel first: each step is entered away from the button that goes on, so two presses of Enter never publish.
            <div className={styles.buttons}>
              <Button disabled={pending} onClick={close} type="button" variant="secondary">
                {dictionary.common.cancel}
              </Button>
              {/* Keyed apart: the button that goes on and the one that publishes are never the same element, focus included. */}
              {step === 'warning' ? (
                <Button key="continue" onClick={() => setStep('confirm')} type="button" variant="secondary">
                  {t.acceptContinue}
                </Button>
              ) : (
                <Button
                  key="publish"
                  loading={pending}
                  onClick={event => {
                    keepFocus(event.currentTarget);
                    void publish();
                  }}
                  type="button"
                  variant="primary"
                >
                  {t.acceptConfirm}
                </Button>
              )}
            </div>
          ) : (
            <div className={styles.buttons}>
              <Button onClick={close} ref={reload} type="button" variant="secondary">
                {t.reload}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
