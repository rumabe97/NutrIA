'use client';
import { useCallback, useSyncExternalStore } from 'react';

import { useStore } from '../useStore';

import type { State } from '../../types';

/** Run a selector against the command store. Re-renders when the selected slice changes. */
export function useSpotlight<T>(selector: (state: State) => T): T {
  const store = useStore();
  const subscribe = store.subscribe;
  const getSnapshot = useCallback(() => selector(store.snapshot()), [selector, store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
