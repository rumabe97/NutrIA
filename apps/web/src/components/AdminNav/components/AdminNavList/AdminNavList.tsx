import { useId } from 'react';

import Link from 'next/link';

import styles from './AdminNavList.module.css';

import { useDictionary } from 'i18n/LocaleProvider';

import { ADMIN_SECTIONS } from '../../sections';

import type { MouseEvent } from 'react';

interface AdminNavListProps {
  /** Called with the link's address when one is followed — the drawer closes on it; the sidebar passes nothing. */
  onNavigate?: (href: string) => void;
  /** The address being read, so its entry can say so. */
  pathname: string;
}

/**
 * A plain click follows the link here; a modified one (a new tab, a download) leaves
 * this page where it is, so the drawer must not act as if it navigated.
 */
function navigated(event: MouseEvent<HTMLAnchorElement>, href: string, onNavigate: (href: string) => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  onNavigate(href);
}

/**
 * The console's pages under their group names, and the way back to the app.
 *
 * One list for the sidebar and the phone's drawer, so the two can never
 * disagree. A group with no page yet draws nothing. The group names are not
 * headings: they would come before the page's own `h1` in the outline, and each
 * page opens with its title. They name their list instead (`aria-labelledby`),
 * which is what a screen reader announces on entering it.
 */
export function AdminNavList({ onNavigate, pathname }: AdminNavListProps) {
  const dictionary = useDictionary();
  const t = dictionary.adminNav;
  const id = useId();

  return (
    <nav aria-label={t.label} className={styles.nav}>
      {ADMIN_SECTIONS.filter(section => section.pages.length > 0).map(section => {
        const headingId = section.group ? `${id}-${section.group}` : undefined;

        return (
          <div className={styles.group} key={section.group ?? 'legacy'}>
            {section.group ? (
              <p className={styles.heading} id={headingId}>
                {t.groups[section.group]}
              </p>
            ) : null}
            <ul aria-labelledby={headingId} className={styles.list}>
              {section.pages.map(page => (
                <li key={page.href}>
                  {/* Exact, not a prefix: every page has its own entry, and Resumen is `/admin` itself. */}
                  <Link
                    aria-current={pathname === page.href ? 'page' : undefined}
                    className={styles.link}
                    href={page.href}
                    onClick={onNavigate ? event => navigated(event, page.href, onNavigate) : undefined}
                  >
                    {t.pages[page.label]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <Link
        className={`${styles.link} ${styles.back}`}
        href="/inicio"
        onClick={onNavigate ? event => navigated(event, '/inicio', onNavigate) : undefined}
      >
        <svg aria-hidden="true" className={styles.backIcon} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t.back}
      </Link>
    </nav>
  );
}
