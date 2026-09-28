import { render, screen, within } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { ChartAxes } from './components/ChartAxes';

import userEvent from '@testing-library/user-event';

import { ChartFrame } from './ChartFrame';

import type { ChartFrameProps } from './ChartFrame';

const BASE = {
  dataLabel: 'Ver datos',
  empty: false,
  emptyLabel: 'Nada que mostrar.',
  table: { columns: ['Altas'], labelsHeader: 'Día', rows: [{ cells: ['4'], label: '28 sept' }] },
  title: 'Altas por día',
  titleId: 'chart-title'
} satisfies Partial<ChartFrameProps>;

describe('ChartFrame', () => {
  it('captions the figure with the title and names the figure with it', () => {
    render(
      <ChartFrame {...BASE}>
        <svg aria-labelledby="chart-title" role="img" />
      </ChartFrame>
    );
    expect(screen.getByRole('figure', { name: 'Altas por día' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Altas por día' })).toBeInTheDocument();
  });

  it('keeps the figures in a table behind a "show data" disclosure', async () => {
    const { container } = render(
      <ChartFrame {...BASE}>
        <svg />
      </ChartFrame>
    );
    const details = container.querySelector('details');
    expect(details).not.toHaveAttribute('open');

    await userEvent.click(screen.getByText('Ver datos'));
    expect(details).toHaveAttribute('open');

    const table = screen.getByRole('table', { name: 'Altas por día' });
    expect(within(table).getByRole('rowheader', { name: '28 sept' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '4' })).toBeInTheDocument();
  });

  it('draws the legend it is given, with details, and none without it', () => {
    const { rerender } = render(
      <ChartFrame {...BASE}>
        <svg />
      </ChartFrame>
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    rerender(
      <ChartFrame
        {...BASE}
        legend={[
          { detail: '6', name: 'Activo', tone: 'success' },
          { detail: '2', name: 'Fallido', tone: 'failure' }
        ]}
      >
        <svg />
      </ChartFrame>
    );
    expect(
      within(screen.getByRole('list'))
        .getAllByRole('listitem')
        .map(item => item.textContent)
    ).toEqual(['Activo6', 'Fallido2']);
  });

  it('puts the legend after the plot when beside it', () => {
    const { container } = render(
      <ChartFrame {...BASE} layout="beside" legend={[{ name: 'Activo' }]}>
        <svg data-testid="plot" />
      </ChartFrame>
    );
    const plot = screen.getByTestId('plot');
    expect(plot.nextElementSibling?.tagName).toBe('UL');
    expect(container.querySelector('.beside')).not.toBeNull();
  });

  it('says it is empty in words, with no plot and no table', () => {
    render(
      <ChartFrame {...BASE} empty={true}>
        <svg data-testid="plot" />
      </ChartFrame>
    );
    expect(screen.getByText('Nada que mostrar.')).toBeInTheDocument();
    expect(screen.queryByTestId('plot')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('forwards className alongside the internal class', () => {
    render(
      <ChartFrame {...BASE} className="extra">
        <svg />
      </ChartFrame>
    );
    const figure = screen.getByRole('figure', { name: 'Altas por día' });
    expect(figure).toHaveClass('root');
    expect(figure).toHaveClass('extra');
  });
});

describe('ChartAxes', () => {
  it('draws a baseline, gridlines with their labels, and the x labels, all hidden from assistive technology', () => {
    const { container } = render(
      <svg>
        <ChartAxes
          labels={[
            { anchor: 'start', minor: false, text: '1 sept', x: 0 },
            { anchor: 'middle', minor: true, text: '15 sept', x: 50 },
            { anchor: 'end', minor: false, text: '30 sept', x: 100 }
          ]}
          labelY={200}
          ticks={[
            { text: '0', y: 180 },
            { text: '50', y: 100 },
            { text: '100', y: 20 }
          ]}
        />
      </svg>
    );
    expect(container.querySelectorAll('g[aria-hidden="true"]')).toHaveLength(2);
    expect(container.querySelectorAll('g[aria-hidden="true"] line, g[aria-hidden="true"] text')).toHaveLength(8);
    expect(container.querySelectorAll('line.baseline')).toHaveLength(1);
    expect(container.querySelectorAll('line.grid')).toHaveLength(2);
    // Zero is the baseline itself and needs no label.
    expect(Array.from(container.querySelectorAll('text.tick')).map(text => text.textContent)).toEqual(['50', '100']);

    const labels = Array.from(container.querySelectorAll('text.label'));
    expect(labels.map(label => [label.textContent, label.getAttribute('x'), label.getAttribute('text-anchor')])).toEqual([
      ['1 sept', '0%', 'start'],
      ['15 sept', '50%', 'middle'],
      ['30 sept', '100%', 'end']
    ]);
    expect(labels[1]).toHaveClass('minor');
  });
});
