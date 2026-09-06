import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { TabsContent } from './components/TabsContent';
import { TabsList } from './components/TabsList';
import { TabsTrigger } from './components/TabsTrigger';

import userEvent from '@testing-library/user-event';

import { Tabs } from './Tabs';

function renderTabs() {
  return render(
    <Tabs defaultValue="one">
      <TabsList className="extra-list">
        <TabsTrigger className="extra-trigger" value="one">
          One
        </TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
      </TabsList>
      <TabsContent className="extra-content" value="one">
        content-one
      </TabsContent>
      <TabsContent value="two">content-two</TabsContent>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('shows the default tab content and hides the others', () => {
    renderTabs();
    expect(screen.getByText('content-one')).toBeInTheDocument();
    expect(screen.queryByText('content-two')).not.toBeInTheDocument();
  });

  it('TabsList, TabsTrigger, TabsContent apply their base + custom classes', () => {
    renderTabs();
    expect(screen.getByRole('tablist')).toHaveClass('list');
    expect(screen.getByRole('tablist')).toHaveClass('extra-list');
    const trigger = screen.getByRole('tab', { name: 'One' });
    expect(trigger).toHaveClass('trigger');
    expect(trigger).toHaveClass('extra-trigger');
    const panel = screen.getByText('content-one');
    expect(panel).toHaveClass('content');
    expect(panel).toHaveClass('extra-content');
  });

  it('switches panels when a trigger is clicked', async () => {
    renderTabs();
    await userEvent.click(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.getByText('content-two')).toBeInTheDocument();
    expect(screen.queryByText('content-one')).not.toBeInTheDocument();
  });
});
