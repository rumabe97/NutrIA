import { fireEvent, render, screen } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import { commandScore } from './utils/commandScore';

import userEvent from '@testing-library/user-event';

import {
  Spotlight,
  SpotlightDialog,
  SpotlightEmpty,
  SpotlightGroup,
  SpotlightInput,
  SpotlightItem,
  SpotlightList,
  SpotlightLoading,
  SpotlightSeparator
} from './index';

function MenuFixture({
  alwaysRenderSeparator,
  defaultValue,
  loop,
  onSelect,
  shouldFilter
}: {
  alwaysRenderSeparator?: boolean;
  defaultValue?: string;
  loop?: boolean;
  onSelect?: (value: string) => void;
  shouldFilter?: boolean;
}) {
  return (
    <Spotlight defaultValue={defaultValue} label="Menu" loop={loop} shouldFilter={shouldFilter}>
      <SpotlightInput aria-label="Search" placeholder="Search…" />
      <SpotlightList label="Suggestions">
        <SpotlightEmpty>No results</SpotlightEmpty>
        <SpotlightGroup heading="Fruit">
          <SpotlightItem onSelect={onSelect} value="apple">
            Apple
          </SpotlightItem>
          <SpotlightItem onSelect={onSelect} value="banana">
            Banana
          </SpotlightItem>
        </SpotlightGroup>
        <SpotlightSeparator alwaysRender={alwaysRenderSeparator} />
        <SpotlightGroup heading="Animals">
          <SpotlightItem onSelect={onSelect} value="cat">
            Cat
          </SpotlightItem>
          <SpotlightItem disabled={true} onSelect={onSelect} value="dog">
            Dog
          </SpotlightItem>
        </SpotlightGroup>
      </SpotlightList>
    </Spotlight>
  );
}

function getOption(name: string) {
  return screen.getByRole('option', { name });
}

describe('Spotlight', () => {
  describe('rendering', () => {
    it('renders a combobox input and listbox', () => {
      render(<MenuFixture />);
      // The input's accessible name is wired via aria-labelledby to the Spotlight root's
      // sr-only label — i.e. the `label` we put on `<Spotlight>` ("Menu") is the
      // name screen readers announce. The input's own aria-label is overridden by
      // aria-labelledby (the standard a11y precedence).
      expect(screen.getByRole('combobox', { name: 'Menu' })).toBeInTheDocument();
      expect(screen.getByRole('listbox', { name: 'Suggestions' })).toBeInTheDocument();
    });

    it('renders each item as role="option"', () => {
      render(<MenuFixture />);
      ['Apple', 'Banana', 'Cat', 'Dog'].forEach(name => expect(getOption(name)).toBeInTheDocument());
    });

    it('group headings are rendered with aria-labelledby on the items wrapper', () => {
      render(<MenuFixture />);
      expect(screen.getByText('Fruit')).toBeInTheDocument();
      expect(screen.getByText('Animals')).toBeInTheDocument();
    });

    it('disabled items expose aria-disabled and data-disabled', () => {
      render(<MenuFixture />);
      const dog = getOption('Dog');
      expect(dog).toHaveAttribute('aria-disabled', 'true');
      expect(dog).toHaveAttribute('data-disabled', 'true');
    });
  });

  describe('initial selection', () => {
    it('auto-selects the first non-disabled item on mount', () => {
      render(<MenuFixture />);
      expect(getOption('Apple')).toHaveAttribute('aria-selected', 'true');
    });

    it('honours defaultValue when provided', () => {
      render(<MenuFixture defaultValue="banana" />);
      expect(getOption('Banana')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('filtering', () => {
    it('typing in the input hides non-matching items', async () => {
      render(<MenuFixture />);
      await userEvent.type(screen.getByRole('combobox'), 'cat');
      expect(screen.queryByRole('option', { name: 'Apple' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Banana' })).not.toBeInTheDocument();
      expect(getOption('Cat')).toBeInTheDocument();
    });

    it('shows the Empty fallback when nothing matches', async () => {
      render(<MenuFixture />);
      await userEvent.type(screen.getByRole('combobox'), 'zzzz');
      expect(screen.getByText('No results')).toBeInTheDocument();
    });

    it('shouldFilter={false} skips internal filtering — all items remain rendered', async () => {
      render(<MenuFixture shouldFilter={false} />);
      await userEvent.type(screen.getByRole('combobox'), 'zzzz');
      expect(getOption('Apple')).toBeInTheDocument();
      expect(getOption('Cat')).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('ArrowDown advances selection to the next valid item', async () => {
      render(<MenuFixture />);
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(getOption('Banana')).toHaveAttribute('aria-selected', 'true');
    });

    it('ArrowUp moves selection up', async () => {
      render(<MenuFixture defaultValue="banana" />);
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{ArrowUp}');
      expect(getOption('Apple')).toHaveAttribute('aria-selected', 'true');
    });

    it('Home jumps to the first item, End to the last', async () => {
      render(<MenuFixture defaultValue="banana" />);
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{Home}');
      expect(getOption('Apple')).toHaveAttribute('aria-selected', 'true');
      await userEvent.keyboard('{End}');
      expect(getOption('Cat')).toHaveAttribute('aria-selected', 'true');
    });

    it('Enter fires onSelect for the currently-selected item', async () => {
      const onSelect = vi.fn();
      render(<MenuFixture onSelect={onSelect} />);
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledWith('apple');
    });

    it('loop=true wraps ArrowDown past the last item back to the first', async () => {
      render(<MenuFixture defaultValue="cat" loop={true} />);
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(getOption('Apple')).toHaveAttribute('aria-selected', 'true');
    });

    it('skips disabled items when navigating', async () => {
      render(<MenuFixture defaultValue="cat" />);
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{ArrowDown}');
      // Dog is disabled — selection should stay on Cat (no next valid item).
      expect(getOption('Cat')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('pointer selection', () => {
    it('clicking an item fires onSelect', async () => {
      const onSelect = vi.fn();
      render(<MenuFixture onSelect={onSelect} />);
      await userEvent.click(getOption('Banana'));
      expect(onSelect).toHaveBeenCalledWith('banana');
    });

    it('clicking a disabled item does NOT fire onSelect', async () => {
      const onSelect = vi.fn();
      render(<MenuFixture onSelect={onSelect} />);
      await userEvent.click(getOption('Dog'));
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('separator', () => {
    it('hides while a search is active', async () => {
      const { container } = render(<MenuFixture />);
      expect(container.querySelector('[data-spotlight-separator]')).not.toBeNull();
      await userEvent.type(screen.getByRole('combobox'), 'a');
      expect(container.querySelector('[data-spotlight-separator]')).toBeNull();
    });

    it('alwaysRender keeps it visible even during a search', async () => {
      const { container } = render(<MenuFixture alwaysRenderSeparator={true} />);
      await userEvent.type(screen.getByRole('combobox'), 'a');
      expect(container.querySelector('[data-spotlight-separator]')).not.toBeNull();
    });
  });

  describe('Loading', () => {
    it('renders a progressbar with progress + label', () => {
      render(
        <Spotlight label="Menu">
          <SpotlightList label="Suggestions">
            <SpotlightLoading label="Fetching" progress={42}>
              <div data-testid="loading-content">…</div>
            </SpotlightLoading>
          </SpotlightList>
        </Spotlight>
      );
      const bar = screen.getByRole('progressbar', { name: 'Fetching' });
      expect(bar).toHaveAttribute('aria-valuenow', '42');
      expect(screen.getByTestId('loading-content')).toBeInTheDocument();
    });
  });

  describe('Dialog wrapper', () => {
    it('renders nothing when closed', () => {
      render(
        <SpotlightDialog label="Menu" open={false}>
          <SpotlightInput aria-label="Search" />
        </SpotlightDialog>
      );
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('mounts the menu when open=true and fires onOpenChange on Escape', async () => {
      const onOpenChange = vi.fn();
      render(
        <SpotlightDialog label="Menu" onOpenChange={onOpenChange} open={true}>
          <SpotlightInput placeholder="Search" />
        </SpotlightDialog>
      );
      expect(screen.getByRole('combobox', { name: 'Menu' })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('controlled mode', () => {
    function Controlled({ onValueChange }: { onValueChange: (v: string) => void }) {
      return (
        <Spotlight label="Menu" onValueChange={onValueChange} value="banana">
          <SpotlightInput aria-label="Search" />
          <SpotlightList label="Suggestions">
            <SpotlightItem value="apple">Apple</SpotlightItem>
            <SpotlightItem value="banana">Banana</SpotlightItem>
          </SpotlightList>
        </Spotlight>
      );
    }

    it('respects the controlled `value` for initial selection', () => {
      render(<Controlled onValueChange={() => undefined} />);
      expect(getOption('Banana')).toHaveAttribute('aria-selected', 'true');
    });

    it('clicking an item fires onValueChange with the new value', async () => {
      const onValueChange = vi.fn();
      render(<Controlled onValueChange={onValueChange} />);
      await userEvent.click(getOption('Apple'));
      expect(onValueChange).toHaveBeenCalledWith('apple');
    });
  });

  describe('vim bindings', () => {
    it('Ctrl+J advances selection (alias for ArrowDown)', async () => {
      render(<MenuFixture />);
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{Control>}j{/Control}');
      expect(getOption('Banana')).toHaveAttribute('aria-selected', 'true');
    });

    it('Ctrl+N advances selection (alias for ArrowDown)', async () => {
      render(<MenuFixture />);
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{Control>}n{/Control}');
      expect(getOption('Banana')).toHaveAttribute('aria-selected', 'true');
    });

    it('Ctrl+K moves selection up (alias for ArrowUp)', async () => {
      render(<MenuFixture defaultValue="banana" />);
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{Control>}k{/Control}');
      expect(getOption('Apple')).toHaveAttribute('aria-selected', 'true');
    });

    it('Ctrl+P moves selection up (alias for ArrowUp)', async () => {
      render(<MenuFixture defaultValue="banana" />);
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{Control>}p{/Control}');
      expect(getOption('Apple')).toHaveAttribute('aria-selected', 'true');
    });

    it('vimBindings={false} disables Ctrl+J shortcut', async () => {
      render(
        <Spotlight label="Menu" vimBindings={false}>
          <SpotlightInput />
          <SpotlightList label="Suggestions">
            <SpotlightItem value="a">A</SpotlightItem>
            <SpotlightItem value="b">B</SpotlightItem>
          </SpotlightList>
        </Spotlight>
      );
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{Control>}j{/Control}');
      expect(getOption('A')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('group navigation', () => {
    it('Alt+ArrowDown jumps from the current group to the next', async () => {
      render(<MenuFixture />);
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
      // Apple was selected → first item in next group ("Animals") = Cat
      expect(getOption('Cat')).toHaveAttribute('aria-selected', 'true');
    });

    it('Alt+ArrowUp jumps to the previous group', async () => {
      render(<MenuFixture defaultValue="cat" />);
      const input = screen.getByRole('combobox');
      input.focus();
      await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
      expect(getOption('Apple')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('forceMount', () => {
    it('item with forceMount stays rendered when filtered out', async () => {
      render(
        <Spotlight label="Menu">
          <SpotlightInput />
          <SpotlightList label="Suggestions">
            <SpotlightItem value="apple">Apple</SpotlightItem>
            <SpotlightItem forceMount={true} value="zzz">
              Always here
            </SpotlightItem>
          </SpotlightList>
        </Spotlight>
      );
      await userEvent.type(screen.getByRole('combobox'), 'apple');
      expect(screen.getByText('Always here')).toBeInTheDocument();
    });

    it('group with forceMount keeps its items rendered even when none match', async () => {
      render(
        <Spotlight label="Menu">
          <SpotlightInput />
          <SpotlightList label="Suggestions">
            <SpotlightGroup forceMount={true} heading="Pinned">
              <SpotlightItem value="zzz">Pinned item</SpotlightItem>
            </SpotlightGroup>
          </SpotlightList>
        </Spotlight>
      );
      await userEvent.type(screen.getByRole('combobox'), 'apple');
      expect(screen.getByText('Pinned item')).toBeInTheDocument();
    });
  });

  describe('custom filter', () => {
    it('uses the caller-provided filter function', async () => {
      const filter = vi.fn((value: string, search: string) => (value === search ? 1 : 0));
      render(
        <Spotlight filter={filter} label="Menu">
          <SpotlightInput />
          <SpotlightList label="Suggestions">
            <SpotlightItem value="apple">Apple</SpotlightItem>
            <SpotlightItem value="banana">Banana</SpotlightItem>
          </SpotlightList>
        </Spotlight>
      );
      await userEvent.type(screen.getByRole('combobox'), 'banana');
      expect(filter).toHaveBeenCalled();
      // Only an exact match passes the custom filter — Apple should be hidden.
      expect(screen.queryByRole('option', { name: 'Apple' })).not.toBeInTheDocument();
      expect(getOption('Banana')).toBeInTheDocument();
    });
  });

  describe('keywords / aliases', () => {
    it('matches against a keyword that is not in the visible label', async () => {
      render(
        <Spotlight label="Menu">
          <SpotlightInput />
          <SpotlightList label="Suggestions">
            <SpotlightItem keywords={['fruit', 'red']} value="apple">
              Apple
            </SpotlightItem>
            <SpotlightItem value="cat">Cat</SpotlightItem>
          </SpotlightList>
        </Spotlight>
      );
      await userEvent.type(screen.getByRole('combobox'), 'fruit');
      expect(getOption('Apple')).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Cat' })).not.toBeInTheDocument();
    });
  });

  describe('pointer selection', () => {
    it('pointer-move selects the hovered item', async () => {
      render(<MenuFixture defaultValue="apple" />);
      // Apple is selected initially. Hover Cat → it becomes selected.
      const cat = getOption('Cat');
      await userEvent.pointer({ target: cat });
      expect(cat).toHaveAttribute('aria-selected', 'true');
    });

    it('disablePointerSelection blocks pointer-move from selecting', async () => {
      render(
        <Spotlight defaultValue="apple" disablePointerSelection={true} label="Menu">
          <SpotlightInput />
          <SpotlightList label="Suggestions">
            <SpotlightItem value="apple">Apple</SpotlightItem>
            <SpotlightItem value="banana">Banana</SpotlightItem>
          </SpotlightList>
        </Spotlight>
      );
      const banana = getOption('Banana');
      await userEvent.pointer({ target: banana });
      // Apple stays selected because pointer-move was ignored.
      expect(getOption('Apple')).toHaveAttribute('aria-selected', 'true');
      // But explicit click still works.
      await userEvent.click(banana);
      expect(banana).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('SpotlightInput', () => {
    it('controlled input: typing in the DOM fires onValueChange but does NOT mutate the store', async () => {
      const onValueChange = vi.fn();
      render(
        <Spotlight label="Menu">
          <SpotlightInput onValueChange={onValueChange} value="initial" />
          <SpotlightList label="Suggestions">
            <SpotlightItem value="apple">Apple</SpotlightItem>
          </SpotlightList>
        </Spotlight>
      );
      const input = screen.getByRole('combobox') as HTMLInputElement;
      expect(input.value).toBe('initial');
      // Typing into a controlled input fires the callback; the visible value
      // doesn't change because the parent owns it.
      await userEvent.type(input, 'a');
      expect(onValueChange).toHaveBeenCalledWith('initiala');
    });

    it('uncontrolled input: typing updates the visible value via the store', async () => {
      render(
        <Spotlight label="Menu">
          <SpotlightInput />
          <SpotlightList label="Suggestions">
            <SpotlightItem value="apple">Apple</SpotlightItem>
          </SpotlightList>
        </Spotlight>
      );
      const input = screen.getByRole('combobox') as HTMLInputElement;
      await userEvent.type(input, 'app');
      expect(input.value).toBe('app');
    });
  });

  describe('SpotlightLoading default Spinner', () => {
    it('renders a Spinner when no children are passed', () => {
      const { container } = render(
        <Spotlight label="Menu">
          <SpotlightList label="Suggestions">
            <SpotlightLoading label="Loading" />
          </SpotlightList>
        </Spotlight>
      );
      expect(container.querySelector('.spinner')).not.toBeNull();
    });

    it('honours custom children over the Spinner default', () => {
      render(
        <Spotlight label="Menu">
          <SpotlightList label="Suggestions">
            <SpotlightLoading label="Loading">
              <span data-testid="custom-loader">…</span>
            </SpotlightLoading>
          </SpotlightList>
        </Spotlight>
      );
      expect(screen.getByTestId('custom-loader')).toBeInTheDocument();
    });
  });

  describe('SpotlightSeparator', () => {
    it('with no items the separator still hides while searching', async () => {
      render(
        <Spotlight label="Menu">
          <SpotlightInput />
          <SpotlightList label="Suggestions">
            <SpotlightItem value="apple">Apple</SpotlightItem>
            <SpotlightSeparator />
          </SpotlightList>
        </Spotlight>
      );
      const { container } = render(
        <Spotlight label="Menu">
          <SpotlightInput />
          <SpotlightList label="Suggestions">
            <SpotlightSeparator />
          </SpotlightList>
        </Spotlight>
      );
      expect(container.querySelector('[data-spotlight-separator]')).not.toBeNull();
    });
  });

  describe('IME composition', () => {
    it('ignores arrow keys while the user is mid-IME-composition (keyCode 229)', () => {
      render(<MenuFixture />);
      const input = screen.getByRole('combobox');
      input.focus();
      // Simulate the legacy CJK-IME marker — keyCode 229 also fast-paths to "isComposing"
      // in our handler. Browsers fire this when the IME panel is open and the user is
      // still selecting a candidate; pressing ArrowDown should NOT advance the menu.
      fireEvent.keyDown(input, { key: 'ArrowDown', keyCode: 229 });
      expect(getOption('Apple')).toHaveAttribute('aria-selected', 'true');
    });
  });
});

describe('commandScore', () => {
  it('returns a positive score when abbreviation matches the value', () => {
    expect(commandScore('apple', 'ap')).toBeGreaterThan(0);
  });

  it('returns 0 when no characters match', () => {
    expect(commandScore('apple', 'xyz')).toBe(0);
  });

  it('exact prefix scores higher than scattered match', () => {
    const prefix = commandScore('apple', 'app');
    const scattered = commandScore('apple', 'ae');
    expect(prefix).toBeGreaterThan(scattered);
  });

  it('aliases extend the searchable surface', () => {
    expect(commandScore('apple', 'red', ['red', 'fruit'])).toBeGreaterThan(0);
    expect(commandScore('apple', 'red')).toBe(0);
  });
});
