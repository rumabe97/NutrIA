'use client';
import styles from './WeightChart.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatDate, formatNumber, interpolate } from 'lib/format';

const WIDTH = 100;
const HEIGHT = 40;
const PAD = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

interface WeightChartProps {
  /** Oldest to newest. */
  entries: readonly { loggedOn: string; weightKg: number }[];
  targetKg: number | null;
}

/**
 * Every weight ever logged, on a real time axis.
 *
 * The dashboard's sparkline spaces readings evenly because it only means to show
 * a direction. Here the x axis is time: a month without a reading is a gap, not
 * a step, and a person who weighs in daily for a week and then weekly should see
 * that. The target, when there is one, is a dashed line the reading is heading
 * for — or has crossed.
 */
export function WeightChart({ entries, targetKg }: WeightChartProps) {
  const dictionary = useDictionary();
  const locale = useLocale();

  if (entries.length < 2) {
    return (
      <div className={styles.empty}>
        <Text size="sm" tone="tertiary">
          {dictionary.progress.chartEmpty}
        </Text>
      </div>
    );
  }

  const first = entries[0];
  const last = entries[entries.length - 1];

  if (!first || !last) {
    return null;
  }

  const start = Date.parse(`${first.loggedOn}T00:00:00Z`);
  const span = Math.max(Date.parse(`${last.loggedOn}T00:00:00Z`) - start, DAY_MS);
  const values = entries.map(entry => entry.weightKg);
  const low = Math.min(...values, targetKg ?? Infinity);
  const high = Math.max(...values, targetKg ?? -Infinity);
  const range = high - low || 1;
  const x = (isoDate: string) => PAD + ((Date.parse(`${isoDate}T00:00:00Z`) - start) / span) * (WIDTH - PAD * 2);
  const y = (kg: number) => HEIGHT - PAD - ((kg - low) / range) * (HEIGHT - PAD * 2);
  const points = entries.map(entry => `${x(entry.loggedOn).toFixed(2)},${y(entry.weightKg).toFixed(2)}`);
  const dateOptions = { day: 'numeric', month: 'short' } as const;

  return (
    <figure className={styles.figure}>
      <div className={styles.axisY}>
        <span>{formatNumber(high, locale, { maximumFractionDigits: 1 })}</span>
        <span>{formatNumber(low, locale, { maximumFractionDigits: 1 })}</span>
      </div>

      <svg aria-hidden="true" className={styles.chart} preserveAspectRatio="none" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {targetKg === null ? null : <line className={styles.target} x1={PAD} x2={WIDTH - PAD} y1={y(targetKg)} y2={y(targetKg)} />}
        <polyline className={styles.line} points={points.join(' ')} />
        {entries.map(entry => (
          <circle className={styles.dot} cx={x(entry.loggedOn)} cy={y(entry.weightKg)} key={entry.loggedOn} r="1.2" />
        ))}
      </svg>

      <div className={styles.axisX}>
        <span>{formatDate(first.loggedOn, locale, dateOptions)}</span>
        <span>{formatDate(last.loggedOn, locale, dateOptions)}</span>
      </div>

      <figcaption className={styles.caption}>
        {/* The svg is `aria-hidden`, so without this the trend — the only thing
            the chart is for — reaches nobody who cannot see it. Not drawn: the
            two axes already say the same numbers to anyone who can. */}
        <Text className="visually-hidden">
          {interpolate(dictionary.progress.chartSummary, {
            from: formatNumber(first.weightKg, locale, { maximumFractionDigits: 1 }),
            fromDate: formatDate(first.loggedOn, locale, dateOptions),
            to: formatNumber(last.weightKg, locale, { maximumFractionDigits: 1 }),
            toDate: formatDate(last.loggedOn, locale, dateOptions)
          })}
        </Text>

        {targetKg === null ? null : (
          <Text size="xs" tone="tertiary">
            {dictionary.progress.weightTarget.replace('{value}', formatNumber(targetKg, locale, { maximumFractionDigits: 1 }))}
          </Text>
        )}
      </figcaption>
    </figure>
  );
}
