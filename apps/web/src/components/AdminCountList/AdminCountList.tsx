import { Fragment } from 'react';

import Link from 'next/link';

import styles from './AdminCountList.module.css';

import { Card } from 'components/Card';

export interface AdminCountRow {
  readonly id: string;
  /** Already formatted. */
  readonly count: string;
  /** Where the row opens the list behind the figure. Omit for a figure that has no list. */
  readonly href?: string;
  readonly label: string;
  /** A word beside the count, so a warning never rests on colour alone ("Revisar"). */
  readonly status?: string;
  /** A defect: the count and the word in `status` are drawn as a warning. */
  readonly warn?: boolean;
}

interface AdminCountListProps {
  /** Names the list for a screen reader. */
  label: string;
  rows: readonly AdminCountRow[];
}

/**
 * A list of figures on one card, each with its label and, when it has one, the list it counts
 * (`0071`): "should be zero" and "worth a look". A figure that is a defect says so in a word
 * as well as in colour.
 */
export function AdminCountList({ label, rows }: AdminCountListProps) {
  return (
    <Card aria-label={label} as="ul" className={styles.list}>
      {rows.map(row => {
        const body = (
          <Fragment>
            <span className={styles.label}>{row.label}</span>
            {row.status === undefined ? null : (
              <span className={styles.status} data-warn={row.warn ? 'true' : undefined}>
                {row.status}
              </span>
            )}
            <span className={styles.count} data-warn={row.warn ? 'true' : undefined}>
              {row.count}
            </span>
            {row.href === undefined ? (
              <span aria-hidden="true" className={styles.chevron} />
            ) : (
              <svg aria-hidden="true" className={styles.chevron} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </Fragment>
        );

        return (
          <li key={row.id}>
            {row.href === undefined ? (
              <div className={styles.row}>{body}</div>
            ) : (
              <Link className={`${styles.row} ${styles.link}`} href={row.href}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </Card>
  );
}
