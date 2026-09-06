'use client';
import { useId, useMemo, useRef } from 'react';

import styles from './Spotlight.module.css';

import { useAsRef } from './hooks/useAsRef';
import { useIsomorphicLayoutEffect } from './hooks/useIsomorphicLayoutEffect';
import { useLazyRef } from './hooks/useLazyRef';
import { useScheduleLayoutEffect } from './hooks/useScheduleLayoutEffect';

import { commandScore } from './utils/commandScore';
import { findNextSibling } from './utils/findNextSibling';
import { findPreviousSibling } from './utils/findPreviousSibling';
import { slottableWithNestedChildren } from './utils/slottableWithNestedChildren';

import {
  GROUP_HEADING_SELECTOR,
  GROUP_ITEMS_SELECTOR,
  GROUP_SELECTOR,
  ITEM_SELECTOR,
  SELECT_EVENT,
  VALID_ITEM_SELECTOR,
  VALUE_ATTR
} from './constants';
import { CommandContext, StoreContext } from './context';

import type { CommandContextValue, CommandProps, State, Store } from './types';
import type { KeyboardEvent } from 'react';

function defaultFilter(value: string, search: string, keywords?: ReadonlyArray<string>): number {
  return commandScore(value, search, keywords);
}

export function Spotlight(props: CommandProps) {
  const state = useLazyRef<State>(() => ({
    filtered: { count: 0, groups: new Set(), items: new Map() },
    search: '',
    selectedItemId: undefined,
    value: props.value ?? props.defaultValue ?? ''
  }));
  const allItems = useLazyRef<Set<string>>(() => new Set());
  const allGroups = useLazyRef<Map<string, Set<string>>>(() => new Map());
  const ids = useLazyRef<Map<string, { keywords?: ReadonlyArray<string>; value: string }>>(() => new Map());
  const listeners = useLazyRef<Set<() => void>>(() => new Set());
  const propsRef = useAsRef(props);
  const { label, ref, value, vimBindings = true, ...etc } = props;

  const listId = useId();
  const labelId = useId();
  const inputId = useId();

  const listInnerRef = useRef<HTMLDivElement | null>(null);

  const schedule = useScheduleLayoutEffect();

  // Controlled-mode `value` handling: any external change to `value` is mirrored into the store
  // and emitted so subscribed sub-components re-render.
  useIsomorphicLayoutEffect(() => {
    if (value !== undefined) {
      state.current.value = value.trim();
      store.emit();
    }
  }, [value]);

  // On mount, scroll the currently-selected item into view (matches the upstream cmdk behaviour where
  // an initial `defaultValue` should not be obscured by overflow).
  useIsomorphicLayoutEffect(() => {
    schedule(6, scrollSelectedIntoView);
  }, []);

  const store: Store = useMemo(() => {
    return {
      emit: () => {
        listeners.current.forEach(listener => listener());
      },
      setState: (key, nextValue, ...rest) => {
        const opts = rest[0];

        if (Object.is(state.current[key], nextValue)) {
          return;
        }

        state.current[key] = nextValue;

        if (key === 'search') {
          // Filter synchronously before emitting back to children so subscribers
          // re-render against the new filtered set.
          filterItems();
          sort();
          schedule(1, selectFirstItem);
        } else if (key === 'value') {
          // Force focus input or root so accessibility works.
          if (document.activeElement?.hasAttribute('data-spotlight-input') || document.activeElement?.hasAttribute('data-spotlight-root')) {
            const input = document.getElementById(inputId);

            if (input) {
              input.focus();
            } else {
              document.getElementById(listId)?.focus();
            }
          }

          schedule(7, () => {
            state.current.selectedItemId = getSelectedItem()?.id;
            store.emit();
          });

          // `opts === true` means "do NOT scroll into view".
          if (!opts) {
            schedule(5, scrollSelectedIntoView);
          }

          if (propsRef.current?.value !== undefined) {
            // Controlled: call the callback and stop — the caller is the source of truth.
            const newValue = (nextValue ?? '') as string;
            propsRef.current.onValueChange?.(newValue);

            return;
          }
        }

        store.emit();
      },
      snapshot: () => state.current,
      subscribe: cb => {
        listeners.current.add(cb);

        return () => {
          listeners.current.delete(cb);
        };
      }
    };
    // Store is created once. All deps are accessed through refs so a stable identity is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const context: CommandContextValue = useMemo(
    () => ({
      filter: () => propsRef.current.shouldFilter,
      getDisablePointerSelection: () => propsRef.current.disablePointerSelection,
      group: id => {
        if (!allGroups.current.has(id)) {
          allGroups.current.set(id, new Set());
        }

        return () => {
          ids.current.delete(id);
          allGroups.current.delete(id);
        };
      },
      inputId,
      item: (id, groupId) => {
        allItems.current.add(id);

        if (groupId) {
          const existing = allGroups.current.get(groupId);

          if (existing) {
            existing.add(id);
          } else {
            allGroups.current.set(groupId, new Set([id]));
          }
        }

        schedule(3, () => {
          filterItems();
          sort();

          if (!state.current.value) {
            selectFirstItem();
          }

          store.emit();
        });

        return () => {
          ids.current.delete(id);
          allItems.current.delete(id);
          state.current.filtered.items.delete(id);
          const selectedItem = getSelectedItem();

          schedule(4, () => {
            filterItems();

            if (selectedItem?.getAttribute('id') === id) {
              selectFirstItem();
            }

            store.emit();
          });
        };
      },
      label,
      labelId,
      listId,
      listInnerRef,
      value: (id, resolved, keywords) => {
        if (resolved !== ids.current.get(id)?.value) {
          ids.current.set(id, { keywords, value: resolved });
          state.current.filtered.items.set(id, score(resolved, keywords));
          schedule(2, () => {
            sort();
            store.emit();
          });
        }
      }
    }),
    // Context identity is intentionally stable; ids and label closures don't need to change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function score(rawValue: string, keywords?: ReadonlyArray<string>): number {
    const filter = propsRef.current?.filter ?? defaultFilter;

    return rawValue ? filter(rawValue, state.current.search, keywords) : 0;
  }

  /** Sorts items by score; groups by highest item score. */
  function sort(): void {
    if (!state.current.search || propsRef.current.shouldFilter === false) {
      return;
    }

    const scores = state.current.filtered.items;

    const groups: [string, number][] = [];
    state.current.filtered.groups.forEach(groupId => {
      const items = allGroups.current.get(groupId);

      if (!items) {
        return;
      }

      let max = 0;
      items.forEach(item => {
        const score = scores.get(item) ?? 0;
        max = Math.max(score, max);
      });
      groups.push([groupId, max]);
    });

    const listInsertionElement = listInnerRef.current;

    if (!listInsertionElement) {
      return;
    }

    getValidItems()
      .sort((itemA, itemB) => {
        const valueA = itemA.getAttribute('id');
        const valueB = itemB.getAttribute('id');

        return (scores.get(valueB ?? '') ?? 0) - (scores.get(valueA ?? '') ?? 0);
      })
      .forEach(item => {
        const group = item.closest(GROUP_ITEMS_SELECTOR);

        if (group) {
          group.appendChild(item.parentElement === group ? item : (item.closest(`${GROUP_ITEMS_SELECTOR} > *`) ?? item));
        } else {
          listInsertionElement.appendChild(
            item.parentElement === listInsertionElement ? item : (item.closest(`${GROUP_ITEMS_SELECTOR} > *`) ?? item)
          );
        }
      });

    groups
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .forEach(group => {
        const element = listInnerRef.current?.querySelector(`${GROUP_SELECTOR}[${VALUE_ATTR}="${encodeURIComponent(group[0])}"]`);
        element?.parentElement?.appendChild(element);
      });
  }

  function selectFirstItem(): void {
    const item = getValidItems().find(candidate => candidate.getAttribute('aria-disabled') !== 'true');
    const nextValue = item?.getAttribute(VALUE_ATTR);
    store.setState('value', nextValue ?? '');
  }

  function filterItems(): void {
    if (!state.current.search || propsRef.current.shouldFilter === false) {
      state.current.filtered.count = allItems.current.size;

      return;
    }

    state.current.filtered.groups = new Set();
    let itemCount = 0;

    for (const id of allItems.current) {
      const entry = ids.current.get(id);
      const rank = score(entry?.value ?? '', entry?.keywords);
      state.current.filtered.items.set(id, rank);

      if (rank > 0) {
        itemCount++;
      }
    }

    for (const [groupId, group] of allGroups.current) {
      for (const itemId of group) {
        if ((state.current.filtered.items.get(itemId) ?? 0) > 0) {
          state.current.filtered.groups.add(groupId);
          break;
        }
      }
    }

    state.current.filtered.count = itemCount;
  }

  function scrollSelectedIntoView(): void {
    const item = getSelectedItem();

    if (!item) {
      return;
    }

    if (item.parentElement?.firstChild === item) {
      // First item in a group — ensure heading is visible too.
      item.closest(GROUP_SELECTOR)?.querySelector(GROUP_HEADING_SELECTOR)?.scrollIntoView({ block: 'nearest' });
    }

    item.scrollIntoView({ block: 'nearest' });
  }

  function getSelectedItem(): HTMLElement | null {
    return (listInnerRef.current?.querySelector<HTMLElement>(`${ITEM_SELECTOR}[aria-selected="true"]`) ?? null) as HTMLElement | null;
  }

  function getValidItems(): HTMLElement[] {
    return Array.from(listInnerRef.current?.querySelectorAll<HTMLElement>(VALID_ITEM_SELECTOR) ?? []);
  }

  function updateSelectedToIndex(index: number): void {
    const items = getValidItems();
    const item = items[index];

    if (item) {
      store.setState('value', item.getAttribute(VALUE_ATTR) ?? '');
    }
  }

  function updateSelectedByItem(change: -1 | 1): void {
    const selected = getSelectedItem();
    const items = getValidItems();
    const index = items.findIndex(item => item === selected);

    let newSelected = items[index + change];

    if (propsRef.current?.loop) {
      newSelected = index + change < 0 ? items[items.length - 1] : index + change === items.length ? items[0] : items[index + change];
    }

    if (newSelected) {
      store.setState('value', newSelected.getAttribute(VALUE_ATTR) ?? '');
    }
  }

  function updateSelectedByGroup(change: -1 | 1): void {
    const selected = getSelectedItem();
    let group: Element | null | undefined = selected?.closest(GROUP_SELECTOR);
    let item: HTMLElement | null | undefined;

    while (group && !item) {
      group = change > 0 ? findNextSibling(group, GROUP_SELECTOR) : findPreviousSibling(group, GROUP_SELECTOR);
      item = group?.querySelector<HTMLElement>(VALID_ITEM_SELECTOR);
    }

    if (item) {
      store.setState('value', item.getAttribute(VALUE_ATTR) ?? '');
    } else {
      updateSelectedByItem(change);
    }
  }

  const last = () => updateSelectedToIndex(getValidItems().length - 1);

  const next = (event: KeyboardEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (event.metaKey) {
      last();
    } else if (event.altKey) {
      updateSelectedByGroup(1);
    } else {
      updateSelectedByItem(1);
    }
  };

  const prev = (event: KeyboardEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (event.metaKey) {
      updateSelectedToIndex(0);
    } else if (event.altKey) {
      updateSelectedByGroup(-1);
    } else {
      updateSelectedByItem(-1);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    etc.onKeyDown?.(event);

    // Don't trigger key binds while the user is composing CJK input via an IME.
    const isComposing = event.nativeEvent.isComposing || event.keyCode === 229;

    if (event.defaultPrevented || isComposing) {
      return;
    }

    switch (event.key) {
      case 'n':
      case 'j':
        if (vimBindings && event.ctrlKey) {
          next(event);
        }

        break;
      case 'ArrowDown':
        next(event);
        break;
      case 'p':
      case 'k':
        if (vimBindings && event.ctrlKey) {
          prev(event);
        }

        break;
      case 'ArrowUp':
        prev(event);
        break;
      case 'Home':
        event.preventDefault();
        updateSelectedToIndex(0);
        break;
      case 'End':
        event.preventDefault();
        last();
        break;

      case 'Enter': {
        event.preventDefault();
        const item = getSelectedItem();

        if (item) {
          item.dispatchEvent(new Event(SELECT_EVENT));
        }

        break;
      }

      default:
        break;
    }
  };

  const rootClassName = [styles.root, etc.className].filter(Boolean).join(' ');

  return (
    <div ref={ref} tabIndex={-1} {...etc} className={rootClassName} data-spotlight-root="" onKeyDown={handleKeyDown}>
      <label data-spotlight-label="" htmlFor={context.inputId} id={context.labelId}>
        {label}
      </label>
      {slottableWithNestedChildren(props, child => (
        <StoreContext.Provider value={store}>
          <CommandContext.Provider value={context}>{child}</CommandContext.Provider>
        </StoreContext.Provider>
      ))}
    </div>
  );
}
