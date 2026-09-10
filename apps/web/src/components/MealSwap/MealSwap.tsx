'use client';
import { useEffect, useId, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './MealSwap.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, ApiError, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

import type { SwapAxis } from 'core/entities/Plan';

interface MealSwapProps {
  limit: number;
  mealId: string;
  remaining: number;
  /** Prep and cooking of the current dish, so "quicker" can say what it means. */
  totalMinutes: number;
}

type Choice = 'any' | SwapAxis;

/**
 * "Change this dish": one button in the toolbar, with the count of what is
 * left, and a panel that opens under it to ask what the new dish should be
 * (0022) before anything is spent. The choice is a radio list with a line
 * under each option saying what it means for this meal; "whatever fits" is
 * first and selected, because it is the most common answer.
 *
 * The confirm button holds its spinner until the page has re-rendered with the
 * new dish: the swap updates the meal in place, so the same URL shows the
 * result, and a refresh is the whole navigation. Errors stay on the panel's
 * own line — a spent allowance and "nothing like that fits" are answers.
 */
export function MealSwap({ limit, mealId, remaining, totalMinutes }: MealSwapProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.meal;
  const name = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice>('any');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [left, setLeft] = useState(remaining);
  const spent = left <= 0;

  /*
   * Closing unmounts the panel with focus still inside it, which leaves focus on
   * <body>: no announcement, and the next Tab restarts the page. Back to the
   * button that opened it — or, when the last change has just been spent and
   * that button is now disabled, to the toolbar around it. After the render, so
   * `disabled` is the one on screen and not the one of a moment ago.
   */
  useEffect(() => {
    if (wasOpen.current && !open) {
      if (trigger.current?.disabled === false) {
        trigger.current.focus();
      } else {
        root.current?.focus();
      }
    }

    wasOpen.current = open;
  }, [open]);

  const options: readonly { hint: string; label: string; value: Choice }[] = [
    { hint: t.swapAxisAnyHint, label: t.swapAxisAny, value: 'any' },
    { hint: interpolate(t.swapAxisQuickerHint, { minutes: totalMinutes }), label: t.swapAxisQuicker, value: 'quicker' },
    { hint: t.swapAxisNoCookingHint, label: t.swapAxisNoCooking, value: 'no_cooking' },
    { hint: t.swapAxisMoreProteinHint, label: t.swapAxisMoreProtein, value: 'more_protein' },
    { hint: t.swapAxisVegetarianHint, label: t.swapAxisVegetarian, value: 'vegetarian' }
  ];

  async function swap() {
    setError(undefined);
    setPending(true);

    try {
      await api(`/meal-plans/meals/${mealId}/swap`, { body: { axis: choice === 'any' ? undefined : choice }, method: 'POST' });
      setLeft(count => Math.max(count - 1, 0));
      setOpen(false);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'QUOTA_EXCEEDED') {
        setLeft(0);
      } else if (caught instanceof ApiError && caught.code === 'CONFLICT') {
        setError(choice === 'any' ? t.swapNoFit : t.swapNoFitAxis);
      } else {
        setError(messageFor(caught, dictionary));
      }
    } finally {
      setPending(false);
    }
  }

  const hint = spent ? interpolate(t.swapSpent, { limit }) : left === 1 ? interpolate(t.swapHintOne, { limit }) : interpolate(t.swapHint, { limit, remaining: left });

  return (
    <div className={styles.root} ref={root} tabIndex={-1}>
      <Button
        // Only while the panel is on the page: `aria-controls` pointing at an id
        // that does not exist is a promise the DOM cannot keep.
        aria-controls={open ? `${name}-panel` : undefined}
        aria-expanded={open}
        className={styles.trigger}
        disabled={spent || pending}
        onClick={() => setOpen(value => !value)}
        ref={trigger}
        size="sm"
        type="button"
        variant="secondary"
      >
        {spent ? t.swapSpentShort : t.swap}
        {spent ? null : <span className={styles.count}>{interpolate(t.swapCount, { limit, remaining: left })}</span>}
      </Button>

      {open ? (
        <div className={styles.panel} id={`${name}-panel`}>
          <Text weight="semibold">{t.swapAxisLabel}</Text>

          <div className={styles.options}>
            {options.map(option => (
              <label className={styles.option} key={option.value}>
                <input checked={choice === option.value} className={styles.input} disabled={pending} name={name} onChange={() => setChoice(option.value)} type="radio" value={option.value} />
                <span className={styles.optionText}>
                  <Text as="span" size="sm" weight="medium">
                    {option.label}
                  </Text>
                  <Text as="span" size="xs" tone="tertiary">
                    {option.hint}
                  </Text>
                </span>
              </label>
            ))}
          </div>

          <div className={styles.footer}>
            <Button loading={pending} onClick={() => void swap()} size="sm" type="button">
              {pending ? t.swapping : t.swapConfirm}
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setError(undefined);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {dictionary.common.cancel}
            </Button>
            {/* An alert only when something failed: the idle line is a count of
                what is left, and a live region around it would read the footer
                out every time the panel opens. Separate keys so the alert is
                *inserted* rather than edited in place — a role appearing on an
                element that was already there is announced by some readers and
                not others. */}
            {error ? (
              <Text as="p" className={styles.hint} key="error" role="alert" size="xs" tone="secondary">
                {error}
              </Text>
            ) : (
              <Text as="p" className={styles.hint} key="hint" size="xs" tone="tertiary">
                {hint}
              </Text>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
