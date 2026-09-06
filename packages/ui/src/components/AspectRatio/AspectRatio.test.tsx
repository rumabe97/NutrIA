import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { AspectRatio } from './AspectRatio';

describe('AspectRatio', () => {
  it('renders children inside a wrapper', () => {
    render(
      <AspectRatio ratio={16 / 9}>
        <img alt="cover" data-testid="img" src="/x.png" />
      </AspectRatio>
    );
    expect(screen.getByTestId('img')).toBeInTheDocument();
  });

  it('applies the ratio via inline padding-bottom on the wrapper', () => {
    render(
      <AspectRatio ratio={2}>
        <span data-testid="child">x</span>
      </AspectRatio>
    );
    const wrapper = screen.getByTestId('child').parentElement?.parentElement as HTMLElement;
    expect(wrapper.style.paddingBottom).toBe('50%');
  });
});
