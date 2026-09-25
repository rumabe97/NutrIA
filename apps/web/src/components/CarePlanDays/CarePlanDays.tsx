import styles from './CarePlanDays.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { MealSwap } from 'components/MealSwap';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { slotLabel } from 'lib/generation';

import type { PlanView } from 'core/controllers/Plan';

interface CarePlanDaysProps {
  linkId: string;
  plan: PlanView;
}

/**
 * The plan under review, day by day, as the professional reads it before
 * publishing (`0060`): each meal with its figures and a swap along the same
 * axes the client has, through the link. One day open at a time is a fortnight
 * that fits a phone; the first is open because that is where review starts.
 *
 * No link to a meal page: those are the client's routes, and nothing here may
 * call one with anything of the client's.
 */
export async function CarePlanDays({ linkId, plan }: CarePlanDaysProps) {
  const [dictionary, locale] = await Promise.all([getDictionary(), activeLocale()]);
  const t = dictionary.practice;
  const number = (value: number) => formatNumber(Math.round(value), locale);

  return (
    <ol className={styles.days}>
      {plan.days.map((day, index) => (
        <li key={day.dayIndex}>
          <details className={styles.day} open={index === 0}>
            <summary className={styles.summary}>
              <span className={styles.dayTitle}>
                {interpolate(t.dayTitle, {
                  date: formatDate(day.date, locale, { day: 'numeric', month: 'short', weekday: 'short' }),
                  index: day.dayIndex
                })}
              </span>
              <span className={styles.totals}>
                {interpolate(t.dayTotals, { kcal: number(day.totals.kcal), protein: number(day.totals.proteinG) })}
              </span>
            </summary>

            <ul className={styles.meals}>
              {day.meals.map(meal => (
                <li className={styles.meal} key={meal.id}>
                  <span className={styles.what}>
                    <Text as="span" size="xs" tone="tertiary">
                      {slotLabel(meal.slot, dictionary)}
                    </Text>
                    <Text as="span" weight="medium">
                      {meal.name}
                    </Text>
                    <Text as="span" className={styles.figures} size="xs" tone="secondary">
                      {number(meal.kcal)} {dictionary.units.kcal} · {number(meal.proteinG)} {dictionary.units.proteinShort}
                    </Text>
                  </span>
                  <MealSwap
                    mealId={meal.id}
                    notes={{ idle: t.swapHint, spent: t.swapSpent }}
                    path={`/care/clients/${encodeURIComponent(linkId)}/plan/meals/${encodeURIComponent(meal.id)}/swap`}
                    totalMinutes={meal.prepMinutes + meal.cookMinutes}
                  />
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ol>
  );
}
