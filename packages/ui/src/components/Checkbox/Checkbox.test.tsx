import { render, screen } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import userEvent from '@testing-library/user-event';

import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders an interactive checkbox labelled by the `label` prop', () => {
    render(<Checkbox label="I agree" />);
    expect(screen.getByRole('checkbox', { name: 'I agree' })).toHaveClass('root');
  });

  it('clicking the label text toggles the checkbox (WCAG 2.5.8 equivalent target)', async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="I agree" onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByText('I agree'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('clicking the visual checkbox also toggles it', async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="I agree" onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'I agree' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('merges a custom className with the wrapper base class', () => {
    render(<Checkbox className="extra" label="I agree" />);
    const cb = screen.getByRole('checkbox', { name: 'I agree' });
    // className goes on the wrapping <label>, not on the inner checkbox button
    expect(cb.closest('label')).toHaveClass('wrapper');
    expect(cb.closest('label')).toHaveClass('extra');
  });

  it('forwards `disabled` to the underlying control', () => {
    render(<Checkbox disabled={true} label="I agree" />);
    expect(screen.getByRole('checkbox', { name: 'I agree' })).toBeDisabled();
  });

  it('accepts ReactNode labels (not just strings)', () => {
    render(<Checkbox label={<span data-testid="custom-label">Custom</span>} />);
    expect(screen.getByTestId('custom-label')).toBeInTheDocument();
  });
});
