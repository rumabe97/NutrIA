'use client';
import { Fragment, useState } from 'react';

import styles from './PlanBrowser.module.css';

import { Text } from 'ui/components/Text';

import { MacroSummary } from 'components/MacroSummary';
import { MealRow } from 'components/MealRow';
import { PlanDayNav } from 'components/PlanDayNav';

import type { PlanView } from 'core/controllers/Plan';

const DATE_LABEL = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', weekday: 'long' });

/**
 * Day selection is client state over a plan fetched on the server: all fourteen
 * days arrive in one response, so switching days is instant and needs no request.
 */
export function PlanBrowser({ plan }: { plan: PlanView }) {
  const today = plan.days.find(day => day.date === new Date().toISOString().slice(0, 10))?.dayIndex;
  const [selected, setSelected] = useState(today ?? 1);
  const day = plan.days.find(candidate => candidate.dayIndex === selected) ?? plan.days[0];

  return (
    <Fragment>
      <div className={styles.header}>
        <h1 className={styles.title}>Tu plan</h1>
        <Text size="sm" tone="tertiary">
          14 días · del {shortDate(plan.startDate)} al {shortDate(plan.endDate)}
        </Text>
      </div>

      <PlanDayNav days={plan.days} onSelect={setSelected} selected={selected} today={today} />

      {day ? (
        <section className={styles.card}>
          <div className={styles.dayHeading}>
            <div>
              <Text size="lg" weight="semibold">
                Día {day.dayIndex}
              </Text>
              <Text size="sm" tone="tertiary">
                {DATE_LABEL.format(new Date(`${day.date}T00:00:00`))}
                {day.dayIndex === today ? ' · hoy' : ''}
              </Text>
            </div>
          </div>

          <MacroSummary carbsG={day.totals.carbsG} fatG={day.totals.fatG} kcal={day.totals.kcal} proteinG={day.totals.proteinG} />

          <div className={styles.meals}>
            {day.meals.map(meal => (
              <MealRow id={meal.id} kcal={meal.kcal} key={meal.id} name={meal.name} proteinG={meal.proteinG} slot={meal.slot} />
            ))}
          </div>
        </section>
      ) : null}
    </Fragment>
  );
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(`${date}T00:00:00`));
}
