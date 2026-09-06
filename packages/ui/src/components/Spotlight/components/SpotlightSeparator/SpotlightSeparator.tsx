'use client';
import { useSpotlight } from '../../hooks/useSpotlight';

import type { SeparatorProps } from '../../types';

/**
 * Visual and semantic separator between items or groups. Hidden while the search query is active
 * unless `alwaysRender` is true.
 */
export function SpotlightSeparator({ alwaysRender, ref, ...etc }: SeparatorProps) {
  const render = useSpotlight(state => !state.search);

  if (!alwaysRender && !render) {
    return null;
  }

  return <div ref={ref} {...etc} data-spotlight-separator="" role="separator" />;
}
