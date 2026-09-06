'use client';
import { usePathname } from 'next/navigation';

import styles from './Header.module.css';

import { Link } from 'ui/components/Link';

import { Brand } from 'components/Brand';

interface Section {
  href: string;
  label: string;
  matchPrefix: string;
}

// The Workspace tab is compiled out of production bundles — NODE_ENV is inlined at build
// time, and the /workspace routes themselves 404 in production (see lib/workspaceDocs.ts).
const SECTIONS: ReadonlyArray<Section> = [
  { href: '/ui', label: 'UI', matchPrefix: '/ui' },
  { href: '/tests', label: 'Tests', matchPrefix: '/tests' },
  ...(process.env.NODE_ENV === 'production' ? [] : [{ href: '/workspace', label: 'Workspace', matchPrefix: '/workspace' }])
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className={`${styles.header} dotted-bottom`}>
      <Brand className={styles.brand} />
      <span aria-hidden="true" className={styles.separator}>
        /
      </span>
      <nav aria-label="Sections" className={styles.sections}>
        {SECTIONS.map(({ href, label, matchPrefix }) => {
          const isActive = pathname === matchPrefix || pathname.startsWith(`${matchPrefix}/`);

          return (
            <Link
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? `${styles.section} ${styles.sectionActive}` : styles.section}
              href={href}
              key={href}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
