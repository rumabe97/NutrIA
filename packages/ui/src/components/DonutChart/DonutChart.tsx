import { useId } from 'react';

import styles from './DonutChart.module.css';

import { ChartFrame } from 'ui/components/ChartFrame';
import { chartToneKey } from 'ui/utils/chartToneKey';
import { isChartEmpty } from 'ui/utils/isChartEmpty';

import type { ChartBaseProps, ChartSeries, ChartTone } from 'ui/types/Chart.types';

export interface DonutChartProps extends ChartBaseProps {
  /** One per slice — the parts of the whole. Printed as they are. */
  labels: readonly string[];
  /** One series: its values are the slices, its name heads the table's figures. A second series is ignored. */
  series: readonly ChartSeries[];
  /** Header of a share column in the table ("Del total"). Given, the table carries each slice's share as the legend does. */
  shareHeader?: string;
  /** A colour per slice, in label order. Left out, slices take the categorical slots in order. */
  tones?: readonly (ChartTone | undefined)[];
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The surface-coloured gap between slices, in the 100-unit viewBox (about 2px at the drawn size). */
const GAP = 1.2;

function positive(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Parts of a whole (`0069`). The legend is always there and always carries each
 * slice's count and share, because an angle is the hardest thing on a chart to read:
 * the ring shows proportion at a glance, the legend says how many.
 */
export function DonutChart({
  className,
  dataLabel,
  emptyLabel,
  formatValue,
  labels,
  labelsHeader,
  locale,
  series,
  shareHeader,
  title,
  tones
}: DonutChartProps) {
  const titleId = useId();
  const format = formatValue ?? ((value: number) => new Intl.NumberFormat(locale).format(value));
  const percent = new Intl.NumberFormat(locale, { maximumFractionDigits: 0, style: 'percent' });
  const entry = series[0];
  const values = labels.map((_, index) => positive(entry?.values[index]));
  const total = values.reduce((sum, value) => sum + value, 0);
  const empty = entry === undefined || isChartEmpty(labels, [entry]);
  const share = (value: number) => (total > 0 ? percent.format(value / total) : percent.format(0));
  const drawn = values.filter(value => value > 0).length;
  const lengths = values.map(value => (total > 0 ? (value / total) * CIRCUMFERENCE : 0));
  // Where each slice starts along the ring: the sum of the slices before it.
  const starts = lengths.map((_, index) => lengths.slice(0, index).reduce((sum, length) => sum + length, 0));

  return (
    <ChartFrame
      className={className}
      dataLabel={dataLabel}
      empty={empty}
      emptyLabel={emptyLabel}
      layout="beside"
      legend={labels.map((text, index) => ({
        detail: `${format(entry?.values[index] ?? 0)} · ${share(values[index] ?? 0)}`,
        name: text,
        tone: tones?.[index]
      }))}
      table={{
        columns: [entry?.name ?? title, ...(shareHeader ? [shareHeader] : [])],
        labelsHeader,
        rows: labels.map((text, index) => ({
          cells: [format(entry?.values[index] ?? 0), ...(shareHeader ? [share(values[index] ?? 0)] : [])],
          label: text
        }))
      }}
      title={title}
      titleId={titleId}
    >
      <svg aria-labelledby={titleId} className={styles.chart} role="img" viewBox="0 0 100 100">
        {labels.map((text, index) => {
          const value = values[index] ?? 0;

          if (value === 0) {
            return null;
          }

          const length = lengths[index] ?? 0;
          const visible = drawn > 1 ? Math.max(length - GAP, 0.5) : length;

          return (
            <circle
              className={`${styles.slice} ${styles[chartToneKey(tones?.[index], index)]}`}
              cx="50"
              cy="50"
              key={`${text}-${index}`}
              r={RADIUS}
              strokeDasharray={`${visible} ${CIRCUMFERENCE - visible}`}
              strokeDashoffset={-(starts[index] ?? 0)}
              transform="rotate(-90 50 50)"
            >
              <title>{`${text}: ${format(entry?.values[index] ?? 0)} (${share(value)})`}</title>
            </circle>
          );
        })}
      </svg>
    </ChartFrame>
  );
}
