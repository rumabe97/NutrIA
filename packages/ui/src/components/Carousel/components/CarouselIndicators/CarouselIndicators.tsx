'use client';
import styles from './CarouselIndicators.module.css';

import { RovingFocusGroup, RovingFocusGroupItem } from 'ui/components/RovingFocusGroup';

import { useCarousel } from '../../Carousel';

import type { HTMLAttributes } from 'react';

export interface CarouselIndicatorsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'dir'> {
  /** **Required.** Localized name builder for each indicator (e.g. `` (index, total) => `Slide ${index + 1} of ${total}` ``). */
  getIndicatorLabel: (index: number, total: number) => string;
}

export function CarouselIndicators({ className, getIndicatorLabel, ...rest }: CarouselIndicatorsProps) {
  const { currentIndex, scrollToIndex, slideCount } = useCarousel();

  if (slideCount <= 1) {
    return null;
  }

  return (
    <RovingFocusGroup className={className ? `${styles.indicators} ${className}` : styles.indicators} orientation="horizontal" {...rest}>
      {Array.from({ length: slideCount }, (_, index) => {
        const isActive = index === currentIndex;

        return (
          <RovingFocusGroupItem active={isActive} asChild={true} key={index}>
            <button
              aria-current={isActive ? 'true' : undefined}
              aria-label={getIndicatorLabel(index, slideCount)}
              className={isActive ? `${styles.dot} ${styles.active}` : styles.dot}
              onClick={() => scrollToIndex(index)}
              type="button"
            />
          </RovingFocusGroupItem>
        );
      })}
    </RovingFocusGroup>
  );
}
