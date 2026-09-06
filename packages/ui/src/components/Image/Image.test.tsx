import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Image } from './Image';

describe('Image', () => {
  it('renders an <img> with src/alt and the image base class', () => {
    render(<Image alt="cover" height={120} src="/cover.png" width={120} />);
    const el = screen.getByRole('img', { name: 'cover' });
    expect(el.tagName).toBe('IMG');
    expect(el).toHaveClass('image');
  });

  it('merges a custom className with the base class', () => {
    render(<Image alt="x" className="extra" height={40} src="/x.png" width={40} />);
    const el = screen.getByRole('img', { name: 'x' });
    expect(el).toHaveClass('image');
    expect(el).toHaveClass('extra');
  });

  it('forwards width and height attributes', () => {
    render(<Image alt="x" height={80} src="/x.png" width={120} />);
    const el = screen.getByRole('img', { name: 'x' });
    expect(el).toHaveAttribute('width', '120');
    expect(el).toHaveAttribute('height', '80');
  });
});
