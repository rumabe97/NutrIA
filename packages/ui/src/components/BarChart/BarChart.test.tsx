import { render, screen, within } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { BarChart } from './BarChart';

import type { BarChartProps } from './BarChart';

const BASE = {
  dataLabel: 'Ver datos',
  emptyLabel: 'Nadie ha llegado a ningún paso.',
  labels: ['Registro', 'Onboarding', 'Primer plan'],
  labelsHeader: 'Paso',
  locale: 'es-ES',
  title: 'Embudo'
} satisfies Partial<BarChartProps>;

function bars(container: HTMLElement) {
  return Array.from(container.querySelectorAll('rect.bar'));
}

function widthOf(rect: Element | undefined) {
  return Number.parseFloat(rect?.getAttribute('width') ?? 'NaN');
}

describe('BarChart', () => {
  it('names the figure and the plot with the title', () => {
    render(<BarChart {...BASE} series={[{ name: 'Personas', values: [100, 64, 40] }]} />);
    expect(screen.getByRole('figure', { name: 'Embudo' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Embudo' })).toBeInTheDocument();
  });

  it('starts at zero: each bar is its figure against the longest', () => {
    const { container } = render(<BarChart {...BASE} series={[{ name: 'Personas', values: [100, 64, 40] }]} />);
    expect(bars(container).map(widthOf)).toEqual([100, 64, 40]);
    expect(bars(container).every(bar => bar.getAttribute('x') === '0')).toBe(true);
  });

  it('prints each figure and its share, and titles each bar with both', () => {
    const { container } = render(
      <BarChart
        {...BASE}
        series={[{ name: 'Personas', values: [100, 64, 40] }]}
        shares={{ header: 'Del paso anterior', values: [undefined, '64 %', '63 %'] }}
      />
    );
    expect(bars(container).map(bar => bar.querySelector('title')?.textContent)).toEqual([
      'Registro: 100',
      'Onboarding: 64 (64 %)',
      'Primer plan: 40 (63 %)'
    ]);

    const table = screen.getByRole('table', { name: 'Embudo' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['Paso', 'Personas', 'Del paso anterior']);
    expect(within(table).getByRole('rowheader', { name: 'Onboarding' }).closest('tr')?.textContent).toBe('Onboarding6464 %');
  });

  it('draws no bar for a zero, keeping its row', () => {
    const { container } = render(<BarChart {...BASE} series={[{ name: 'Personas', values: [10, 0, 5] }]} />);
    expect(bars(container)).toHaveLength(2);
    expect(within(screen.getByRole('table', { name: 'Embudo' })).getAllByRole('rowheader')).toHaveLength(3);
  });

  it('shows a legend for two series or more', () => {
    render(
      <BarChart
        {...BASE}
        series={[
          { name: 'Llamadas', values: [10, 4, 2] },
          { name: 'Fallos', tone: 'failure', values: [1, 0, 2] }
        ]}
      />
    );
    expect(
      within(screen.getByRole('list'))
        .getAllByRole('listitem')
        .map(item => item.textContent)
    ).toEqual(['Llamadas', 'Fallos']);
  });

  it('shows the empty state when every value is zero', () => {
    render(<BarChart {...BASE} series={[{ name: 'Personas', values: [0, 0, 0] }]} />);
    expect(screen.getByText('Nadie ha llegado a ningún paso.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
