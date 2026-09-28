import styles from './Sparkline.module.css';

import { chartToneKey } from 'ui/utils/chartToneKey';
import { linearScale } from 'ui/utils/linearScale';

import type { ChartTone } from 'ui/types/Chart.types';

export interface SparklineProps {
  className?: string;
  /** The line's colour. Defaults to the first categorical slot. */
  tone?: ChartTone;
  /** Oldest first, evenly spaced. */
  values: readonly number[];
}

const WIDTH = 100;
const HEIGHT = 24;
/** Room for the stroke at the top and bottom edges. */
const PAD = 2;

/**
 * A trend with no axes, drawn beside the figure it belongs to (a `StatTile`'s).
 *
 * Decorative, so `aria-hidden`: the figure beside it carries the number, and it must
 * never be shown without one. Runs from zero, like every chart here; a series with
 * nothing above zero, or fewer than two points, draws nothing rather than a flat line
 * that would read as data.
 */
export function Sparkline({ className, tone, values }: SparklineProps) {
  const clean = values.map(value => (Number.isFinite(value) && value > 0 ? value : 0));
  const max = Math.max(0, ...clean);

  if (clean.length < 2 || max === 0) {
    return null;
  }

  const y = linearScale([0, max], [HEIGHT - PAD, PAD]);
  const points = clean.map((value, index) => `${((index / (clean.length - 1)) * WIDTH).toFixed(2)},${y(value).toFixed(2)}`).join(' ');

  return (
    <svg
      aria-hidden="true"
      className={[styles.sparkline, styles[chartToneKey(tone, 0)], className].filter(Boolean).join(' ')}
      focusable="false"
      preserveAspectRatio="none"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      <polyline className={styles.line} points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
