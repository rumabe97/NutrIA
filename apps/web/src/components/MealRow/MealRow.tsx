'use client';
import Link from 'next/link';

import styles from './MealRow.module.css';

import { useDictionary, useLocale } from 'i18n/LocaleProvider';

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
export function MealRow({ id, illustrationPath = null, ingredients = [], kcal, name, proteinG, slot }: MealRowProps) {
  const dictionary = useDictionary();
  const locale = useLocale();

  return (
    <div className={styles.row}>
      <Link className={styles.head} data-illustrated={illustrationPath ? 'true' : undefined} href={`/plan/comida/${id}`}>
        {/* Decorative here — the name beside it is the content — so the alt is empty and
            the label lives on the detail page, where the picture is large enough to matter. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- the API serves a phone-sized, immutable WebP already; next/image would add an optimiser hop and per-image billing for nothing */}
        {illustrationPath ? <img alt="" className={styles.thumb} loading="lazy" src={`${API_URL}${illustrationPath}`} /> : null}
        <span className={styles.slot}>{slotLabel(slot, dictionary)}</span>
        <span className={styles.name}>{name}</span>
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
  );
}
