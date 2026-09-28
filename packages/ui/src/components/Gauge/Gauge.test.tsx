import { render, screen, within } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Gauge } from './Gauge';

import type { GaugeProps } from './Gauge';

const BASE = {
  capLabel: 'Límite',
  dataLabel: 'Ver datos',
  emptyLabel: 'Sin límite fijado.',
  formatValue: (value: number) => `${value.toFixed(2)} $`,
  labelsHeader: 'Mes',
  locale: 'es-ES',
  overLabel: 'Por encima del límite',
  title: 'Gasto en imágenes',
  valueLabel: 'Gastado'
} satisfies Partial<GaugeProps>;

function fill(container: HTMLElement) {
  return container.querySelector('rect.fill');
}

describe('Gauge', () => {
  it('names the figure and the plot with the title, and prints both figures', () => {
    render(<Gauge {...BASE} cap={10} value={4} />);
    expect(screen.getByRole('figure', { name: 'Gasto en imágenes' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Gasto en imágenes' })).toBeInTheDocument();
    expect(screen.getAllByText('4.00 $').length).toBeGreaterThan(0);
    expect(screen.getAllByText('10.00 $').length).toBeGreaterThan(0);
  });

  it('fills the value against the cap, from zero', () => {
    const { container } = render(<Gauge {...BASE} cap={10} value={4} />);
    expect(fill(container)).toHaveAttribute('width', '40%');
    expect(fill(container)?.querySelector('title')?.textContent).toBe('Gastado: 4.00 $');
    expect(screen.queryByText('Por encima del límite')).not.toBeInTheDocument();
  });

  it('says it is over the cap in words, with a full bar in the over state', () => {
    const { container } = render(<Gauge {...BASE} cap={10} value={12.5} />);
    expect(fill(container)).toHaveAttribute('width', '100%');
    expect(fill(container)).toHaveClass('over');
    expect(screen.getByText('Por encima del límite')).toBeInTheDocument();
  });

  it('keeps the figures in the table', () => {
    render(<Gauge {...BASE} cap={10} value={4} />);
    const table = screen.getByRole('table', { name: 'Gasto en imágenes' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['Mes', 'Gastado', 'Límite']);
    expect(
      within(table)
        .getAllByRole('cell')
        .map(cell => cell.textContent)
    ).toEqual(['4.00 $', '10.00 $']);
  });

  it('draws no fill at zero', () => {
    const { container } = render(<Gauge {...BASE} cap={10} value={0} />);
    expect(fill(container)).toBeNull();
  });

  it('shows the empty state without a cap', () => {
    render(<Gauge {...BASE} cap={0} value={3} />);
    expect(screen.getByText('Sin límite fijado.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
