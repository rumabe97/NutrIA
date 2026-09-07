'use client';
import { Fragment, useState } from 'react';

import styles from './PlanBrowser.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { MacroSummary } from 'components/MacroSummary';
import { MealRow } from 'components/MealRow';
import { PlanDayNav } from 'components/PlanDayNav';

import { formatDate, interpolate } from 'lib/format';

import type { PlanView } from 'core/controllers/Plan';

/**
 * Day selection is client state over a plan fetched on the server: all fourteen
 * days arrive in one response, so switching days is instant and needs no request.
 */
export function PlanBrowser({ plan }: { plan: PlanView }) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const shortDate = (date: string) => formatDate(date, locale, { day: 'numeric', month: 'short' });
  const today = plan.days.find(day => day.date === new Date().toISOString().slice(0, 10))?.dayIndex;
  const [selected, setSelected] = useState(today ?? 1);
  const day = plan.days.find(candidate => candidate.dayIndex === selected) ?? plan.days[0];

  return (
    <Fragment>
      <div className={styles.header}>
        <h1 className={styles.title}>{dictionary.plan.title}</h1>
        <Text size="sm" tone="tertiary">
          {interpolate(dictionary.plan.range, { end: shortDate(plan.endDate), start: shortDate(plan.startDate) })}
        </Text>
      </div>

      <div className={styles.layout}>
        <PlanDayNav days={plan.days} onSelect={setSelected} selected={selected} today={today} />

        {day ? (
          <section className={`${styles.card} motion-enter`} key={day.dayIndex}>
          <div className={styles.dayHeading}>
            <div>
              <Text size="lg" weight="semibold">
                {interpolate(dictionary.plan.day, { index: day.dayIndex })}
              </Text>
              <Text size="sm" tone="tertiary">
                {formatDate(day.date, locale, { day: 'numeric', month: 'long', weekday: 'long' })}
                {day.dayIndex === today ? dictionary.plan.dayIsToday : ''}
              </Text>
            </div>
          </div>

          <MacroSummary carbsG={day.totals.carbsG} fatG={day.totals.fatG} kcal={day.totals.kcal} proteinG={day.totals.proteinG} />

            {/* Keyed on the day so switching days replays the entrance — the
                content changed, and motion is how a reader is told that. */}
            <div className={`${styles.meals} motion-list`}>
              {day.meals.map(meal => (
                <MealRow id={meal.id} kcal={meal.kcal} key={meal.id} name={meal.name} proteinG={meal.proteinG} slot={meal.slot} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Fragment>
  );
}

