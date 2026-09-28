import { useId } from 'react';

import styles from './LineChart.module.css';

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

export interface LineChartProps extends ChartBaseProps {
  /** Formats a label for the axis, the titles and the table. Defaults to a short date for `YYYY-MM-DD`, the label as it is otherwise. */
  formatLabel?: (label: string) => string;
  /** One per point, oldest first. `YYYY-MM-DD` days are placed at their real distance apart; anything else is spaced evenly. */
  labels: readonly string[];
  /** One line per series. */
  series: readonly ChartSeries[];
}

/** The svg's height and the plot inside it, in px — the same frame as `ColumnChart`. */
const HEIGHT = 224;
const PLOT_TOP = 18;
const PLOT_BOTTOM = 194;
const LABEL_Y = 214;
/** Width of the stretched coordinate space the lines are drawn in; only its ratio to 100 % matters. */
const SPAN = 1000;
/** Up to this many points a dot marks each one; past it the dots would be a second line. */
const DOTS_UP_TO = 31;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function finite(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

/**
 * Where each label sits across the plot, 0–1. Days go at their real distance, so a
 * missing day is a longer step and not a squeezed one; anything else is even.
 */
function positions(labels: readonly string[]): number[] {
  if (labels.length === 1) {
    return [0.5];
  }

  const times = labels.map(label => (ISO_DAY.test(label) ? Date.parse(`${label}T00:00:00Z`) : Number.NaN));
  const first = times[0] ?? Number.NaN;
  const span = (times.at(-1) ?? Number.NaN) - first;

  if (times.every(Number.isFinite) && span > 0) {
    return times.map(time => (time - first) / span);
  }

  return labels.map((_, index) => index / (labels.length - 1));
}

/**
 * One or more series over time, from a zero baseline (`0069`).
 *
 * The lines are drawn in a coordinate space that stretches across the plot, with a
 * stroke that does not stretch with it, so a line is 2px at any width. Each point is
 * a mark with a `<title>` holding its figure; up to a month of points it is also a
 * visible dot, beyond that an invisible target on the line.
 */
export function LineChart({
  className,
  dataLabel,
  emptyLabel,
  formatLabel,
  formatValue,
  labels,
  labelsHeader,
  locale,
  series,
  title
}: LineChartProps) {
  const titleId = useId();
  const format = formatValue ?? ((value: number) => new Intl.NumberFormat(locale).format(value));
  const label = formatLabel ?? ((value: string) => formatDateLabel(value, locale));
  const empty = isChartEmpty(labels, series);
  const count = labels.length;

  const max = Math.max(0, ...series.flatMap(entry => entry.values.map(finite)));
  const integer = series.every(entry => entry.values.every(value => Number.isInteger(value)));
  const ticks = niceTicks(0, max, 4, integer);
  const y = linearScale([0, ticks.at(-1) ?? 1], [PLOT_BOTTOM, PLOT_TOP]);
  const tickFormat = formatValue ?? ((value: number) => formatCompactNumber(value, locale));
  const at = positions(labels);
  const dots = count <= DOTS_UP_TO;

  const axisLabels: ChartAxisLabel[] = axisLabelIndices(count, 7, at).map(({ index, minor }) => {
    const x = (at[index] ?? 0) * 100;
    const anchor = count === 1 ? 'middle' : index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle';

    return { anchor, minor, text: label(labels[index] ?? ''), x };
  });

  return (
    <ChartFrame
      className={className}
      dataLabel={dataLabel}
      empty={empty}
      emptyLabel={emptyLabel}
      legend={series.length > 1 ? series.map(entry => ({ name: entry.name, tone: entry.tone })) : undefined}
      table={{
        columns: series.map(entry => entry.name),
        labelsHeader,
        rows: labels.map((text, index) => ({ cells: series.map(entry => format(entry.values[index] ?? 0)), label: label(text) }))
      }}
      title={title}
      titleId={titleId}
    >
      <svg aria-labelledby={titleId} className={styles.chart} height={HEIGHT} role="img" width="100%">
        <ChartAxes labels={axisLabels} labelY={LABEL_Y} ticks={ticks.map(tick => ({ text: tickFormat(tick), y: y(tick) }))}>
          <svg aria-hidden="true" height={HEIGHT} preserveAspectRatio="none" viewBox={`0 0 ${SPAN} ${HEIGHT}`} width="100%" x="0" y="0">
            {series.map((entry, seriesIndex) => (
              <polyline
                className={`${styles.line} ${styles[chartToneKey(entry.tone, seriesIndex)]}`}
                key={`${entry.name}-${seriesIndex}`}
                points={labels.map((_, index) => `${((at[index] ?? 0) * SPAN).toFixed(2)},${y(finite(entry.values[index])).toFixed(2)}`).join(' ')}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {series.map((entry, seriesIndex) =>
            labels.map((text, index) => {
              const value = finite(entry.values[index]);
              const name = series.length > 1 ? `${label(text)} · ${entry.name}: ${format(value)}` : `${label(text)}: ${format(value)}`;

              return (
                <circle
                  className={dots ? `${styles.dot} ${styles[chartToneKey(entry.tone, seriesIndex)]}` : styles.target}
                  cx={`${(at[index] ?? 0) * 100}%`}
                  cy={y(value)}
                  key={`${seriesIndex}-${index}`}
                  r={dots ? 3.5 : 6}
                >
                  <title>{name}</title>
                </circle>
              );
            })
          )}
        </ChartAxes>
      </svg>
    </ChartFrame>
  );
}
