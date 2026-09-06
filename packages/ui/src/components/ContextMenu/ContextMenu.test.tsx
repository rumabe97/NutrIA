import { fireEvent, render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { ContextMenuItem } from './components/ContextMenuItem';

import { ContextMenu } from './ContextMenu';

function renderContextMenu() {
  return render(
    <ContextMenu trigger={<div data-testid="zone">right-click me</div>}>
      <ContextMenuItem icon={<span>📋</span>} suffix={<span>⌘C</span>}>
        Copy
      </ContextMenuItem>
      <ContextMenuItem>Paste</ContextMenuItem>
    </ContextMenu>
  );
}

describe('ContextMenu', () => {
  it('renders the trigger', () => {
    renderContextMenu();
    expect(screen.getByTestId('zone')).toBeInTheDocument();
  });

  it('content is hidden until the trigger is right-clicked', () => {
    renderContextMenu();
    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
  });

  it('opens the menu on contextmenu event and shows items with the item base class', () => {
    renderContextMenu();
    fireEvent.contextMenu(screen.getByTestId('zone'));
    const copy = screen.getByRole('menuitem', { name: /Copy/ });
    expect(copy).toHaveClass('item');
    expect(copy).toHaveTextContent('📋');
    expect(copy).toHaveTextContent('⌘C');
  });
});
