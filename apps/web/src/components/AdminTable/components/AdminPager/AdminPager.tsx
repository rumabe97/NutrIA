import styles from './AdminPager.module.css';

import { CtaLink } from 'components/CtaLink';

interface AdminPagerProps {
  /** Names the landmark ("Páginas de la tabla"). */
  label: string;
  /** The page after, or undefined on the last. */
  nextHref?: string;
  nextLabel: string;
  /** The page before, or undefined on the first. */
  previousHref?: string;
  previousLabel: string;
  /** Which rows are on screen, "26–50 de 120"; omitted when none are. */
  range?: string;
}

/**
 * A console table's pager: links, not buttons, so a page of a table is an address that
 * survives a reload and the back button, and needs no JavaScript. An end with nowhere
 * to go is not drawn, and the range keeps its place in the middle.
 */
export function AdminPager({ label, nextHref, nextLabel, previousHref, previousLabel, range }: AdminPagerProps) {
  if (!previousHref && !nextHref) {
    return null;
  }

  return (
    <nav aria-label={label} className={styles.pager}>
      {previousHref ? (
        <CtaLink className={styles.previous} href={previousHref} rel="prev" size="sm" variant="secondary">
          {previousLabel}
        </CtaLink>
      ) : (
        <span />
      )}
      {range ? <span className={styles.range}>{range}</span> : <span />}
      {nextHref ? (
        <CtaLink className={styles.next} href={nextHref} rel="next" size="sm" variant="secondary">
          {nextLabel}
        </CtaLink>
      ) : (
        <span />
      )}
    </nav>
  );
}
