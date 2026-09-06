import { render, screen } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import { RadioGroupItem } from './components/RadioGroupItem';

import userEvent from '@testing-library/user-event';

import { RadioGroup } from './RadioGroup';

function renderGroup(extra?: { className?: string; onValueChange?: (v: string) => void }) {
  return render(
    <RadioGroup className={extra?.className} onValueChange={extra?.onValueChange}>
      <RadioGroupItem label="One" value="1" />
      <RadioGroupItem label="Two" value="2" />
    </RadioGroup>
  );
}

describe('RadioGroup', () => {
  it('renders a radiogroup with the root base class', () => {
    const { container } = renderGroup();
    const group = container.querySelector('[role="radiogroup"]');
    expect(group).toHaveClass('root');
  });

  it('merges a custom className with the root base class', () => {
    const { container } = renderGroup({ className: 'extra' });
    const group = container.querySelector('[role="radiogroup"]');
    expect(group).toHaveClass('root');
    expect(group).toHaveClass('extra');
  });

  it('items render with the item base class and are labelled by `label`', () => {
    renderGroup();
    expect(screen.getByRole('radio', { name: 'One' })).toHaveClass('item');
  });

  it('clicking the label text selects the radio (WCAG 2.5.8 equivalent target)', async () => {
    const onValueChange = vi.fn();
    renderGroup({ onValueChange });
    await userEvent.click(screen.getByText('Two'));
    expect(onValueChange).toHaveBeenCalledWith('2');
  });

  it('fires onValueChange when clicking the visual radio', async () => {
    const onValueChange = vi.fn();
    renderGroup({ onValueChange });
    await userEvent.click(screen.getByRole('radio', { name: 'Two' }));
    expect(onValueChange).toHaveBeenCalledWith('2');
  });
});
