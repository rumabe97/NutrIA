'use client';
import { Fragment, useEffect, useRef, useState } from 'react';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

import styles from './AppNav.module.css';

import { useDictionary } from 'i18n/LocaleProvider';

import { LocaleSwitcher } from 'components/LocaleSwitcher';
import { ThemeSwitcher } from 'components/ThemeSwitcher';
import { useOffline } from 'components/OfflineProvider';

import { forgetOfflineCopies } from 'lib/offline';
import { forgetPushOnThisDevice } from 'lib/push';
import { signOut } from 'lib/auth-client';

import { currentHref, destinationsFor } from './destinations';
import { useMarkerSlide } from './useMarkerSlide';

import type { MouseEvent } from 'react';

interface AppNavProps {
  /** The `assistant` switch (`GET /settings`), display only — see `destinations.ts`. */
  assistant?: boolean;
  /** `UserView.professional` (`GET /users/me`), display only — see `destinations.ts`. */
  professional?: boolean;
}

/** A click that opens the link somewhere else and leaves this screen where it is. */
function opensElsewhere(event: MouseEvent<HTMLAnchorElement>) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * The signed-in app's shell: the header (brand, language, theme, sign-out), the
 * navigation — a floating bar below 48rem, a rail from there — and the hatched
 * pattern behind the header. The layout (`(app)/layout.module.css`) leaves the
 * room the rail and the bar take, through the tokens in `styles/variables.css`.
 */
export function AppNav({ assistant = false, professional = false }: AppNavProps) {
  const dictionary = useDictionary();
  const pathname = usePathname();
  const router = useRouter();
  const { available, offline } = useOffline();
  const navRef = useRef<HTMLElement>(null);
  // The destination just pressed, marked at once rather than when its screen arrives: the
  // marker moves under the finger, and the bar's items settle in the moment of the tap
  // instead of a second later, while somebody is already reading.
  const [pressed, setPressed] = useState<{ from: string; href: string } | null>(null);
  // Offline, only what opens: the screens with a copy on this device, and nothing
  // that needs the server — switching language and signing out both do (`0053`).
  const destinations = destinationsFor({ assistant, available, professional });
  // A press counts only on the screen it was made on: once the address moves, it says where we are.
  const current = pressed?.from === pathname ? pressed.href : currentHref(pathname, destinations);

  useMarkerSlide(navRef, current);

  // A press that went nowhere (the same screen, a refused navigation) is forgotten after a while.
  useEffect(() => {
    if (!pressed) {
      return;
    }

    const timer = window.setTimeout(() => setPressed(null), 10_000);

    return () => window.clearTimeout(timer);
  }, [pressed]);

  async function handleSignOut() {
    // This browser stops being told about this account, while the session can still say so (`0054`).
    await forgetPushOnThisDevice();
    await signOut();
    // Today's screen and the list stay on the device only while the session does (`0053`).
    await forgetOfflineCopies();
    router.push('/');
    router.refresh();
  }

  return (
    <Fragment>
      {/* The hatched pattern behind the header — the owner's exception, PRD 024 criterion 9:
          it drifts by itself. Still under reduced motion, absent in Alto contraste and forced colours. */}
      <div aria-hidden="true" className={styles.pattern}>
        <div className={styles.hatch} />
      </div>

      <header className={styles.header}>
        <div className={styles.inner}>
          <Link aria-label={dictionary.appNav.brandHome} className={styles.brand} href="/inicio">
            <span aria-hidden="true" className={styles.mark} />
            <span className={styles.wordmark}>NutrIA</span>
          </Link>

          <div className={styles.actions}>
            {/* The theme only paints this device, so it works offline too. */}
            {offline ? null : <LocaleSwitcher compact={true} />}
            <ThemeSwitcher />

            {offline ? null : (
              // Below 360px the words step aside for the icon; they stay the button's name.
              <button className={styles.signOut} onClick={handleSignOut} type="button">
                <svg aria-hidden="true" className={styles.signOutIcon} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                  <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className={styles.signOutLabel}>{dictionary.appNav.signOut}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <nav aria-label={dictionary.appNav.mainLabel} className={styles.nav} data-count={destinations.length} ref={navRef}>
        {destinations.map(destination => {
          const isCurrent = destination.href === current;

          return (
            <Link
              aria-current={isCurrent ? 'page' : undefined}
              className={styles.link}
              href={destination.href}
              key={destination.href}
              onClick={event => {
                if (!opensElsewhere(event)) {
                  setPressed({ from: pathname, href: destination.href });
                }
              }}
            >
              {isCurrent ? <span aria-hidden="true" className={styles.marker} data-nav-marker="" /> : null}
              <svg aria-hidden="true" className={styles.icon} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                <path d={destination.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {/* The words are the link's name at every width; on the bar only the current one shows them. */}
              <span className={isCurrent ? `${styles.label} motion-fade` : styles.label}>{dictionary.appNav[destination.label]}</span>
            </Link>
          );
        })}
      </nav>
    </Fragment>
  );
}
