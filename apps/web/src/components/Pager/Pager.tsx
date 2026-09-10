import { useId } from 'react';

import Link from 'next/link';

import styles from './Pager.module.css';

import { Text } from 'ui/components/Text';

interface PagerProps {
  /** Copy, passed in so this stays a server component and the page keeps the dictionary. */
  labels: { next: string; of: string; previous: string };
  offset: number;
  /** The query parameter this pager owns, so two pagers on one screen do not fight. */
  param: string;
  size: number;
  total: number;
}

/**
 * Links, not buttons.
 *
 * A page of a list is a place: it should survive a refresh, a share and the
 * back button, and it does that for free when it lives in the URL. The whole
 * component is then a server component with no state to get out of step with
 * what is on screen.
 */
export function Pager({ labels, offset, param, size, total }: PagerProps) {
  const rangeId = useId();

  if (total <= size) {return null;}

  const from = offset + 1;
  const to = Math.min(offset + size, total);
  const href = (next: number) => `?${param}=${Math.max(next, 0)}`;

  return (
    /*
     * Named by its own range. A second `navigation` landmark on a page has to
     * be told apart from the first, and "1–20 de 45" is both a name and the one
     * thing that distinguishes two pagers over two different lists. No new
     * copy, so no caller has to remember to pass one.
     */
    <nav aria-labelledby={rangeId} className={styles.pager}>
      {offset > 0 ? (
        <Link className={styles.step} href={href(offset - size)} rel="prev">
          {labels.previous}
        </Link>
      ) : (
        <span className={styles.spacer} />
      )}

      <Text as="span" id={rangeId} size="sm" tone="tertiary">
        {labels.of.replace('{from}', String(from)).replace('{to}', String(to)).replace('{total}', String(total))}
      </Text>

      {to < total ? (
        <Link className={styles.step} href={href(offset + size)} rel="next">
          {labels.next}
        </Link>
      ) : (
        <span className={styles.spacer} />
      )}
    </nav>
  );
}
