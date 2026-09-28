import { render, screen, within } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { ColumnChart } from './ColumnChart';

import type { ColumnChartProps } from './ColumnChart';

const BASE = {
  dataLabel: 'Ver datos',
  emptyLabel: 'Nada en este periodo.',
  labels: ['2026-09-26', '2026-09-27', '2026-09-28'],
  labelsHeader: 'Día',
  locale: 'es-ES',
  title: 'Generaciones por día'
} satisfies Partial<ColumnChartProps>;

function rects(container: HTMLElement) {
  return Array.from(container.querySelectorAll('rect'));
}

function bottomOf(rect: SVGRectElement) {
  return Number(rect.getAttribute('y')) + Number(rect.getAttribute('height'));
}

describe('ColumnChart', () => {
  it('names the figure and the plot with the title', () => {
    render(<ColumnChart {...BASE} series={[{ name: 'Planes', values: [2, 5, 3] }]} />);
    expect(screen.getByRole('figure', { name: 'Generaciones por día' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Generaciones por día' })).toBeInTheDocument();
  });

  it('puts a title with the exact figure on every column', () => {
    const { container } = render(<ColumnChart {...BASE} series={[{ name: 'Planes', values: [2, 1500, 3] }]} />);
    const titles = rects(container).map(rect => rect.querySelector('title')?.textContent);
    expect(titles).toEqual(['26 sept: 2', '27 sept: 1500', '28 sept: 3']);
  });

  it('starts the scale at zero: every column stands on the baseline, heights in proportion', () => {
    const { container } = render(<ColumnChart {...BASE} series={[{ name: 'Planes', values: [10, 20, 40] }]} />);
    const [a, b, c] = rects(container);

    expect(a && b && c).toBeTruthy();

    if (!a || !b || !c) {
      return;
    }

    expect(new Set([bottomOf(a), bottomOf(b), bottomOf(c)]).size).toBe(1);
    const height = (rect: SVGRectElement) => Number(rect.getAttribute('height'));
    expect(height(b) / height(a)).toBeCloseTo(2, 1);
    expect(height(c) / height(a)).toBeCloseTo(4, 1);
  });

  it('draws the table of the same figures behind "show data"', () => {
    render(<ColumnChart {...BASE} formatValue={value => `${value} u`} series={[{ name: 'Planes', values: [2, 5, 3] }]} />);
    expect(screen.getByText('Ver datos')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Generaciones por día' });
    expect(within(table).getByRole('columnheader', { name: 'Día' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Planes' })).toBeInTheDocument();
    expect(
      within(table)
        .getAllByRole('cell')
        .map(cell => cell.textContent)
    ).toEqual(['2 u', '5 u', '3 u']);
  });

  it('shows a legend for two series or more, and none for one', () => {
    const { rerender } = render(<ColumnChart {...BASE} series={[{ name: 'Planes', values: [2, 5, 3] }]} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    rerender(
      <ColumnChart
        {...BASE}
        series={[
          { name: 'Bien', tone: 'success', values: [2, 5, 3] },
          { name: 'Fallo', tone: 'failure', values: [1, 0, 2] }
        ]}
      />
    );
    const legend = screen.getByRole('list');
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map(item => item.textContent)
    ).toEqual(['Bien', 'Fallo']);
  });

  it('stacks to the total: the scale covers the tallest stack, segments sit on each other, the table adds a total', () => {
    const { container } = render(
      <ColumnChart
        {...BASE}
        series={[
          { name: 'Bien', tone: 'success', values: [30, 10, 0] },
          { name: 'Fallo', tone: 'failure', values: [30, 5, 4] }
        ]}
        stacked={true}
        totalLabel="Total"
      />
    );

    // The tallest stack is 60, so a tick at or above 60 is drawn; 30 alone would top out lower.
    const ticks = Array.from(container.querySelectorAll('g[aria-hidden] text')).map(text => text.textContent);
    expect(ticks).toContain('60');

    const [okFirst, failFirst] = rects(container);
    expect(okFirst && failFirst).toBeTruthy();

    if (!okFirst || !failFirst) {
      return;
    }

    // The failure segment sits on top of the success one, a 2px gap between them.
    expect(bottomOf(failFirst)).toBeCloseTo(Number(okFirst.getAttribute('y')) - 2, 5);
    // Same value, same height: both are half of one 60 stack.
    expect(Number(okFirst.getAttribute('height'))).toBeCloseTo(Number(failFirst.getAttribute('height')) + 2, 5);

    const table = screen.getByRole('table', { name: 'Generaciones por día' });
    expect(within(table).getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
    const firstRow = within(table).getByRole('rowheader', { name: '26 sept' }).closest('tr');
    expect(firstRow?.textContent).toBe('26 sept303060');
  });

  it('shows the empty state instead of a flat chart when every value is zero', () => {
    render(<ColumnChart {...BASE} series={[{ name: 'Planes', values: [0, 0, 0] }]} />);
    expect(screen.getByText('Nada en este periodo.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no labels', () => {
    render(<ColumnChart {...BASE} labels={[]} series={[{ name: 'Planes', values: [] }]} />);
    expect(screen.getByText('Nada en este periodo.')).toBeInTheDocument();
  });

  it('prints labels that are not days as they are', () => {
    const { container } = render(<ColumnChart {...BASE} labels={['Semana 1', 'Semana 2']} series={[{ name: 'Mensajes', values: [4, 6] }]} />);
    expect(rects(container)[0]?.querySelector('title')?.textContent).toBe('Semana 1: 4');
  });

  it('forwards className to the figure', () => {
    render(<ColumnChart {...BASE} className="extra" series={[{ name: 'Planes', values: [2, 5, 3] }]} />);
    const figure = screen.getByRole('figure', { name: 'Generaciones por día' });
    expect(figure).toHaveClass('root');
    expect(figure).toHaveClass('extra');
  });
});
