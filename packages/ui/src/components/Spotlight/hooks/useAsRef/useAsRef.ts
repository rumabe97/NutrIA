'use client';
import { useRef } from 'react';

import { useIsomorphicLayoutEffect } from '../useIsomorphicLayoutEffect';

import type { RefObject } from 'react';

/** Tracks the most recent value of `data` in a ref. Updates each render via layout effect. */
export function useAsRef<T>(data: T): RefObject<T> {
  const ref = useRef<T>(data);
  useIsomorphicLayoutEffect(() => {
    ref.current = data;
  });

  return ref;
}
