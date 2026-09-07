'use client';
import { useState } from 'react';

import styles from './PlanDayNav.module.css';

const DAYS_PER_WEEK = 7;
const WEEKDAY = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });

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
  const [week, setWeek] = useState(() => (selected > DAYS_PER_WEEK ? 2 : 1));
  const visible = days.filter(day => (week === 1 ? day.dayIndex <= DAYS_PER_WEEK : day.dayIndex > DAYS_PER_WEEK));

  return (
    <div className={styles.wrapper}>
      <div className={styles.weeks}>
        {[1, 2].map(number => (
          <button aria-pressed={week === number} className={styles.week} key={number} onClick={() => setWeek(number)} type="button">
            Semana {number}
          </button>
        ))}
      </div>

      <nav aria-label="Días del plan" className={styles.days}>
        {visible.map(day => (
          <button
            aria-current={day.dayIndex === selected}
            className={day.dayIndex === today ? `${styles.day} ${styles.today}` : styles.day}
            key={day.dayIndex}
            onClick={() => onSelect(day.dayIndex)}
            type="button"
          >
            <span className={styles.dayIndex}>{day.dayIndex}</span>
            <span className={styles.dayLabel}>{WEEKDAY.format(new Date(`${day.date}T00:00:00`))}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
