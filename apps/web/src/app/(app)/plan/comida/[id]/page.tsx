import { Fragment } from 'react';

import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { MacroSummary } from 'components/MacroSummary';
import { MealStatus } from 'components/MealStatus';
import { MealSwap } from 'components/MealSwap';
import { RecipeVerdict } from 'components/RecipeVerdict';

import { API_URL } from 'lib/env';
import { difficultyLabel, slotLabel } from 'lib/generation';
import { formatDate, formatNumber, formatQuantity, interpolate } from 'lib/format';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { resumesOn } from 'lib/vacation';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../../_shared/metadata';

import type { AllowancesView, MealDetailView } from 'core/controllers/Plan';
import type { MealStatus as Status } from 'core/entities/Plan';
import type { Metadata } from 'next';
import type { VacationView } from 'core/controllers/Vacation';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/plan/comida');
}

export default async function MealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await redirectIfOnboardingIncomplete();

  const { id } = await params;
  const [dictionary, locale, meal, allowances, trips] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<MealDetailView>(`/meal-plans/meals/${id}`),
    serverApi<AllowancesView>('/meal-plans/allowances'),
    serverApi<readonly VacationView[]>('/vacations')
  ]);

  if (!meal) {notFound();}

  const away = trips?.find(trip => trip.away);
  // Its day has not come. Offering the control anyway is offering something the
  // API will refuse, which is how a screen teaches somebody not to trust it.
  const notYet = meal.date > new Date().toISOString().slice(0, 10);

  const totalMinutes = meal.prepMinutes + meal.cookMinutes;
  // Only a meal of the plan being lived can be marked or swapped (0021); one of
  // an earlier plan is shown as it was, and the way back leads to that plan.
  const editable = meal.planStatus === 'active';

  return (
    <Fragment>
      <Link className={styles.back} href={editable ? '/plan' : `/plan/historial/${meal.planId}`}>
        {editable ? dictionary.meal.back : dictionary.meal.backToHistory}
      </Link>

      <span className={styles.slot}>{interpolate(dictionary.meal.dayOf, { day: meal.dayIndex, slot: slotLabel(meal.slot, dictionary) })}</span>
      <h1 className={styles.title}>{meal.name}</h1>

      <div className={styles.facts}>
        {totalMinutes > 0 ? <span>{interpolate(dictionary.meal.totalMinutes, { minutes: totalMinutes })}</span> : <span>{dictionary.meal.noCooking}</span>}
        <span>{difficultyLabel(meal.difficulty, dictionary)}</span>
        {meal.cuisine ? <span>{meal.cuisine}</span> : null}
      </div>

      {/* What can be done with this meal, in one row: eaten or skipped on the left,
          another dish on the right — and only for a meal still to come, since a
          plate already eaten is not something to change. The state is the message;
          the buttons carry it, and nothing is explained under them. */}
      {editable ? (
        <div className={styles.toolbar}>
          {/* Paused means paused (`0032`): marking a meal you are not eating
              records something that did not happen, and a swap spends an
              allowance on a fortnight nobody is living. The API refuses all
              three; this is so nobody is invited to try. */}
          {away ? (
            <Text size="sm" tone="tertiary">
              {interpolate(dictionary.vacations.pausedUntil, { date: formatDate(resumesOn(away.endsOn), locale, { day: 'numeric', month: 'long' }) })}
            </Text>
          ) : (
            <Fragment>
              {/* Marking waits for the day; swapping does not — changing tomorrow's
                  dinner today is the whole point of a plan you can steer. */}
              {notYet ? (
                <Text size="sm" tone="tertiary">
                  {interpolate(dictionary.meal.notYet, { date: formatDate(meal.date, locale, { day: 'numeric', month: 'long' }) })}
                </Text>
              ) : (
                <MealStatus mealId={meal.id} status={meal.status as Status} />
              )}
              {allowances && meal.status === 'planned' ? <MealSwap limit={allowances.mealSwaps.limit} mealId={meal.id} remaining={allowances.mealSwaps.remaining} totalMinutes={totalMinutes} /> : null}
            </Fragment>
          )}
        </div>
      ) : (
        <Text className={styles.readOnly} size="sm" tone="tertiary">
          {dictionary.meal.readOnly}
        </Text>
      )}

      {/* An illustration when one has been drawn, and it says so. Nobody cooked this
          dish, so there is no photograph of it and calling a picture one would be the
          most convincing lie on the page (0010). Absent, the page is complete without
          it: the specification below is the content, the picture is the bonus. */}
      {meal.illustrationPath ? (
        <figure className={styles.figure}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the API serves a phone-sized, immutable WebP already; next/image would add an optimiser hop and per-image billing for nothing */}
          <img alt={meal.name} className={styles.illustration} src={`${API_URL}${meal.illustrationPath}`} />
          <figcaption className={styles.illustrationLabel}>{dictionary.meal.illustration}</figcaption>
        </figure>
      ) : null}
      {/* The four numbers a cook checks before starting. */}
      <dl className={styles.spec}>
        {[
          { label: dictionary.meal.prep, value: interpolate(dictionary.meal.minutes, { value: formatNumber(meal.prepMinutes, locale) }) },
          {
            label: dictionary.meal.cook,
            value: meal.cookMinutes > 0 ? interpolate(dictionary.meal.minutes, { value: formatNumber(meal.cookMinutes, locale) }) : dictionary.meal.none
          },
          { label: dictionary.meal.servingsLabel, value: formatNumber(Math.round(meal.servings * 100) / 100, locale) },
          { label: dictionary.meal.difficultyLabel, value: difficultyLabel(meal.difficulty, dictionary) }
        ].map(item => (
          <div className={styles.specItem} key={item.label}>
            <dt className={styles.specLabel}>{item.label}</dt>
            <dd className={styles.specValue}>{item.value}</dd>
          </div>
        ))}
      </dl>

      <MacroSummary carbsG={meal.carbsG} fatG={meal.fatG} kcal={meal.kcal} note={dictionary.macros.note} proteinG={meal.proteinG} />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{dictionary.meal.ingredients}</h2>

        {/* The quantities below are already scaled to this meal's portion, so the
            note explains the number rather than making the reader do the maths. */}
        <div className={styles.servingNote}>
          <Text size="sm">
            {interpolate(dictionary.meal.servingNote, {
              servings: formatNumber(Math.round(meal.servings * 100) / 100, locale),
              unit: meal.servings === 1 ? dictionary.meal.servingUnitOne : dictionary.meal.servingUnitOther
            })}
          </Text>
        </div>

        <ul className={styles.ingredients}>
          {meal.ingredients.map(ingredient => (
            <li className={styles.ingredient} key={ingredient.name}>
              <div className={styles.ingredientLine}>
                <span>{ingredient.name}</span>
                <span className={styles.quantity}>{formatQuantity(ingredient.grams, 'g', locale, dictionary)}</span>
              </div>
              {/* What to buy instead when the shop has none — already filtered for
                  this person's allergens and scaled to this portion, so the line
                  can be followed as written. Staples have none, on purpose. */}
              {ingredient.alternatives.length > 0 ? (
                <Text as="span" className={styles.alternatives} size="sm" tone="secondary">
                  {dictionary.meal.alternatives}:{' '}
                  {ingredient.alternatives.map(alternative => `${alternative.name} (${formatQuantity(alternative.grams, 'g', locale, dictionary)})`).join(' · ')}
                </Text>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {meal.steps.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{dictionary.meal.steps}</h2>
          <ol className={styles.steps}>
            {meal.steps.map(step => (
              <li className={styles.step} key={step.text}>
                {/* The step, then what the cook watches for and how long it takes —
                    the two things a method leaves out when it is written to be
                    short rather than to be followed. */}
                <div className={styles.stepBody}>
                  <Text>{step.text}</Text>
                  {step.cue || step.minutes ? (
                    <Text as="span" className={styles.stepCue} size="sm" tone="secondary">
                      {step.cue ? <span>{step.cue}</span> : null}
                      {step.cue && step.minutes ? <span aria-hidden="true"> · </span> : null}
                      {step.minutes ? <span className={styles.stepTime}>{interpolate(dictionary.meal.minutes, { value: formatNumber(step.minutes, locale) })}</span> : null}
                    </Text>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* The verdict comes last, after the recipe: it is asked of someone who has
          cooked or eaten the dish, and that is where they are when they reach it. */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{dictionary.meal.verdictTitle}</h2>
        {away ? null : <RecipeVerdict recipeId={meal.recipeId} verdict={meal.verdict} />}
      </section>
    </Fragment>
  );
}

