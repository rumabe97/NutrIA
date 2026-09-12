'use client';
import { useEffect, useSyncExternalStore } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import styles from './OfflineCopy.module.css';

import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatInstant, interpolate } from 'lib/format';
import { refreshOfflineCopies } from 'lib/offline';

/** Older than this when it reaches the screen, a render was not made for this visit: it is a stored copy. */
const COPY_AFTER_MS = 2 * 60 * 1000;

type Copy = 'earlier' | 'today' | null;

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);

  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** When a render first reached this screen. Fixed once per render, so whether it is a copy never changes while it is read. */
let arrival: { readonly at: number; readonly renderedAt: number } | null = null;

function copyOf(renderedAt: number): Copy {
  if (arrival?.renderedAt !== renderedAt) {
    arrival = { at: Date.now(), renderedAt };
  }

  if (arrival.at - renderedAt <= COPY_AFTER_MS) {
    return null;
  }

  return new Date(arrival.at).toDateString() === new Date(renderedAt).toDateString() ? 'today' : 'earlier';
}

/** Nothing to listen to: the answer is fixed on arrival. */
function unchanging(): () => void {
  return () => undefined;
}

function neverOnServer(): Copy {
  return null;
}

/**
 * The signed-in screens' side of the offline copies (`0053`).
 *
 * Keeps them fresh: on every change of screen (the worker allows once a minute)
 * and once more as the app is put away, which on the way to the shop is when
 * the latest ticks matter. And says so when what is on screen is a copy or the
 * connection is gone — a tick made offline does not stick, and a list that
 * quietly unticks itself is worse than one that says why.
 *
 * `renderedAt` is when the server made this screen. A copy is the only render
 * that arrives minutes old, which is how one is told apart: the worker leaves
 * no other mark on it.
 */
export function OfflineCopy({ renderedAt }: Readonly<{ renderedAt: number }>) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
  // Never a copy on the server, which cannot know, so hydration renders what the
  // server did; the client's answer follows straight after.
  const copy = useSyncExternalStore(unchanging, () => copyOf(renderedAt), neverOnServer);

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

  if (online && !copy) {
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
