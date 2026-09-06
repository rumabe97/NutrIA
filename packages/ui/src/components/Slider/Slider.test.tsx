import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Slider } from './Slider';

describe('Slider', () => {
  it('renders a single thumb by default', () => {
    render(<Slider aria-label="volume" defaultValue={[50]} />);
    expect(screen.getAllByRole('slider')).toHaveLength(1);
  });

  it('renders one thumb per value when given a multi-value array', () => {
    render(<Slider defaultValue={[10, 50, 90]} />);
    expect(screen.getAllByRole('slider')).toHaveLength(3);
  });

  it('applies the root base class', () => {
    const { container } = render(<Slider defaultValue={[20]} />);
    expect(container.querySelector('.root')).not.toBeNull();
  });

  it('merges a custom className with the root base class', () => {
    const { container } = render(<Slider className="extra" defaultValue={[20]} />);
    const root = container.querySelector('.root');
    expect(root).toHaveClass('root');
    expect(root).toHaveClass('extra');
  });

  it('forwards `disabled` to the thumb', () => {
    render(<Slider aria-label="vol" defaultValue={[50]} disabled={true} />);
    expect(screen.getByRole('slider')).toHaveAttribute('data-disabled');
  });

  it('labels each thumb when `ariaLabelThumbs` is provided (multi-thumb a11y)', () => {
    render(<Slider ariaLabelThumbs={['Minimum price', 'Maximum price']} defaultValue={[10, 90]} />);
    expect(screen.getByRole('slider', { name: 'Minimum price' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Maximum price' })).toBeInTheDocument();
  });
});
