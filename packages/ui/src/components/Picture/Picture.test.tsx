import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import { Picture } from './Picture';

describe('Picture', () => {
  it('renders a named image, lazy and decoded off the main thread by default', () => {
    render(<Picture alt="Lentejas" height={720} src="/a.webp" width={960} />);
    const image = screen.getByRole('img', { name: 'Lentejas' });

    expect(image.tagName).toBe('IMG');
    expect(image).toHaveAttribute('src', '/a.webp');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image).toHaveAttribute('width', '960');
    expect(image).toHaveAttribute('height', '720');
  });

  it('lets the caller load one eagerly', () => {
    render(<Picture alt="Lentejas" fetchPriority="high" loading="eager" src="/a.webp" />);
    const image = screen.getByRole('img', { name: 'Lentejas' });

    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
  });

  it('puts className and the ratio on the frame, and the ref on the image', () => {
    const ref = createRef<HTMLImageElement>();

    render(<Picture alt="Lentejas" className="extra" ratio="1/1" ref={ref} src="/a.webp" />);
    const image = screen.getByRole('img', { name: 'Lentejas' });
    const frame = image.parentElement;

    expect(frame).toHaveClass('frame');
    expect(frame).toHaveClass('extra');
    expect(frame).toHaveAttribute('data-ratio', '1/1');
    expect(ref.current).toBe(image);
  });

  it('defaults to a 4:3 frame', () => {
    render(<Picture alt="Lentejas" src="/a.webp" />);

    expect(screen.getByRole('img', { name: 'Lentejas' }).parentElement).toHaveAttribute('data-ratio', '4/3');
  });

  it('keeps an empty alt decorative', () => {
    render(<Picture alt="" src="/a.webp" />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('presentation')).toHaveAttribute('alt', '');
  });

  it('with no src, draws the fallback in the same frame and hides it when unnamed', () => {
    const { container } = render(<Picture fallback={<svg data-testid="glyph" />} src={null} />);
    const frame = container.firstElementChild;

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('glyph')).toBeInTheDocument();
    expect(frame).toHaveClass('frame');
    expect(frame).toHaveAttribute('aria-hidden', 'true');
  });

  it('on error, swaps the image for the fallback — no broken icon — and hides the placeholder', () => {
    const onError = vi.fn();
    const { container } = render(<Picture alt="Lentejas" fallback={<svg data-testid="glyph" />} onError={onError} src="/missing.webp" />);

    fireEvent.error(screen.getByRole('img', { name: 'Lentejas' }));

    const frame = container.firstElementChild;

    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(frame).toHaveAttribute('data-failed', 'true');
    expect(frame).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('glyph')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('gives a new src its own chance after a failure', () => {
    const { rerender } = render(<Picture alt="Lentejas" src="/missing.webp" />);

    fireEvent.error(screen.getByRole('img', { name: 'Lentejas' }));
    rerender(<Picture alt="Lentejas" src="/b.webp" />);

    expect(screen.getByRole('img', { name: 'Lentejas' }).tagName).toBe('IMG');
  });

  it('notices an image that failed before it mounted', () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    const naturalWidth = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);

    const { container } = render(<Picture alt="Lentejas" src="/missing.webp" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('data-failed', 'true');

    complete.mockRestore();
    naturalWidth.mockRestore();
  });

  it('leaves an image alone while it is still loading', () => {
    render(<Picture alt="Lentejas" src="/a.webp" />);

    expect(screen.getByRole('img', { name: 'Lentejas' }).tagName).toBe('IMG');
  });
});
