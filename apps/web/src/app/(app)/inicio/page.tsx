import { Fragment } from 'react';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';
import { MacroSummary } from 'components/MacroSummary';
import { MealRow } from 'components/MealRow';
import { NextMeal } from 'components/NextMeal';
import { PlanProgress } from 'components/PlanProgress';
import { ShoppingSnapshot } from 'components/ShoppingSnapshot';
import { TargetProgress } from 'components/TargetProgress';
import { WeightTracker } from 'components/WeightTracker';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import type { CheckInStatusView } from 'core/controllers/CheckIn';
import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { FullProfileView } from 'core/controllers/Profile';
import type { PlanView } from 'core/controllers/Plan';
import type { UserView } from 'core/controllers/User';
import type { VacationView } from 'core/controllers/Vacation';
import type { WeightView } from 'core/controllers/Progress';

export const dynamic = 'force-dynamic';

/** Only the fields the dashboard's snapshot needs. The shopping screen reads the rest. */
type ShoppingListView = { items: readonly { category: string }[] };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function greetingKey(hour: number): 'goodAfternoon' | 'goodEvening' | 'goodMorning' {
  if (hour < 6) {return 'goodEvening';}

  if (hour < 14) {return 'goodMorning';}

  if (hour < 21) {return 'goodAfternoon';}

  return 'goodEvening';
}

export default async function DashboardPage() {
  await redirectIfOnboardingIncomplete();

  const [dictionary, locale, user, profile, plan, shopping, weight, checkIn, trips] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<UserView>('/users/me'),
    serverApi<FullProfileView>('/profile'),
    serverApi<PlanView | null>('/meal-plans/active'),
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
  const hello = firstName ? interpolate(t.greetingNamed, { greeting, name: firstName }) : greeting;
  const today = new Date().toISOString().slice(0, 10);
  const day = plan?.days.find(candidate => candidate.date === today);
  /*
   * There is no day today because the plan was paused around it (`0032`), not
   * because anything went wrong — and the difference matters enough to say out
   * loud, above everything else on the screen.
   */
  const away = trips?.find(trip => trip.away);

  return (
    <Fragment>
      <h1 className={styles.greeting}>{hello}</h1>

      <div className={styles.layout}>
        <div className={`${styles.main} motion-enter`}>
          {away ? (
            <EmptyState body={interpolate(dictionary.vacations.awayBody, { until: formatDate(away.endsOn, locale, { day: 'numeric', month: 'long' }) })} title={dictionary.vacations.awayTitle} />
          ) : null}

          {/* The fortnight's check-in, first, when it is due: the one thing this
              screen wants from the person before anything else it offers. */}
          {checkIn?.due ? (
            <EmptyState body={t.checkInDueBody} title={t.checkInDueTitle} tone="warning">
              <CtaLink href="/check-in" size="lg">
                {t.checkInDueCta}
              </CtaLink>
            </EmptyState>
          ) : null}

          {plan ? (
            <Fragment>
              <Text tone="secondary">
                {day ? interpolate(t.dayOf, { current: day.dayIndex, total: plan.days.length }) : t.activePlan}{' '}
                {interpolate(t.checkIn, { when: checkInLabel(plan.endDate, t) })}
              </Text>

              <PlanProgress days={plan.days} today={day?.dayIndex} />

              {day ? (
                <Fragment>
                  {/* The one question someone opens this screen to answer, answered
                      first and on its own. The full day is below it. */}
                  <NextMeal hour={hour} meals={day.meals} />

                  <section className={styles.todayCard}>
                    <div className={styles.todayHeading}>
                      <Text size="lg" weight="semibold">
                        {t.today}
                      </Text>
                      <CtaLink href="/plan" size="sm" variant="ghost">
                        {t.seeAllDays}
                      </CtaLink>
                    </div>

                    <MacroSummary carbsG={day.totals.carbsG} fatG={day.totals.fatG} kcal={day.totals.kcal} note={dictionary.macros.note} proteinG={day.totals.proteinG} />

                    <div className={`${styles.meals} motion-list`}>
                      {day.meals.map(meal => (
                        <MealRow id={meal.id} illustrationPath={meal.illustrationPath} ingredients={meal.ingredients} kcal={meal.kcal} key={meal.id} name={meal.name} proteinG={meal.proteinG} slot={meal.slot} status={meal.status} />
                      ))}
                    </div>
                  </section>
                </Fragment>
              ) : (
            // The plan is active but today falls outside its dates — the fortnight
            // has run its course and the next one is due.
            <EmptyState body={checkIn?.done ? `${t.planEndedBody} ${t.checkInDoneNote}` : t.planEndedBody} title={t.planEndedTitle}>
              <CtaLink href="/plan/generando" size="lg">
                {t.planEndedCta}
              </CtaLink>
                  <CtaLink href="/plan" size="lg" variant="secondary">
                    {t.seePreviousPlan}
                  </CtaLink>
                </EmptyState>
              )}
            </Fragment>
          ) : (
        // No "finish your profile" branch: an unfinished profile never reaches
        // this page, it is redirected to its resume step above.
        <Fragment>
          <Text tone="secondary">{t.profileComplete}</Text>

          <EmptyState body={t.noPlanBody} title={t.noPlanTitle}>
            <CtaLink href="/plan/generando" size="lg">
              {t.noPlanCta}
            </CtaLink>
          </EmptyState>
            </Fragment>
          )}
        </div>

        {profile?.targets ? (
          <aside className={`${styles.rail} motion-enter`}>
            {/* Each rail block is its own panel, so the grid's gap is the rhythm
                between them rather than a margin each one invents. */}
            <div className={styles.railBlock}>
              <div className={styles.targetsLabel}>
                <Text size="sm" tone="tertiary">
                  {interpolate(t.targetsLabel, {
                    status: profile.targets.overrideStatus === 'applied' ? t.targetsStatusOverridden : t.targetsStatusEstimated
                  })}
                </Text>
                <CtaLink href="/perfil" size="sm" variant="ghost">
                  {t.targetsAdjust}
                </CtaLink>
              </div>

              <MacroSummary
                carbsG={profile.targets.effective.carbsG}
                fatG={profile.targets.effective.fatG}
                kcal={profile.targets.effective.kcal}
                proteinG={profile.targets.effective.proteinG}
              />

              {/* Said on every screen the figure appears on, not only where it is
                  edited: someone acts on the number they see, not on the one they
                  once read an explanation for. */}
              <Text className={styles.targetsNote} size="xs" tone="tertiary">
                {t.targetsEstimate}
              </Text>

              {day ? <TargetProgress targets={profile.targets.effective} totals={day.totals} /> : null}

              {shopping && shopping.items.length > 0 ? <ShoppingSnapshot items={shopping.items} /> : null}

              {weight ? <WeightTracker weight={weight} /> : null}

              {profile.targets.derivation.clampedBy === 'floor' ? (
                <p className={styles.notice}>
                  {interpolate(t.targetsClamped, {
                    floor: formatNumber(profile.targets.derivation.floorKcal, locale),
                    requested: formatNumber(profile.targets.derivation.requestedKcal, locale)
                  })}
                </p>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </Fragment>
  );
}

function checkInLabel(endDate: string, t: Dictionary['dashboard']): string {
  const remaining = Math.ceil((new Date(`${endDate}T00:00:00`).getTime() - Date.now()) / MS_PER_DAY);

  if (remaining < 0) {return t.availableNow;}

  if (remaining === 0) {return t.today.toLowerCase();}

  if (remaining === 1) {return t.tomorrow;}

  return interpolate(t.inDays, { count: remaining });
}
