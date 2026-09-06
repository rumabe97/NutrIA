import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Grid } from './index';

describe('Grid', () => {
  describe('rendering', () => {
    it('renders as <div> by default with the grid base class', () => {
      render(<Grid data-testid="grid">child</Grid>);
      const grid = screen.getByTestId('grid');
      expect(grid.tagName).toBe('DIV');
      expect(grid).toHaveClass('grid');
    });

    it('renders as a custom element via the `as` prop', () => {
      render(
        <Grid as="ul" data-testid="grid">
          <li>1</li>
        </Grid>
      );
      expect(screen.getByTestId('grid').tagName).toBe('UL');
    });
  });

  describe('columns / rows', () => {
    it('columns="3" sets grid-template-columns to repeat(3, minmax(0, 1fr))', () => {
      render(
        <Grid columns="3" data-testid="grid">
          child
        </Grid>
      );
      expect(screen.getByTestId('grid')).toHaveStyle({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' });
    });

    it('rows="2" sets grid-template-rows to repeat(2, minmax(0, 1fr))', () => {
      render(
        <Grid data-testid="grid" rows="2">
          child
        </Grid>
      );
      expect(screen.getByTestId('grid')).toHaveStyle({ gridTemplateRows: 'repeat(2, minmax(0, 1fr))' });
    });

    it('omits grid-template-* inline styles when neither columns nor rows are passed', () => {
      render(<Grid data-testid="grid">child</Grid>);
      const grid = screen.getByTestId('grid');
      expect(grid.style.gridTemplateColumns).toBe('');
      expect(grid.style.gridTemplateRows).toBe('');
    });
  });

  describe('layout props', () => {
    it('gap maps to var(--space-N)', () => {
      render(
        <Grid data-testid="grid" gap="04">
          child
        </Grid>
      );
      expect(screen.getByTestId('grid')).toHaveStyle({ gap: 'var(--space-04)' });
    });

    it('inline={true} sets display: inline-grid', () => {
      render(
        <Grid data-testid="grid" inline={true}>
          child
        </Grid>
      );
      expect(screen.getByTestId('grid')).toHaveStyle({ display: 'inline-grid' });
    });

    it('align and justify map to alignItems / justifyContent', () => {
      render(
        <Grid align="center" data-testid="grid" justify="space-around">
          child
        </Grid>
      );
      const grid = screen.getByTestId('grid');
      expect(grid).toHaveStyle({ alignItems: 'center', justifyContent: 'space-around' });
    });
  });

  describe('escape hatch', () => {
    it('merges a custom className with the grid base class', () => {
      render(
        <Grid className="extra" data-testid="grid">
          child
        </Grid>
      );
      const grid = screen.getByTestId('grid');
      expect(grid).toHaveClass('grid');
      expect(grid).toHaveClass('extra');
    });
  });
});
