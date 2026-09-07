'use client';
import Link from 'next/link';

import styles from './NextMeal.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatNumber } from 'lib/format';
import { slotLabel } from 'lib/generation';

/**
 * The hour each slot is typically eaten at.
 *
 * Not a user preference and not stored: it is only used to pick which of today's
 * meals to put first, and being an hour out changes nothing that matters. A
 * schedule the user could set would be a promise to honour it everywhere else.
 */
const SLOT_HOUR: Record<string, number> = {
  afternoon_snack: 17,
  breakfast: 9,
  dinner: 21,
  lunch: 14,
  morning_snack: 11,
  supper: 23
};

interface NextMealProps {
  hour: number;
  meals: readonly { id: string; kcal: number; name: string; proteinG: number; slot: string }[];
}

/**
 * Which meal is next, given the time of day.
 *
 * The dashboard listed today's four meals with equal weight, so the one question
 * someone opens it to answer — *what am I eating now* — was one they had to
 * answer themselves. This is that answer, and nothing else.
 */
export function NextMeal({ hour, meals }: NextMealProps) {
  const dictionary = useDictionary();
  const locale = useLocale();

  const upcoming = [...meals].sort((a, b) => (SLOT_HOUR[a.slot] ?? 12) - (SLOT_HOUR[b.slot] ?? 12)).find(meal => (SLOT_HOUR[meal.slot] ?? 12) >= hour);

  if (!upcoming) {
    return (
      <p className={styles.done}>
        <Text size="sm" tone="tertiary">
          {dictionary.dashboard.nextMealNone}
        </Text>
      </p>
    );
  }

  return (
    <Link className={styles.card} href={`/plan/comida/${upcoming.id}`}>
      <span className={styles.eyebrow}>
        {dictionary.dashboard.nextMeal} · {slotLabel(upcoming.slot, dictionary)}
      </span>
      <span className={styles.name}>{upcoming.name}</span>
      <span className={styles.meta}>
        {formatNumber(Math.round(upcoming.kcal), locale)} {dictionary.units.kcal} · {formatNumber(Math.round(upcoming.proteinG), locale)}{' '}
        {dictionary.units.proteinShort}
      </span>
    </Link>
  );
}
