import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Text } from './index';

// Class-name assertions below rely on vitest.config.ts's
// `css.modules.classNameStrategy: 'non-scoped'`.

describe('Text', () => {
  describe('as polymorphism', () => {
    it('renders as <p> by default', () => {
      render(<Text>Body</Text>);
      expect(screen.getByText('Body').tagName).toBe('P');
    });

    it.each(['span', 'small', 'strong', 'em', 'mark', 's'] as const)('as="%s" renders a <%s> element', as => {
      render(<Text as={as}>Body</Text>);
      expect(screen.getByText('Body').tagName).toBe(as.toUpperCase());
    });
  });

  describe('weight handling', () => {
    it('does NOT apply a weight class when none is passed — preserves browser default for semantic tags', () => {
      render(<Text>Body</Text>);
      expect(screen.getByText('Body').className).not.toMatch(/weight-/);
    });

    it.each(['regular', 'medium', 'semibold', 'bold'] as const)('weight="%s" applies the matching class', weight => {
      render(<Text weight={weight}>Body</Text>);
      expect(screen.getByText('Body')).toHaveClass(`weight-${weight}`);
    });
  });

  describe('size and tone', () => {
    it.each(['xs', 'sm', 'md', 'lg'] as const)('size="%s" applies the matching class', size => {
      render(<Text size={size}>Body</Text>);
      expect(screen.getByText('Body')).toHaveClass(`size-${size}`);
    });

    it('defaults to size="md"', () => {
      render(<Text>Body</Text>);
      expect(screen.getByText('Body')).toHaveClass('size-md');
    });

    it.each(['primary', 'secondary', 'tertiary', 'disabled'] as const)('tone="%s" applies the matching class', tone => {
      render(<Text tone={tone}>Body</Text>);
      expect(screen.getByText('Body')).toHaveClass(`tone-${tone}`);
    });

    it('defaults to tone="primary"', () => {
      render(<Text>Body</Text>);
      expect(screen.getByText('Body')).toHaveClass('tone-primary');
    });
  });

  describe('alignment', () => {
    it.each(['start', 'center', 'end', 'justify'] as const)('align="%s" applies the matching class', align => {
      render(<Text align={align}>Body</Text>);
      expect(screen.getByText('Body')).toHaveClass(`align-${align}`);
    });

    it('applies no align class when align is not passed', () => {
      render(<Text>Body</Text>);
      expect(screen.getByText('Body').className).not.toMatch(/align-/);
    });
  });

  describe('escape hatch', () => {
    it('merges a custom className with the computed classes', () => {
      render(<Text className="extra">Body</Text>);
      const el = screen.getByText('Body');
      expect(el).toHaveClass('text');
      expect(el).toHaveClass('extra');
    });

    it('forwards arbitrary HTML attributes', () => {
      render(
        <Text data-testid="copy" id="lede">
          Body
        </Text>
      );
      expect(screen.getByTestId('copy')).toHaveAttribute('id', 'lede');
    });
  });
});
