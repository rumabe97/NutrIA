import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders the root with the base class and size-derived inline dimensions', () => {
    render(<Avatar data-testid="a" name="Pablo" size={64} />);
    const root = screen.getByTestId('a');
    expect(root).toHaveClass('root');
    expect(root).toHaveStyle({ height: '64px', width: '64px' });
  });

  it('defaults to 80px when size is omitted', () => {
    render(<Avatar data-testid="a" name="Pablo" />);
    expect(screen.getByTestId('a')).toHaveStyle({ height: '80px', width: '80px' });
  });

  it('merges a custom className and inline style', () => {
    render(<Avatar className="extra" data-testid="a" name="Pablo" style={{ borderRadius: '4px' }} />);
    const root = screen.getByTestId('a');
    expect(root).toHaveClass('root');
    expect(root).toHaveClass('extra');
    expect(root).toHaveStyle({ borderRadius: '4px' });
  });

  it('renders a custom fallback when provided', () => {
    render(<Avatar data-testid="a" fallback={<span data-testid="custom">PA</span>} name="Pablo" />);
    expect(screen.getByTestId('custom')).toBeInTheDocument();
  });

  describe('accessibility', () => {
    it('exposes name as the MarbleEffect fallback accessible name (default fallback path)', () => {
      // Radix Avatar.Image swaps to the fallback when the src fails to load (in jsdom,
      // images never load, so the fallback renders). The fallback's MarbleEffect should
      // carry `aria-label={name}` so the avatar is announced.
      render(<Avatar name="Pablo Arrastia" />);
      expect(screen.getByRole('img', { name: 'Pablo Arrastia' })).toBeInTheDocument();
    });

    it('uses `alt` as the accessible name when provided, overriding `name`', () => {
      render(<Avatar alt="Pablo's profile picture" name="Pablo" />);
      expect(screen.getByRole('img', { name: "Pablo's profile picture" })).toBeInTheDocument();
    });

    it('does not announce a name when a custom fallback is provided (caller owns a11y)', () => {
      // When the consumer passes their own fallback, the DS hands off a11y responsibility
      // to them. The MarbleEffect default is the only path where Avatar guarantees a label.
      render(<Avatar fallback={<span>PA</span>} name="Pablo" />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });
});
