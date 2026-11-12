import { render, screen, within } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Rings } from './Rings';

const DAY = [
  { label: 'Calorías', max: 2246, value: 1880, valueText: '1880 de 2246 kcal' },
  { label: 'Proteína', max: 113, value: 104, valueText: '104 de 113 g' },
  { label: 'Hidratos', max: 291, value: 238, valueText: '238 de 291 g' },
  { label: 'Grasas', max: 70, value: 61, valueText: '61 de 70 g' }
];

function arcs(container: HTMLElement) {
  return [...container.querySelectorAll('circle[pathLength]')];
}

describe('Rings', () => {
  it('is a named group whose figures are a list, one item per ring', () => {
    render(<Rings items={DAY} label="Objetivos de hoy" />);
    const group = screen.getByRole('group', { name: 'Objetivos de hoy' });
    const items = within(group).getAllByRole('listitem');
    expect(items.map(item => item.textContent)).toEqual([
      'Calorías: 1880 de 2246 kcal',
      'Proteína: 104 de 113 g',
      'Hidratos: 238 de 291 g',
      'Grasas: 61 de 70 g'
    ]);
  });

  it('hides the picture from assistive technology', () => {
    const { container } = render(<Rings items={DAY} label="Objetivos" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws each ring to its share of the maximum', () => {
    const { container } = render(<Rings items={[{ label: 'Comidas', max: 42, value: 21 }]} label="Comidas hechas" />);
    expect(arcs(container)[0]).toHaveAttribute('stroke-dashoffset', '50');
  });

  it('clamps a value over its maximum at a full ring, and never below an empty one', () => {
    const { container } = render(
      <Rings
        items={[
          { label: 'Over', max: 100, value: 140 },
          { label: 'Under', max: 100, value: -5 },
          { label: 'No max', max: 0, value: 10 }
        ]}
        label="Bounds"
      />
    );
    // A full ring is drawn; an empty one, or one with no maximum, draws no arc at all.
    expect(arcs(container)).toHaveLength(1);
    expect(arcs(container)[0]).toHaveAttribute('stroke-dashoffset', '0');
  });

  it('says the figures as "value / max" when no words are given', () => {
    render(<Rings items={[{ label: 'Agua', max: 8, value: 3 }]} label="Hoy" />);
    expect(screen.getByRole('listitem')).toHaveTextContent('Agua: 3 / 8');
  });

  it('draws four rings at most, coloured by place unless told otherwise', () => {
    const { container } = render(
      <Rings
        items={[...DAY, { label: 'Fibra', max: 30, value: 20 }].map((item, index) => (index === 1 ? { ...item, tone: 4 as const } : item))}
        label="Hoy"
      />
    );
    expect(arcs(container)).toHaveLength(4);
    expect(arcs(container)[0]).toHaveClass('tone1');
    expect(arcs(container)[1]).toHaveClass('tone4');
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('sweeps in, and starts each ring a step after the one outside it', () => {
    const { container } = render(<Rings items={DAY} label="Hoy" />);
    expect(arcs(container)[0]).toHaveClass('motion-sweep');
    expect(arcs(container)[0]?.parentElement).toHaveClass('motion-figures');
  });

  it('is only a picture when decorative: no group, no list, hidden whole, the rings still drawn', () => {
    const { container } = render(<Rings decorative={true} items={DAY} label="Hoy" />);
    expect(screen.queryByRole('group')).toBeNull();
    expect(container.querySelector('ul')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(arcs(container)).toHaveLength(4);
  });

  it('forwards className and its size', () => {
    render(<Rings className="extra" items={DAY} label="Hoy" size="lg" />);
    const group = screen.getByRole('group');
    expect(group).toHaveClass('root');
    expect(group).toHaveClass('lg');
    expect(group).toHaveClass('extra');
  });
});
