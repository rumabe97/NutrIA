import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { MarbleEffect } from './MarbleEffect';

describe('MarbleEffect', () => {
  it('renders an <svg> with the requested size', () => {
    render(<MarbleEffect aria-label="avatar" name="Pablo" size={120} />);
    const svg = screen.getByRole('img', { name: 'avatar' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg).toHaveAttribute('width', '120');
    expect(svg).toHaveAttribute('height', '120');
  });

  it('defaults to size 80 when omitted', () => {
    render(<MarbleEffect aria-label="x" name="Pablo" />);
    const svg = screen.getByRole('img', { name: 'x' });
    expect(svg).toHaveAttribute('width', '80');
    expect(svg).toHaveAttribute('height', '80');
  });

  it('is deterministic — same name produces the same SVG markup', () => {
    const { container: first } = render(<MarbleEffect aria-label="a" name="Pablo" />);
    const { container: second } = render(<MarbleEffect aria-label="a" name="Pablo" />);

    // The two SVGs should be identical structurally (deterministic generateColors output).
    // We strip the auto-generated ids (different across renders) before comparing.
    const stripIds = (html: string) => html.replace(/id="[^"]+"/g, 'id="X"').replace(/url\(#[^)]+\)/g, 'url(#X)');

    expect(stripIds(first.innerHTML)).toBe(stripIds(second.innerHTML));
  });

  it('different names produce different SVG markup', () => {
    const { container: a } = render(<MarbleEffect aria-label="a" name="Pablo" />);
    const { container: b } = render(<MarbleEffect aria-label="a" name="Anna" />);

    const stripIds = (html: string) => html.replace(/id="[^"]+"/g, 'id="X"').replace(/url\(#[^)]+\)/g, 'url(#X)');

    expect(stripIds(a.innerHTML)).not.toBe(stripIds(b.innerHTML));
  });

  it('renders an SVG <title> when the title prop is provided', () => {
    render(<MarbleEffect aria-label="x" name="Pablo" title="Avatar for Pablo" />);
    expect(screen.getByTitle('Avatar for Pablo')).toBeInTheDocument();
  });
});
