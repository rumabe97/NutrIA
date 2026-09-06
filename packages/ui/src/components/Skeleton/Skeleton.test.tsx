import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders a span with the skeleton base class', () => {
    render(<Skeleton data-testid="s" />);
    const el = screen.getByTestId('s');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveClass('skeleton');
  });

  it('signals loading state via aria-busy', () => {
    render(<Skeleton data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveAttribute('aria-busy', 'true');
  });

  describe('animation', () => {
    it('applies the shimmer animation class by default', () => {
      render(<Skeleton data-testid="s" />);
      expect(screen.getByTestId('s')).toHaveClass('shimmer');
    });

    it('animation="pulse" applies the pulse class', () => {
      render(<Skeleton animation="pulse" data-testid="s" />);
      const el = screen.getByTestId('s');
      expect(el).toHaveClass('pulse');
      expect(el).not.toHaveClass('shimmer');
    });

    it('animation="wave" applies the wave class', () => {
      render(<Skeleton animation="wave" data-testid="s" />);
      const el = screen.getByTestId('s');
      expect(el).toHaveClass('wave');
      expect(el).not.toHaveClass('shimmer');
    });

    it('animation="none" drops every animation class', () => {
      render(<Skeleton animation="none" data-testid="s" />);
      const el = screen.getByTestId('s');
      expect(el).not.toHaveClass('shimmer');
      expect(el).not.toHaveClass('pulse');
      expect(el).not.toHaveClass('wave');
    });
  });

  describe('sizing', () => {
    it('applies width / height inline when no children are passed', () => {
      render(<Skeleton data-testid="s" height="24px" width="200px" />);
      expect(screen.getByTestId('s')).toHaveStyle({ height: '24px', width: '200px' });
    });

    it('ignores width / height when children are passed (children dictate the size)', () => {
      render(
        <Skeleton data-testid="s" height="999px" width="999px">
          Loaded text
        </Skeleton>
      );
      const el = screen.getByTestId('s');
      expect(el.style.width).toBe('');
      expect(el.style.height).toBe('');
    });

    it('children are rendered invisibly via the measure helper', () => {
      render(<Skeleton>Hello</Skeleton>);
      expect(screen.getByText('Hello')).toHaveClass('measure');
    });

    it('applies radius as inline border-radius in pixels', () => {
      render(<Skeleton data-testid="s" radius={12} />);
      expect(screen.getByTestId('s')).toHaveStyle({ borderRadius: '12px' });
    });
  });

  describe('escape hatches', () => {
    it('merges a custom className with the base class', () => {
      render(<Skeleton className="extra" data-testid="s" />);
      const el = screen.getByTestId('s');
      expect(el).toHaveClass('skeleton');
      expect(el).toHaveClass('extra');
    });
  });
});
