import { Fragment } from 'react';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
import { CtaLink } from 'components/CtaLink';
import { DayRings } from 'components/DayRings';
import { DayStatusProvider } from 'components/DayStatusProvider';
import { EmptyState } from 'components/EmptyState';
import { MacroSummary } from 'components/MacroSummary';
import { MealRow } from 'components/MealRow';
import { NextMeal } from 'components/NextMeal';
import { PlanPendingNotice } from 'components/PlanPendingNotice';
import { PlanProgress } from 'components/PlanProgress';
import { ScheduledPlanCard } from 'components/ScheduledPlanCard';
import { ShoppingSnapshot } from 'components/ShoppingSnapshot';
import { Tour } from 'components/Tour';
import { WeightTracker } from 'components/WeightTracker';

import { formatDate, formatNumber, interpolate, localIsoDate } from 'lib/format';
import { redirectIfOnboardingIncomplete, redirectIfProfileConsentMissing } from 'lib/onboarding';
import { resumesOn } from 'lib/vacation';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../_shared/metadata';

import type { CheckInStatusView } from 'core/controllers/CheckIn';
import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { FullProfileView } from 'core/controllers/Profile';
import type { Metadata } from 'next';
import type { PlanView } from 'core/controllers/Plan';
import type { ReactNode } from 'react';
import type { UserView } from 'core/controllers/User';
import type { VacationView } from 'core/controllers/Vacation';
import type { WeightView } from 'core/controllers/Progress';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/inicio');
}

/** Only the fields the dashboard's snapshot needs. The shopping screen reads the rest. */
type ShoppingListView = { items: readonly { category: string }[] };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function greetingKey(hour: number): 'goodAfternoon' | 'goodEvening' | 'goodMorning' {
  if (hour < 6) {
    return 'goodEvening';
  }

  if (hour < 14) {
    return 'goodMorning';
  }

  if (hour < 21) {
    return 'goodAfternoon';
  }

  return 'goodEvening';
}

/**
 * Inicio (project 024 phase 4): the greeting, the rings of the day, the next meal as its
 * picture, the day's meals, then weight and shopping — on a phone in that order, one
 * column; from `--breakpoint-wide` the meals take the main column and the rings, weight and
 * shopping the rail beside it. One source order for both, so reading and tabbing never
 * change with the width; only the placement does (`page.module.css`).
 */
export default async function DashboardPage() {
  await redirectIfOnboardingIncomplete();
  await redirectIfProfileConsentMissing();

  const [dictionary, locale, user, profile, plan, scheduled, shopping, weight, checkIn, trips] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<UserView>('/users/me'),
    serverApi<FullProfileView>('/profile'),
    serverApi<PlanView | null>('/meal-plans/active'),
    // A plan chosen to begin on a later day (project 015); 404 is the usual answer.
    serverApi<PlanView>('/meal-plans/scheduled'),
    // 404s into null when there is no active plan, which is a normal state and
    // why every consumer below is guarded rather than this being awaited apart.
    serverApi<ShoppingListView>('/shopping-lists/active'),
    serverApi<WeightView>('/progress/weight'),
    serverApi<CheckInStatusView>('/check-ins/status'),
    serverApi<readonly VacationView[]>('/vacations')
  ]);

  const t = dictionary.dashboard;
  const hour = new Date().getHours();
  const firstName = (profile?.profile?.displayName ?? user?.name ?? '').split(' ')[0];
  const greeting = t[greetingKey(hour)];
  const today = localIsoDate(new Date(), profile?.profile?.timezone);
  const day = plan?.days.find(candidate => candidate.date === today);
  /*
   * There is no day today because the plan was paused around it (`0032`), not
   * because anything went wrong — and the difference matters enough to say out
   * loud, above everything else on the screen.
   */
  const away = trips?.find(trip => trip.away);
  const targets = profile?.targets ?? null;

  // The day's targets, and — on a day of the plan — the rings of what has been marked
  // done against them. On a phone it comes first on a plan's day, because it is what the
  // screen measures; with no day to measure it follows the day's own content, so the one
  // thing to do (create a plan, come back from a trip) leads.
  const targetsCard = targets ? (
    <Card as="section" className={`${styles.targets} motion-enter`}>
      <div className={styles.cardHeading}>
        <h2 className={styles.cardTitle}>
          {interpolate(t.targetsLabel, { status: targets.overrideStatus === 'applied' ? t.targetsStatusOverridden : t.targetsStatusEstimated })}
        </h2>
        <CtaLink href="/perfil" size="sm" variant="tertiary">
          {t.targetsAdjust}
        </CtaLink>
      </div>

      {day ? (
        <DayRings meals={day.meals} targets={targets.effective} totals={day.totals} />
      ) : (
        <MacroSummary
          carbsG={targets.effective.carbsG}
          fatG={targets.effective.fatG}
          kcal={targets.effective.kcal}
          proteinG={targets.effective.proteinG}
        />
      )}

      {/* Said on every screen the figure appears on, not only where it is
            edited: someone acts on the number they see, not on the one they
            once read an explanation for. */}
      <Text className={styles.targetsNote} size="xs" tone="tertiary">
        {t.targetsEstimate}
      </Text>
    </Card>
  ) : null;

  const board = (
    <div className={styles.board} data-rail={targets ? true : undefined}>
      {/* What the screen wants from the person before anything it offers. Each is
          absent when it has nothing to say, and so is the region (`:empty`). */}
      <div className={`${styles.notices} motion-enter`}>
        <PlanPendingNotice body={t.pendingReviewBody} currentPlanId={plan?.id ?? null} title={t.pendingReviewTitle} />

        {away ? (
          <EmptyState
            body={interpolate(dictionary.vacations.awayBody, {
              until: formatDate(resumesOn(away.endsOn), locale, { day: 'numeric', month: 'long' })
            })}
            inline={true}
            title={dictionary.vacations.awayTitle}
          >
            {/* A way back into the plan, and deliberately the only action here:
                generating a new one would throw away the paused fortnight. */}
            {plan ? (
              <CtaLink href="/plan" size="lg" variant="secondary">
                {dictionary.vacations.seePlan}
              </CtaLink>
            ) : null}
          </EmptyState>
        ) : null}

        {/* The fortnight's check-in, first, when it is due: the one thing this
            screen wants from the person before anything else it offers. */}
        {checkIn?.due ? (
          <EmptyState body={t.checkInDueBody} inline={true} title={t.checkInDueTitle} tone="warning">
            <CtaLink href="/check-in" size="lg">
              {t.checkInDueCta}
            </CtaLink>
          </EmptyState>
        ) : null}
      </div>

      {day ? targetsCard : null}

      <div className={`${styles.main} motion-list`}>
        {plan ? (
          <Fragment>
            {day ? (
              <Fragment>
                {/* The one question someone opens this screen to answer, answered
                    first and on its own, as the dish itself. The full day is below it. */}
                <NextMeal hour={hour} meals={day.meals} />

                <Card as="section">
                  <div className={styles.cardHeading}>
                    {/* A heading, not a bold paragraph: this screen had one
                        `<h1>` and nothing else, so navigating it by heading
                        landed on the greeting and stopped. */}
                    <h2 className={styles.cardTitle}>{t.today}</h2>
                    <CtaLink href="/plan" size="sm" variant="tertiary">
                      {t.seeAllDays}
                    </CtaLink>
                  </div>

                  {/* With no targets there are no rings to state the day's total
                      beside: the plan's own figures, as they were. */}
                  {targets ? null : (
                    <MacroSummary carbsG={day.totals.carbsG} fatG={day.totals.fatG} kcal={day.totals.kcal} proteinG={day.totals.proteinG} />
                  )}

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
                        slot={meal.slot}
                        status={meal.status}
                      />
                    ))}
                  </div>

                  <Text className={styles.macroNote} size="xs" tone="tertiary">
                    {dictionary.macros.note}
                  </Text>
                </Card>
              </Fragment>
            ) : away ? null : (
              // The plan is active but today falls outside its dates and nobody is
              // away — the fortnight has run its course and the next one is due.
              // While away there is no day for today *by design* (`0032`), and
              // calling that "finished" would offer to replace a plan that is
              // merely waiting.
              <EmptyState body={checkIn?.done ? `${t.planEndedBody} ${t.checkInDoneNote}` : t.planEndedBody} inline={true} title={t.planEndedTitle}>
                <CtaLink href="/plan/generando" size="lg">
                  {t.planEndedCta}
                </CtaLink>
                <CtaLink href="/plan" size="lg" variant="secondary">
                  {t.seePreviousPlan}
                </CtaLink>
              </EmptyState>
            )}

            <Card className={styles.progress}>
              <PlanProgress days={plan.days} today={day?.dayIndex} />
            </Card>

            {scheduled ? <ScheduledPlanCard startDate={scheduled.startDate} /> : null}
          </Fragment>
        ) : scheduled ? (
          // Nothing under way and a plan waiting for its day: say when, instead
          // of offering to build one the person already has.
          <ScheduledPlanCard startDate={scheduled.startDate} waiting={true} />
        ) : (
          // No "finish your profile" branch: an unfinished profile never reaches
          // this page, it is redirected to its resume step above.
          <Fragment>
            <Text tone="secondary">{t.profileComplete}</Text>

            <EmptyState body={t.noPlanBody} inline={true} title={t.noPlanTitle}>
              <CtaLink href="/plan/generando" size="lg">
                {t.noPlanCta}
              </CtaLink>
            </EmptyState>
          </Fragment>
        )}
      </div>

      {day ? null : targetsCard}

      {targets ? (
        // Reference, beside the day on a wide screen and after it on a phone: the
        // shopping still to do, the weight to log, and why the targets moved.
        <div className={`${styles.side} motion-list`}>
          {shopping && shopping.items.length > 0 ? (
            <Card padding="sm">
              <ShoppingSnapshot items={shopping.items} />
            </Card>
          ) : null}

          {weight ? (
            <Card>
              <WeightTracker weight={weight} />
            </Card>
          ) : null}

          {targets.derivation.clampedBy === 'floor' ? (
            <Note tone="warning" toneLabel={dictionary.common.noteTone.warning}>
              {interpolate(t.targetsClamped, {
                floor: formatNumber(targets.derivation.floorKcal, locale),
                requested: formatNumber(targets.derivation.requestedKcal, locale)
              })}
            </Note>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <Fragment>
      {/* Shown once, here, to somebody who has just arrived — and only here: a
          tour that can open on any screen is a tour that interrupts the
          shopping list. A missing profile counts as seen, so a failed request
          never turns into a nag (`0038`). */}
      <Tour seen={profile?.profile?.tourSeen ?? true} />

      <header className={`${styles.intro} motion-enter`}>
        <h1 className={styles.greeting}>{greetingLine(greeting, firstName, t)}</h1>

        {plan ? (
          <Text className={styles.status} tone="secondary">
            {away
              ? interpolate(dictionary.vacations.pausedUntil, { date: formatDate(resumesOn(away.endsOn), locale, { day: 'numeric', month: 'long' }) })
              : `${day ? interpolate(t.dayOf, { current: day.dayIndex, total: plan.days.length }) : t.activePlan} ${interpolate(t.checkIn, { when: checkInLabel(plan.endDate, t) })}`}
          </Text>
        ) : null}
      </header>

      {/* The day's marks, shared by its rows and its rings, so a tick moves the rings at once. */}
      {day ? <DayStatusProvider meals={day.meals}>{board}</DayStatusProvider> : board}
    </Fragment>
  );
}

/**
 * "Buenas tardes, Lucía." with the name set apart in the accent — solid, not the gradient:
 * the gradient's light end does not hold 3:1 on the paper (LOG, phase 1b). The words are
 * the dictionary's own, split around the name, so a language that puts the name first
 * keeps its order.
 */
function greetingLine(greeting: string, name: string, t: Dictionary['dashboard']): ReactNode {
  if (!name) {
    return greeting;
  }

  const [before = '', after = ''] = t.greetingNamed.split('{name}');

  return (
    <Fragment>
      {interpolate(before, { greeting })}
      <span className={styles.name}>{name}</span>
      {interpolate(after, { greeting })}
    </Fragment>
  );
}

function checkInLabel(endDate: string, t: Dictionary['dashboard']): string {
  const remaining = Math.ceil((new Date(`${endDate}T00:00:00`).getTime() - Date.now()) / MS_PER_DAY);

  if (remaining < 0) {
    return t.availableNow;
  }

  if (remaining === 0) {
    return t.today.toLowerCase();
  }

  if (remaining === 1) {
    return t.tomorrow;
  }

  return interpolate(t.inDays, { count: remaining });
}
