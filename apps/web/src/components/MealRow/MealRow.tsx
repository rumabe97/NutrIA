'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import styles from './MealRow.module.css';

import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api } from 'lib/api';
import { API_URL } from 'lib/env';
import { formatNumber, formatQuantity } from 'lib/format';
import { slotLabel } from 'lib/generation';

interface MealRowProps {
  id: string;
  /** API path of the recipe's illustration, when one has been drawn. */
  illustrationPath?: string | null;
  /** Already scaled to this meal's portion by the API. */
  ingredients?: readonly { grams: number; name: string }[];
  kcal: number;
  name: string;
  proteinG: number;
  slot: string;
  status?: string;
}

/**
 * One meal, with its ingredients a disclosure away rather than a page away.
 *
 * The plan used to be fourteen days of names, and the grams — the thing you
 * actually cook and shop from — were behind a navigation per meal. Fifty-six
 * navigations is not a plan you can use in a kitchen.
 *
 * Closed by default, because fourteen days of open ingredient lists is not a
 * plan you can scan either. The title stays a link to the full recipe with its
 * method; this is the quantities only.
 */
/**
 * One meal in a day's list, with a tick at the start to mark it eaten from
 * here — the list is where a person is when a plate has just been cleared.
 * Optimistic; a failure puts it back. "Skipped" stays on the meal's own page,
 * where it is a considered choice rather than a tap in passing.
 */
export function MealRow({ id, illustrationPath = null, ingredients = [], kcal, name, proteinG, slot, status: initial = 'planned' }: MealRowProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const [status, setStatus] = useState(initial);
  const [pending, setPending] = useState(false);
  const done = status === 'completed';

  async function toggleDone() {
    const previous = status;
    const next = done ? 'planned' : 'completed';

    setStatus(next);
    setPending(true);

    try {
      await api(`/meal-plans/meals/${id}/status`, { body: { status: next }, method: 'PATCH' });
      router.refresh();
    } catch {
      setStatus(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.row} data-status={status}>
      <button
        aria-busy={pending || undefined}
        aria-label={done ? dictionary.meal.unmarkDone : dictionary.meal.markDone}
        aria-pressed={done}
        className={styles.tick}
        disabled={pending}
        onClick={() => void toggleDone()}
        type="button"
      >
        <svg aria-hidden="true" className={styles.tickMark} fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 12 12" width="12">
          <path d="M2 6.5 4.8 9.2 10 3.5" />
        </svg>
      </button>
      <div className={styles.body}>
      <Link className={styles.head} data-illustrated={illustrationPath ? 'true' : undefined} href={`/plan/comida/${id}`}>
        {/* Decorative here — the name beside it is the content — so the alt is empty and
            the label lives on the detail page, where the picture is large enough to matter. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- the API serves a phone-sized, immutable WebP already; next/image would add an optimiser hop and per-image billing for nothing */}
        {illustrationPath ? <img alt="" className={styles.thumb} loading="lazy" src={`${API_URL}${illustrationPath}`} /> : null}
        <span className={styles.slot}>{slotLabel(slot, dictionary)}</span>
        <span className={styles.name}>
          {name}
          {status === 'completed' ? <span className={styles.badge}>{dictionary.meal.badgeDone}</span> : null}
          {status === 'skipped' ? <span className={styles.badge}>{dictionary.meal.badgeSkipped}</span> : null}
        </span>
        <span className={styles.meta}>
          {formatNumber(Math.round(kcal), locale)} {dictionary.units.kcal} · {formatNumber(Math.round(proteinG), locale)} {dictionary.units.proteinShort}
        </span>
      </Link>

      {ingredients.length > 0 ? (
        <details className={styles.details}>
          <summary className={styles.summary}>{dictionary.meal.ingredients}</summary>
          <ul className={styles.ingredients}>
            {ingredients.map(ingredient => (
              <li className={styles.ingredient} key={ingredient.name}>
                <span>{ingredient.name}</span>
                <span className={styles.grams}>{formatQuantity(ingredient.grams, 'g', locale, dictionary)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      </div>
    </div>
  );
}
