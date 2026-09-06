'use client';
import styles from './CarouselPrevious.module.css';

import { useCarousel } from '../../Carousel';

import type { ComponentPropsWithRef } from 'react';

export interface CarouselPreviousProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label'> {
  /** **Required.** Accessible name for the icon-only button. Localize in non-English apps. */
  'aria-label': string;
}

export function CarouselPrevious({ 'aria-label': ariaLabel, className, ref, ...rest }: CarouselPreviousProps) {
  const { canScrollPrev, scrollPrev } = useCarousel();

  return (
    <button
      aria-label={ariaLabel}
      className={className ? `${styles.button} ${className}` : styles.button}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      ref={ref}
      type="button"
      {...rest}
    >
      <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
        <path d="M10 4L6 8L10 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </button>
  );
}
