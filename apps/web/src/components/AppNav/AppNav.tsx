'use client';
import { Fragment } from 'react';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

import styles from './AppNav.module.css';

import { signOut } from 'lib/auth-client';

/**
 * Destinations, in the order the product loop uses them. The same list drives
 * the desktop header and the mobile bottom bar, so the two can never disagree.
 *
 * Progress is not yet built, so it is absent rather than present-and-dead: a nav
 * item that leads nowhere is worse than one that is not there.
 */
const DESTINATIONS = [
  { href: '/inicio', icon: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5', label: 'Inicio' },
  { href: '/plan', icon: 'M7 4h10a1 1 0 0 1 1 1v15l-6-3-6 3V5a1 1 0 0 1 1-1Z', label: 'Plan' },
  { href: '/compra', icon: 'M4 6h2l2.2 9.4a1 1 0 0 0 1 .8h7.7a1 1 0 0 0 1-.8L20 9H7M9 20h.01M17 20h.01', label: 'Compra' },
  { href: '/perfil', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0', label: 'Perfil' }
] as const;

export function AppNav() {
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
          <Link aria-label="NutrIA — inicio" className={styles.brand} href="/inicio">
            <span aria-hidden="true" className={styles.mark} />
            NutrIA
          </Link>

          <nav aria-label="Secciones" className={styles.desktopNav}>
            {DESTINATIONS.map(destination => (
              <Link aria-current={isCurrent(destination.href)} className={styles.navLink} href={destination.href} key={destination.href}>
                {destination.label}
              </Link>
            ))}
          </nav>

          <button className={styles.signOut} onClick={handleSignOut} type="button">
            Cerrar sesión
          </button>
        </div>
      </header>

      <nav aria-label="Navegación principal" className={styles.bottomBar}>
        {DESTINATIONS.map(destination => (
          <Link aria-current={isCurrent(destination.href)} className={styles.bottomLink} href={destination.href} key={destination.href}>
            <svg aria-hidden="true" className={styles.bottomIcon} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <path d={destination.icon} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {destination.label}
          </Link>
        ))}
      </nav>
    </Fragment>
  );
}
