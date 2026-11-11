import styles from './Rings.module.css';

import { InView } from 'ui/components/InView';

import type { ComponentPropsWithRef } from 'react';

export interface RingsItem {
  /** **Required.** What the ring measures ("Calorías"). */
  label: string;
  /** **Required.** The full ring. Zero or less draws an empty ring. */
  max: number;
  /** Which ring colour (`--color-ring-1` … `-4`). Defaults to the item's place: the first ring is 1. */
  tone?: 1 | 2 | 3 | 4;
  /** **Required.** How far the ring is drawn. Over `max` it is a full ring, never more. */
  value: number;
  /** The figures in words, for assistive technology ("1880 de 2246 kcal"). Defaults to "value / max". */
  valueText?: string;
}

export interface RingsProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  /** **Required.** One to four measures, outermost first. Anything after the fourth is not drawn. */
  items: readonly RingsItem[];
  /** **Required.** What the rings are, as a whole ("Objetivos de hoy"): the group's name. */
  label: string;
  /** How large the rings are drawn: `sm` 6rem, `md` 9rem, `lg` 12rem — never wider than their box. */
  size?: 'sm' | 'md' | 'lg';
}

/** In viewBox units (0–100): the width of a ring and the space between two. */
const STROKE = 8;
const GAP = 2;
/** The outermost ring's radius: half the box, less half a stroke and a hair for anti-aliasing. */
const OUTER = 50 - STROKE / 2 - 0.5;
const TONES = [1, 2, 3, 4] as const;

function fraction(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value / max));
}

/**
 * One to four concentric progress rings (project 024: the day's targets, a dish's share of the
 * day, meals done, the plan being made).
 *
 * Drawn in SVG with round caps, each ring on its track, in `--color-ring-1…4` over
 * `--color-ring-track` (3:1 against the track and the card, `scripts/check-contrast.mjs`). Each
 * ring sweeps to its value when it arrives — when it is reached, if it starts below the fold
 * (`InView`) — and under reduced motion it is simply there.
 *
 * **The text alternative is a list**, visually hidden, one item per ring: "Calorías: 1880 de
 * 2246 kcal". Not a `role="img"` with one long `aria-label`: four figures in one label are read as
 * one breathless sentence that cannot be stepped through, and a list lets a screen reader say
 * how many measures there are and move from one to the next. The picture itself is
 * `aria-hidden`; the group is named by `label`.
 */
export function Rings({ className, items, label, size = 'md', ...rest }: RingsProps) {
  const drawn = items.slice(0, 4);

  return (
    <div aria-label={label} className={[styles.root, styles[size], className].filter(Boolean).join(' ')} role="group" {...rest}>
      <InView className={styles.picture}>
        <svg aria-hidden="true" className={styles.svg} focusable="false" viewBox="0 0 100 100">
          {drawn.map((item, index) => (
            <circle className={styles.track} cx="50" cy="50" key={`track-${item.label}`} r={OUTER - index * (STROKE + GAP)} strokeWidth={STROKE} />
          ))}
          <g className="motion-figures">
            {drawn.map((item, index) => {
              const share = fraction(item.value, item.max);

              if (share === 0) {
                return null;
              }

              const tone = item.tone ?? TONES[index];

              return (
                <circle
                  className={`${styles.arc} ${styles[`tone${tone}`]} motion-sweep`}
                  cx="50"
                  cy="50"
                  key={`arc-${item.label}`}
                  pathLength={100}
                  r={OUTER - index * (STROKE + GAP)}
                  strokeDasharray="100 100"
                  strokeDashoffset={100 - share * 100}
                  strokeWidth={STROKE}
                  transform="rotate(-90 50 50)"
                />
              );
            })}
          </g>
        </svg>
      </InView>
      <ul className="visually-hidden">
        {drawn.map(item => (
          <li key={item.label}>
            {item.label}: {item.valueText ?? `${item.value} / ${item.max}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
