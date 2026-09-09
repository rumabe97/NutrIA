'use client';
import { Fragment, useState } from 'react';

import Link from 'next/link';

import styles from './PlanBrowser.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { CtaLink } from 'components/CtaLink';
import { MacroSummary } from 'components/MacroSummary';
import { MealRow } from 'components/MealRow';
import { PlanDayNav } from 'components/PlanDayNav';

import { formatDate, interpolate } from 'lib/format';

import type { PlanRedoStanding } from 'core/domain/Allowance';
import type { PlanView } from 'core/controllers/Plan';

/**
 * Day selection is client state over a plan fetched on the server: all fourteen
 * days arrive in one response, so switching days is instant and needs no request.
 */
interface PlanBrowserProps {
  /** Whether there is more than this plan to see — shows the way to the history. */
  hasHistory?: boolean;
  /**
   * A plan no longer being lived (0021): the marks are shown and nothing can be
   * changed — no tick, no redo, no "today" — and the header says which plan it
   * was and how it ended.
   */
  history?: { replaced: boolean } | null;
  plan: PlanView;
  redo: PlanRedoStanding | null;
}

export function PlanBrowser({ hasHistory = false, history = null, plan, redo }: PlanBrowserProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const shortDate = (date: string) => formatDate(date, locale, { day: 'numeric', month: 'short' });
  const today = history ? undefined : plan.days.find(day => day.date === new Date().toISOString().slice(0, 10))?.dayIndex;
  const [selected, setSelected] = useState(today ?? 1);
  const day = plan.days.find(candidate => candidate.dayIndex === selected) ?? plan.days[0];

  return (
    <Fragment>
      {history ? (
        <Link className={styles.back} href="/plan/historial">
          {dictionary.plan.historyBack}
        </Link>
      ) : null}
      <div className={styles.header}>
        <h1 className={styles.title}>{history ? dictionary.plan.historyOne : dictionary.plan.title}</h1>
        <Text size="sm" tone="tertiary">
          {interpolate(dictionary.plan.range, { end: shortDate(plan.endDate), start: shortDate(plan.startDate) })}
          {history ? ` · ${history.replaced ? dictionary.plan.historyReplaced : dictionary.plan.historyFinished}` : ''}
        </Text>
        {hasHistory && !history ? (
          <Link className={styles.historyLink} href="/plan/historial">
            {dictionary.plan.historyLink}
          </Link>
        ) : null}
        {/* What the fortnight still allows, said before the person goes looking
            for a button that will refuse them. A redo is a whole new plan for the
            same days; the next fortnight is never rationed. */}
        {redo?.kind === 'redo' ? (
          <div className={styles.redo}>
            {redo.allowed ? (
              <Fragment>
                <CtaLink href="/plan/generando" size="sm" variant="secondary">
                  {dictionary.plan.redoCta}
                </CtaLink>
                <Text size="xs" tone="tertiary">
                  {dictionary.plan.redoAvailable}
                </Text>
              </Fragment>
            ) : (
              <Text size="xs" tone="tertiary">
                {interpolate(dictionary.plan.redoSpent, { date: redo.nextAt ? shortDate(redo.nextAt) : '' })}
              </Text>
            )}
          </div>
        ) : null}
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

          <MacroSummary carbsG={day.totals.carbsG} fatG={day.totals.fatG} kcal={day.totals.kcal} note={dictionary.macros.note} proteinG={day.totals.proteinG} />

            {/* Keyed on the day so switching days replays the entrance — the
                content changed, and motion is how a reader is told that. */}
            <div className={`${styles.meals} motion-list`}>
              {day.meals.map(meal => (
                <MealRow
                  id={meal.id}
                  illustrationPath={meal.illustrationPath}
                  ingredients={meal.ingredients}
                  kcal={meal.kcal}
                  key={meal.id}
                  name={meal.name}
                  proteinG={meal.proteinG}
                  readOnly={history !== null}
                  slot={meal.slot}
                  status={meal.status}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Fragment>
  );
}

