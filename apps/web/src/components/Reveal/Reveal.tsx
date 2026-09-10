'use client';
import { useEffect, useRef } from 'react';

import type { CSSProperties, ElementType, ReactNode } from 'react';

interface RevealProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  /** Stagger, in ms, for items revealed together. */
  delay?: number;
}

/**
 * Reveals its children once, when they first scroll into view.
 *
 * Renders visible and opts *into* being hidden, rather than the reverse. The
 * server's markup is therefore what paints, immediately and without waiting for
 * this file to arrive; only an element still below the fold by the time this
 * effect runs is hidden, and hiding something nobody can see costs nothing. A
 * reader with no JavaScript keeps the entire page, and the hero — the largest
 * element, and the one the LCP is measured against — is painted by the server
 * rather than by React.
 *
 * An IntersectionObserver rather than a scroll listener: it costs nothing per
 * frame, and it disconnects after firing because a section that re-animates
 * every time you scroll past reads as a glitch.
 *
 * The animation itself is CSS in `styles/globals.css`, so
 * `prefers-reduced-motion` turns it off in one place.
 */
export function Reveal({ as: Component = 'div', children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) {return;}

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {return;}

    /*
     * Measured now rather than at render, because "now" is the only moment that
     * tells the truth: hydration can land after the reader has already scrolled,
     * and anything they have reached has been read. Animating it in at that
     * point is a flash, not a reveal.
     */
    if (element.getBoundingClientRect().top < window.innerHeight) {return;}

    /*
     * Built before the element is hidden, never after. If the constructor is
     * missing or throws, the early return leaves the element exactly as the
     * server rendered it — visible — instead of stranding it at `opacity: 0`
     * with nothing left running that could bring it back.
     */
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {return;}

        element.dataset.reveal = 'shown';
        observer.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.1 }
    );

    element.dataset.reveal = 'hidden';
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <Component className={className} data-reveal="" ref={ref} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>
      {children}
    </Component>
  );
}
