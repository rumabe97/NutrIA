import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { HStack } from './index';

describe('HStack', () => {
  describe('rendering', () => {
    it('renders as <div> by default with the hstack class', () => {
      render(<HStack data-testid="stack">child</HStack>);
      const stack = screen.getByTestId('stack');
      expect(stack.tagName).toBe('DIV');
      expect(stack).toHaveClass('hstack');
    });

    it('renders as a custom element via the `as` prop', () => {
      render(
        <HStack as="nav" data-testid="stack">
          child
        </HStack>
      );
      expect(screen.getByTestId('stack').tagName).toBe('NAV');
    });
  });

  describe('wrap default', () => {
    it('does NOT set inline flexWrap when wrap is unset (defaults to true via the CSS class)', () => {
      render(<HStack data-testid="stack">child</HStack>);
      expect(screen.getByTestId('stack').style.flexWrap).toBe('');
    });

    it('does NOT set inline flexWrap when wrap={true}', () => {
      render(
        <HStack data-testid="stack" wrap={true}>
          child
        </HStack>
      );
      expect(screen.getByTestId('stack').style.flexWrap).toBe('');
    });

    it('sets flex-wrap: nowrap inline when wrap={false}', () => {
      render(
        <HStack data-testid="stack" wrap={false}>
          child
        </HStack>
      );
      expect(screen.getByTestId('stack')).toHaveStyle({ flexWrap: 'nowrap' });
    });
  });

  describe('layout props (inline-style tokens)', () => {
    it('gap maps to var(--space-N) on the inline style', () => {
      render(
        <HStack data-testid="stack" gap="03">
          child
        </HStack>
      );
      expect(screen.getByTestId('stack')).toHaveStyle({ gap: 'var(--space-03)' });
    });

    it('align and justify map to alignItems / justifyContent', () => {
      render(
        <HStack align="center" data-testid="stack" justify="space-between">
          child
        </HStack>
      );
      const stack = screen.getByTestId('stack');
      expect(stack).toHaveStyle({ alignItems: 'center', justifyContent: 'space-between' });
    });
  });

  describe('escape hatch', () => {
    it('merges a custom className with the hstack base', () => {
      render(
        <HStack className="extra" data-testid="stack">
          child
        </HStack>
      );
      const stack = screen.getByTestId('stack');
      expect(stack).toHaveClass('hstack');
      expect(stack).toHaveClass('extra');
    });
  });
});
