import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { VStack } from './index';

describe('VStack', () => {
  describe('rendering', () => {
    it('renders as <div> by default', () => {
      render(<VStack data-testid="stack">child</VStack>);
      expect(screen.getByTestId('stack').tagName).toBe('DIV');
    });

    it('renders as a custom element via the `as` prop', () => {
      render(
        <VStack as="section" data-testid="stack">
          child
        </VStack>
      );
      expect(screen.getByTestId('stack').tagName).toBe('SECTION');
    });

    it('applies the base "vstack" class', () => {
      render(<VStack data-testid="stack">child</VStack>);
      expect(screen.getByTestId('stack')).toHaveClass('vstack');
    });
  });

  describe('layout props (inline-style tokens)', () => {
    it.each(['01', '04', '08', '12'] as const)('gap="%s" maps to var(--space-%s) on the inline style', gap => {
      render(
        <VStack data-testid="stack" gap={gap}>
          child
        </VStack>
      );
      expect(screen.getByTestId('stack')).toHaveStyle({ gap: `var(--space-${gap})` });
    });

    it('align maps to align-items', () => {
      render(
        <VStack align="center" data-testid="stack">
          child
        </VStack>
      );
      expect(screen.getByTestId('stack')).toHaveStyle({ alignItems: 'center' });
    });

    it('justify maps to justify-content', () => {
      render(
        <VStack data-testid="stack" justify="space-between">
          child
        </VStack>
      );
      expect(screen.getByTestId('stack')).toHaveStyle({ justifyContent: 'space-between' });
    });

    it('omits gap / align / justify from inline style when not passed', () => {
      render(<VStack data-testid="stack">child</VStack>);
      const stack = screen.getByTestId('stack');
      expect(stack.style.gap).toBe('');
      expect(stack.style.alignItems).toBe('');
      expect(stack.style.justifyContent).toBe('');
    });
  });

  describe('escape hatch', () => {
    it('merges a custom className with the vstack base class', () => {
      render(
        <VStack className="extra" data-testid="stack">
          child
        </VStack>
      );
      const stack = screen.getByTestId('stack');
      expect(stack).toHaveClass('vstack');
      expect(stack).toHaveClass('extra');
    });

    it('caller-provided style merges with the computed inline style', () => {
      render(
        <VStack data-testid="stack" gap="04" style={{ marginTop: '10px' }}>
          child
        </VStack>
      );
      const stack = screen.getByTestId('stack');
      expect(stack).toHaveStyle({ gap: 'var(--space-04)', marginTop: '10px' });
    });
  });
});
