import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Container } from './index';

describe('Container', () => {
  describe('rendering', () => {
    it('renders as <div> by default with the container base class', () => {
      render(<Container data-testid="container">child</Container>);
      const container = screen.getByTestId('container');
      expect(container.tagName).toBe('DIV');
      expect(container).toHaveClass('container');
    });

    it('renders as a custom element via the `as` prop', () => {
      render(
        <Container as="article" data-testid="container">
          child
        </Container>
      );
      expect(screen.getByTestId('container').tagName).toBe('ARTICLE');
    });
  });

  describe('size tier', () => {
    it.each(['sm', 'md', 'lg', 'xl'] as const)('size="%s" applies the matching class', size => {
      render(
        <Container data-testid="container" size={size}>
          child
        </Container>
      );
      expect(screen.getByTestId('container')).toHaveClass(size);
    });

    it('defaults to size="lg"', () => {
      render(<Container data-testid="container">child</Container>);
      expect(screen.getByTestId('container')).toHaveClass('lg');
    });
  });

  describe('padding (px) prop', () => {
    it('px="04" maps to paddingInline: var(--space-04) inline', () => {
      render(
        <Container data-testid="container" px="04">
          child
        </Container>
      );
      expect(screen.getByTestId('container')).toHaveStyle({ paddingInline: 'var(--space-04)' });
    });

    it('omits paddingInline when px is not passed', () => {
      render(<Container data-testid="container">child</Container>);
      expect(screen.getByTestId('container').style.paddingInline).toBe('');
    });
  });

  describe('escape hatch', () => {
    it('merges a custom className with size + base classes', () => {
      render(
        <Container className="extra" data-testid="container" size="md">
          child
        </Container>
      );
      const container = screen.getByTestId('container');
      expect(container).toHaveClass('container');
      expect(container).toHaveClass('md');
      expect(container).toHaveClass('extra');
    });
  });
});
