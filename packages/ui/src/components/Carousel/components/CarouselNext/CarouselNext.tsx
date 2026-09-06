'use client';
import styles from './CarouselNext.module.css';

import { useCarousel } from '../../Carousel';

import type { ComponentPropsWithRef } from 'react';

export interface CarouselNextProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label'> {
  /** **Required.** Accessible name for the icon-only button. Localize in non-English apps. */
  'aria-label': string;
}

export function CarouselNext({ 'aria-label': ariaLabel, className, ref, ...rest }: CarouselNextProps) {
  const { canScrollNext, scrollNext } = useCarousel();

  return (
    <button
      aria-label={ariaLabel}
      className={className ? `${styles.button} ${className}` : styles.button}
      disabled={!canScrollNext}
      onClick={scrollNext}
      ref={ref}
      type="button"
      {...rest}
    >
      <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
        <path d="M6 4L10 8L6 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </button>
  );
}
