import styles from './DishShare.module.css';

import { CountUp } from 'ui/components/CountUp';
import { Rings } from 'ui/components/Rings';

import { formatNumber, interpolate } from 'lib/format';
import { shareOf } from 'lib/dayRings';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { Locale } from 'i18n/config';
import type { Macros } from 'lib/dayRings';

interface DishShareProps {
  /** Copy, so this stays a server component. */
  dictionary: Dictionary;
  /** The dish's own figures — the whole meal, its sides included. */
  dish: Macros;
  locale: Locale;
  /** What the day this meal belongs to was built to hit. */
  targets: Macros;
}

/** One per page: the dish's page draws this block once. */
const TITLE_ID = 'dish-share-title';

/**
 * A dish's share of its day (project 024: "a dish's share of the day on its page"): one
 * small ring per figure — kcal, protein, carbohydrates, fat — drawn to the dish's part of
 * the day's target, with the figure and the percentage in words under each. The words
 * are the text; the rings are their picture (`decorative`). A dish over the day's target
 * draws a full ring and says the real percentage.
 */
export function DishShare({ dictionary, dish, locale, targets }: DishShareProps) {
  const rows = [
    { label: dictionary.macros.kcal, target: targets.kcal, tone: 1, unit: dictionary.units.kcal, value: dish.kcal },
    { label: dictionary.macros.protein, target: targets.proteinG, tone: 2, unit: dictionary.units.gram, value: dish.proteinG },
    { label: dictionary.macros.carbs, target: targets.carbsG, tone: 3, unit: dictionary.units.gram, value: dish.carbsG },
    { label: dictionary.macros.fat, target: targets.fatG, tone: 4, unit: dictionary.units.gram, value: dish.fatG }
  ] as const;

  return (
    <section aria-labelledby={TITLE_ID} className={styles.share}>
      <h2 className={styles.title} id={TITLE_ID}>
        {dictionary.meal.shareTitle}
      </h2>
      <ul className={`${styles.list} motion-list`}>
        {rows.map(row => {
          const percent = shareOf(row.value, row.target);

          return (
            <li className={styles.item} key={row.label}>
              <Rings
                decorative={true}
                items={[{ label: row.label, max: row.target, tone: row.tone, value: row.value }]}
                label={row.label}
                size="sm"
              />
              <span className={styles.figure}>
                <CountUp locale={locale} text={formatNumber(Math.round(row.value), locale)} value={Math.round(row.value)} />
                <span className={styles.unit}> {row.unit}</span>
              </span>
              <span className={styles.label}>{row.label}</span>
              {percent === null ? null : (
                <span className={styles.percent}>{interpolate(dictionary.meal.shareOfDay, { percent: formatNumber(percent, locale) })}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
