import { render, screen } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import userEvent from '@testing-library/user-event';

import { Dialog } from './Dialog';

function renderDialog(extra?: { description?: string; onOpenChange?: (open: boolean) => void; open?: boolean }) {
  return render(
    <Dialog
      closeButton={<button data-testid="close">×</button>}
      description={extra?.description}
      onOpenChange={extra?.onOpenChange}
      open={extra?.open}
      title="My dialog"
      trigger={<button data-testid="trigger">Open</button>}
    >
      <p>body content</p>
    </Dialog>
  );
}

describe('Dialog', () => {
  describe('closed (default)', () => {
    it('renders only the trigger; content is hidden in the portal', () => {
      renderDialog();
      expect(screen.getByTestId('trigger')).toBeInTheDocument();
      expect(screen.queryByText('body content')).not.toBeInTheDocument();
    });
  });

  describe('open', () => {
    it('shows title, body, and close button when open=true', () => {
      renderDialog({ open: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('My dialog')).toBeInTheDocument();
      expect(screen.getByText('body content')).toBeInTheDocument();
      expect(screen.getByTestId('close')).toBeInTheDocument();
    });

    it('renders the description when provided', () => {
      renderDialog({ description: 'extra info', open: true });
      expect(screen.getByText('extra info')).toBeInTheDocument();
    });

    it('omits the description when not provided', () => {
      renderDialog({ open: true });
      expect(screen.queryByText('extra info')).not.toBeInTheDocument();
    });

    it('wires aria-describedby to the description node when provided', () => {
      renderDialog({ description: 'extra info', open: true });
      const dialog = screen.getByRole('dialog');
      const describedBy = dialog.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const target = describedBy ? document.getElementById(describedBy) : null;
      expect(target).toHaveTextContent('extra info');
    });

    it('explicitly nulls aria-describedby when no description is provided (no dangling Radix-default id)', () => {
      // Radix auto-wires aria-describedby to a generated id when Dialog.Description is
      // present. Without our `aria-describedby={undefined}` override, omitting Description
      // would leave the attribute pointing at a non-existent id and Radix would warn at
      // dev time. Verify the attribute is absent in the no-description branch.
      renderDialog({ open: true });
      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
    });
  });

  describe('interactions', () => {
    it('fires onOpenChange(true) when the trigger is clicked', async () => {
      const onOpenChange = vi.fn();
      renderDialog({ onOpenChange });
      await userEvent.click(screen.getByTestId('trigger'));
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });
  });
});
