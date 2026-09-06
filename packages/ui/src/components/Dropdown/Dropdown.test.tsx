import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { DropdownGroup } from './components/DropdownGroup';
import { DropdownOption } from './components/DropdownOption';

import userEvent from '@testing-library/user-event';

import { Dropdown } from './Dropdown';

function renderDropdown() {
  return render(
    <Dropdown label="menu" prefix={<span>›</span>} suffix={<span>‹</span>}>
      <DropdownGroup>
        <DropdownOption>One</DropdownOption>
        <DropdownOption className="extra">Two</DropdownOption>
      </DropdownGroup>
    </Dropdown>
  );
}

describe('Dropdown', () => {
  it('renders a trigger with the label, prefix, and suffix', () => {
    renderDropdown();
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveClass('trigger');
    expect(trigger).toHaveTextContent('menu');
    expect(trigger).toHaveTextContent('›');
    expect(trigger).toHaveTextContent('‹');
  });

  it('content is hidden until the trigger is clicked', () => {
    renderDropdown();
    expect(screen.queryByText('One')).not.toBeInTheDocument();
  });

  it('shows the menu items after clicking the trigger', async () => {
    renderDropdown();
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menuitem', { name: 'One' })).toHaveClass('option');
    const two = screen.getByRole('menuitem', { name: 'Two' });
    expect(two).toHaveClass('option');
    expect(two).toHaveClass('extra');
  });
});
