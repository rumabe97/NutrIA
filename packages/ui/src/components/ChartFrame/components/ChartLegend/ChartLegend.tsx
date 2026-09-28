import styles from './ChartLegend.module.css';

import { chartToneKey } from 'ui/utils/chartToneKey';

import type { ChartTone } from 'ui/types/Chart.types';

export interface ChartLegendItem {
  /** A figure to print after the name — the donut's counts. */
  readonly detail?: string;
  /** The series' name. */
  readonly name: string;
  /** The series' colour; the item's position picks the slot when it is left out. */
  readonly tone?: ChartTone;
}

interface ChartLegendProps {
  /** `column` lists the items one under another, beside a donut. */
  direction: 'column' | 'row';
  items: readonly ChartLegendItem[];
}

/**
 * The series' names beside their colours, so identity never rests on colour alone. A
 * list, in series order, with the text in text colours — the swatch carries the hue.
 */
export function ChartLegend({ direction, items }: ChartLegendProps) {
  return (
    <ul className={direction === 'column' ? `${styles.legend} ${styles.column}` : styles.legend}>
      {items.map((item, index) => (
        <li className={styles.item} key={`${item.name}-${index}`}>
          <span aria-hidden="true" className={`${styles.swatch} ${styles[chartToneKey(item.tone, index)]}`} />
          <span>{item.name}</span>
          {item.detail === undefined ? null : <span className={styles.detail}>{item.detail}</span>}
        </li>
      ))}
    </ul>
  );
}
