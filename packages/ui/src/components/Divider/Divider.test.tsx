import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Divider } from './Divider';

describe('Divider', () => {
  it('renders an <hr> with the divider base class', () => {
    render(<Divider data-testid="d" />);
    const el = screen.getByTestId('d');
    expect(el.tagName).toBe('HR');
    expect(el).toHaveClass('divider');
  });

  it('merges a custom className alongside the base class', () => {
    render(<Divider className="extra" data-testid="d" />);
    const el = screen.getByTestId('d');
    expect(el).toHaveClass('divider');
    expect(el).toHaveClass('extra');
  });

  it('forwards inline styles and arbitrary HTML attributes', () => {
    render(<Divider aria-label="separator" data-testid="d" style={{ marginTop: '8px' }} />);
    const el = screen.getByTestId('d');
    expect(el).toHaveStyle({ marginTop: '8px' });
    expect(el).toHaveAttribute('aria-label', 'separator');
  });
});
