import { render, screen } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import userEvent from '@testing-library/user-event';

import { Switch } from './Switch';

describe('Switch', () => {
  it('renders an interactive switch with the root base class', () => {
    render(<Switch aria-label="toggle" />);
    const sw = screen.getByRole('switch', { name: 'toggle' });
    expect(sw).toHaveClass('root');
  });

  it('merges a custom className with the root base class', () => {
    render(<Switch aria-label="toggle" className="extra" />);
    const sw = screen.getByRole('switch', { name: 'toggle' });
    expect(sw).toHaveClass('root');
    expect(sw).toHaveClass('extra');
  });

  it('forwards `disabled` to the underlying control', () => {
    render(<Switch aria-label="toggle" disabled={true} />);
    expect(screen.getByRole('switch', { name: 'toggle' })).toBeDisabled();
  });

  it('fires onCheckedChange when the user clicks', async () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="toggle" onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByRole('switch', { name: 'toggle' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
