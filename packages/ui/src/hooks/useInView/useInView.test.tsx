import { act, render } from '@testing-library/react';
import { Fragment } from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InView } from 'ui/components/InView';

import type { ReactNode } from 'react';

/** The page's one observer, captured so a test can say "now it is in view". */
let fire: IntersectionObserverCallback | null = null;
const observed = new Set<Element>();

class CapturingObserver {
  constructor(callback: IntersectionObserverCallback) {
    fire = callback;
  }

  observe = (element: Element) => observed.add(element);
  unobserve = (element: Element) => observed.delete(element);
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: reduce && query.includes('reduce'),
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn()
  }));
}

function load() {
  vi.stubGlobal('IntersectionObserver', CapturingObserver);

  return InView;
}

function below(top: number) {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
}

beforeEach(() => {
  fire = null;
  observed.clear();
  setReducedMotion(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderInView(children: ReactNode = 'figure') {
  const Wrapper = load();

  return render(<Wrapper data-testid="wrap">{children}</Wrapper>);
}

describe('useInView (through InView)', () => {
  it('leaves an element that is already on screen alone: it is never armed', async () => {
    below(10);
    const { getByTestId } = await renderInView();
    expect(getByTestId('wrap')).not.toHaveAttribute('data-in-view');
    expect(observed.size).toBe(0);
  });

  it('arms an element below the fold and plays it once it is reached', async () => {
    below(window.innerHeight + 300);
    const { getByTestId } = await renderInView();
    const element = getByTestId('wrap');
    expect(element).toHaveAttribute('data-in-view', 'waiting');
    expect(observed.has(element)).toBe(true);

    act(() => {
      fire?.([{ isIntersecting: true, target: element } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(element).toHaveAttribute('data-in-view', 'shown');
    // Once: it is no longer watched.
    expect(observed.has(element)).toBe(false);
  });

  it('arms nothing under reduced motion, so the final state is what shows', async () => {
    setReducedMotion(true);
    below(window.innerHeight + 300);
    const { getByTestId } = await renderInView();
    expect(getByTestId('wrap')).not.toHaveAttribute('data-in-view');
  });

  it('keeps its content in the document while it waits, for assistive technology', async () => {
    below(window.innerHeight + 300);
    const { getByText } = await renderInView(<span>1880 de 2246 kcal</span>);
    expect(getByText('1880 de 2246 kcal')).toBeInTheDocument();
  });

  it('shares one observer between every element', async () => {
    below(window.innerHeight + 300);
    load();
    let built = 0;
    vi.stubGlobal(
      'IntersectionObserver',
      class extends CapturingObserver {
        constructor(callback: IntersectionObserverCallback) {
          super(callback);
          built++;
        }
      }
    );
    render(
      <Fragment>
        <InView>one</InView>
        <InView>two</InView>
        <InView>three</InView>
      </Fragment>
    );
    expect(built).toBe(1);
    expect(observed.size).toBe(3);
  });
});
