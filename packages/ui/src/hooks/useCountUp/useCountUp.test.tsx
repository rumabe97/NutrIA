import { render, renderHook, screen, waitFor } from '@testing-library/react';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CountUp } from 'ui/components/CountUp';

import { useCountUp } from './useCountUp';

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

/** A visible figure as `CountUp` draws it: a span holding the text React wrote. */
function figure(text: string) {
  const element = document.createElement('span');

  element.textContent = text;
  document.body.append(element);

  return { current: element };
}

/** Every text the figure showed, frame by frame. */
function watch(element: Element) {
  const shown: string[] = [];
  const observer = new MutationObserver(() => shown.push(element.textContent ?? ''));

  observer.observe(element, { characterData: true, subtree: true });

  return shown;
}

afterEach(() => {
  setReducedMotion(false);
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('useCountUp', () => {
  it('returns the final value, always: React only ever draws the real figure', () => {
    const ref = figure('1880');
    const { result } = renderHook(() => useCountUp(1880, ref, String));

    expect(result.current).toBe(1880);
  });

  it('counts the visible figure up and ends on exactly the text React drew', async () => {
    const ref = figure('100 g');
    const shown = watch(ref.current);

    renderHook(() => useCountUp(100, ref, value => `${Math.round(value)} g`));
    await waitFor(() => expect(shown.at(-1)).toBe('100 g'), { timeout: 2000 });
    // It went through smaller numbers on the way: it counted rather than jumped.
    expect(shown[0]).toBe('0 g');
    expect(shown.length).toBeGreaterThan(2);
  });

  it('writes nothing under reduced motion: the final value is what shows', async () => {
    setReducedMotion(true);
    const ref = figure('42');
    const shown = watch(ref.current);

    renderHook(() => useCountUp(42, ref, String));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(shown).toEqual([]);
    expect(ref.current.textContent).toBe('42');
  });

  it('keeps a figure below the fold final until it is reached', async () => {
    const ref = figure('7');

    vi.spyOn(ref.current, 'getBoundingClientRect').mockReturnValue({ top: window.innerHeight + 400 } as DOMRect);
    const shown = watch(ref.current);

    renderHook(() => useCountUp(7, ref, String));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(shown).toEqual([]);
    expect(ref.current.textContent).toBe('7');
  });
});

describe('CountUp', () => {
  it('gives assistive technology the final text at once, and hides the counting figure from it', () => {
    const { container } = render(<CountUp format={{ maximumFractionDigits: 0 }} locale="es-ES" text="2.246 kcal" value={2246} />);

    expect(screen.getByText('2.246 kcal', { selector: '.visually-hidden' })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it('formats the value itself when no text is given', () => {
    setReducedMotion(true);
    render(<CountUp locale="en-GB" value={1204} />);
    expect(screen.getByText('1,204', { selector: '.visually-hidden' })).toBeInTheDocument();
  });
});
