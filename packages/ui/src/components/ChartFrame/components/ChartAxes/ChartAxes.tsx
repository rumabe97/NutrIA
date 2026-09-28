import styles from './ChartAxes.module.css';

import type { ReactNode } from 'react';

export interface ChartAxisLabel {
  /** Which end of the text sits on `x`: the first label starts there, the last ends there. */
  readonly anchor: 'end' | 'middle' | 'start';
  /** Dropped when the chart is narrow (see `axisLabelIndices`). */
  readonly minor: boolean;
  readonly text: string;
  /** Position across the plot, 0–100 (per cent of its width). */
  readonly x: number;
}

export interface ChartAxisTick {
  readonly text: string;
  /** Position down the plot, in px from its top. */
  readonly y: number;
}

export interface ChartAxesProps {
  /** The marks. Drawn over the gridlines and under the labels, so a label stays readable over a column. */
  children?: ReactNode;
  /** The x axis' labels. */
  labels: readonly ChartAxisLabel[];
  /** Baseline of the x labels, in px. */
  labelY: number;
  /** The y axis' ticks, zero included; zero draws the baseline, the rest hairlines. */
  ticks: readonly ChartAxisTick[];
}

/**
 * The gridlines and axis labels of a chart with a y scale, drawn inside its `<svg>`.
 *
 * Across the plot everything is in per cent, so the chart fills whatever width it is
 * given with nothing measured; down it, everything is in px, so text is always the
 * size of text. Tick labels sit on their gridline at the left edge with a halo in the
 * chart's surface colour, rather than in a margin — there is no way to reserve one
 * without knowing the width. The marks go in as children, between the gridlines and
 * the labels. The axes are `aria-hidden`: the chart's name and its table say what
 * they say.
 */
export function ChartAxes({ children, labels, labelY, ticks }: ChartAxesProps) {
  return (
    <g>
      <g aria-hidden="true">
        {ticks.map((tick, index) => (
          <line className={index === 0 ? styles.baseline : styles.grid} key={`${tick.text}-${index}`} x1="0" x2="100%" y1={tick.y} y2={tick.y} />
        ))}
      </g>
      {children}
      <g aria-hidden="true">
        {ticks.slice(1).map((tick, index) => (
          <text className={styles.tick} key={`${tick.text}-${index}`} x="0" y={tick.y - 4}>
            {tick.text}
          </text>
        ))}
        {labels.map((label, index) => (
          <text
            className={label.minor ? `${styles.label} ${styles.minor}` : styles.label}
            key={`${label.text}-${index}`}
            textAnchor={label.anchor}
            x={`${label.x}%`}
            y={labelY}
          >
            {label.text}
          </text>
        ))}
      </g>
    </g>
  );
}
