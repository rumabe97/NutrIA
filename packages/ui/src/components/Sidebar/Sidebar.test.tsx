import { render, screen } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import userEvent from '@testing-library/user-event';

import { Sidebar } from './Sidebar';

function renderSidebar(extra?: { description?: string; direction?: 'left' | 'right'; onOpenChange?: (open: boolean) => void; open?: boolean }) {
  return render(
    <Sidebar
      description={extra?.description}
      direction={extra?.direction}
      onOpenChange={extra?.onOpenChange}
      open={extra?.open}
      title="Nav"
      trigger={<button data-testid="trigger">Open</button>}
    >
      <p>sidebar body</p>
    </Sidebar>
  );
}

describe('Sidebar', () => {
  it('renders only the trigger when closed', () => {
    renderSidebar();
    expect(screen.getByTestId('trigger')).toBeInTheDocument();
    expect(screen.queryByText('sidebar body')).not.toBeInTheDocument();
  });

  it('shows title and body when open=true', () => {
    renderSidebar({ open: true });
    expect(screen.getByText('Nav')).toBeInTheDocument();
    expect(screen.getByText('sidebar body')).toBeInTheDocument();
  });

  it('applies the direction class (left by default, right when overridden)', () => {
    const { rerender } = renderSidebar({ open: true });
    expect(document.querySelector('.left')).not.toBeNull();
    rerender(
      <Sidebar direction="right" open={true} title="Nav" trigger={<button>Open</button>}>
        <p>x</p>
      </Sidebar>
    );
    expect(document.querySelector('.right')).not.toBeNull();
  });

  it('renders the description when provided', () => {
    renderSidebar({ description: 'extra info', open: true });
    expect(screen.getByText('extra info')).toBeInTheDocument();
  });

  it('omits the description when not provided', () => {
    renderSidebar({ open: true });
    expect(screen.queryByText('extra info')).not.toBeInTheDocument();
  });

  it('wires aria-describedby to the description node when provided', () => {
    renderSidebar({ description: 'extra info', open: true });
    const aside = document.querySelector('aside');
    const describedBy = aside?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const target = describedBy ? document.getElementById(describedBy) : null;
    expect(target).toHaveTextContent('extra info');
  });

  it('explicitly nulls aria-describedby when no description is provided (no dangling vaul-default id)', () => {
    renderSidebar({ open: true });
    expect(document.querySelector('aside')).not.toHaveAttribute('aria-describedby');
  });

  it('fires onOpenChange when the trigger is clicked', async () => {
    const onOpenChange = vi.fn();
    renderSidebar({ onOpenChange });
    await userEvent.click(screen.getByTestId('trigger'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
