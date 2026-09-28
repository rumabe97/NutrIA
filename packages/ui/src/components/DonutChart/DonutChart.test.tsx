import { render, screen, within } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { DonutChart } from './DonutChart';

import type { DonutChartProps } from './DonutChart';

const BASE = {
  dataLabel: 'Ver datos',
  emptyLabel: 'Todavía no hay planes.',
  labels: ['Activo', 'Archivado', 'Fallido'],
  labelsHeader: 'Estado',
  locale: 'es-ES',
  title: 'Planes por estado'
} satisfies Partial<DonutChartProps>;

function slices(container: HTMLElement) {
  return Array.from(container.querySelectorAll('circle'));
}

function plain(text: string | null | undefined) {
  return text?.replace(/\s/g, ' ');
}

describe('DonutChart', () => {
  it('names the figure and the plot with the title', () => {
    render(<DonutChart {...BASE} series={[{ name: 'Planes', values: [6, 3, 1] }]} />);
    expect(screen.getByRole('figure', { name: 'Planes por estado' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Planes por estado' })).toBeInTheDocument();
  });

  it('always shows the legend with each count and share, even for one slice', () => {
    render(<DonutChart {...BASE} labels={['Activo']} series={[{ name: 'Planes', values: [4] }]} />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map(item => plain(item.textContent))).toEqual(['Activo4 · 100 %']);
  });

  it('titles every slice with its count and share, and sizes it to that share', () => {
    const { container } = render(<DonutChart {...BASE} series={[{ name: 'Planes', values: [6, 3, 1] }]} />);
    const all = slices(container);
    expect(all.map(slice => plain(slice.querySelector('title')?.textContent))).toEqual([
      'Activo: 6 (60 %)',
      'Archivado: 3 (30 %)',
      'Fallido: 1 (10 %)'
    ]);

    const lengths = all.map(slice => Number.parseFloat(slice.getAttribute('stroke-dasharray') ?? 'NaN'));
    // Each visible arc is its share of the ring less the same small gap, so the ratios hold.
    expect(((lengths[0] ?? 0) + 1.2) / ((lengths[1] ?? 0) + 1.2)).toBeCloseTo(2, 5);
  });

  it('skips a zero slice but keeps it in the legend and the table', () => {
    const { container } = render(<DonutChart {...BASE} series={[{ name: 'Planes', values: [6, 0, 1] }]} />);
    expect(slices(container)).toHaveLength(2);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3);
    expect(within(screen.getByRole('table', { name: 'Planes por estado' })).getAllByRole('rowheader')).toHaveLength(3);
  });

  it('carries each share in the table when given a share header', () => {
    render(<DonutChart {...BASE} series={[{ name: 'Planes', values: [3, 1, 0] }]} shareHeader="Del total" />);
    const table = screen.getByRole('table', { name: 'Planes por estado' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['Estado', 'Planes', 'Del total']);
    expect(plain(within(table).getByRole('rowheader', { name: 'Activo' }).closest('tr')?.textContent)).toBe('Activo375 %');
  });

  it('draws a single slice as a whole ring, with no gap', () => {
    const { container } = render(<DonutChart {...BASE} series={[{ name: 'Planes', values: [5, 0, 0] }]} />);
    const [ring] = slices(container);
    const [visible, rest] = (ring?.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number.parseFloat);
    expect(rest).toBeCloseTo(0, 5);
    expect(visible).toBeCloseTo(2 * Math.PI * 40, 5);
  });

  it('shows the empty state when every value is zero', () => {
    render(<DonutChart {...BASE} series={[{ name: 'Planes', values: [0, 0, 0] }]} />);
    expect(screen.getByText('Todavía no hay planes.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
