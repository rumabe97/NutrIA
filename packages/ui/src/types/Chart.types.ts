/**
 * Shared shapes for the chart set (`0069`): `LineChart`, `ColumnChart`, `BarChart`,
 * `DonutChart`, `Gauge`, `Sparkline` and `ChartFrame`.
 */

/**
 * The colour a series wears.
 *
 * - `1`–`6` are the categorical slots (`--color-chart-1` … `-6`), for identity:
 *   which series. Left out, a series takes the slot of its position, so pin it when a
 *   filter can remove a series before it — colour follows the entity, not its rank.
 * - `success`, `failure`, `neutral` are for a series that *means* an outcome. Put them
 *   in that order when they touch (stacked columns): see `colors.css`.
 */
export type ChartTone = 'failure' | 'neutral' | 'success' | 1 | 2 | 3 | 4 | 5 | 6;

/** One series: a name for the legend and the table, and one value per label. */
export interface ChartSeries {
  /** Shown in the legend and as the table's column header. */
  readonly name: string;
  /** Pins the colour. Defaults to the categorical slot of the series' position. */
  readonly tone?: ChartTone;
  /** One number per entry of the chart's `labels`, in the same order. */
  readonly values: readonly number[];
}

/** The props every chart with a "show data" table shares. */
export interface ChartBaseProps {
  /** Extra class on the `<figure>`. Set `--chart-surface` here when the chart sits on a card. */
  className?: string;
  /** **Required.** Text of the disclosure that holds the figures as a table ("Ver datos"). */
  dataLabel: string;
  /** **Required.** What the chart says when there is nothing to draw. */
  emptyLabel: string;
  /** Formats a figure for the marks' titles and the table. Defaults to the locale's number format. */
  formatValue?: (value: number) => string;
  /** **Required.** Header of the table's first column — what the labels are ("Día", "Paso"). */
  labelsHeader: string;
  /** **Required.** BCP 47 locale for the default number and date formats. */
  locale: string;
  /** **Required.** Visible caption and the chart's accessible name. */
  title: string;
}
