'use client';
import { useSpotlight } from '../../hooks/useSpotlight';

import type { EmptyProps } from '../../types';

/** Automatically rendered when no items match the current search query. */
export function SpotlightEmpty({ ref, ...props }: EmptyProps) {
  const render = useSpotlight(state => state.filtered.count === 0);

  if (!render) {
    return null;
  }

  return <div ref={ref} {...props} data-spotlight-empty="" role="presentation" />;
}
