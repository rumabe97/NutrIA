'use client';
import { Fragment, useState } from 'react';

import Link from 'next/link';

import styles from './PlanBrowser.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { CtaLink } from 'components/CtaLink';
import { EventPlanner } from 'components/EventPlanner';
import { MacroShift } from 'components/MacroShift';
import { MacroSummary } from 'components/MacroSummary';
import { MealRow } from 'components/MealRow';
import { PlanDayNav } from 'components/PlanDayNav';

import { formatDate, interpolate } from 'lib/format';

import type { EventStanding } from 'components/EventPlanner';
import type { EventView } from 'core/controllers/Event';
import type { PlanRedoStanding } from 'core/domain/Allowance';
import type { PlanView } from 'core/controllers/Plan';

/**
 * Day selection is client state over a plan fetched on the server: all fourteen
 * days arrive in one response, so switching days is instant and needs no request.
 */
interface PlanBrowserProps {
  /** The upcoming events, for the form under the day. */
  events?: readonly EventView[];
  /**
   * A plan no longer being lived (0021): the marks are shown and nothing can be
   * changed — no tick, no redo, no "today" — and the header says which plan it
   * was and how it ended.
   */
  history?: { replaced: boolean } | null;
  /**
   * Additions with the plan under way, or `null` for a tier without them —
   * and null means nothing is drawn, not a disabled something.
   */
  midPlan?: EventStanding | null;
  plan: PlanView;
  redo: PlanRedoStanding | null;
}

export function PlanBrowser({ events = [], history = null, midPlan = null, plan, redo }: PlanBrowserProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const shortDate = (date: string) => formatDate(date, locale, { day: 'numeric', month: 'short' });
  const today = history ? undefined : plan.days.find(day => day.date === new Date().toISOString().slice(0, 10))?.dayIndex;
  const [selected, setSelected] = useState(today ?? 1);
  const day = plan.days.find(candidate => candidate.dayIndex === selected) ?? plan.days[0];
  const canAddMidPlan = midPlan !== null && history === null;

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
        {/* Always shown, even on a first plan: the list holds this one too, and a
            door that appears only once there is something behind it is a door
            nobody learns exists. */}
        {history ? null : (
          <Link className={styles.historyLink} href="/plan/historial">
            {dictionary.plan.historyLink}
          </Link>
        )}
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
              {/* A day that eats for something says so, and says what (0043). The
                  arrows come from comparing the day's own targets with the plan's,
                  so an old plan whose event was deleted still explains itself. */}
              {day.loadedFor ? (
                <span className={styles.loaded}>
                  {interpolate(dictionary.plan.loadedFor, { name: day.loadedFor })}
                  {day.targets && plan.strategy
                    ? loadShifts(day.targets, plan.strategy).map(shift => (
                        <Fragment key={shift.macro}>
                          {' · '}
                          <MacroShift direction={shift.direction} label={dictionary.events[shift.macro].toLowerCase()} />
                        </Fragment>
                      ))
                    : null}
                </span>
              ) : null}
            </div>

            <MacroSummary
              carbsG={day.totals.carbsG}
              fatG={day.totals.fatG}
              kcal={day.totals.kcal}
              note={dictionary.macros.note}
              proteinG={day.totals.proteinG}
            />

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

        {/* Adding an event with the plan under way, for the tier that has it
            (`0043` left the rebuild out; premium buys it). Outside the day card
            on purpose: that card is keyed on the day and remounts on every
            switch, which would empty a half-typed form. */}
        {canAddMidPlan ? (
          <section className={`${styles.card} ${styles.events}`}>
            <EventPlanner allowance={midPlan} events={events} variant="plan" />
          </section>
        ) : null}
      </div>
    </Fragment>
  );
}

type Grams = { carbsG: number; fatG: number; proteinG: number };
type Shift = { direction: 'down' | 'up'; macro: 'carbs' | 'fat' | 'protein' };

/** "hidratos ↑ · grasa ↓": which macros a loaded day moved, read off the numbers rather than stored. */
function loadShifts(targets: Grams, strategy: Grams): Shift[] {
  const pairs: [Shift['macro'], number, number][] = [
    ['carbs', targets.carbsG, strategy.carbsG],
    ['protein', targets.proteinG, strategy.proteinG],
    ['fat', targets.fatG, strategy.fatG]
  ];

  return pairs.flatMap(([macro, day, plan]) => (day === plan ? [] : [{ direction: day > plan ? 'up' : 'down', macro }]));
}
