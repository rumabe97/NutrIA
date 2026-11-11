/**
 * Whether the person asked for less motion. Read in script by the hooks that move things
 * themselves (`useCountUp`, `useInView`): the reduced-motion rule in `ui/styles/base` reaches CSS
 * animations and transitions, not a number written frame by frame.
 *
 * `true` where it cannot be asked (no `window`, no `matchMedia`): with no answer, nothing moves.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
