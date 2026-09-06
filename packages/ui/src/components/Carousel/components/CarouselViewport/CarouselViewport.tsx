'use client';
import { useEffect, useRef } from 'react';

import styles from './CarouselViewport.module.css';

import { useCarousel } from '../../Carousel';

import type { HTMLAttributes, KeyboardEvent, TouchEvent } from 'react';

export interface CarouselViewportProps extends HTMLAttributes<HTMLDivElement> {}

// Tuned to feel like iOS UIScrollView paging: a deliberate flick lands ~0.4–0.8 px/ms.
// Below 0.3, the gesture reads as a casual drag — let native scroll-snap settle it by position.
const SWIPE_VELOCITY_THRESHOLD = 0.3;

// Discard taps and micro-jitters; require a real horizontal commitment before we override.
const SWIPE_DISTANCE_THRESHOLD = 20;

export function CarouselViewport({ children, className, ...rest }: CarouselViewportProps) {
  const { dragFree, programmaticTargetRef, scrollNext, scrollPrev, scrollToIndex, setCurrentIndex, setSlideCount, slideCount, viewportRef } =
    useCarousel();

  const touchLastTimeRef = useRef(0);
  const touchLastXRef = useRef(0);
  const touchLastYRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  useEffect(() => {
    if (!viewportRef.current) {
      return;
    }

    // Bound to a const (not narrowed from a `| null` check) so the hoisted function
    // declarations below can capture it without tripping strict-null analysis.
    const viewport = viewportRef.current;

    function refreshCount() {
      setSlideCount(viewport.children.length);
    }

    refreshCount();

    const intersection = new IntersectionObserver(
      entries => {
        const mostVisible = entries
          .filter(entry => entry.isIntersecting)
          .sort((entryA, entryB) => entryB.intersectionRatio - entryA.intersectionRatio)[0];

        if (!mostVisible) {
          return;
        }

        const index = Array.prototype.indexOf.call(viewport.children, mostVisible.target);

        if (index < 0) {
          return;
        }

        // While a programmatic scroll is animating, intermediate slides cross
        // the 50% threshold and would clobber the target index — ignore them
        // and only accept the IO update once we've reached the target.
        const target = programmaticTargetRef.current;

        if (target !== null && target !== index) {
          return;
        }

        if (target === index) {
          programmaticTargetRef.current = null;
        }

        setCurrentIndex(index);
      },
      { root: viewport, threshold: 0.5 }
    );

    function observeChildren() {
      intersection.disconnect();
      Array.prototype.forEach.call(viewport.children, (child: Element) => intersection.observe(child));
    }

    observeChildren();

    const mutation = new MutationObserver(() => {
      refreshCount();
      observeChildren();
    });
    mutation.observe(viewport, { childList: true });

    // Safety net: if the IO never reports the target as most-visible (e.g. the
    // user interrupted with a manual swipe mid-animation), clear the ref when
    // the scroll finally settles so future native scrolls aren't gated.
    function handleScrollEnd() {
      programmaticTargetRef.current = null;
    }

    viewport.addEventListener('scrollend', handleScrollEnd);

    return () => {
      intersection.disconnect();
      mutation.disconnect();
      viewport.removeEventListener('scrollend', handleScrollEnd);
    };
  }, [programmaticTargetRef, setCurrentIndex, setSlideCount, viewportRef]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollNext();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollPrev();
    } else if (event.key === 'Home') {
      event.preventDefault();
      scrollToIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      scrollToIndex(slideCount - 1);
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchStartTimeRef.current = event.nativeEvent.timeStamp;
    touchLastXRef.current = touch.clientX;
    touchLastYRef.current = touch.clientY;
    touchLastTimeRef.current = event.nativeEvent.timeStamp;
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    touchLastXRef.current = touch.clientX;
    touchLastYRef.current = touch.clientY;
    touchLastTimeRef.current = event.nativeEvent.timeStamp;
  };

  const handleTouchEnd = () => {
    // In dragFree mode, never override the natural scroll — the whole point
    // is that swipes / flicks land wherever momentum carries them.
    if (dragFree) {
      return;
    }

    const dx = touchLastXRef.current - touchStartXRef.current;
    const dy = touchLastYRef.current - touchStartYRef.current;
    const dt = touchLastTimeRef.current - touchStartTimeRef.current;

    if (dt === 0) {
      return;
    }

    if (Math.abs(dy) > Math.abs(dx)) {
      return;
    }

    if (Math.abs(dx) < SWIPE_DISTANCE_THRESHOLD) {
      return;
    }

    const velocity = Math.abs(dx) / dt;

    if (velocity < SWIPE_VELOCITY_THRESHOLD) {
      return;
    }

    if (dx < 0) {
      scrollNext();
    } else {
      scrollPrev();
    }
  };

  const classes = [styles.viewport, dragFree && styles.dragFree, className].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      onKeyDown={handleKeyDown}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      ref={viewportRef}
      tabIndex={0}
      {...rest}
    >
      {children}
    </div>
  );
}
