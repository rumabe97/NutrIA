'use client';
import { useEffect } from 'react';

import { isBelowFold, observeInView } from 'ui/utils/observeInView';
import { prefersReducedMotion } from 'ui/utils/prefersReducedMotion';

import type { RefObject } from 'react';

export interface UseInViewOptions {
  /** The attribute written on the element: `waiting` while it is armed, `shown` once reached. */
  attribute?: string;
}

/**
 * The in-view trigger (`ui/styles/motion`): a figure below the fold plays its entrance when it is
 * reached, once.
 *
 * The element renders in its resting state — final, visible — and only an element that is still
 * below the fold when this runs is armed (`data-in-view="waiting"`, under which nothing inside it
 * animates). Reaching it writes `shown`, and every entrance inside plays from its start. Nothing
 * on screen is ever armed, so the server's markup is what paints; a reader with no script, or
 * with reduced motion, keeps the final state and never sees an empty figure.
 *
 * One `IntersectionObserver` is shared by every caller (`ui/utils/observeInView`).
 */
export function useInView<T extends Element>(ref: RefObject<T | null>, { attribute = 'data-in-view' }: UseInViewOptions = {}): void {
  useEffect(() => {
    const element = ref.current;

    if (!element || prefersReducedMotion() || typeof IntersectionObserver === 'undefined' || !isBelowFold(element)) {
      return;
    }

    /*
     * The observer is built before the element is armed, never after: if it throws, the element
     * stays exactly as the server drew it instead of waiting for a signal nothing will send.
     */
    let stop: () => void;

    try {
      stop = observeInView(element, () => element.setAttribute(attribute, 'shown'));
    } catch {
      return;
    }

    element.setAttribute(attribute, 'waiting');

    return () => {
      stop();

      if (element.getAttribute(attribute) === 'waiting') {
        element.removeAttribute(attribute);
      }
    };
  }, [attribute, ref]);
}
