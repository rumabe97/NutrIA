'use client';
import { Fragment } from 'react';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

import styles from './AppNav.module.css';

import { useDictionary } from 'i18n/LocaleProvider';

import { LocaleSwitcher } from 'components/LocaleSwitcher';

import { signOut } from 'lib/auth-client';

/**
 * Destinations, in the order the product loop uses them. The same list drives
 * the desktop header and the mobile bottom bar, so the two can never disagree.
 *
 * Progress is not yet built, so it is absent rather than present-and-dead: a nav
 * item that leads nowhere is worse than one that is not there.
 */
const DESTINATIONS = [
  { href: '/inicio', icon: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5', label: 'home' },
  { href: '/plan', icon: 'M7 4h10a1 1 0 0 1 1 1v15l-6-3-6 3V5a1 1 0 0 1 1-1Z', label: 'plan' },
  { href: '/compra', icon: 'M4 6h2l2.2 9.4a1 1 0 0 0 1 .8h7.7a1 1 0 0 0 1-.8L20 9H7M9 20h.01M17 20h.01', label: 'shopping' },
  { href: '/perfil', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0', label: 'profile' }
] as const;

export function AppNav() {
  const dictionary = useDictionary();
  const pathname = usePathname();
  const router = useRouter();
  const isCurrent = (href: string) => (pathname.startsWith(href) ? 'page' : undefined);

  async function handleSignOut() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <Fragment>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link aria-label={dictionary.appNav.brandHome} className={styles.brand} href="/inicio">
            <span aria-hidden="true" className={styles.mark} />
            <span className={styles.wordmark}>NutrIA</span>
          </Link>

          <nav aria-label={dictionary.appNav.sectionsLabel} className={styles.desktopNav}>
            {DESTINATIONS.map(destination => (
              <Link aria-current={isCurrent(destination.href)} className={styles.navLink} href={destination.href} key={destination.href}>
                {dictionary.appNav[destination.label]}
              </Link>
            ))}
          </nav>

          <LocaleSwitcher compact={true} />

          <button className={styles.signOut} onClick={handleSignOut} type="button">
            {dictionary.appNav.signOut}
          </button>
        </div>
      </header>

      <nav aria-label={dictionary.appNav.mainLabel} className={styles.bottomBar}>
        {DESTINATIONS.map(destination => (
          <Link aria-current={isCurrent(destination.href)} className={styles.bottomLink} href={destination.href} key={destination.href}>
            <svg aria-hidden="true" className={styles.bottomIcon} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <path d={destination.icon} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {dictionary.appNav[destination.label]}
          </Link>
        ))}
      </nav>
    </Fragment>
  );
}
