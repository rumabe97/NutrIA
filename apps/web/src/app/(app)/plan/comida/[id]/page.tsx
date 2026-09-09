import { Fragment } from 'react';

import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { MacroSummary } from 'components/MacroSummary';

import { API_URL } from 'lib/env';
import { difficultyLabel, slotLabel } from 'lib/generation';
import { formatNumber, formatQuantity, interpolate } from 'lib/format';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import type { MealDetailView } from 'core/controllers/Plan';

export const dynamic = 'force-dynamic';

export default async function MealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await redirectIfOnboardingIncomplete();

  const { id } = await params;
  const [dictionary, locale, meal] = await Promise.all([getDictionary(), activeLocale(), serverApi<MealDetailView>(`/meal-plans/meals/${id}`)]);

  if (!meal) {notFound();}

  const totalMinutes = meal.prepMinutes + meal.cookMinutes;

  return (
    <Fragment>
      <Link className={styles.back} href="/plan">
        {dictionary.meal.back}
      </Link>

      <span className={styles.slot}>{interpolate(dictionary.meal.dayOf, { day: meal.dayIndex, slot: slotLabel(meal.slot, dictionary) })}</span>
      <h1 className={styles.title}>{meal.name}</h1>

      <div className={styles.facts}>
        {totalMinutes > 0 ? <span>{interpolate(dictionary.meal.totalMinutes, { minutes: totalMinutes })}</span> : <span>{dictionary.meal.noCooking}</span>}
        <span>{difficultyLabel(meal.difficulty, dictionary)}</span>
        {meal.cuisine ? <span>{meal.cuisine}</span> : null}
      </div>

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
    </Fragment>
  );
}

