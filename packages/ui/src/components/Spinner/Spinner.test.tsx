import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders a span with the spinner base class', () => {
    render(<Spinner data-testid="spinner" />);
    const el = screen.getByTestId('spinner');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveClass('spinner');
  });

  it('applies the size as inline width/height in pixels', () => {
    render(<Spinner data-testid="spinner" size={40} />);
    expect(screen.getByTestId('spinner')).toHaveStyle({ height: '40px', width: '40px' });
  });

  it('defaults to 20px when size is omitted', () => {
    render(<Spinner data-testid="spinner" />);
    expect(screen.getByTestId('spinner')).toHaveStyle({ height: '20px', width: '20px' });
  });

  it('merges a custom className with the base class', () => {
    render(<Spinner className="extra" data-testid="spinner" />);
    const el = screen.getByTestId('spinner');
    expect(el).toHaveClass('spinner');
    expect(el).toHaveClass('extra');
  });

  it('renders 8 leaf elements', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelectorAll('.leaf').length).toBe(8);
  });

  it('is aria-hidden so assistive tech treats it as decorative by default', () => {
    render(<Spinner data-testid="spinner" />);
    expect(screen.getByTestId('spinner')).toHaveAttribute('aria-hidden', 'true');
  });

  it('becomes a role="status" with the label announced when `label` is provided', () => {
    render(<Spinner label="Loading projects" />);
    const status = screen.getByRole('status');
    expect(status).not.toHaveAttribute('aria-hidden');
    expect(status).toHaveTextContent('Loading projects');
  });
});
