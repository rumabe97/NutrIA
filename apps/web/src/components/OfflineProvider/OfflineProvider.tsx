'use client';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { OFFLINE_PATHS, storedPages } from 'lib/offline';

import type { ReactNode } from 'react';

/** Older than this when it reaches the screen, a render was not made for this visit: it is a stored copy. */
const COPY_AFTER_MS = 2 * 60 * 1000;

type Copy = 'earlier' | 'today' | null;

type OfflineValue = {
  /** Whether a screen opens right now: every one online; offline, only one with a copy on this device. */
  readonly available: (path: string) => boolean;
  /** Whether what is on screen is a stored copy, and whether it is from today. */
  readonly copy: Copy;
  /** No connection, or a copy on screen because there was none a moment ago. */
  readonly offline: boolean;
  /** When the server made what is on screen. */
  readonly renderedAt: number;
};

const OfflineContext = createContext<OfflineValue>({ available: () => true, copy: null, offline: false, renderedAt: 0 });

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
 * Whether the signed-in screens are live, and what opens when they are not (`0053`).
 *
 * One place for the question, because three things ask it: the notice that says
 * a screen is a copy, the navigation that draws only what opens offline, and
 * each meal's link to its recipe.
 *
 * `renderedAt` is when the server made this screen. A copy is the only render
 * that arrives minutes old, which is how one is told apart: the worker leaves no
 * other mark on it. Never a copy on the server, which cannot know, so hydration
 * renders what the server did and the client's answer follows straight after.
 */
export function OfflineProvider({ children, renderedAt }: Readonly<{ children: ReactNode; renderedAt: number }>) {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
  const copy = useSyncExternalStore(unchanging, () => copyOf(renderedAt), neverOnServer);
  const offline = !online || copy !== null;
  const [stored, setStored] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    let current = offline;

    if (current) {
      void storedPages().then(paths => {
        if (current) {
          setStored(paths);
        }
      });
    }

    return () => {
      current = false;
    };
  }, [offline, renderedAt]);

  const value = useMemo<OfflineValue>(
    () => ({
      // Until the device has said what it holds, the screens it always keeps.
      available: path => !offline || (stored ? stored.has(path) : OFFLINE_PATHS.includes(path)),
      copy,
      offline,
      renderedAt
    }),
    [copy, offline, renderedAt, stored]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineValue {
  return useContext(OfflineContext);
}
