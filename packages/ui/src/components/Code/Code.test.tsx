import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Code } from './Code';

describe('Code', () => {
  it('renders a <code> element with the code base class', () => {
    render(<Code data-testid="c">hi</Code>);
    const el = screen.getByTestId('c');
    expect(el.tagName).toBe('CODE');
    expect(el).toHaveClass('code');
  });

  it('renders children inside', () => {
    render(<Code>npm i</Code>);
    expect(screen.getByText('npm i')).toBeInTheDocument();
  });

  it('merges a custom className with the base class', () => {
    render(
      <Code className="extra" data-testid="c">
        x
      </Code>
    );
    const el = screen.getByTestId('c');
    expect(el).toHaveClass('code');
    expect(el).toHaveClass('extra');
  });
});
