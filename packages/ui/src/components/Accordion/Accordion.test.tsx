import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { AccordionItem } from './components/AccordionItem';

import userEvent from '@testing-library/user-event';

import { Accordion } from './Accordion';

function renderAccordion(extra?: { className?: string }) {
  return render(
    <Accordion className={extra?.className} collapsible={true} type="single">
      <AccordionItem trigger="One" value="1">
        content-one
      </AccordionItem>
      <AccordionItem trigger="Two" value="2">
        content-two
      </AccordionItem>
    </Accordion>
  );
}

describe('Accordion', () => {
  it('renders the root with the base class', () => {
    const { container } = renderAccordion();
    expect(container.firstChild).toHaveClass('root');
  });

  it('merges a custom className with the base class', () => {
    const { container } = renderAccordion({ className: 'extra' });
    expect(container.firstChild).toHaveClass('root');
    expect(container.firstChild).toHaveClass('extra');
  });

  it('items render with their trigger labels visible', () => {
    renderAccordion();
    expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Two' })).toBeInTheDocument();
  });

  it('expands an item when its trigger is clicked', async () => {
    renderAccordion();
    await userEvent.click(screen.getByRole('button', { name: 'One' }));
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-expanded', 'true');
  });
});
