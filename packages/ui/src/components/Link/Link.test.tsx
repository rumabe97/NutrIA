import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Link } from './Link';

describe('Link', () => {
  it('renders an <a> with href and the link base class', () => {
    render(<Link href="/about">About</Link>);
    const el = screen.getByRole('link', { name: 'About' });
    expect(el.tagName).toBe('A');
    expect(el).toHaveAttribute('href', '/about');
    expect(el).toHaveClass('link');
  });

  it('forwards target and rel for external links', () => {
    render(
      <Link href="https://example.com" rel="noopener noreferrer" target="_blank">
        Out
      </Link>
    );
    const el = screen.getByRole('link', { name: 'Out' });
    expect(el).toHaveAttribute('target', '_blank');
    expect(el).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('defaults rel to "noopener noreferrer" when target="_blank" and no rel is provided', () => {
    // Browsers auto-apply `noopener` for target="_blank" but NOT `noreferrer`. The DS
    // applies both as a safety default; consumers override with an explicit `rel`.
    render(
      <Link href="https://example.com" target="_blank">
        Out
      </Link>
    );
    expect(screen.getByRole('link', { name: 'Out' })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('respects a consumer-provided rel even when target="_blank"', () => {
    render(
      <Link href="https://example.com" rel="noopener" target="_blank">
        Trusted
      </Link>
    );
    expect(screen.getByRole('link', { name: 'Trusted' })).toHaveAttribute('rel', 'noopener');
  });

  it('does not set rel when target is not "_blank"', () => {
    render(<Link href="/about">About</Link>);
    expect(screen.getByRole('link', { name: 'About' })).not.toHaveAttribute('rel');
  });

  it('merges a custom className with the base class', () => {
    render(
      <Link className="extra" href="/x">
        x
      </Link>
    );
    const el = screen.getByRole('link', { name: 'x' });
    expect(el).toHaveClass('link');
    expect(el).toHaveClass('extra');
  });

  it('applies the inline class when `inline` is set (visible underline for prose links)', () => {
    render(
      <Link href="/docs" inline={true}>
        docs
      </Link>
    );
    expect(screen.getByRole('link', { name: 'docs' })).toHaveClass('inline');
  });

  it('forwards aria-current for active-link patterns', () => {
    render(
      <Link aria-current="page" href="/now">
        Now
      </Link>
    );
    expect(screen.getByRole('link', { name: 'Now' })).toHaveAttribute('aria-current', 'page');
  });
});
