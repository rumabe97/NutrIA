import { useId } from 'react';

import styles from './BarChart.module.css';

import { ChartFrame } from 'ui/components/ChartFrame';
import { chartToneKey } from 'ui/utils/chartToneKey';
import { isChartEmpty } from 'ui/utils/isChartEmpty';

import type { ChartBaseProps, ChartSeries } from 'ui/types/Chart.types';

export interface BarChartShares {
  /** Header of the share column in the table ("Del paso anterior"). */
  readonly header: string;
  /** One already formatted share per label ("64 %"), printed after the bar's figure; `undefined` prints none. */
  readonly values: readonly (string | undefined)[];
}

export interface BarChartProps extends ChartBaseProps {
  /** One per bar, top to bottom — the funnel's steps, a top-N's names. Printed as they are. */
  labels: readonly string[];
  /** Usually one. More than one draws a thinner bar per series in each row, with a legend. */
  series: readonly ChartSeries[];
  /** A share to print beside each figure — the funnel's "of the step before". One series only. */
  shares?: BarChartShares;
}

/** Height of one bar, and the gap between two bars of one row, in px. */
const BAR = 12;
const BAR_GAP = 4;

function positive(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Horizontal bars from a zero baseline (`0069`): the funnel, and any top-N list.
 *
 * Each row prints its name and its figure — and a share when one is given — as HTML
 * text above a bar whose length is the figure against the longest one. HTML, not SVG
 * text, because SVG text cannot wrap: a long dish or step name on a phone would run into
 * its figure. That text is read as it is, not wrapped in a `role="img"` (whose children a
 * screen reader skips): the names and figures are the chart. The bars are `aria-hidden`.
 * One series wears one colour: a bar's length already says how much.
 */
export function BarChart({ className, dataLabel, emptyLabel, formatValue, labels, labelsHeader, locale, series, shares, title }: BarChartProps) {
  const titleId = useId();
  const format = formatValue ?? ((value: number) => new Intl.NumberFormat(locale).format(value));
  const empty = isChartEmpty(labels, series);
  const max = Math.max(0, ...series.flatMap(entry => entry.values.map(positive)));
  const single = series.length === 1;
  const withShares = single && shares !== undefined;
  const height = series.length * BAR + (series.length - 1) * BAR_GAP;

  return (
    <ChartFrame
      className={className}
      dataLabel={dataLabel}
      empty={empty}
      emptyLabel={emptyLabel}
      legend={single ? undefined : series.map(entry => ({ name: entry.name, tone: entry.tone }))}
      table={{
        columns: [...series.map(entry => entry.name), ...(withShares ? [shares.header] : [])],
        labelsHeader,
        rows: labels.map((text, index) => ({
          cells: [...series.map(entry => format(entry.values[index] ?? 0)), ...(withShares ? [shares.values[index] ?? ''] : [])],
          label: text
        }))
      }}
      title={title}
      titleId={titleId}
    >
      <div className={styles.chart}>
        {labels.map((text, index) => {
          const share = withShares ? shares.values[index] : undefined;
          const figure = single ? format(series[0]?.values[index] ?? 0) : undefined;

          return (
            <div className={styles.row} key={`${text}-${index}`}>
              <p className={styles.head}>
                <span className={styles.name}>{text}</span>
                {figure === undefined ? null : (
                  <span className={styles.figure}>
                    {figure}
                    {share === undefined ? null : <span className={styles.share}>{` · ${share}`}</span>}
                  </span>
                )}
              </p>
              <svg aria-hidden="true" className={styles.bars} focusable="false" height={height} width="100%">
                {series.map((entry, seriesIndex) => {
                  const value = positive(entry.values[index]);
                  const name =
                    [single ? text : `${text} · ${entry.name}`, format(entry.values[index] ?? 0)].join(': ') + (share ? ` (${share})` : '');
                  const y = seriesIndex * (BAR + BAR_GAP);

                  return (
                    <g key={`${entry.name}-${seriesIndex}`}>
                      <rect className={styles.track} height={BAR} rx="2" width="100%" x="0" y={y} />
                      {value === 0 ? null : (
                        <rect
                          className={`${styles.bar} ${styles[chartToneKey(entry.tone, seriesIndex)]}`}
                          height={BAR}
                          rx="2"
                          width={`${(value / (max || 1)) * 100}%`}
                          x="0"
                          y={y}
                        >
                          <title>{name}</title>
                        </rect>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })}
      </div>
    </ChartFrame>
  );
}
