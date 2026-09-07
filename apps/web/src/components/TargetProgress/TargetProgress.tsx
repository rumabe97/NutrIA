'use client';
import styles from './TargetProgress.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatNumber, interpolate } from 'lib/format';

import type { NutritionTargets } from 'core/entities/Nutrition';

const FULL = 100;

interface TargetProgressProps {
  targets: NutritionTargets;
  totals: { carbsG: number; fatG: number; kcal: number; proteinG: number };
}

/**
 * Today's plan against today's targets.
 *
 * Both numbers were already on this screen — the day's totals in one block, the
 * targets in another — and comparing them was left to the reader. Two figures
 * that only mean something next to each other should be next to each other.
 *
 * This reports what the *plan* provides, not what was eaten: meal completion
 * arrives with a later project, and a bar that looked like intake would be a
 * claim the product cannot support.
 */
export function TargetProgress({ targets, totals }: TargetProgressProps) {
  const dictionary = useDictionary();
  const locale = useLocale();

  const rows = [
    { label: dictionary.macros.kcal, target: targets.kcal, unit: dictionary.units.kcal, value: totals.kcal },
    { label: dictionary.macros.protein, target: targets.proteinG, unit: dictionary.units.gram, value: totals.proteinG },
    { label: dictionary.macros.carbs, target: targets.carbsG, unit: dictionary.units.gram, value: totals.carbsG },
    { label: dictionary.macros.fat, target: targets.fatG, unit: dictionary.units.gram, value: totals.fatG }
  ];

  return (
    <section className={styles.panel}>
      <Text size="sm" tone="tertiary">
        {dictionary.dashboard.todayVsTarget}
      </Text>

      <dl className={styles.rows}>
        {rows.map(row => (
          <div className={styles.row} key={row.label}>
            <dt className={styles.label}>{row.label}</dt>
            <dd className={styles.value}>
              {interpolate(dictionary.dashboard.ofTarget, {
                target: formatNumber(Math.round(row.target), locale),
                unit: row.unit,
                value: formatNumber(Math.round(row.value), locale)
              })}
            </dd>
            {/* Capped at 100% so an overshoot fills the bar rather than escaping
                it; the numbers above say by how much. */}
            <div className={styles.track}>
              <div className={styles.bar} style={{ inlineSize: `${Math.min((row.value / (row.target || 1)) * FULL, FULL)}%` }} />
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
