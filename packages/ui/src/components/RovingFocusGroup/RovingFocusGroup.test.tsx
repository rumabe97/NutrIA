import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import userEvent from '@testing-library/user-event';

import { RovingFocusGroup, RovingFocusGroupItem } from './RovingFocusGroup';

function Fixture() {
  return (
    <RovingFocusGroup className="extra" orientation="horizontal">
      <RovingFocusGroupItem asChild={true}>
        <button type="button">One</button>
      </RovingFocusGroupItem>
      <RovingFocusGroupItem asChild={true}>
        <button type="button">Two</button>
      </RovingFocusGroupItem>
      <RovingFocusGroupItem asChild={true}>
        <button type="button">Three</button>
      </RovingFocusGroupItem>
    </RovingFocusGroup>
  );
}

describe('RovingFocusGroup', () => {
  it('renders children and applies the className to the root', () => {
    const { container } = render(<Fixture />);
    expect(container.querySelector('.extra')).not.toBeNull();
    ['One', 'Two', 'Three'].forEach(name => {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    });
  });

  it('arrow keys move focus between items (roving tabindex)', async () => {
    render(<Fixture />);
    const first = screen.getByRole('button', { name: 'One' });
    first.focus();
    expect(first).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Two' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Three' })).toHaveFocus();
  });
});
