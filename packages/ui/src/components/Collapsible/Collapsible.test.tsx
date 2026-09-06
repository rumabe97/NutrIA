import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { CollapsibleContent } from './components/CollapsibleContent';
import { CollapsibleTrigger } from './components/CollapsibleTrigger';

import userEvent from '@testing-library/user-event';

import { Collapsible } from './Collapsible';

function renderCollapsible() {
  return render(
    <Collapsible className="extra-root">
      <CollapsibleTrigger className="extra-trigger">toggle</CollapsibleTrigger>
      <CollapsibleContent className="extra-content">body</CollapsibleContent>
    </Collapsible>
  );
}

describe('Collapsible', () => {
  it('applies the root + custom class on the wrapper', () => {
    const { container } = renderCollapsible();
    expect(container.firstChild).toHaveClass('root');
    expect(container.firstChild).toHaveClass('extra-root');
  });

  it('trigger and content apply their base + custom classes', () => {
    renderCollapsible();
    const trigger = screen.getByRole('button', { name: 'toggle' });
    expect(trigger).toHaveClass('trigger');
    expect(trigger).toHaveClass('extra-trigger');
  });

  it('toggles aria-expanded on the trigger when clicked', async () => {
    renderCollapsible();
    const trigger = screen.getByRole('button', { name: 'toggle' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});
