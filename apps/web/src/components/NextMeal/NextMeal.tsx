'use client';
import styles from './NextMeal.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { DishLink } from 'components/DishLink';
import { DishPicture } from 'components/DishPicture';

import { formatNumber, interpolate } from 'lib/format';
import { slotLabel } from 'lib/generation';

/**
 * The hour each slot is typically eaten at.
 *
 * Not a user preference and not stored: it is only used to pick which of today's
 * meals to put first, and being an hour out changes nothing that matters. A
 * schedule the user could set would be a promise to honour it everywhere else —
 * which is why the card never prints it.
 */
const SLOT_HOUR: Record<string, number> = { afternoon_snack: 17, breakfast: 9, dinner: 21, lunch: 14, morning_snack: 11, supper: 23 };

interface NextMealProps {
  hour: number;
  meals: readonly {
    id: string;
    cookMinutes: number;
    illustrationPath?: string | null;
    kcal: number;
    name: string;
    prepMinutes: number;
    proteinG: number;
    slot: string;
  }[];
}

/**
 * Which meal is next, given the time of day — as the dish itself: its picture large, or
 * its designed state when it has none, with a strip over the picture's foot carrying its
 * slot, its name and its figures (project 024: food first).
 *
 * The dashboard listed today's four meals with equal weight, so the one question
 * someone opens it to answer — *what am I eating now* — was one they had to
 * answer themselves. This is that answer, and nothing else.
 *
 * The strip is a near-opaque card, not glass: a material belongs to navigation, not to
 * content (PRD 024 § "What changes from the sheets", 6). It overlaps only the picture's
 * foot, and never its top-right corner, where the «IA» mark is.
 */
export function NextMeal({ hour, meals }: NextMealProps) {
  const dictionary = useDictionary();
  const locale = useLocale();

  const upcoming = [...meals]
    .sort((a, b) => (SLOT_HOUR[a.slot] ?? 12) - (SLOT_HOUR[b.slot] ?? 12))
    .find(meal => (SLOT_HOUR[meal.slot] ?? 12) >= hour);

  if (!upcoming) {
    // One element, not a `<Text>` inside a `<p>`: `Text` renders a `<p>` itself, and
    // a nested paragraph is invalid HTML the browser restructures — which made the
    // server and client trees differ and the whole dashboard re-render on the client.
    return (
      <Text className={styles.done} size="sm" tone="tertiary">
        {dictionary.dashboard.nextMealNone}
      </Text>
    );
  }

  const minutes = upcoming.prepMinutes + upcoming.cookMinutes;

  return (
    <DishLink className={styles.card} mealId={upcoming.id}>
      {/* The first thing on the dashboard, so requested at once rather than lazily. It
          fades up over its placeholder (`.motion-fade`). */}
      <span className={`${styles.picture} motion-fade`}>
        <DishPicture path={upcoming.illustrationPath} priority={true} slot={upcoming.slot} variant="card" />
      </span>
      <span className={styles.strip}>
        <span className={styles.words}>
          <span className={styles.eyebrow}>
            {dictionary.dashboard.nextMeal} · {slotLabel(upcoming.slot, dictionary)}
          </span>
          <span className={styles.name} data-dish-title="">
            {upcoming.name}
          </span>
          <span className={styles.meta}>
            {formatNumber(Math.round(upcoming.kcal), locale)} {dictionary.units.kcal} · {formatNumber(Math.round(upcoming.proteinG), locale)}{' '}
            {dictionary.units.proteinShort}
            {minutes > 0 ? ` · ${interpolate(dictionary.meal.minutes, { value: formatNumber(minutes, locale) })}` : null}
          </span>
        </span>
        <span aria-hidden="true" className={styles.go}>
          <svg
            fill="none"
            height="18"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </span>
    </DishLink>
  );
}
