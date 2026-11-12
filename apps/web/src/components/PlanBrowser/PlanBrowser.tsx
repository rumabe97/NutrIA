'use client';
import { Fragment, useState } from 'react';

import Link from 'next/link';

import styles from './PlanBrowser.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';
import { CtaLink } from 'components/CtaLink';
import { EventPlanner } from 'components/EventPlanner';
import { MacroShift } from 'components/MacroShift';
import { MacroSummary } from 'components/MacroSummary';
import { MealRow } from 'components/MealRow';
import { PlanDayNav } from 'components/PlanDayNav';
import { TargetProgress } from 'components/TargetProgress';
import { useOffline } from 'components/OfflineProvider';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { swapOffered } from 'lib/mealSwap';

import type { EventStanding } from 'components/EventPlanner';
import type { EventView } from 'core/controllers/Event';
import type { MealSwapStanding, PlanRedoStanding } from 'core/domain/Allowance';
import type { PlanView } from 'core/controllers/Plan';

/**
 * Day selection is client state over a plan fetched on the server: all fourteen
 * days arrive in one response, so switching days is instant and needs no request.
 */
interface PlanBrowserProps {
  /** The plan is paused for a trip (`0032`): nothing on it is changed, so no row offers a swap. */
  away?: boolean;
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
  /**
   * The fortnight's swaps, read as the dish's page reads them, for «Cambiar plato» on each
   * row of the plan being lived (the owner's decision of 2026-11-12). Null — the allowance
   * could not be read, or this is not the current plan — draws no swap anywhere.
   */
  swaps?: MealSwapStanding | null;
  /** A plan that has not started (project 015): its days to read and swap, with nothing to mark yet. */
  upcoming?: boolean;
}

export function PlanBrowser({
  away = false,
  events = [],
  history = null,
  midPlan = null,
  plan,
  redo,
  swaps = null,
  upcoming = false
}: PlanBrowserProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const { offline } = useOffline();
  // One swap panel open at a time, across the day's rows: opening another puts the first away.
  const [swapping, setSwapping] = useState<string | null>(null);
  const shortDate = (date: string) => formatDate(date, locale, { day: 'numeric', month: 'short' });
  const today = history || upcoming ? undefined : plan.days.find(day => day.date === new Date().toISOString().slice(0, 10))?.dayIndex;
  const [selected, setSelected] = useState(today ?? 1);
  // Which way the last change of day went: the next day slides in from the end, an
  // earlier one from the start (the shared axis, `ui/styles/motion`). None before the first.
  const [travel, setTravel] = useState<'back' | 'forward' | null>(null);
  const day = plan.days.find(candidate => candidate.dayIndex === selected) ?? plan.days[0];
  // What the day was built to hit: its own targets on a day that eats for an event, the
  // plan's otherwise. Null on a plan older than both, which then shows its figures only.
  const dayTargets = day ? (day.targets ?? plan.strategy) : null;

  function select(dayIndex: number) {
    if (dayIndex !== selected) {
      setTravel(dayIndex > selected ? 'forward' : 'back');
      setSwapping(null);
    }

    setSelected(dayIndex);
  }

  const canAddMidPlan = midPlan !== null && history === null && !upcoming;

  return (
    <Fragment>
      {history ? (
        <Link className={styles.back} href="/plan/historial">
          {dictionary.plan.historyBack}
        </Link>
      ) : null}
      {upcoming ? (
        <Link className={styles.back} href="/plan">
          {dictionary.plan.upcomingBack}
        </Link>
      ) : null}
      {/* The day is the title, as the approved sheet draws it: «Miércoles, día 3», with the
          fortnight and the day's energy against its target under it. Which plan this is —
          a past one, the next one — is said in the small capitals above. */}
      <div className={styles.header}>
        {history || upcoming ? <p className={styles.eyebrow}>{history ? dictionary.plan.historyOne : dictionary.plan.upcomingTitle}</p> : null}
        <h1 className={styles.title}>
          {day ? (
            <Fragment>
              {capitalised(formatDate(day.date, locale, { weekday: 'long' }), locale)},{' '}
              <span className={styles.dayNumber}>{interpolate(dictionary.plan.day, { index: day.dayIndex }).toLocaleLowerCase(locale)}</span>
            </Fragment>
          ) : (
            dictionary.plan.title
          )}
        </h1>
        <Text size="sm" tone="tertiary">
          {interpolate(dictionary.plan.range, { end: shortDate(plan.endDate), start: shortDate(plan.startDate) })}
          {day && dayTargets
            ? ` · ${interpolate(dictionary.dashboard.ofTarget, {
                target: formatNumber(Math.round(dayTargets.kcal), locale),
                unit: dictionary.units.kcal,
                value: formatNumber(Math.round(day.totals.kcal), locale)
              })}`
            : ''}
          {day && day.dayIndex === today ? dictionary.plan.dayIsToday : ''}
          {history ? ` · ${history.replaced ? dictionary.plan.historyReplaced : dictionary.plan.historyFinished}` : ''}
        </Text>
        {/* A day that eats for something says so, and says what (0043). The
            arrows come from comparing the day's own targets with the plan's,
            so an old plan whose event was deleted still explains itself. */}
        {day?.loadedFor ? (
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

      <div className={styles.layout}>
        <PlanDayNav days={plan.days} onSelect={select} selected={selected} today={today} />

        {day ? (
          <div
            className={`${styles.day} ${travel === 'forward' ? 'motion-forward' : travel === 'back' ? 'motion-back' : 'motion-enter'}`}
            key={day.dayIndex}
          >
            {/* Keyed on the day, so switching days replays the slide and the cards' arrival —
                the content changed, and motion is how a reader is told that. One card a meal. */}
            <div className={`${styles.meals} motion-list`}>
              {day.meals.map(meal => (
                <MealRow
                  accompaniments={meal.accompaniments}
                  id={meal.id}
                  illustrationPath={meal.illustrationPath}
                  ingredients={meal.ingredients}
                  kcal={meal.kcal}
                  key={meal.id}
                  name={meal.name}
                  proteinG={meal.proteinG}
                  readOnly={history !== null || upcoming}
                  showMark={!upcoming}
                  slot={meal.slot}
                  status={meal.status}
                  swap={
                    swaps &&
                    history === null &&
                    !upcoming &&
                    swapOffered({ allowanceKnown: true, away, mealStatus: meal.status, offline, planStatus: plan.status })
                      ? {
                          limit: swaps.limit,
                          onOpenChange: open => setSwapping(open ? meal.id : current => (current === meal.id ? null : current)),
                          open: swapping === meal.id,
                          remaining: swaps.remaining,
                          totalMinutes: meal.prepMinutes + meal.cookMinutes
                        }
                      : undefined
                  }
                  totalMinutes={meal.prepMinutes + meal.cookMinutes}
                  variant="card"
                />
              ))}
            </div>

            {/* The day's figures, after the food: what it adds up to, and against what it
                was built to hit. The plan's, never what was eaten. */}
            <Card as="section" className={styles.card}>
              <MacroSummary
                carbsG={day.totals.carbsG}
                fatG={day.totals.fatG}
                kcal={day.totals.kcal}
                note={dictionary.macros.note}
                proteinG={day.totals.proteinG}
              />
              {dayTargets ? (
                <div className={styles.targets}>
                  <TargetProgress label={dictionary.plan.dayVsTarget} targets={dayTargets} totals={day.totals} />
                </div>
              ) : null}
            </Card>
          </div>
        ) : null}

        {/* Adding an event with the plan under way, for the tier that has it
            (`0043` left the rebuild out; premium buys it). Outside the day card
            on purpose: that card is keyed on the day and remounts on every
            switch, which would empty a half-typed form. */}
        {canAddMidPlan ? (
          <Card as="section" className={`${styles.card} ${styles.events}`}>
            <EventPlanner allowance={midPlan} events={events} variant="plan" />
          </Card>
        ) : null}

        {/* The plan's own doors, after the day: the earlier plans — always shown, even on a
            first plan, since a door that appears only once there is something behind it is
            a door nobody learns exists — and what the fortnight still allows, said before
            the person goes looking for a button that will refuse them. A redo is a whole new
            plan for the same days; the next fortnight is never rationed. */}
        {history || upcoming ? null : (
          <div className={styles.doors}>
            <Link className={styles.historyLink} href="/plan/historial">
              {dictionary.plan.historyLink}
            </Link>
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
        )}
      </div>
    </Fragment>
  );
}

/** «Jueves»: a weekday at the head of a title, in a language that writes it small. */
function capitalised(word: string, locale: string): string {
  return word.charAt(0).toLocaleUpperCase(locale) + word.slice(1);
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
