import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { StatTile } from './StatTile';

function plain(text: string | null | undefined) {
  return text?.replace(/\s/g, ' ');
}

describe('StatTile', () => {
  it('shows the label and the figure', () => {
    render(<StatTile label="Altas" locale="es-ES" value="1.204" />);
    expect(screen.getByText('Altas')).toBeInTheDocument();
    expect(screen.getByText('1.204')).toBeInTheDocument();
  });

  it('draws the change as an up arrow and a signed percentage, said in words by changeLabel', () => {
    const { container } = render(
      <StatTile change={{ current: 112, previous: 100 }} changeLabel="{change} frente al periodo anterior" label="Altas" locale="es-ES" value="112" />
    );
    const hidden = container.querySelector('.visually-hidden');
    expect(plain(hidden?.textContent)).toBe('+12 % frente al periodo anterior');
    // The drawn percentage is hidden from a screen reader, which hears the sentence instead.
    expect(plain(hidden?.previousElementSibling?.textContent)).toBe('+12 %');
    expect(hidden?.previousElementSibling).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg path')?.getAttribute('d')).toBe('M5 1.5l4 6.5H1z');
  });

  it('draws a fall with a down arrow and a minus sign', () => {
    const { container } = render(<StatTile change={{ current: 75, previous: 100 }} label="Altas" locale="es-ES" value="75" />);
    expect(plain(container.querySelector('.change')?.textContent)).toBe('-25 %');
    expect(container.querySelector('svg path')?.getAttribute('d')).toBe('M5 8.5L1 2h8z');
  });

  it('colours the change by which way is good, and leaves it grey without one', () => {
    const { container, rerender } = render(
      <StatTile change={{ current: 12, previous: 10 }} goodDirection="up" label="Altas" locale="es-ES" value="12" />
    );
    expect(container.querySelector('.change')).toHaveClass('good');

    rerender(<StatTile change={{ current: 12, previous: 10 }} goodDirection="down" label="Fallos" locale="es-ES" value="12" />);
    expect(container.querySelector('.change')).toHaveClass('bad');

    rerender(<StatTile change={{ current: 12, previous: 10 }} label="Altas" locale="es-ES" value="12" />);
    expect(container.querySelector('.change')).toHaveClass('flat');
  });

  it('draws no arrow when nothing moved', () => {
    const { container } = render(<StatTile change={{ current: 10, previous: 10 }} label="Altas" locale="es-ES" value="10" />);
    expect(plain(container.querySelector('.change')?.textContent)).toBe('0 %');
    expect(container.querySelector('.change svg')).toBeNull();
  });

  it('draws no change when the previous period was zero', () => {
    const { container } = render(
      <StatTile change={{ current: 5, previous: 0 }} changeLabel="{change} frente al periodo anterior" label="Altas" locale="es-ES" value="5" />
    );
    expect(container.querySelector('.change')).toBeNull();
  });

  it('shows a note and a decorative sparkline', () => {
    const { container } = render(<StatTile label="Altas" locale="es-ES" note="Cuentas confirmadas" sparkline={[1, 4, 2]} value="7" />);
    expect(screen.getByText('Cuentas confirmadas')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('forwards className alongside the internal class', () => {
    const { container } = render(<StatTile className="extra" label="Altas" locale="es-ES" value="7" />);
    expect(container.firstElementChild).toHaveClass('tile');
    expect(container.firstElementChild).toHaveClass('extra');
  });
});
