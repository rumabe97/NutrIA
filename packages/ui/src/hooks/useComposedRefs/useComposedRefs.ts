import { useCallback } from 'react';

import { composeRefs } from 'ui/utils/composeRefs';

import type { Ref, RefCallback } from 'react';

type PossibleRef<T> = Ref<T> | undefined;

/**
 * Compose multiple refs into a single, memoized callback ref.
 *
 * The `useCallback` + eslint suppressions look removable but aren't. Without memoization,
 * a fresh callback every render fires React's ref lifecycle on every render
 * (`oldCallback(null)` → `newCallback(node)`), which trips callback refs that track mount
 * state — IntersectionObserver setup, third-party libraries, etc.
 *
 * The suppressions are needed because the deps array is the variadic `refs` itself (a
 * variable, not a literal). ESLint can't verify it statically; React's runtime comparison
 * still does the right thing element-by-element.
 */
export function useComposedRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  return useCallback(composeRefs(...refs), refs);
}
