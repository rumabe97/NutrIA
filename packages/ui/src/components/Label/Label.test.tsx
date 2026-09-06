import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Label } from './Label';

describe('Label', () => {
  it('renders a <label> with the base class', () => {
    render(<Label htmlFor="x">Email</Label>);
    const el = screen.getByText('Email');
    expect(el.tagName).toBe('LABEL');
    expect(el).toHaveClass('label');
  });

  it('forwards htmlFor to associate with a form control', () => {
    render(<Label htmlFor="email-input">Email</Label>);
    expect(screen.getByText('Email')).toHaveAttribute('for', 'email-input');
  });

  it('merges a custom className with the base class', () => {
    render(
      <Label className="extra" htmlFor="x">
        Email
      </Label>
    );
    const el = screen.getByText('Email');
    expect(el).toHaveClass('label');
    expect(el).toHaveClass('extra');
  });

  it('prevents text selection on double-click (Radix behaviour)', () => {
    // A double-click on a normal <label> would select the word in the label text.
    // Radix Label suppresses this. We verify by dispatching a double-click and checking
    // that preventDefault was called on the synthetic event.
    render(<Label htmlFor="x">Accept terms</Label>);
    const el = screen.getByText('Accept terms');
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT prevent selection when the double-click lands on a form control inside', () => {
    render(
      <Label htmlFor="x">
        Label text
        <input data-testid="inner" />
      </Label>
    );
    const inner = screen.getByTestId('inner');
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
    inner.dispatchEvent(event);
    // Inside a form control, selection logic stays native — preventDefault is NOT called.
    expect(event.defaultPrevented).toBe(false);
  });
});
