import { render, screen, within } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { LineChart } from './LineChart';

import type { LineChartProps } from './LineChart';

const BASE = {
  dataLabel: 'Ver datos',
  emptyLabel: 'Nada en este periodo.',
  labelsHeader: 'Día',
  locale: 'es-ES',
  title: 'Altas por día'
} satisfies Partial<LineChartProps>;

function circles(container: HTMLElement) {
  return Array.from(container.querySelectorAll('circle'));
}

function cx(circle: SVGCircleElement | undefined) {
  return Number.parseFloat(circle?.getAttribute('cx') ?? 'NaN');
}

describe('LineChart', () => {
  it('names the figure and the plot with the title', () => {
    render(<LineChart {...BASE} labels={['2026-09-27', '2026-09-28']} series={[{ name: 'Altas', values: [3, 5] }]} />);
    expect(screen.getByRole('figure', { name: 'Altas por día' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Altas por día' })).toBeInTheDocument();
  });

  it('puts a title with the exact figure on every point, naming the series when there are several', () => {
    const { container } = render(
      <LineChart
        {...BASE}
        labels={['2026-09-27', '2026-09-28']}
        series={[
          { name: 'p50', values: [12, 14] },
          { name: 'p95', values: [40, 38] }
        ]}
      />
    );
    expect(circles(container).map(circle => circle.querySelector('title')?.textContent)).toEqual([
      '27 sept · p50: 12',
      '28 sept · p50: 14',
      '27 sept · p95: 40',
      '28 sept · p95: 38'
    ]);
  });

  it('places days at their real distance apart', () => {
    const { container } = render(
      <LineChart {...BASE} labels={['2026-09-01', '2026-09-02', '2026-09-11']} series={[{ name: 'Altas', values: [1, 2, 3] }]} />
    );
    const [first, second, third] = circles(container);
    expect(cx(first)).toBe(0);
    expect(cx(second)).toBeCloseTo(10, 5);
    expect(cx(third)).toBe(100);
  });

  it('spaces labels that are not days evenly', () => {
    const { container } = render(<LineChart {...BASE} labels={['a', 'b', 'c']} series={[{ name: 'Altas', values: [1, 2, 3] }]} />);
    expect(circles(container).map(cx)).toEqual([0, 50, 100]);
  });

  it('starts the scale at zero', () => {
    const { container } = render(<LineChart {...BASE} labels={['a', 'b']} series={[{ name: 'Altas', values: [50, 100] }]} />);
    const [low, high] = circles(container).map(circle => Number(circle.getAttribute('cy')));
    // 100 at the top tick, 50 halfway down to the zero baseline.
    const baseline = Number(container.querySelector('line')?.getAttribute('y1'));
    expect(baseline - (low ?? 0)).toBeCloseTo((baseline - (high ?? 0)) / 2, 5);
  });

  it('shows a legend and the table with one column per series', () => {
    render(
      <LineChart
        {...BASE}
        labels={['2026-09-27', '2026-09-28']}
        series={[
          { name: 'Vistas', values: [10, 12] },
          { name: 'Clics', values: [3, 4] }
        ]}
      />
    );
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
    const table = screen.getByRole('table', { name: 'Altas por día' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['Día', 'Vistas', 'Clics']);
  });

  it('drops the visible dots past a month of points, keeping a target with the figure', () => {
    const labels = Array.from({ length: 40 }, (_, index) => `d${index}`);
    const { container } = render(<LineChart {...BASE} labels={labels} series={[{ name: 'Altas', values: labels.map((_, index) => index) }]} />);
    const all = circles(container);
    expect(all).toHaveLength(40);
    expect(all.every(circle => circle.classList.contains('target'))).toBe(true);
    expect(all[39]?.querySelector('title')?.textContent).toBe('d39: 39');
  });

  it('shows the empty state when every value is zero', () => {
    render(<LineChart {...BASE} labels={['a', 'b']} series={[{ name: 'Altas', values: [0, 0] }]} />);
    expect(screen.getByText('Nada en este periodo.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no labels', () => {
    render(<LineChart {...BASE} labels={[]} series={[]} />);
    expect(screen.getByText('Nada en este periodo.')).toBeInTheDocument();
  });
});
