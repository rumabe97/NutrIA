'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { prefersReducedMotion } from 'ui/utils/prefersReducedMotion';

import type { RefObject } from 'react';

/** The marker of the current destination, inside the navigation `container` holds. */
const MARKER = '[data-nav-marker]';

/** A duration token as the browser computes it — `400ms` or `0.4s` — in milliseconds. */
function milliseconds(value: string): number {
  const amount = Number.parseFloat(value);

  if (Number.isNaN(amount)) {
    return 0;
  }

  return value.trim().endsWith('ms') ? amount : amount * 1000;
}

/**
 * Slides the current destination's marker from where the last one stood (a FLIP: the new
 * marker is drawn in its place at once, then moved back over the old one by `transform`
 * and released). The duration and the easing are the motion system's `--motion-axis` —
 * `--duration-enter` on `--spring-gentle` — read from the stylesheet, never typed here.
 *
 * Only `transform` moves, on an element nothing else is laid out around, so the slide
 * costs no layout and blocks nothing: the destination works the moment it is drawn.
 * With reduced motion the marker simply is where it belongs (`ui/utils/prefersReducedMotion`,
 * the rule for anything moved from script).
 */
export function useMarkerSlide(container: RefObject<HTMLElement | null>, current: string | undefined) {
  const last = useRef<DOMRect | null>(null);

  useLayoutEffect(() => {
    const marker = container.current?.querySelector<HTMLElement>(MARKER) ?? null;
    const previous = last.current;
    const next = marker?.getBoundingClientRect() ?? null;

    last.current = next;

    if (!marker || !previous || !next || next.width === 0 || next.height === 0 || prefersReducedMotion()) {
      return;
    }

    const dx = previous.left - next.left;
    const dy = previous.top - next.top;

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      return;
    }

    const style = getComputedStyle(marker);
    const duration = milliseconds(style.getPropertyValue('--duration-enter'));
    const easing = style.getPropertyValue('--spring-gentle').trim() || 'ease';
    const from = `translate(${dx}px, ${dy}px) scale(${previous.width / next.width}, ${previous.height / next.height})`;

    try {
      marker.animate([{ transform: from }, { transform: 'none' }], { duration, easing });
    } catch {
      // An easing this browser cannot parse: the same slide on a plain ease.
      marker.animate([{ transform: from }, { transform: 'none' }], { duration, easing: 'ease' });
    }
  }, [container, current]);

  // The bar and the rail are fixed, so a marker's place on screen only changes when the
  // window does — and then the next slide must start from where the marker is now.
  useEffect(() => {
    function remember() {
      last.current = container.current?.querySelector<HTMLElement>(MARKER)?.getBoundingClientRect() ?? null;
    }

    window.addEventListener('resize', remember);

    return () => window.removeEventListener('resize', remember);
  }, [container]);
}
