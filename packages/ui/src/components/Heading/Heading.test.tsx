import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Heading } from './index';

// Class-name assertions below rely on vitest.config.ts's
// `css.modules.classNameStrategy: 'non-scoped'` — module classes resolve to
// their literal names in tests (`size-xl` etc.) instead of hashed identifiers.

describe('Heading', () => {
  describe('level → semantic tag', () => {
    it.each(['1', '2', '3', '4', '5', '6'] as const)('level="%s" renders an h%s element', level => {
      render(<Heading level={level}>Title</Heading>);
      const heading = screen.getByRole('heading', { level: Number(level) });
      expect(heading.tagName).toBe(`H${level}`);
    });
  });

  describe('size derivation', () => {
    it.each([
      ['1', 'xl'],
      ['2', 'lg'],
      ['3', 'md'],
      ['4', 'sm'],
      ['5', 'sm'],
      ['6', 'xs']
    ] as const)('default size for level="%s" is "%s"', (level, expectedSize) => {
      render(<Heading level={level}>Title</Heading>);
      expect(screen.getByRole('heading')).toHaveClass(`size-${expectedSize}`);
    });

    it('custom size overrides the level default — same tag, different visual size', () => {
      render(
        <Heading level="2" size="xs">
          Title
        </Heading>
      );
      const heading = screen.getByRole('heading');
      expect(heading.tagName).toBe('H2');
      expect(heading).toHaveClass('size-xs');
      expect(heading).not.toHaveClass('size-lg');
    });
  });

  describe('styling props', () => {
    it.each(['regular', 'medium', 'semibold', 'bold'] as const)('weight="%s" applies the matching class', weight => {
      render(
        <Heading level="2" weight={weight}>
          Title
        </Heading>
      );
      expect(screen.getByRole('heading')).toHaveClass(`weight-${weight}`);
    });

    it.each(['primary', 'secondary', 'tertiary'] as const)('tone="%s" applies the matching class', tone => {
      render(
        <Heading level="2" tone={tone}>
          Title
        </Heading>
      );
      expect(screen.getByRole('heading')).toHaveClass(`tone-${tone}`);
    });

    it('applies an align class only when provided', () => {
      const { rerender } = render(<Heading level="2">Title</Heading>);
      expect(screen.getByRole('heading').className).not.toMatch(/align-/);

      rerender(
        <Heading align="center" level="2">
          Title
        </Heading>
      );
      expect(screen.getByRole('heading')).toHaveClass('align-center');
    });
  });

  describe('defaults', () => {
    it('defaults to weight="semibold" and tone="primary"', () => {
      render(<Heading level="3">Title</Heading>);
      const heading = screen.getByRole('heading');
      expect(heading).toHaveClass('weight-semibold');
      expect(heading).toHaveClass('tone-primary');
    });
  });

  describe('escape hatch', () => {
    it('merges a custom className with the computed classes', () => {
      render(
        <Heading className="extra" level="2">
          Title
        </Heading>
      );
      const heading = screen.getByRole('heading');
      expect(heading).toHaveClass('heading');
      expect(heading).toHaveClass('extra');
    });

    it('forwards arbitrary HTML attributes (id, data-*, aria-*)', () => {
      render(
        <Heading aria-describedby="caption" data-testid="title" id="page-title" level="2">
          Title
        </Heading>
      );
      const heading = screen.getByTestId('title');
      expect(heading).toHaveAttribute('id', 'page-title');
      expect(heading).toHaveAttribute('aria-describedby', 'caption');
    });
  });
});
