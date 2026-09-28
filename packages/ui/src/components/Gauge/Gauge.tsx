import { useId } from 'react';

import styles from './Gauge.module.css';

import { ChartFrame } from 'ui/components/ChartFrame';

import type { ChartBaseProps } from 'ui/types/Chart.types';

export interface GaugeProps extends ChartBaseProps {
  /** **Required.** The limit the value is measured against. Zero or less draws the empty state. */
  cap: number;
  /** **Required.** Names the cap beside its figure and in the table ("Límite"). */
  capLabel: string;
  /** **Required.** What is said, in words, once the value passes the cap ("Por encima del límite"). */
  overLabel: string;
  /** **Required.** The figure measured. */
  value: number;
  /** **Required.** Names the value beside its figure and in the table ("Gastado"). */
  valueLabel: string;
}

/** Height of the bar, in px. */
const BAR = 12;

/**
 * One figure against its cap (`0069`): the month's picture spend against the budget.
 *
 * A bar, not an arc: a length is read faster and more exactly than an angle, and it
 * fits a phone. Both figures are printed above it. Past the cap the bar is full, in
 * the failure colour, and the over-cap state is said in words, since a colour alone
 * says nothing to somebody who cannot tell it apart.
 */
export function Gauge({
  cap,
  capLabel,
  className,
  dataLabel,
  emptyLabel,
  formatValue,
  labelsHeader,
  locale,
  overLabel,
  title,
  value,
  valueLabel
}: GaugeProps) {
  const titleId = useId();
  const format = formatValue ?? ((figure: number) => new Intl.NumberFormat(locale).format(figure));
  const empty = !Number.isFinite(cap) || cap <= 0 || !Number.isFinite(value);
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const over = !empty && safe > cap;
  const fill = empty ? 0 : Math.min(safe / cap, 1) * 100;

  return (
    <ChartFrame
      className={className}
      dataLabel={dataLabel}
      empty={empty}
      emptyLabel={emptyLabel}
      table={{ columns: [valueLabel, capLabel], labelsHeader, rows: [{ cells: [format(value), format(cap)], label: title }] }}
      title={title}
      titleId={titleId}
    >
      <div className={styles.gauge}>
        <p className={styles.figures}>
          <span className={styles.figure}>
            <span className={styles.label}>{valueLabel}</span>
            <span className={styles.value}>{format(value)}</span>
          </span>
          <span className={`${styles.figure} ${styles.cap}`}>
            <span className={styles.label}>{capLabel}</span>
            <span className={styles.value}>{format(cap)}</span>
          </span>
        </p>
        <svg aria-labelledby={titleId} className={styles.chart} height={BAR} role="img" width="100%">
          <rect className={styles.track} height={BAR} rx={BAR / 2} width="100%" x="0" y="0">
            <title>{`${capLabel}: ${format(cap)}`}</title>
          </rect>
          {fill > 0 ? (
            <rect className={over ? `${styles.fill} ${styles.over}` : styles.fill} height={BAR} rx={BAR / 2} width={`${fill}%`} x="0" y="0">
              <title>{`${valueLabel}: ${format(value)}`}</title>
            </rect>
          ) : null}
        </svg>
        {over ? (
          <p className={styles.warning}>
            <svg aria-hidden="true" className={styles.icon} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 16 16">
              <path d="M8 2.5l6 11H2l6-11z" strokeLinejoin="round" />
              <path d="M8 7v3M8 12v.01" strokeLinecap="round" />
            </svg>
            {overLabel}
          </p>
        ) : null}
      </div>
    </ChartFrame>
  );
}
