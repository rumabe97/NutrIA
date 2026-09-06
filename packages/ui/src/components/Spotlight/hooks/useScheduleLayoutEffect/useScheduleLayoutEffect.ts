'use client';
import { useState } from 'react';

import { useIsomorphicLayoutEffect } from '../useIsomorphicLayoutEffect';
import { useLazyRef } from '../useLazyRef';

/**
 * Imperatively schedule a callback to run on the next layout-effect tick.
 * Callbacks keyed by id (number or string) — re-scheduling the same id replaces the previous one.
 */
export function useScheduleLayoutEffect(): (id: number | string, callback: () => void) => void {
  const [tick, setTick] = useState<object>({});
  const callbacks = useLazyRef(() => new Map<number | string, () => void>());

  useIsomorphicLayoutEffect(() => {
    callbacks.current.forEach(callback => callback());
    callbacks.current.clear();
  }, [tick]);

  return (id, callback) => {
    callbacks.current.set(id, callback);
    setTick({});
  };
}
