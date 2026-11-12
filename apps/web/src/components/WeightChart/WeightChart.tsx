'use client';
import styles from './WeightChart.module.css';

import { InView } from 'ui/components/InView';
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
 *
 * It draws itself in (project 024): a veil in the card's own colour slides off the
 * plot from where the line starts, so the line and the ground under it are drawn
 * left to right — by `transform` alone — and if the chart is below the fold, when it
 * is reached (`InView`). At rest, and under reduced motion, it is the finished line.
 *
 * Not a stroke offset (`.motion-draw`): the line is drawn in a box stretched to the
 * plot with a stroke that does not stretch, and Chrome measures a dash on such a
 * line in the wrong space — the line came out broken into dashes.
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

      <InView className={styles.plot}>
        <svg aria-hidden="true" className={styles.chart} preserveAspectRatio="none" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          {/* The ground under the line, to the foot of the plot: a wash of the accent. */}
          <polygon
            className={styles.area}
            points={`${x(first.loggedOn).toFixed(2)},${String(HEIGHT)} ${points.join(' ')} ${x(last.loggedOn).toFixed(2)},${String(HEIGHT)}`}
          />
          {targetKg === null ? null : <line className={styles.target} x1={PAD} x2={WIDTH - PAD} y1={y(targetKg)} y2={y(targetKg)} />}
          <polyline className={styles.line} points={points.join(' ')} />
          {entries.map(entry => (
            <circle className={styles.dot} cx={x(entry.loggedOn)} cy={y(entry.weightKg)} key={entry.loggedOn} r="1.2" />
          ))}
        </svg>
        <span aria-hidden="true" className={styles.veil} />
      </InView>

      <div className={styles.axisX}>
        <span>{formatDate(first.loggedOn, locale, dateOptions)}</span>
        <span>{formatDate(last.loggedOn, locale, dateOptions)}</span>
      </div>

      <figcaption className={styles.caption}>
        {/* The svg is `aria-hidden`, so without this the trend — the only thing
            the chart is for — reaches nobody who cannot see it. Drawn too, as the
            approved sheet has it: the chart in one sentence, under the line. */}
        <Text size="sm" tone="secondary">
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
