import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement IntersectionObserver. Components that observe slides
// (currently CarouselViewport) construct one in useEffect — without a mock,
// rendering crashes. The mock is a no-op: tests that need to assert
// intersection-driven state changes drive that state directly.
class MockIntersectionObserver implements IntersectionObserver {
  root: Element | Document | null = null;
  rootMargin = '';
  scrollMargin = '';
  thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn<() => IntersectionObserverEntry[]>(() => []);

  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    // signature only — behaviour stubbed
  }
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// jsdom doesn't implement ResizeObserver. Radix primitives that measure size
// (Slider, Select, Dialog content) construct one in useEffect — without a mock,
// rendering crashes during mount.
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);

// jsdom doesn't implement matchMedia. vaul (Drawer / Sidebar) reads it on mount
// to detect reduced motion — without a stub, the effect throws.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => false)
}));

// jsdom doesn't implement the Pointer Events capture API. Radix Select calls
// hasPointerCapture / setPointerCapture / releasePointerCapture during open
// interactions — stub them as no-ops so the interaction completes.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
}

// jsdom doesn't implement scrollIntoView. Radix Select calls it on the
// highlighted item when opening — stub as a no-op.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

// jsdom defines Element.prototype.scrollTo but the implementation does nothing.
// Replace it with a vi.fn() so tests can assert calls.
Element.prototype.scrollTo = vi.fn();

// jsdom doesn't ship TouchEvent. Without it, RTL's fireEvent.touch* falls back
// to a generic UIEvent that React 19's synthetic event dispatch silently
// ignores for `onTouchMove`. A minimal polyfill — enough to satisfy React's
// instanceof check and carry the touches list / timeStamp our handlers read —
// fixes touch event delivery.
interface TouchEventInitLike {
  bubbles?: boolean;
  cancelable?: boolean;
  changedTouches?: Touch[];
  targetTouches?: Touch[];
  touches?: Touch[];
}

class MockTouchEvent extends UIEvent {
  readonly altKey = false;
  readonly changedTouches: ReadonlyArray<Touch>;
  readonly ctrlKey = false;
  readonly metaKey = false;
  readonly shiftKey = false;
  readonly targetTouches: ReadonlyArray<Touch>;
  readonly touches: ReadonlyArray<Touch>;

  constructor(type: string, init: TouchEventInitLike = {}) {
    super(type, { bubbles: init.bubbles, cancelable: init.cancelable });
    this.touches = init.touches ?? [];
    this.changedTouches = init.changedTouches ?? [];
    this.targetTouches = init.targetTouches ?? init.touches ?? [];
  }
}

vi.stubGlobal('TouchEvent', MockTouchEvent);

// Reset DOM and mocks between tests so spies / state don't bleed across cases.
//
// ⚠️ The re-stub block below is LOAD-BEARING — don't simplify it away. Here's why:
//
//   `vi.unstubAllGlobals()` removes every stub set with `vi.stubGlobal(...)` since the
//   start of the test. That includes the file-level stubs at the top of this file —
//   IntersectionObserver, ResizeObserver, TouchEvent, matchMedia — which jsdom doesn't
//   ship at all. Without the re-stub, the *next* test in the file would crash the
//   moment a component touches one of those globals (e.g. Carousel constructing an
//   IntersectionObserver on mount).
//
// `Element.prototype.scrollTo` is restored too: `vi.restoreAllMocks()` resets it to
// the jsdom default (which is a no-op stub) — fine, but we re-stub with `vi.fn()` so
// component tests can spy on smooth-scroll calls (Carousel tests rely on this).
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.stubGlobal('TouchEvent', MockTouchEvent);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false)
  }));
  Element.prototype.scrollTo = vi.fn();
});
