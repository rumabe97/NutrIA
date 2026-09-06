import { Fragment } from 'react';
import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Section } from './index';

// Class-name assertions rely on vitest.config.ts's `classNameStrategy: 'non-scoped'`.

describe('Section', () => {
  describe('rendering', () => {
    it('always renders a <section> element', () => {
      const { container } = render(<Section aria-label="Test">Content</Section>);
      expect(container.querySelector('section')).toBeInTheDocument();
    });
  });

  describe('accessible name', () => {
    it('aria-label becomes the region name', () => {
      render(<Section aria-label="Pricing">Content</Section>);
      expect(screen.getByRole('region', { name: 'Pricing' })).toBeInTheDocument();
    });

    it('aria-labelledby references a heading and inherits its name', () => {
      render(
        <Fragment>
          <h2 id="features-h">Features</h2>
          <Section aria-labelledby="features-h">Content</Section>
        </Fragment>
      );
      expect(screen.getByRole('region', { name: 'Features' })).toBeInTheDocument();
    });
  });

  describe('size tier', () => {
    it.each(['sm', 'md', 'lg', 'xl'] as const)('size="%s" applies the matching class', size => {
      render(
        <Section aria-label="Test" size={size}>
          Content
        </Section>
      );
      expect(screen.getByRole('region')).toHaveClass(size);
    });

    it('defaults to size="lg"', () => {
      render(<Section aria-label="Test">Content</Section>);
      expect(screen.getByRole('region')).toHaveClass('lg');
    });
  });

  describe('escape hatch', () => {
    it('merges a custom className with the size class', () => {
      render(
        <Section aria-label="Test" className="extra" size="md">
          Content
        </Section>
      );
      const region = screen.getByRole('region');
      expect(region).toHaveClass('md');
      expect(region).toHaveClass('extra');
    });

    it('forwards arbitrary HTML attributes', () => {
      render(
        <Section aria-label="Test" data-testid="pricing-section" id="pricing">
          Content
        </Section>
      );
      const region = screen.getByTestId('pricing-section');
      expect(region).toHaveAttribute('id', 'pricing');
    });
  });
});
