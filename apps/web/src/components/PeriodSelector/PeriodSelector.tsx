import Link from 'next/link';

import styles from './PeriodSelector.module.css';

import { PERIODS } from 'core/entities/Period';

import { interpolate } from 'lib/format';

import { periodHref } from './periodHref';

import type { PageQuery } from './periodHref';
import type { Period } from 'core/entities/Period';

interface PeriodSelectorProps {
  /** The period the page is showing. */
  current: Period;
  /** Names the group for a screen reader ("Periodo"). */
  label: string;
  /** One option's words, with `{days}` ("{days} días"). */
  optionLabel: string;
  /** The page the links stay on. */
  pathname: string;
  /** The page's own query, kept on every link. */
  query: PageQuery;
}

/**
 * 7, 30 or 90 days (`0068`): three links, not a form, so a period is an address —
 * the back button, a reload and a pasted link all show the same figures — and the
 * control needs no JavaScript. Every other parameter rides along.
 *
 * The period being shown carries `aria-current` and, for the eye, a filled segment
 * and heavier type: never colour alone.
 */
export function PeriodSelector({ current, label, optionLabel, pathname, query }: PeriodSelectorProps) {
  return (
    <nav aria-label={label}>
      <ul className={styles.segments}>
        {PERIODS.map(period => (
          <li key={period}>
            <Link
              aria-current={period === current ? 'true' : undefined}
              className={styles.segment}
              href={periodHref(pathname, query, period)}
              scroll={false}
            >
              {interpolate(optionLabel, { days: period })}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
