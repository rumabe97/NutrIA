import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Spacer } from './Spacer';

describe('Spacer', () => {
  it('renders an aria-hidden <span>', () => {
    render(<Spacer data-testid="s" />);
    const el = screen.getByTestId('s');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  // The inline style, not the computed one: since jsdom 30 `getComputedStyle` resolves `rem`
  // to px, as a browser does, and the contract here is the rem the component writes.
  it('defaults to 1rem of marginTop', () => {
    render(<Spacer data-testid="s" />);
    expect(screen.getByTestId('s').style.marginTop).toBe('1rem');
  });

  it('maps `space` to N rem of marginTop', () => {
    render(<Spacer data-testid="s" space={3} />);
    expect(screen.getByTestId('s').style.marginTop).toBe('3rem');
  });

  it('merges caller-supplied inline styles', () => {
    render(<Spacer data-testid="s" space={2} style={{ background: 'red' }} />);
    const el = screen.getByTestId('s');
    expect(el).toHaveStyle({ background: 'red' });
    expect(el.style.marginTop).toBe('2rem');
  });
});
