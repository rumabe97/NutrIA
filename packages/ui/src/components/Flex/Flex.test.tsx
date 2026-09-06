import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Flex } from './Flex';

describe('Flex', () => {
  describe('rendering', () => {
    it('renders as <div> by default with the flex base class', () => {
      render(<Flex data-testid="f">child</Flex>);
      const el = screen.getByTestId('f');
      expect(el.tagName).toBe('DIV');
      expect(el).toHaveClass('flex');
    });

    it('renders as a custom element via `as`', () => {
      render(
        <Flex as="section" data-testid="f">
          x
        </Flex>
      );
      expect(screen.getByTestId('f').tagName).toBe('SECTION');
    });
  });

  describe('layout props → inline styles', () => {
    it('direction / align / justify map to flex CSS properties', () => {
      render(
        <Flex align="center" data-testid="f" direction="column" justify="space-between">
          x
        </Flex>
      );
      const el = screen.getByTestId('f');
      expect(el).toHaveStyle({ alignItems: 'center', flexDirection: 'column', justifyContent: 'space-between' });
    });

    it('gap maps to var(--space-N)', () => {
      render(
        <Flex data-testid="f" gap="04">
          x
        </Flex>
      );
      expect(screen.getByTestId('f')).toHaveStyle({ gap: 'var(--space-04)' });
    });

    it('inline={true} sets display: inline-flex', () => {
      render(
        <Flex data-testid="f" inline={true}>
          x
        </Flex>
      );
      expect(screen.getByTestId('f')).toHaveStyle({ display: 'inline-flex' });
    });

    it('wrap maps to flex-wrap', () => {
      render(
        <Flex data-testid="f" wrap="wrap">
          x
        </Flex>
      );
      expect(screen.getByTestId('f')).toHaveStyle({ flexWrap: 'wrap' });
    });

    it('does not set inline styles when no layout props are passed', () => {
      render(<Flex data-testid="f">x</Flex>);
      const el = screen.getByTestId('f');
      expect(el.style.flexDirection).toBe('');
      expect(el.style.gap).toBe('');
    });
  });

  describe('escape hatches', () => {
    it('merges custom className and style with the base', () => {
      render(
        <Flex className="extra" data-testid="f" style={{ background: 'red' }}>
          x
        </Flex>
      );
      const el = screen.getByTestId('f');
      expect(el).toHaveClass('flex');
      expect(el).toHaveClass('extra');
      expect(el).toHaveStyle({ background: 'red' });
    });
  });
});
