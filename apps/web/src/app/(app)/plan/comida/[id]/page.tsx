import { Fragment } from 'react';

import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { MacroSummary } from 'components/MacroSummary';

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

      <div aria-hidden="true" className={styles.visual}>
        {meal.name}
      </div>

      <MacroSummary carbsG={meal.carbsG} fatG={meal.fatG} kcal={meal.kcal} proteinG={meal.proteinG} />

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
              <span>{ingredient.name}</span>
              <span className={styles.quantity}>{formatQuantity(ingredient.grams, 'g', locale, dictionary)}</span>
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
                <Text>{step.text}</Text>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </Fragment>
  );
}

