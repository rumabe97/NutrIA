'use client';
import { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';

import styles from './Carousel.module.css';

import type { AccessibleName } from 'ui/types/AccessibleName.types';
import type { ComponentPropsWithRef, ReactNode, RefObject } from 'react';

interface CarouselContextValue {
  canScrollNext: boolean;
  canScrollPrev: boolean;
  currentIndex: number;
  dragFree: boolean;
  // The slide we're animating toward during a programmatic scroll. Set by
  // scrollToIndex, cleared once the IO reports the target as most-visible (or
  // on scrollend). CarouselViewport reads it to ignore intermediate slides
  // that cross the IO threshold mid-animation during fast multi-clicks.
  programmaticTargetRef: RefObject<number | null>;
  rootId: string;
  scrollNext: () => void;
  scrollPrev: () => void;
  scrollToIndex: (index: number) => void;
  setCurrentIndex: (index: number) => void;
  setSlideCount: (count: number) => void;
  slideCount: number;
  slidesToScroll: number;
  viewportRef: RefObject<HTMLDivElement | null>;
}

const CarouselContext = createContext<CarouselContextValue | null>(null);

export function useCarousel(): CarouselContextValue {
  const ctx = useContext(CarouselContext);

  if (!ctx) {
    throw new Error('Carousel sub-components must be rendered inside <Carousel>.');
  }

  return ctx;
}

type CarouselOwnProps = {
  children: ReactNode;
  /** Allow free dragging between slides (instead of snapping). */
  dragFree?: boolean;
  /** **Required.** Localized role description (e.g. `'carousel'` / `'carrusel'`). Replaces the generic "region" wording. */
  roleDescription: string;
  /** Slides advanced per Next/Previous step. Defaults to 1. */
  slidesToScroll?: number;
};

export type CarouselProps = Omit<ComponentPropsWithRef<'div'>, 'aria-label' | 'aria-labelledby'> & CarouselOwnProps & AccessibleName;

export function Carousel({ children, className, dragFree = false, ref, roleDescription, slidesToScroll = 1, ...rest }: CarouselProps) {
  const rootId = useId();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const programmaticTargetRef = useRef<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideCount, setSlideCount] = useState(0);

  const step = Math.max(1, Math.floor(slidesToScroll));

  const scrollToIndex = useCallback((index: number) => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const slide = viewport.children[index] as HTMLElement | undefined;

    if (!slide) {
      return;
    }

    programmaticTargetRef.current = index;
    setCurrentIndex(index);

    // Reduced-motion guard. Per the WHATWG CSSOM View spec, `Element.scrollTo({ behavior:
    // 'smooth' })` overrides the CSS `scroll-behavior` property — so our blanket
    // `scroll-behavior: auto !important` in `ui/styles/base.css` does NOT prevent the
    // smooth scroll here. We have to check `prefers-reduced-motion` ourselves and pick
    // `behavior: 'auto'` (which defers to CSS, i.e. instant for reduced-motion users)
    // when set. Without this check, vestibular-disorder users who opted out of motion
    // still get the smooth animation.
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({ behavior: prefersReducedMotion ? 'auto' : 'smooth', left: slide.offsetLeft });
  }, []);

  const scrollNext = useCallback(() => {
    scrollToIndex(Math.min(currentIndex + step, slideCount - 1));
  }, [currentIndex, scrollToIndex, slideCount, step]);

  const scrollPrev = useCallback(() => {
    scrollToIndex(Math.max(currentIndex - step, 0));
  }, [currentIndex, scrollToIndex, step]);

  const value = useMemo<CarouselContextValue>(
    () => ({
      canScrollNext: currentIndex < slideCount - 1,
      canScrollPrev: currentIndex > 0,
      currentIndex,
      dragFree,
      programmaticTargetRef,
      rootId,
      scrollNext,
      scrollPrev,
      scrollToIndex,
      setCurrentIndex,
      setSlideCount,
      slideCount,
      slidesToScroll: step,
      viewportRef
    }),
    [currentIndex, dragFree, rootId, scrollNext, scrollPrev, scrollToIndex, slideCount, step]
  );

  return (
    <CarouselContext.Provider value={value}>
      <div
        aria-roledescription={roleDescription}
        className={className ? `${styles.root} ${className}` : styles.root}
        ref={ref}
        role="region"
        {...rest}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}
