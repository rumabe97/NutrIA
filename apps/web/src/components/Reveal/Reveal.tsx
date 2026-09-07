'use client';
import { useEffect, useRef } from 'react';

import type { ElementType, ReactNode } from 'react';

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
 * An IntersectionObserver rather than a scroll listener: it costs nothing per
 * frame, and it disconnects after firing because a section that re-animates
 * every time you scroll past reads as a glitch.
 *
 * The animation itself is CSS in `styles/globals.css`, so
 * `prefers-reduced-motion` turns it off in one place — including the initial
 * `opacity: 0`, which would otherwise leave the page blank for anyone who has
 * motion disabled.
 */
export function Reveal({ as: Component = 'div', children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) {return;}

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.dataset.reveal = 'shown';

      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {return;}

        element.dataset.reveal = 'shown';
        observer.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.1 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <Component className={className} data-reveal="" ref={ref} style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}>
      {children}
    </Component>
  );
}
