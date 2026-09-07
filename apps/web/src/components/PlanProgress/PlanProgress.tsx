'use client';
import Link from 'next/link';

import styles from './PlanProgress.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatNumber, interpolate } from 'lib/format';

interface PlanProgressProps {
  /** Every day of the plan, in order. */
  days: readonly { date: string; dayIndex: number }[];
  /** The day matching today, when the plan is current. */
  today?: number;
}

/**
 * Fourteen days, and where you are in them.
 *
 * The dashboard used to say "Día 6 de 14" in a sentence and stop. A sentence is
 * a fact; the strip is a shape, and a shape answers "how much of this is left"
 * without being read. Every cell is real — one per stored plan day — and the
 * whole thing links to the plan rather than pretending to be interactive itself.
 */
export function PlanProgress({ days, today }: PlanProgressProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.dashboard;
  const remaining = today === undefined ? days.length : days.length - today;

  return (
    <section className={styles.wrapper}>
      <div className={styles.head}>
        <Text size="sm" tone="tertiary">
          {t.fortnight}
        </Text>
        <Text size="sm" tone="tertiary">
          {remaining <= 0 ? t.lastDay : interpolate(t.daysLeft, { count: formatNumber(remaining, locale) })}
        </Text>
      </div>

      <Link aria-label={t.seeAllDays} className={styles.strip} href="/plan">
        {days.map(day => (
          <span
            className={styles.cell}
            data-state={today !== undefined && day.dayIndex < today ? 'past' : day.dayIndex === today ? 'today' : 'future'}
            key={day.dayIndex}
            title={interpolate(t.fortnightDay, { index: day.dayIndex })}
          />
        ))}
      </Link>
    </section>
  );
}
