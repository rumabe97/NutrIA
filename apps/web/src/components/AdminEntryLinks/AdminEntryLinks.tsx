import Link from 'next/link';

import styles from './AdminEntryLinks.module.css';

import { Card } from 'components/Card';

interface AdminEntryLinksProps {
  /** **Required.** Names the group of links for a screen reader. */
  label: string;
  links: readonly { readonly href: string; readonly summary: string; readonly title: string }[];
}

/**
 * The sheet's two entry rows (sheet «ConsolaPerfiles», its foot): each a whole link of
 * a minimum height of a finger, its name in bold, what waits behind it under the name
 * and a chevron at the end. Only what exists is drawn: a row for a page that is not
 * built yet is a dead control.
 */
export function AdminEntryLinks({ label, links }: AdminEntryLinksProps) {
  return (
    <Card aria-label={label} as="nav" className={styles.card}>
      <ul className={styles.list} role="list">
        {links.map(link => (
          <li key={link.href}>
            <Link className={styles.link} href={link.href}>
              <span className={styles.words}>
                <span className={styles.title}>{link.title}</span>
                <span className={styles.summary}>{link.summary}</span>
              </span>
              <svg aria-hidden="true" className={styles.chevron} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
