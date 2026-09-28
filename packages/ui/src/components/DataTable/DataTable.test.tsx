import { render, screen, within } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { DataTable } from './DataTable';

import type { DataTableColumn, DataTableRow } from './DataTable';

const COLUMNS: DataTableColumn[] = [
  { header: 'Email', key: 'email', sorted: 'asc', sortHref: '?sort=email' },
  { align: 'end', header: 'Planes', key: 'plans', sortHref: '?sort=plans' },
  { header: 'Rol', key: 'role' }
];

const ROWS: DataTableRow[] = [
  { id: 'a', cells: { email: 'ana@example.com', plans: 3, role: 'user' } },
  { id: 'b', cells: { email: 'luis@example.com', plans: 12, role: 'admin' } }
];

describe('DataTable', () => {
  it('renders a table named by its caption, inside a focusable region with the same name', () => {
    render(<DataTable caption="Cuentas" columns={COLUMNS} empty="Nadie" rows={ROWS} />);
    const region = screen.getByRole('region', { name: 'Cuentas' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(within(region).getByRole('table', { name: 'Cuentas' })).toBeInTheDocument();
  });

  it('keeps the caption as the name when it is hidden', () => {
    render(<DataTable caption="Cuentas" columns={COLUMNS} empty="Nadie" hideCaption={true} rows={ROWS} />);
    expect(screen.getByRole('table', { name: 'Cuentas' })).toBeInTheDocument();
    expect(screen.getByText('Cuentas')).toHaveClass('visually-hidden');
  });

  it('makes the first cell of each row its header', () => {
    render(<DataTable caption="Cuentas" columns={COLUMNS} empty="Nadie" rows={ROWS} />);
    expect(screen.getByRole('rowheader', { name: 'ana@example.com' })).toBeInTheDocument();
    expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['3', 'user', '12', 'admin']);
  });

  it('makes a sortable header a link, and marks the sorted one with aria-sort', () => {
    render(<DataTable caption="Cuentas" columns={COLUMNS} empty="Nadie" rows={ROWS} />);
    const email = screen.getByRole('columnheader', { name: 'Email' });
    expect(email).toHaveAttribute('aria-sort', 'ascending');
    expect(within(email).getByRole('link', { name: 'Email' })).toHaveAttribute('href', '?sort=email');

    const plans = screen.getByRole('columnheader', { name: 'Planes' });
    expect(plans).not.toHaveAttribute('aria-sort');
    expect(within(plans).getByRole('link', { name: 'Planes' })).toHaveAttribute('href', '?sort=plans');

    const role = screen.getByRole('columnheader', { name: 'Rol' });
    expect(within(role).queryByRole('link')).not.toBeInTheDocument();
  });

  it('says descending when sorted the other way', () => {
    render(<DataTable caption="Cuentas" columns={[{ header: 'Email', key: 'email', sorted: 'desc', sortHref: '?' }]} empty="Nadie" rows={ROWS} />);
    expect(screen.getByRole('columnheader', { name: 'Email' })).toHaveAttribute('aria-sort', 'descending');
  });

  it('reads the sort hint in the link name, after the header', () => {
    render(
      <DataTable
        caption="Cuentas"
        columns={[{ header: 'Email', key: 'email', sorted: 'asc', sortHint: 'orden ascendente', sortHref: '?sort=email&dir=desc' }]}
        empty="Nadie"
        rows={ROWS}
      />
    );
    expect(screen.getByRole('link', { name: 'Email, orden ascendente' })).toHaveAttribute('href', '?sort=email&dir=desc');
  });

  it('shows the empty text across every column when there are no rows', () => {
    render(<DataTable caption="Cuentas" columns={COLUMNS} empty="Nadie coincide con el filtro." rows={[]} />);
    const cell = screen.getByRole('cell', { name: 'Nadie coincide con el filtro.' });
    expect(cell).toHaveAttribute('colspan', '3');
  });

  it('forwards className alongside the internal class', () => {
    render(<DataTable caption="Cuentas" className="extra" columns={COLUMNS} empty="Nadie" rows={ROWS} />);
    const region = screen.getByRole('region', { name: 'Cuentas' });
    expect(region).toHaveClass('region');
    expect(region).toHaveClass('extra');
  });
});
