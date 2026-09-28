import { render } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('is decorative: hidden from assistive technology and never focusable', () => {
    const { container } = render(<Sparkline values={[1, 3, 2]} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).not.toHaveAttribute('role');
  });

  it('runs from zero: the highest value touches the top, zero the bottom', () => {
    const { container } = render(<Sparkline values={[0, 10, 5]} />);
    const points = container.querySelector('polyline')?.getAttribute('points')?.split(' ');
    expect(points).toEqual(['0.00,22.00', '50.00,2.00', '100.00,12.00']);
  });

  it('draws nothing for fewer than two points or nothing above zero', () => {
    expect(render(<Sparkline values={[4]} />).container).toBeEmptyDOMElement();
    expect(render(<Sparkline values={[0, 0, 0]} />).container).toBeEmptyDOMElement();
    expect(render(<Sparkline values={[]} />).container).toBeEmptyDOMElement();
  });

  it('wears its tone and forwards className', () => {
    const { container } = render(<Sparkline className="extra" tone="success" values={[1, 2]} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('sparkline');
    expect(svg).toHaveClass('toneSuccess');
    expect(svg).toHaveClass('extra');
  });
});
