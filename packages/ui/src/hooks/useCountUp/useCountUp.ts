'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { isBelowFold, observeInView } from 'ui/utils/observeInView';
import { prefersReducedMotion } from 'ui/utils/prefersReducedMotion';

import type { RefObject } from 'react';

/** What the token `--duration-enter-long` holds; read from the page when it can be. */
const FALLBACK_DURATION_MS = 600;

/**
 * A figure the server painted and the reader may already have read. When the page wakes up later
 * than this, counting it up from zero would take a number away to give it back: it stays.
 */
const HYDRATION_GRACE_MS = 600;

function noSubscription(): () => void {
  return () => {};
}

function onClient(): boolean {
  return false;
}

function duringHydration(): boolean {
  return true;
}

function durationMs(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--duration-enter-long').trim();
  const parsed = raw.endsWith('ms') ? Number.parseFloat(raw) : raw.endsWith('s') ? Number.parseFloat(raw) * 1000 : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_DURATION_MS;
}

/** The gentle spring's shape, near enough for a number: fast out, soft landing, no overshoot. */
function ease(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/**
 * The number beside a figure, counting up to its value (`ui/styles/motion`, figures).
 *
 * Returns the value to render, which is **always the final one**: on the server, on the first
 * render, under reduced motion, and while the element is below the fold. React only ever writes
 * the real figure, so the markup, a reader without script and assistive technology have it at
 * once. The counting is written straight into the text of `ref` — the visible figure, which the
 * caller hides from assistive technology and doubles with the final value for it
 * (`ui/components/CountUp` does both) — frame by frame, without a render, from the previous
 * value (zero the first time) over `--duration-enter-long`, and it ends on exactly the text React
 * drew. A figure below the fold counts when it is reached, once.
 *
 * `format` writes a number the way the figure is written ("1,82 $").
 *
 * A figure the server painted is left alone when the page hydrates after the reader could have
 * read it: counting it back from zero would be a flash, not an entrance. A value that changes
 * after that — a meal marked done moving Inicio's figures — counts from the one before.
 */
export function useCountUp<T extends Element>(value: number, ref: RefObject<T | null>, format: (shown: number) => string): number {
  const hydrating = useSyncExternalStore(noSubscription, onClient, duringHydration);
  const [wasHydrated] = useState(hydrating);
  const from = useRef(0);
  // Only the figure as it first arrives can be one the reader has already read; a value that
  // changes afterwards (a meal marked done) is new, and counts.
  const first = useRef(true);
  const write = useRef(format);

  useEffect(() => {
    write.current = format;
  });

  useEffect(() => {
    const element = ref.current;
    const text = element?.firstChild;
    const start = from.current;
    const arriving = first.current;

    first.current = false;

    if (!element || text?.nodeType !== Node.TEXT_NODE || prefersReducedMotion() || start === value) {
      from.current = value;

      return;
    }

    const below = isBelowFold(element);

    if (arriving && wasHydrated && !below && performance.now() > HYDRATION_GRACE_MS) {
      from.current = value;

      return;
    }

    // What React drew: the figure ends on exactly these characters.
    const final = text.nodeValue;
    let frame = 0;
    let written: string | null = null;

    const draw = (shown: string | null) => {
      written = shown;
      text.nodeValue = shown;
    };

    const run = () => {
      const duration = durationMs();
      let began: number | null = null;

      const step = (now: number) => {
        began ??= now;
        const progress = Math.min(1, (now - began) / duration);

        if (progress >= 1) {
          draw(final);
          from.current = value;

          return;
        }

        draw(write.current(start + (value - start) * ease(progress)));
        frame = requestAnimationFrame(step);
      };

      draw(write.current(start));
      frame = requestAnimationFrame(step);
    };

    let stop = () => {};

    if (below && typeof IntersectionObserver !== 'undefined') {
      try {
        stop = observeInView(element, run);
      } catch {
        from.current = value;
      }
    } else {
      run();
    }

    return () => {
      stop();
      cancelAnimationFrame(frame);

      // Stopped half-way and React has not written since: put its figure back. When React has
      // (a new value), its text is the truth and stays.
      if (written !== null && text.nodeValue === written) {
        text.nodeValue = final;
      }
    };
  }, [ref, value, wasHydrated]);

  return value;
}
