'use client';
import { useEffect, useRef } from 'react';

import { composeRefs } from 'ui/utils/composeRefs';

import { slottableWithNestedChildren } from '../../utils/slottableWithNestedChildren';
import { useCommand } from '../../hooks/useCommand';
import { useSpotlight } from '../../hooks/useSpotlight';

import type { ListProps } from '../../types';

/**
 * Contains `Item`, `Group`, and `Separator`. Sets a `--spotlight-list-height` CSS variable based on
 * its content so consumers can animate height with a CSS transition. `label` is required and
 * provides the listbox's accessible name — pass the localized string for your app.
 */
export function SpotlightList({ label, ref: forwardedRef, ...etc }: ListProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const heightRef = useRef<HTMLDivElement | null>(null);
  const selectedItemId = useSpotlight(state => state.selectedItemId);
  const context = useCommand();

  useEffect(() => {
    if (!heightRef.current || !ref.current) {
      return undefined;
    }

    const el = heightRef.current;
    const wrapper = ref.current;
    let animationFrame = 0;
    const observer = new ResizeObserver(() => {
      animationFrame = requestAnimationFrame(() => {
        wrapper.style.setProperty('--spotlight-list-height', `${el.offsetHeight.toFixed(1)}px`);
      });
    });
    observer.observe(el);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.unobserve(el);
    };
  }, []);

  return (
    <div
      ref={composeRefs(ref, forwardedRef)}
      {...etc}
      aria-activedescendant={selectedItemId}
      aria-label={label}
      aria-live="polite"
      data-spotlight-list=""
      id={context.listId}
      role="listbox"
      tabIndex={-1}
    >
      {slottableWithNestedChildren(etc, child => (
        <div data-spotlight-list-sizer="" ref={composeRefs(heightRef, context.listInnerRef)}>
          {child}
        </div>
      ))}
    </div>
  );
}
