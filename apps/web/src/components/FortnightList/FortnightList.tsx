'use client';
import Link from 'next/link';

import styles from './FortnightList.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatDate, formatNumber, interpolate } from 'lib/format';

import type { FortnightView } from 'core/controllers/Progress';

const FULL = 100;

/**
 * One card per fortnight lived, newest first: how its meals were marked and
 * what the check-in said. The bar is the check-in's own measure — eaten over
 * marked — so the number here and the one on the check-in never disagree; an
 * empty bar with "no meals marked" is the honest state before the first mark.
 */
export function FortnightList({ fortnights }: { fortnights: readonly FortnightView[] }) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.progress;
  const status = { active: t.statusActive, archived: t.statusArchived, completed: t.statusCompleted } as const;
  const chip = (fortnight: FortnightView) =>
    fortnight.replaced ? t.statusReplaced : (status[fortnight.status as keyof typeof status] ?? fortnight.status);
  const hunger = { hungry: t.hungerHungry, right: t.hungerRight, too_much: t.hungerTooMuch } as const;
  const difficulty = { easy: t.difficultyEasy, hard: t.difficultyHard, ok: t.difficultyOk } as const;
  const dateOptions = { day: 'numeric', month: 'short' } as const;

  return (
    <ol className={styles.list}>
      {fortnights.map(fortnight => {
        const unmarked = fortnight.meals.soFar - fortnight.meals.eaten - fortnight.meals.skipped;

        return (
          <li className={styles.card} key={fortnight.planId}>
            {/* Dated, not numbered: a redo or a regeneration makes a new plan of the
                same fortnight, and "Quincena 3" of a person on their first fortnight
                asked more than it answered. The plan number stays, small. */}
            <div className={styles.head}>
              <div>
                <h3 className={styles.title}>
                  {interpolate(t.fortnightRange, {
                    from: formatDate(fortnight.startDate, locale, dateOptions),
                    to: formatDate(fortnight.endDate, locale, dateOptions)
                  })}
                </h3>
                <Text size="xs" tone="tertiary">
                  {interpolate(t.planNumber, { version: fortnight.version })}
                </Text>
              </div>
              <span className={styles.status} data-status={fortnight.replaced ? 'replaced' : fortnight.status}>
                {chip(fortnight)}
              </span>
            </div>

            <div className={styles.adherence}>
              <div className={styles.figure}>
                <span className={styles.percent}>{fortnight.adherence === null ? t.noData : `${formatNumber(fortnight.adherence, locale)} %`}</span>
                <Text size="xs" tone="tertiary">
                  {fortnight.adherence === null ? t.adherenceNone : t.adherenceLabel}
                </Text>
              </div>
              <div className={styles.track}>
                <div className={styles.bar} style={{ inlineSize: `${Math.min(fortnight.adherence ?? 0, FULL)}%` }} />
              </div>
              <Text size="xs" tone="tertiary">
                {interpolate(t.mealsLine, { eaten: fortnight.meals.eaten, skipped: fortnight.meals.skipped, soFar: fortnight.meals.soFar, unmarked })}
              </Text>
            </div>

            {fortnight.checkIn ? (
              <ul className={styles.checkIn}>
                {fortnight.checkIn.satisfaction === null ? null : <li>{interpolate(t.satisfaction, { value: fortnight.checkIn.satisfaction })}</li>}
                {fortnight.checkIn.hunger ? <li>{hunger[fortnight.checkIn.hunger]}</li> : null}
                {fortnight.checkIn.difficulty ? <li>{difficulty[fortnight.checkIn.difficulty]}</li> : null}
                {fortnight.checkIn.weightKg === null ? null : (
                  <li>{interpolate(t.checkInWeight, { value: formatNumber(fortnight.checkIn.weightKg, locale, { maximumFractionDigits: 1 }) })}</li>
                )}
              </ul>
            ) : null}

            <Link className={styles.open} href={fortnight.status === 'active' ? '/plan' : `/plan/historial/${fortnight.planId}`}>
              {t.openPlan}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
