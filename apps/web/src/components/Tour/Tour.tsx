'use client';
import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react';

import Link from 'next/link';

import styles from './Tour.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api } from 'lib/api';
import { interpolate } from 'lib/format';

/**
 * The stops, in the order somebody meets them: the plan exists, a dish can be
 * changed, the days can be shaped, a trip pauses them, and the check-in is what
 * makes the next fortnight better.
 *
 * Only things a person cannot find on their own are here. The shopping list and
 * the progress chart are in the navigation bar with their own names, and a tour
 * that reads out the menu is a tour nobody finishes.
 */
const STOPS = [
  { href: '/plan', key: 'plan' },
  { href: '/plan', key: 'swap' },
  { href: '/onboarding/4?volver=perfil', key: 'shape' },
  { href: '/perfil', key: 'trip' },
  { href: '/check-in', key: 'checkIn' }
] as const;

interface TourProps {
  /** Render a button that replays it, instead of opening on its own. */
  replay?: boolean;
  /** Whether this person has already been shown it (`0038`). Unread in replay mode. */
  seen?: boolean;
}

/**
 * What the product does, said once, to somebody who has just arrived (`0038`).
 *
 * It opens itself on the dashboard for anyone who has never seen it — existing
 * accounts included, since they are the ones who have been using features
 * nobody ever named — and it can be replayed from the profile.
 *
 * A native `<dialog>`: the focus trap, the Escape key and the backdrop are the
 * platform's, and every one of them is a thing a hand-rolled overlay gets
 * subtly wrong. What the platform does not do is decide where focus should
 * land, and its defaults are wrong here in both directions — see `show` and
 * `leave`. Closing is closing however it happens — the mark is written in
 * `onClose`, so leaving by Escape counts exactly like pressing the last button.
 */
export function Tour({ replay = false, seen = true }: TourProps) {
  const dictionary = useDictionary();
  const t = dictionary.tour;
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const bodyId = `${id}-body`;
  const titleId = `${id}-title`;
  const [step, setStep] = useState(0);

  const show = useCallback(() => {
    // `showModal` throws on a dialog that is already open, which is what a
    // second run of the mount effect would be.
    if (!dialog.current || dialog.current.open) {return;}

    dialog.current.showModal();
    /*
     * `showModal` puts focus on the first focusable child, which here is the
     * link that ends the tour: a modal that opens by itself and lands the
     * reader on the way out. The heading is where the tour actually starts.
     */
    title.current?.focus();
  }, []);

  useEffect(() => {
    if (!replay && !seen) {show();}
  }, [replay, seen, show]);

  function open() {
    setStep(0);
    show();
  }

  function close() {
    dialog.current?.close();
  }

  /*
   * A dialog opened from an effect has nothing behind it to return to, so the
   * platform's restoration leaves focus on <body>: no landmark, no heading, and
   * the next Tab starts the page again. The replay button is the right place to
   * go back to when there is one; otherwise the page's own heading is.
   */
  function leave() {
    markSeen();

    const target = trigger.current ?? document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1');

    if (!target) {return;}

    // A heading is not focusable by itself, and a page-level heading with a
    // permanent `tabindex` is a stop in everyone's tab order for the sake of
    // this one moment.
    if (!target.hasAttribute('tabindex')) {target.tabIndex = -1;}

    target.focus();
  }

  /*
   * Fire-and-forget on purpose. Nothing on the screen waits for this, and a
   * mark that failed to save costs one repeated tour — a modal held open by a
   * spinner over a dropped request costs more.
   */
  function markSeen() {
    void api('/profile/tour', { body: { seen: true }, method: 'PATCH' }).catch(() => undefined);
  }

  /*
   * Stepping swaps the heading and the body with no other sign that anything
   * happened. Focus follows the change: it is announced, and the next Tab
   * starts at the top of the new stop rather than in the middle of it.
   */
  useEffect(() => {
    if (dialog.current?.open) {title.current?.focus();}
  }, [step]);

  const stop = STOPS[step];
  const last = step === STOPS.length - 1;

  return (
    <section className={replay ? styles.replay : styles.headless}>
      {replay ? (
        <Fragment>
          <h2 className={styles.replayTitle}>{t.replayTitle}</h2>
          <Text size="sm" tone="secondary">
            {t.replayBody}
          </Text>
          <Button onClick={open} ref={trigger} size="sm" type="button" variant="secondary">
            {t.replayCta}
          </Button>
        </Fragment>
      ) : null}

      <dialog aria-describedby={bodyId} aria-labelledby={titleId} className={styles.dialog} onClose={leave} ref={dialog}>
        <div className={styles.panel}>
          <Text size="xs" tone="tertiary">
            {interpolate(t.progress, { of: STOPS.length, step: step + 1 })}
          </Text>

          <h2 className={styles.title} id={titleId} ref={title} tabIndex={-1}>
            {t.stops[stop.key].title}
          </h2>

          <Text id={bodyId} tone="secondary">
            {t.stops[stop.key].body}
          </Text>

          {/* The stop's own screen, one click away. Somebody who wants to see
              the thing being described should not have to remember where it
              was — and going there ends the tour, which is the right trade. */}
          <Link className={styles.link} href={stop.href} onClick={close}>
            {t.stops[stop.key].cta}
          </Link>

          {last ? (
            <Text size="sm" tone="tertiary">
              {t.closing}
            </Text>
          ) : null}

          <div className={styles.actions}>
            {/* The way out is at the other end of the row from the way on: a
                button that leaves and a button that continues should never be
                neighbours a thumb can confuse. On the last stop there is no
                way out to offer — leaving and finishing are the same thing. */}
            {last ? null : (
              <Button className={styles.skip} onClick={close} size="sm" type="button" variant="secondary">
                {t.skip}
              </Button>
            )}

            {step > 0 ? (
              <Button onClick={() => setStep(value => value - 1)} size="sm" type="button" variant="secondary">
                {t.back}
              </Button>
            ) : null}

            <Button onClick={last ? close : () => setStep(value => value + 1)} size="sm" type="button">
              {last ? t.done : t.next}
            </Button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
