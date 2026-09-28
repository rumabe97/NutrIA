import { useId } from 'react';

import styles from './ColumnChart.module.css';

import { axisLabelIndices } from 'ui/utils/axisLabelIndices';
import { ChartAxes, ChartFrame } from 'ui/components/ChartFrame';
import { chartToneKey } from 'ui/utils/chartToneKey';
import { formatCompactNumber } from 'ui/utils/formatCompactNumber';
import { formatDateLabel } from 'ui/utils/formatDateLabel';
import { isChartEmpty } from 'ui/utils/isChartEmpty';
import { linearScale } from 'ui/utils/linearScale';
import { niceTicks } from 'ui/utils/niceTicks';

import type { ChartAxisLabel } from 'ui/components/ChartFrame';
import type { ChartBaseProps, ChartSeries } from 'ui/types/Chart.types';
import type { ReactElement } from 'react';

export interface ColumnChartProps extends ChartBaseProps {
  /** Formats a label for the axis and the table. Defaults to a short date for `YYYY-MM-DD`, the label as it is otherwise. */
  formatLabel?: (label: string) => string;
  /** One per column, left to right — usually `YYYY-MM-DD` days. */
  labels: readonly string[];
  /** One or more series. Two or more draw side by side, or on top of each other with `stacked`. */
  series: readonly ChartSeries[];
  /** Stack the series in each column, first at the bottom. The scale then runs to the tallest total. */
  stacked?: boolean;
  /** With `stacked`, adds a total column with this header to the table. */
  totalLabel?: string;
}

/** The svg's height and the plot inside it, in px: labels above the top gridline, dates under the baseline. */
const HEIGHT = 224;
const PLOT_TOP = 18;
const PLOT_BOTTOM = 194;
const LABEL_Y = 214;
/** The surface-coloured gap between stacked segments. */
const GAP = 2;
/** Share of each column's slot a column fills; the rest is the space between columns. */
const FILL = 0.72;

function positive(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Columns from a zero baseline: one or more series per label, side by side or
 * stacked (`0069`). The scale always starts at zero and ends on a round tick at or
 * above the tallest column — or the tallest stack. Negative values are drawn as zero;
 * the table prints them as they are.
 *
 * Every column carries a `<title>` with its figure; the figure's accessible name is
 * `title`, and "show data" holds every figure as a table.
 */
export function ColumnChart({
  className,
  dataLabel,
  emptyLabel,
  formatLabel,
  formatValue,
  labels,
  labelsHeader,
  locale,
  series,
  stacked = false,
  title,
  totalLabel
}: ColumnChartProps) {
  const titleId = useId();
  const format = formatValue ?? ((value: number) => new Intl.NumberFormat(locale).format(value));
  const label = formatLabel ?? ((value: string) => formatDateLabel(value, locale));
  const empty = isChartEmpty(labels, series);
  const count = labels.length;

  const totals = labels.map((_, index) => series.reduce((sum, entry) => sum + positive(entry.values[index]), 0));
  const max = stacked ? Math.max(0, ...totals) : Math.max(0, ...series.flatMap(entry => entry.values.map(positive)));
  const integer = series.every(entry => entry.values.every(value => Number.isInteger(value)));
  const ticks = niceTicks(0, max, 4, integer);
  const top = ticks.at(-1) ?? 1;
  const y = linearScale([0, top], [PLOT_BOTTOM, PLOT_TOP]);
  const tickFormat = formatValue ?? ((value: number) => formatCompactNumber(value, locale));

  const slot = count > 0 ? 100 / count : 100;
  const width = slot * FILL;
  const inset = (slot - width) / 2;
  const groups = stacked ? 1 : Math.max(1, series.length);
  const markWidth = width / groups;

  const marks: ReactElement[] = [];

  labels.forEach((text, index) => {
    let base = 0;
    let drawn = 0;

    series.forEach((entry, seriesIndex) => {
      const value = positive(entry.values[index]);

      if (value === 0) {
        return;
      }

      const from = stacked ? base : 0;
      const to = from + value;
      const gap = stacked && drawn > 0 ? GAP : 0;
      const bottom = y(from) - gap;
      const x = index * slot + inset + (stacked ? 0 : seriesIndex * markWidth);
      const name = series.length > 1 ? `${label(text)} · ${entry.name}: ${format(value)}` : `${label(text)}: ${format(value)}`;

      marks.push(
        <rect
          className={`${styles.mark} ${styles[chartToneKey(entry.tone, seriesIndex)]}`}
          height={Math.max(1, bottom - y(to))}
          key={`${index}-${seriesIndex}`}
          width={`${markWidth}%`}
          x={`${x}%`}
          y={Math.min(y(to), bottom - 1)}
        >
          <title>{name}</title>
        </rect>
      );

      base = to;
      drawn += 1;
    });
  });

  const axisLabels: ChartAxisLabel[] = axisLabelIndices(count).map(({ index, minor }) => {
    const text = label(labels[index] ?? '');

    if (count === 1) {
      return { anchor: 'middle', minor, text, x: 50 };
    }

    if (index === 0) {
      return { anchor: 'start', minor, text, x: inset };
    }

    if (index === count - 1) {
      return { anchor: 'end', minor, text, x: 100 - inset };
    }

    return { anchor: 'middle', minor, text, x: (index + 0.5) * slot };
  });

  const withTotal = stacked && totalLabel !== undefined && series.length > 1;

  return (
    <ChartFrame
      className={className}
      dataLabel={dataLabel}
      empty={empty}
      emptyLabel={emptyLabel}
      legend={series.length > 1 ? series.map(entry => ({ name: entry.name, tone: entry.tone })) : undefined}
      table={{
        columns: [...series.map(entry => entry.name), ...(withTotal ? [totalLabel] : [])],
        labelsHeader,
        rows: labels.map((text, index) => ({
          cells: [...series.map(entry => format(entry.values[index] ?? 0)), ...(withTotal ? [format(totals[index] ?? 0)] : [])],
          label: label(text)
        }))
      }}
      title={title}
      titleId={titleId}
    >
      <svg aria-labelledby={titleId} className={styles.chart} height={HEIGHT} role="img" width="100%">
        <ChartAxes labels={axisLabels} labelY={LABEL_Y} ticks={ticks.map(tick => ({ text: tickFormat(tick), y: y(tick) }))}>
          {marks}
        </ChartAxes>
      </svg>
    </ChartFrame>
  );
}
