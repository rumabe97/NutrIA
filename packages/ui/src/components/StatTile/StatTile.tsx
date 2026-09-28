import styles from './StatTile.module.css';

import { percentChange } from 'ui/utils/percentChange';
import { Sparkline } from 'ui/components/Sparkline';

import type { ChartTone } from 'ui/types/Chart.types';
import type { ComponentPropsWithRef, ReactNode } from 'react';

export interface StatTileProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  /** The same figure for this period and the one before; drawn as ▲ / ▼ and a percentage. */
  change?: { readonly current: number; readonly previous: number };
  /**
   * What the change means, in words, for a screen reader: `{change}` is replaced with the signed
   * percentage ("{change} frente al periodo anterior" → "+12 % frente al periodo anterior"). A
   * string, not a function, so a tile can cross into a client component. Without it the
   * percentage is read as drawn.
   */
  changeLabel?: string;
  /** Which way is good news. Colours the change green or red; without it the change stays grey. */
  goodDirection?: 'down' | 'up';
  /** **Required.** What the figure is. */
  label: string;
  /** **Required.** BCP 47 locale for the percentage. */
  locale: string;
  /** A line under the figure — what it counts, or a caveat. */
  note?: ReactNode;
  /** A trend beside the figure. Decorative: the figure and the change say it in words. */
  sparkline?: readonly number[];
  /** The sparkline's colour. */
  sparklineTone?: ChartTone;
  /** **Required.** The figure, already formatted. */
  value: string;
}

/**
 * One headline figure (`0069`): what it is, the figure, and optionally how it moved
 * against the previous period, a note and a sparkline.
 *
 * The change is drawn as an arrow and a signed percentage, and said as a sentence
 * (`changeLabel`), so its meaning never rests on the arrow or its colour. When the
 * previous period was zero no percentage means anything, and none is drawn.
 */
export function StatTile({
  change,
  changeLabel,
  className,
  goodDirection,
  label,
  locale,
  note,
  sparkline,
  sparklineTone,
  value,
  ...rest
}: StatTileProps) {
  const fraction = change ? percentChange(change.current, change.previous) : null;
  const text =
    fraction === null
      ? null
      : new Intl.NumberFormat(locale, {
          maximumFractionDigits: Math.abs(fraction) < 0.1 ? 1 : 0,
          signDisplay: 'exceptZero',
          style: 'percent'
        }).format(fraction);
  const direction = fraction === null || fraction === 0 ? null : fraction > 0 ? 'up' : 'down';
  const mood = direction === null || goodDirection === undefined ? styles.flat : direction === goodDirection ? styles.good : styles.bad;

  return (
    <div className={[styles.tile, className].filter(Boolean).join(' ')} {...rest}>
      <p className={styles.label}>{label}</p>
      <div className={styles.row}>
        <p className={styles.value}>{value}</p>
        {sparkline ? <Sparkline className={styles.sparkline} tone={sparklineTone} values={sparkline} /> : null}
      </div>
      {text === null ? null : (
        <p className={`${styles.change} ${mood}`}>
          {direction === null ? null : (
            <svg aria-hidden="true" className={styles.arrow} viewBox="0 0 10 10">
              <path d={direction === 'up' ? 'M5 1.5l4 6.5H1z' : 'M5 8.5L1 2h8z'} fill="currentColor" />
            </svg>
          )}
          {changeLabel === undefined ? (
            text
          ) : (
            <span>
              <span aria-hidden="true">{text}</span>
              <span className="visually-hidden">{changeLabel.replace('{change}', text)}</span>
            </span>
          )}
        </p>
      )}
      {note === undefined ? null : <p className={styles.note}>{note}</p>}
    </div>
  );
}
