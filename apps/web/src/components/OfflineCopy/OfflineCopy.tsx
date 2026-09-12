'use client';
import { useEffect } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import styles from './OfflineCopy.module.css';

import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { useOffline } from 'components/OfflineProvider';

import { formatInstant, interpolate } from 'lib/format';
import { refreshOfflineCopies } from 'lib/offline';

/**
 * The signed-in screens' side of the offline copies (`0053`).
 *
 * Keeps them fresh: on every change of screen (the worker allows once a minute)
 * and once more as the app is put away, which on the way to the shop is when
 * the latest ticks matter. And says so when what is on screen is a copy or the
 * connection is gone — a tick made offline does not stick, and a list that
 * quietly unticks itself is worse than one that says why.
 */
export function OfflineCopy() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { copy, offline, renderedAt } = useOffline();

  useEffect(() => {
    void refreshOfflineCopies();
  }, [pathname]);

  useEffect(() => {
    function onHidden() {
      if (document.visibilityState === 'hidden') {
        void refreshOfflineCopies(true);
      }
    }

    // Back online while reading a copy: the live screen, once. On the event
    // only — on arrival, a copy served because the network kept failing would
    // reload itself for as long as it failed.
    function onOnline() {
      if (copy) {
        router.refresh();
      }
    }

    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('online', onOnline);
    };
  }, [copy, router]);

  if (!offline) {
    return null;
  }

  const t = dictionary.offline;
  const message =
    copy === 'today'
      ? interpolate(t.copyToday, { time: formatInstant(renderedAt, locale, { hour: '2-digit', minute: '2-digit' }) })
      : copy === 'earlier'
        ? interpolate(t.copyEarlier, { date: formatInstant(renderedAt, locale, { day: 'numeric', month: 'long', weekday: 'long' }) })
        : t.offline;

  return (
    <p className={styles.notice} role="status">
      {message}
    </p>
  );
}
