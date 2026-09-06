import { act, createEvent, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { Fragment } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import userEvent from '@testing-library/user-event';

import { Carousel, CarouselIndicators, CarouselItem, CarouselNext, CarouselPrevious, CarouselViewport, useCarousel } from './index';

import type { CarouselProps } from './index';
import type { ReactNode } from 'react';

// ─── Fixtures ───────────────────────────────────────────────────────────────

interface FixtureProps extends Partial<Omit<CarouselProps, 'aria-label' | 'aria-labelledby' | 'children'>> {
  ariaLabel?: string;
  slides?: number;
}

function renderCarousel({ ariaLabel = 'Test carousel', slides = 3, ...rest }: FixtureProps = {}) {
  return render(
    <Carousel aria-label={ariaLabel} roleDescription="carousel" {...rest}>
      <CarouselViewport data-testid="viewport">
        {Array.from({ length: slides }, (_, index) => (
          <CarouselItem key={index} roleDescription="slide">
            Slide {index + 1}
          </CarouselItem>
        ))}
      </CarouselViewport>
      <CarouselPrevious aria-label="Previous slide" />
      <CarouselNext aria-label="Next slide" />
      <CarouselIndicators getIndicatorLabel={(index, total) => `Go to slide ${index + 1} of ${total}`} />
    </Carousel>
  );
}

interface HookFixtureProps {
  dragFree?: boolean;
  slides?: number;
  slidesToScroll?: number;
}

function renderUseCarousel({ dragFree, slides = 3, slidesToScroll }: HookFixtureProps = {}) {
  return renderHook(() => useCarousel(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Carousel aria-label="Hook" dragFree={dragFree} roleDescription="carousel" slidesToScroll={slidesToScroll}>
        <CarouselViewport>
          {Array.from({ length: slides }, (_, index) => (
            <CarouselItem key={index} roleDescription="slide">
              {index + 1}
            </CarouselItem>
          ))}
        </CarouselViewport>
        {children}
      </Carousel>
    )
  });
}

// jsdom's Event constructor sets `timeStamp` to wall-clock time. We override
// it post-construction via `defineProperty`; the component reads
// `event.nativeEvent.timeStamp` so the override survives the synthetic-event
// hop.
function fireTouch(element: Element, kind: 'touchend' | 'touchmove' | 'touchstart', x: number, y: number, timeStamp: number) {
  const touchObject = { clientX: x, clientY: y, identifier: 0 };
  const init = kind === 'touchend' ? { changedTouches: [touchObject] } : { touches: [touchObject] };
  const factory = kind === 'touchstart' ? createEvent.touchStart : kind === 'touchmove' ? createEvent.touchMove : createEvent.touchEnd;
  const event = factory(element, init);
  Object.defineProperty(event, 'timeStamp', { configurable: true, value: timeStamp });
  fireEvent(element, event);
}

function getDots() {
  return screen.getAllByRole('button', { name: /Go to slide/ });
}

function getViewport() {
  return screen.getByTestId('viewport');
}

function getPrev() {
  return screen.getByRole('button', { name: 'Previous slide' });
}

function getNext() {
  return screen.getByRole('button', { name: 'Next slide' });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Carousel', () => {
  describe('accessibility', () => {
    it('renders as a named landmark with carousel role description', () => {
      renderCarousel({ ariaLabel: 'Featured items' });
      const region = screen.getByRole('region', { name: 'Featured items' });
      expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    });

    it('marks every slide with role="group" and aria-roledescription="slide"', () => {
      renderCarousel({ slides: 4 });
      const slides = screen.getAllByRole('group');
      expect(slides).toHaveLength(4);
      slides.forEach(slide => {
        expect(slide).toHaveAttribute('aria-roledescription', 'slide');
      });
    });

    it('exposes a focusable viewport (tabIndex=0)', () => {
      renderCarousel();
      expect(getViewport()).toHaveAttribute('tabindex', '0');
    });

    it('labels Previous and Next with default aria-labels', () => {
      renderCarousel();
      expect(screen.queryByRole('button', { name: 'Previous slide' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Next slide' })).toBeInTheDocument();
    });

    it('disables Previous at the start of the carousel', () => {
      renderCarousel();
      expect(getPrev()).toBeDisabled();
      expect(getNext()).toBeEnabled();
    });

    it('marks the active indicator with aria-current="true"', () => {
      renderCarousel({ slides: 3 });
      const dots = getDots();
      expect(dots).toHaveLength(3);
      expect(dots[0]).toHaveAttribute('aria-current', 'true');
      expect(dots[1]).not.toHaveAttribute('aria-current');
      expect(dots[2]).not.toHaveAttribute('aria-current');
    });

    it('hides the indicators when there is only one slide', () => {
      renderCarousel({ slides: 1 });
      expect(screen.queryByRole('button', { name: /Go to slide/ })).not.toBeInTheDocument();
    });

    it('throws when useCarousel is called outside <Carousel>', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => useCarousel())).toThrow(/inside <Carousel>/);
      consoleError.mockRestore();
    });

    it('accepts aria-labelledby as an alternative to aria-label', () => {
      render(
        <Fragment>
          <h2 id="title">Featured</h2>
          <Carousel aria-labelledby="title" roleDescription="carousel">
            <CarouselViewport data-testid="viewport">
              <CarouselItem roleDescription="slide">1</CarouselItem>
            </CarouselViewport>
          </Carousel>
        </Fragment>
      );
      const region = screen.getByRole('region', { name: 'Featured' });
      expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    });

    it('accepts custom aria-labels on Previous and Next', () => {
      render(
        <Carousel aria-label="Test" roleDescription="carousel">
          <CarouselViewport data-testid="viewport">
            <CarouselItem roleDescription="slide">1</CarouselItem>
            <CarouselItem roleDescription="slide">2</CarouselItem>
          </CarouselViewport>
          <CarouselPrevious aria-label="Go back one item" />
          <CarouselNext aria-label="Go to next item" />
        </Carousel>
      );
      expect(screen.queryByRole('button', { name: 'Go back one item' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Go to next item' })).toBeInTheDocument();
    });
  });

  describe('button navigation', () => {
    it('Next advances and updates aria-current + Previous-enabled state', async () => {
      const user = userEvent.setup();
      renderCarousel();

      await user.click(getNext());

      const dots = getDots();
      expect(dots[1]).toHaveAttribute('aria-current', 'true');
      expect(dots[0]).not.toHaveAttribute('aria-current');
      expect(getPrev()).toBeEnabled();
    });

    it('Next disables itself once the last slide is reached', async () => {
      const user = userEvent.setup();
      renderCarousel({ slides: 3 });

      await user.click(getNext());
      await user.click(getNext());

      expect(getNext()).toBeDisabled();
      expect(getPrev()).toBeEnabled();
    });

    it('Previous returns to the start and disables itself', async () => {
      const user = userEvent.setup();
      renderCarousel();

      await user.click(getNext());
      await user.click(getPrev());

      expect(getDots()[0]).toHaveAttribute('aria-current', 'true');
      expect(getPrev()).toBeDisabled();
    });

    it('clicking an indicator jumps directly to that slide', async () => {
      const user = userEvent.setup();
      renderCarousel({ slides: 4 });

      const dots = getDots();
      await user.click(dots[3]);

      expect(dots[3]).toHaveAttribute('aria-current', 'true');
      expect(getNext()).toBeDisabled();
    });

    it('respects slidesToScroll — each click advances by N slides', async () => {
      const user = userEvent.setup();
      renderCarousel({ slides: 9, slidesToScroll: 3 });

      await user.click(getNext());

      expect(getDots()[3]).toHaveAttribute('aria-current', 'true');
    });

    it('calls Element.prototype.scrollTo with smooth behavior on each step', async () => {
      const scrollSpy = vi.spyOn(Element.prototype, 'scrollTo');
      const user = userEvent.setup();
      renderCarousel();

      await user.click(getNext());

      expect(scrollSpy).toHaveBeenCalled();
      expect(scrollSpy.mock.calls.at(-1)?.[0]).toMatchObject({ behavior: 'smooth' });
    });

    it('falls back to `behavior: "auto"` when prefers-reduced-motion is set (bypasses smooth scroll)', async () => {
      // `Element.scrollTo({ behavior: 'smooth' })` overrides the CSS `scroll-behavior: auto !important`
      // in our reduced-motion baseline (per WHATWG CSSOM View). The component reads `matchMedia`
      // and picks `'auto'` itself when the user opted out — verify that here.
      vi.stubGlobal('matchMedia', (query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn()
      }));

      const scrollSpy = vi.spyOn(Element.prototype, 'scrollTo');
      const user = userEvent.setup();
      renderCarousel();

      await user.click(getNext());

      expect(scrollSpy).toHaveBeenCalled();
      expect(scrollSpy.mock.calls.at(-1)?.[0]).toMatchObject({ behavior: 'auto' });
    });

    it('disables both navigation buttons when there are no slides', () => {
      render(
        <Carousel aria-label="Empty" roleDescription="carousel">
          <CarouselViewport data-testid="viewport" />
          <CarouselPrevious aria-label="Previous slide" />
          <CarouselNext aria-label="Next slide" />
        </Carousel>
      );
      expect(getPrev()).toBeDisabled();
      expect(getNext()).toBeDisabled();
    });
  });

  describe('keyboard navigation', () => {
    function focusViewport() {
      const viewport = getViewport();
      viewport.focus();

      return viewport;
    }

    it('ArrowRight advances to the next slide', async () => {
      const user = userEvent.setup();
      renderCarousel();

      focusViewport();
      await user.keyboard('{ArrowRight}');

      expect(getDots()[1]).toHaveAttribute('aria-current', 'true');
    });

    it('ArrowLeft goes back to the previous slide', async () => {
      const user = userEvent.setup();
      renderCarousel();

      focusViewport();
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowLeft}');

      expect(getDots()[1]).toHaveAttribute('aria-current', 'true');
    });

    it('Home jumps to the first slide and End to the last', async () => {
      const user = userEvent.setup();
      renderCarousel({ slides: 5 });

      focusViewport();
      await user.keyboard('{End}');
      expect(getDots()[4]).toHaveAttribute('aria-current', 'true');

      await user.keyboard('{Home}');
      expect(getDots()[0]).toHaveAttribute('aria-current', 'true');
    });

    it('ignores keys outside of the supported set', async () => {
      const user = userEvent.setup();
      renderCarousel();

      focusViewport();
      await user.keyboard('{Enter}{Space}{ArrowUp}{ArrowDown}');

      expect(getDots()[0]).toHaveAttribute('aria-current', 'true');
    });

    it('indicators support roving tabindex — arrow keys move focus between dots, Enter activates', async () => {
      const user = userEvent.setup();
      renderCarousel({ slides: 4 });

      const dots = getDots();
      dots[0].focus();
      expect(document.activeElement).toBe(dots[0]);

      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(dots[1]);

      await user.keyboard('{Enter}');
      expect(dots[1]).toHaveAttribute('aria-current', 'true');
    });
  });

  describe('touch gestures', () => {
    it('a fast left-flick advances by one slide', () => {
      renderCarousel();

      // dx=-100 over dt=100ms → velocity 1.0 px/ms (above 0.3 threshold) → scrollNext
      fireTouch(getViewport(), 'touchstart', 200, 100, 0);
      fireTouch(getViewport(), 'touchmove', 100, 100, 100);
      fireTouch(getViewport(), 'touchend', 100, 100, 100);

      expect(getDots()[1]).toHaveAttribute('aria-current', 'true');
    });

    it('a fast right-flick goes back one slide', async () => {
      const user = userEvent.setup();
      renderCarousel({ slides: 3 });

      await user.click(getNext());
      await user.click(getNext());

      // dx=+100 over dt=100ms → velocity 1.0 px/ms → scrollPrev
      fireTouch(getViewport(), 'touchstart', 100, 100, 0);
      fireTouch(getViewport(), 'touchmove', 200, 100, 100);
      fireTouch(getViewport(), 'touchend', 200, 100, 100);

      expect(getDots()[1]).toHaveAttribute('aria-current', 'true');
    });

    it('ignores a slow drag (velocity below threshold)', () => {
      renderCarousel();

      // dx=-100 over dt=1000ms → velocity 0.1 px/ms (below 0.3) → no override
      fireTouch(getViewport(), 'touchstart', 200, 100, 0);
      fireTouch(getViewport(), 'touchmove', 100, 100, 1000);
      fireTouch(getViewport(), 'touchend', 100, 100, 1000);

      expect(getDots()[0]).toHaveAttribute('aria-current', 'true');
    });

    it('ignores a short flick (< 20px) as micro-jitter', () => {
      renderCarousel();

      // dx=-15 — fast (0.75 px/ms) but below the 20px distance threshold
      fireTouch(getViewport(), 'touchstart', 200, 100, 0);
      fireTouch(getViewport(), 'touchmove', 185, 100, 20);
      fireTouch(getViewport(), 'touchend', 185, 100, 20);

      expect(getDots()[0]).toHaveAttribute('aria-current', 'true');
    });

    it('ignores a vertical-dominant gesture (page scroll, not carousel)', () => {
      renderCarousel();

      // |dy|=200 > |dx|=30 → vertical-dominant → no override
      fireTouch(getViewport(), 'touchstart', 200, 100, 0);
      fireTouch(getViewport(), 'touchmove', 170, 300, 100);
      fireTouch(getViewport(), 'touchend', 170, 300, 100);

      expect(getDots()[0]).toHaveAttribute('aria-current', 'true');
    });

    it('dragFree disables the velocity-based override', () => {
      renderCarousel({ dragFree: true });

      // Identical to the fast-left-flick fixture; dragFree should suppress scrollNext.
      fireTouch(getViewport(), 'touchstart', 200, 100, 0);
      fireTouch(getViewport(), 'touchmove', 100, 100, 100);
      fireTouch(getViewport(), 'touchend', 100, 100, 100);

      expect(getDots()[0]).toHaveAttribute('aria-current', 'true');
    });

    it('dragFree applies the .dragFree CSS class to the viewport', () => {
      // vitest.config.ts sets `css.modules.classNameStrategy: 'non-scoped'`, so
      // CSS module classes resolve to their literal names in tests (`dragFree`
      // here, not a hashed identifier). If that config changes, this assertion
      // would need to match the new strategy.
      renderCarousel({ dragFree: true });
      expect(getViewport()).toHaveClass('dragFree');
    });
  });

  describe('useCarousel hook', () => {
    it('coerces slidesToScroll to a positive integer', () => {
      const { result } = renderUseCarousel({ slidesToScroll: 2.7 });
      expect(result.current.slidesToScroll).toBe(2);
    });

    it('reflects dragFree from the root', () => {
      const { result } = renderUseCarousel({ dragFree: true });
      expect(result.current.dragFree).toBe(true);
    });

    it('reports canScrollPrev/canScrollNext at the boundary', () => {
      const { result } = renderUseCarousel();
      expect(result.current.canScrollPrev).toBe(false);
      expect(result.current.canScrollNext).toBe(true);
    });

    it('exposes callable actions that update currentIndex', () => {
      const { result } = renderUseCarousel({ slides: 4 });

      expect(result.current.currentIndex).toBe(0);

      act(() => result.current.scrollNext());
      expect(result.current.currentIndex).toBe(1);

      act(() => result.current.scrollToIndex(3));
      expect(result.current.currentIndex).toBe(3);
      expect(result.current.canScrollNext).toBe(false);

      act(() => result.current.scrollPrev());
      expect(result.current.currentIndex).toBe(2);
    });
  });
});
