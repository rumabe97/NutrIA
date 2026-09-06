'use client';
import { useRef } from 'react';

import type { RefObject } from 'react';

/** Lazy `useRef`: the factory runs once on first render and never again. */
export function useLazyRef<T>(fn: () => T): RefObject<T> {
  const ref = useRef<T | null>(null);

  if (ref.current === null) {
    ref.current = fn();
  }

  return ref as RefObject<T>;
}
