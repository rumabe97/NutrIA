import { render, screen } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import { SelectOption } from './components/SelectOption';

import userEvent from '@testing-library/user-event';

import { Select } from './Select';

function renderSelect(extra?: { onValueChange?: (v: string) => void }) {
  return render(
    <Select aria-label="numbers" onValueChange={extra?.onValueChange} placeholder="pick one">
      <SelectOption indicator="✓" value="1">
        One
      </SelectOption>
      <SelectOption indicator="✓" value="2">
        Two
      </SelectOption>
    </Select>
  );
}

describe('Select', () => {
  it('renders a trigger showing the placeholder', () => {
    renderSelect();
    expect(screen.getByRole('combobox')).toHaveTextContent('pick one');
  });

  it('the trigger carries the trigger base class', () => {
    renderSelect();
    expect(screen.getByRole('combobox')).toHaveClass('trigger');
  });

  it('content is hidden until the trigger is activated', () => {
    renderSelect();
    expect(screen.queryByRole('option', { name: 'One' })).not.toBeInTheDocument();
  });

  it('opens the listbox when the trigger is clicked', async () => {
    renderSelect();
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'One' })).toHaveClass('option');
    expect(screen.getByRole('option', { name: 'Two' })).toHaveClass('option');
  });

  it('fires onValueChange when an option is picked', async () => {
    const onValueChange = vi.fn();
    renderSelect({ onValueChange });
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Two' }));
    expect(onValueChange).toHaveBeenCalledWith('2');
  });
});
