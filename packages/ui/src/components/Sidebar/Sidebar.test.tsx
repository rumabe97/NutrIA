import { render, screen, waitFor } from '@testing-library/react';

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

  it('moves focus into the drawer when it opens, not left on the trigger behind the overlay', async () => {
    render(
      <Sidebar title="Nav" trigger={<button>Menú</button>}>
        <a href="/admin">Resumen</a>
      </Sidebar>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Menú' }));

    await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));
  });

  describe('focus on close', () => {
    function renderFocusable(onCloseAutoFocus?: (event: Event) => void) {
      return render(
        <Sidebar onCloseAutoFocus={onCloseAutoFocus} title="Nav" trigger={<button>Menú</button>}>
          <button>Inside</button>
        </Sidebar>
      );
    }

    // vaul leaves focus on the trigger when it opens, so each test moves it inside first:
    // that is where it is when somebody follows a link in the drawer.
    async function openAndFocusInside() {
      await userEvent.click(screen.getByRole('button', { name: 'Menú' }));
      const inside = await screen.findByRole('button', { name: 'Inside' });
      inside.focus();
      expect(inside).toHaveFocus();
    }

    it('returns focus to the trigger by default', async () => {
      renderFocusable();
      await openAndFocusInside();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Menú' })).toHaveFocus(), { timeout: 2000 });
    });

    it('calls onCloseAutoFocus with the event, and keeps the default when it is not prevented', async () => {
      const onCloseAutoFocus = vi.fn();
      renderFocusable(onCloseAutoFocus);
      await openAndFocusInside();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledWith(expect.any(Event)), { timeout: 2000 });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Menú' })).toHaveFocus(), { timeout: 2000 });
    });

    it('leaves focus alone when onCloseAutoFocus prevents the default', async () => {
      const onCloseAutoFocus = vi.fn((event: Event) => event.preventDefault());
      renderFocusable(onCloseAutoFocus);
      await openAndFocusInside();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalled(), { timeout: 2000 });
      expect(screen.getByRole('button', { name: 'Menú' })).not.toHaveFocus();
    });
  });
});
