import { Fragment } from 'react';

import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { Text } from 'ui/components/Text';

import { MacroSummary } from 'components/MacroSummary';

import { formatQuantity, SLOT_LABELS } from 'lib/generation';
import { serverApi } from 'lib/server-api';

import type { MealDetailView } from 'core/controllers/Plan';

export const dynamic = 'force-dynamic';

const DIFFICULTY: Record<string, string> = { easy: 'Fácil', hard: 'Difícil', medium: 'Media' };

export default async function MealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meal = await serverApi<MealDetailView>(`/meal-plans/meals/${id}`);

  if (!meal) {notFound();}

  const totalMinutes = meal.prepMinutes + meal.cookMinutes;

  return (
    <Fragment>
      <Link className={styles.back} href="/plan">
        ← Volver al plan
      </Link>

      <span className={styles.slot}>
        {SLOT_LABELS[meal.slot] ?? meal.slot} · Día {meal.dayIndex}
      </span>
      <h1 className={styles.title}>{meal.name}</h1>

      <div className={styles.facts}>
        {totalMinutes > 0 ? <span>{totalMinutes} min en total</span> : <span>Sin cocinar</span>}
        <span>{DIFFICULTY[meal.difficulty] ?? meal.difficulty}</span>
        {meal.cuisine ? <span>{meal.cuisine}</span> : null}
      </div>

      <div aria-hidden="true" className={styles.visual}>
        {meal.name}
      </div>

      <MacroSummary carbsG={meal.carbsG} fatG={meal.fatG} kcal={meal.kcal} proteinG={meal.proteinG} />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Ingredientes</h2>

        {/* The quantities below are already scaled to this meal's portion, so the
            note explains the number rather than making the reader do the maths. */}
        <div className={styles.servingNote}>
          <Text size="sm">
            Cantidades para {formatServings(meal.servings)} {meal.servings === 1 ? 'ración' : 'raciones'}.
          </Text>
        </div>

        <ul className={styles.ingredients}>
          {meal.ingredients.map(ingredient => (
            <li className={styles.ingredient} key={ingredient.name}>
              <span>{ingredient.name}</span>
              <span className={styles.quantity}>{formatQuantity(ingredient.grams, 'g')}</span>
            </li>
          ))}
        </ul>
      </section>

      {meal.steps.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Preparación</h2>
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

function formatServings(servings: number): string {
  return String(Math.round(servings * 100) / 100).replace('.', ',');
}
