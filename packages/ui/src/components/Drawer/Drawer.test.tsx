import { render, screen } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import userEvent from '@testing-library/user-event';

import { Drawer } from './Drawer';

function renderDrawer(extra?: { description?: string; onOpenChange?: (open: boolean) => void; open?: boolean }) {
  return render(
    <Drawer
      description={extra?.description}
      onOpenChange={extra?.onOpenChange}
      open={extra?.open}
      title="My drawer"
      trigger={<button data-testid="trigger">Open</button>}
    >
      <p>drawer body</p>
    </Drawer>
  );
}

describe('Drawer', () => {
  it('renders only the trigger when closed', () => {
    renderDrawer();
    expect(screen.getByTestId('trigger')).toBeInTheDocument();
    expect(screen.queryByText('drawer body')).not.toBeInTheDocument();
  });

  it('shows title + body when controlled open=true', () => {
    renderDrawer({ open: true });
    expect(screen.getByText('My drawer')).toBeInTheDocument();
    expect(screen.getByText('drawer body')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    renderDrawer({ description: 'extra info', open: true });
    expect(screen.getByText('extra info')).toBeInTheDocument();
  });

  it('omits the description when not provided', () => {
    renderDrawer({ open: true });
    expect(screen.queryByText('extra info')).not.toBeInTheDocument();
  });

  it('wires aria-describedby to the description node when provided', () => {
    renderDrawer({ description: 'extra info', open: true });
    const dialog = screen.getByRole('dialog');
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const target = describedBy ? document.getElementById(describedBy) : null;
    expect(target).toHaveTextContent('extra info');
  });

  it('explicitly nulls aria-describedby when no description is provided (no dangling vaul-default id)', () => {
    renderDrawer({ open: true });
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
  });

  it('fires onOpenChange when the trigger is clicked', async () => {
    const onOpenChange = vi.fn();
    renderDrawer({ onOpenChange });
    await userEvent.click(screen.getByTestId('trigger'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
