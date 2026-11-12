'use client';
import { Fragment, useId, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './MealRow.module.css';

import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { DishLink } from 'components/DishLink';
import { DishPicture } from 'components/DishPicture';
import { MealSwap } from 'components/MealSwap';
import { useDayStatus } from 'components/DayStatusProvider';
import { useOffline } from 'components/OfflineProvider';

import { accompanimentPhrase } from 'lib/accompaniments';
import { api } from 'lib/api';
import { formatNumber, formatQuantity } from 'lib/format';
import { slotLabel } from 'lib/generation';

import type { MealAccompaniment } from 'lib/accompaniments';

interface MealRowProps {
  id: string;
  /** What goes beside the plate, read after the dish's name (`0079`). */
  accompaniments?: readonly MealAccompaniment[];
  /** The dish's picture once one is drawn (`0066`); without one the row shows the dish's designed state. */
  illustrationPath?: string | null;
  /** Already scaled to this meal's portion by the API. */
  ingredients?: readonly { grams: number; name: string }[];
  kcal: number;
  name: string;
  proteinG: number;
  /** A row of a plan that is no longer active: the mark is shown, not offered. */
  readOnly?: boolean;
  /** False for a plan that has not started: there is nothing to mark yet, so no circle that looks as if there were. */
  showMark?: boolean;
  slot: string;
  status?: string;
  /**
   * «Cambiar plato» on the row (the plan's day only): the same control as the dish's page,
   * with the fortnight's count. The caller decides whether it is offered (`lib/mealSwap`)
   * and keeps one panel open at a time.
   */
  swap?: {
    readonly limit: number;
    readonly onOpenChange: (open: boolean) => void;
    readonly open: boolean;
    readonly remaining: number;
    readonly totalMinutes: number;
  };
}

/**
 * One meal in a day's list: a tick at the start to mark it eaten from here — the list is
 * where a person is when a plate has just been cleared — then the dish, its picture
 * first (project 024: the food is the product), and its ingredients a disclosure away.
 *
 * The plan used to be fourteen days of names, and the grams — the thing you actually cook
 * and shop from — were behind a navigation per meal. Closed by default, because fourteen
 * days of open ingredient lists is not a plan you can scan either. The dish is a link to
 * its full recipe, and grows into it where the browser can (`components/DishLink`).
 *
 * The tick is optimistic; a failure puts it back. Where the screen sums the day's marks
 * (Inicio's rings, `components/DayStatusProvider`), the row tells it at once. "Skipped"
 * stays on the meal's own page, where it is a considered choice rather than a tap in
 * passing.
 */
export function MealRow({
  id,
  accompaniments = [],
  illustrationPath = null,
  ingredients = [],
  kcal,
  name,
  proteinG,
  readOnly = false,
  showMark = true,
  slot,
  status: initial = 'planned',
  swap
}: MealRowProps) {
  const nameId = useId();
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const day = useDayStatus();
  const [status, setStatus] = useState(initial);
  const [pending, setPending] = useState(false);
  // Only a mark made here ticks: a row that arrives already done is simply done.
  const [ticked, setTicked] = useState(false);
  const done = status === 'completed';
  const recipe = `/plan/comida/${id}`;
  // Offline, the recipe opens only if this device has a copy of it (`0053`): a
  // link that leads to "not connected" is worse than a row that is not a link.
  const opens = useOffline().available(recipe);
  const head = (
    <Fragment>
      <span className={styles.thumb}>
        <DishPicture path={illustrationPath} slot={slot} variant="thumb" />
      </span>
      <span className={styles.text}>
        <span className={styles.slot}>{slotLabel(slot, dictionary)}</span>
        <span className={styles.name}>
          <span data-dish-title="" id={nameId}>
            {name}
          </span>
          {accompaniments.map(side => (
            <Fragment key={side.key}>
              {' '}
              <span className={styles.side}>+ {accompanimentPhrase(side, dictionary, locale)}</span>
            </Fragment>
          ))}
          {status === 'completed' ? <span className={styles.badge}>{dictionary.meal.badgeDone}</span> : null}
          {status === 'skipped' ? <span className={styles.badge}>{dictionary.meal.badgeSkipped}</span> : null}
        </span>
        <span className={styles.meta}>
          {formatNumber(Math.round(kcal), locale)} {dictionary.units.kcal} · {formatNumber(Math.round(proteinG), locale)}{' '}
          {dictionary.units.proteinShort}
        </span>
      </span>
    </Fragment>
  );

  async function toggleDone() {
    const previous = status;
    const next = done ? 'planned' : 'completed';

    setStatus(next);
    setTicked(next === 'completed');
    day?.mark(id, next);
    setPending(true);

    try {
      await api(`/meal-plans/meals/${id}/status`, { body: { status: next }, method: 'PATCH' });
      router.refresh();
    } catch {
      setStatus(previous);
      setTicked(false);
      day?.mark(id, previous);
    } finally {
      setPending(false);
    }
  }

  const mark = (
    <svg
      aria-hidden="true"
      className={styles.tickMark}
      fill="none"
      height="12"
      // Keyed on the mark just made, so the stroke draws itself again (`.motion-tick`).
      key={ticked ? 'ticked' : 'still'}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      viewBox="0 0 12 12"
      width="12"
    >
      <path className={ticked ? 'motion-tick' : undefined} d="M2 6.5 4.8 9.2 10 3.5" pathLength={1} />
    </svg>
  );

  return (
    <div className={styles.row} data-marked={showMark} data-status={status}>
      {!showMark ? null : readOnly ? (
        <span aria-hidden="true" className={styles.tick} data-done={done} data-static="true">
          {mark}
        </span>
      ) : (
        <button
          aria-busy={pending || undefined}
          aria-label={done ? dictionary.meal.unmarkDone : dictionary.meal.markDone}
          aria-pressed={done}
          className={styles.tick}
          disabled={pending}
          onClick={() => void toggleDone()}
          type="button"
        >
          {mark}
        </button>
      )}
      <div className={styles.body}>
        {opens ? (
          <DishLink className={styles.head} mealId={id}>
            {head}
          </DishLink>
        ) : (
          <div className={styles.head}>{head}</div>
        )}

        {ingredients.length > 0 ? (
          <details className={styles.details}>
            <summary className={styles.summary}>{dictionary.meal.ingredients}</summary>
            <ul className={styles.ingredients}>
              {ingredients.map(ingredient => (
                <li className={styles.ingredient} key={ingredient.name}>
                  <span className={styles.ingredientName}>{ingredient.name}</span>
                  <span className={styles.grams}>{formatQuantity(ingredient.grams, 'g', locale, dictionary)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
      {/* Under the dish and across the whole row, so its panel has the row's width at 320 px;
          outside the link, since a control inside a link is two targets in one. The button
          names the dish it changes through `describedBy`: four «Cambiar plato» in a list are
          otherwise one name four times. Only while the meal is still planned, which a mark
          made here can change. */}
      {swap && status === 'planned' ? (
        <div className={styles.swap}>
          <MealSwap
            describedBy={nameId}
            limit={swap.limit}
            mealId={id}
            onOpenChange={swap.onOpenChange}
            open={swap.open}
            remaining={swap.remaining}
            totalMinutes={swap.totalMinutes}
          />
        </div>
      ) : null}
    </div>
  );
}
