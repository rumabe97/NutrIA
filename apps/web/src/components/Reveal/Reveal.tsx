'use client';
import { useRef } from 'react';

import { useInView } from 'ui/hooks/useInView';

import type { CSSProperties, ElementType, ReactNode } from 'react';

interface RevealProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  /** Stagger, in ms, for items revealed together. */
  delay?: number;
}

/**
 * Reveals its children once, when they first scroll into view — the motion system's in-view
 * trigger (`ui/hooks/useInView`, one `IntersectionObserver` for the page) applied to a whole
 * section of the landing page.
 *
 * Renders visible and opts *into* being hidden, rather than the reverse. The server's markup is
 * therefore what paints, immediately and without waiting for this file to arrive; only an
 * element still below the fold by the time the hook runs is hidden (`data-reveal="waiting"`),
 * and hiding something nobody can see costs nothing. A reader with no JavaScript keeps the
 * entire page, and the hero — the largest element, and the one the LCP is measured against — is
 * painted by the server rather than by React. Under reduced motion nothing is hidden at all.
 *
 * The animation itself is CSS in `styles/globals.css`.
 */
export function Reveal({ as: Component = 'div', children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useInView(ref, { attribute: 'data-reveal' });

  return (
    <Component className={className} data-reveal="" ref={ref} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>
      {children}
    </Component>
  );
}
