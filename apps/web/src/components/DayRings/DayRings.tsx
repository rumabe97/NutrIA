'use client';
import styles from './DayRings.module.css';

import { CountUp } from 'ui/components/CountUp';
import { Rings } from 'ui/components/Rings';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { useDayStatus } from 'components/DayStatusProvider';

import { completedCount, completedTotals } from 'lib/dayRings';
import { formatNumber, interpolate } from 'lib/format';

import type { Macros } from 'lib/dayRings';

interface DayRingsProps {
  /** Today's meals, with their status and figures as the server last returned them. */
  meals: readonly (Macros & { readonly id: string; readonly status: string })[];
  /** The person's targets in effect. */
  targets: Macros;
  /** What today's plan adds up to, all its meals: said beside the rings, never drawn as them. */
  totals: Macros;
}

/**
 * The rings of the day on Inicio (project 024, PRD § "What changes from the sheets", 8):
 * the meals marked «Hecha», summed, against the day's targets — kcal, protein,
 * carbohydrates and fat, outermost first, in the theme's four ring colours.
 *
 * They say only what is known: what the meals the person **marked as done** add up to,
 * in those words. And the plan's own total for the day stays written under them, so an
 * empty ring is never read as a short plan. With nothing marked the rings are empty and
 * a line says how to fill them.
 *
 * A meal ticked further down the screen moves them at once (`components/DayStatusProvider`):
 * the rings sweep to the new value and the figures count to it.
 *
 * The legend is the text: each figure in words, beside the rings while there is room for
 * both and under them when there is not — a container query on the card, so it holds at
 * 320 px, in a desktop rail and at 200 % text alike. The rings themselves are then only
 * their picture (`decorative`).
 */
export function DayRings({ meals, targets, totals }: DayRingsProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const day = useDayStatus();
  const marks = day?.marks ?? {};
  const done = completedTotals(meals, marks);
  const marked = completedCount(meals, marks);
  const whole = (value: number) => formatNumber(Math.round(value), locale);

  const rows = [
    { done: done.kcal, label: dictionary.macros.kcal, target: targets.kcal, tone: 1, unit: dictionary.units.kcal },
    { done: done.proteinG, label: dictionary.macros.protein, target: targets.proteinG, tone: 2, unit: dictionary.units.gram },
    { done: done.carbsG, label: dictionary.macros.carbs, target: targets.carbsG, tone: 3, unit: dictionary.units.gram },
    { done: done.fatG, label: dictionary.macros.fat, target: targets.fatG, tone: 4, unit: dictionary.units.gram }
  ] as const;

  return (
    <div className={styles.root}>
      <div className={styles.figures}>
        <Rings
          className={styles.rings}
          decorative={true}
          items={rows.map(row => ({ label: row.label, max: row.target, value: row.done }))}
          label={dictionary.dashboard.todayVsTarget}
        />

        <ul className={styles.legend}>
          {rows.map(row => (
            <li className={styles.item} key={row.label}>
              <span className={styles.label}>
                <span aria-hidden="true" className={`${styles.dot} ${styles[`tone${row.tone}`]}`} />
                {row.label}
              </span>
              <span className={styles.line}>
                <CountUp className={styles.value} locale={locale} text={whole(row.done)} value={Math.round(row.done)} />{' '}
                <span className={styles.of}>{interpolate(dictionary.dashboard.ringsOf, { target: whole(row.target), unit: row.unit })}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Text className={styles.caption} size="sm" tone="secondary">
        {marked > 0 ? dictionary.dashboard.ringsDone : dictionary.dashboard.ringsNone}
      </Text>
      <Text className={styles.plan} size="sm" tone="tertiary">
        {interpolate(dictionary.dashboard.ringsPlan, {
          carbs: whole(totals.carbsG),
          fat: whole(totals.fatG),
          kcal: whole(totals.kcal),
          protein: whole(totals.proteinG)
        })}
      </Text>
    </div>
  );
}
