'use client';
import { useState } from 'react';

import styles from './PlanDayNav.module.css';

import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatDate, interpolate } from 'lib/format';

const DAYS_PER_WEEK = 7;

interface PlanDayNavProps {
  days: readonly { date: string; dayIndex: number }[];
  onSelect: (dayIndex: number) => void;
  selected: number;
  /** The day matching today's date, if the plan is current. */
  today?: number;
}

/**
 * Fourteen days is too many chips for a phone, so the week toggle narrows it to
 * seven and the row scrolls within that. Both controls drive the same selection —
 * the week buttons are a filter, not a second source of truth.
 */
export function PlanDayNav({ days, onSelect, selected, today }: PlanDayNavProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const [week, setWeek] = useState(() => (selected > DAYS_PER_WEEK ? 2 : 1));
  const visible = days.filter(day => (week === 1 ? day.dayIndex <= DAYS_PER_WEEK : day.dayIndex > DAYS_PER_WEEK));

  return (
    <div className={styles.wrapper}>
      <div className={styles.weeks}>
        {[1, 2].map(number => (
          <button aria-pressed={week === number} className={styles.week} key={number} onClick={() => setWeek(number)} type="button">
            {interpolate(dictionary.plan.week, { number })}
          </button>
        ))}
      </div>

      {/* A group, not a `<nav>`: these buttons change what the page shows, they do not go anywhere. */}
      <div aria-label={dictionary.plan.daysLabel} className={styles.days} role="group">
        {visible.map(day => (
          <button
            aria-current={day.dayIndex === selected}
            // The chip shows a weekday and a date, as a calendar does; its name says the whole day.
            aria-label={`${formatDate(day.date, locale, { day: 'numeric', month: 'long', weekday: 'long' })} · ${interpolate(dictionary.plan.day, { index: day.dayIndex })}`}
            className={day.dayIndex === today ? `${styles.day} ${styles.today}` : styles.day}
            key={day.dayIndex}
            onClick={() => onSelect(day.dayIndex)}
            type="button"
          >
            <span className={styles.dayLabel}>{formatDate(day.date, locale, { weekday: 'short' })}</span>
            <span className={styles.dayIndex}>{formatDate(day.date, locale, { day: 'numeric' })}</span>
            {/* Which day of the plan it is only fits where the chips become rows — the desktop rail. */}
            <span className={styles.dayDate}>{interpolate(dictionary.plan.day, { index: day.dayIndex })}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
