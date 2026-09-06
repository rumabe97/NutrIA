import type { ComponentPropsWithoutRef, ReactNode, Ref, RefObject } from 'react';
import type { DialogProps as RadixDialogProps } from '@radix-ui/react-dialog';

type DivProps = ComponentPropsWithoutRef<'div'>;
type Children = { children?: ReactNode };
type DivRef = { ref?: Ref<HTMLDivElement> };
type InputRef = { ref?: Ref<HTMLInputElement> };

export type CommandFilter = (value: string, search: string, keywords?: ReadonlyArray<string>) => number;

export type CommandProps = Children &
  DivProps &
  DivRef & {
    /** Initial selected item value. */
    defaultValue?: string;
    /** Disable selection via pointer events (keyboard only). */
    disablePointerSelection?: boolean;
    /** Custom filter (0 = hidden, 1 = best match). Defaults to `command-score`. */
    filter?: CommandFilter;
    /** **Required.** Accessible label for the menu (read via `aria-labelledby`). Localize in non-English apps. */
    label: string;
    /** Loop around with arrow keys at the ends. */
    loop?: boolean;
    /** Fires when the selected item changes. */
    onValueChange?: (value: string) => void;
    /** Set `false` to turn off automatic filtering; you then conditionally render items yourself. */
    shouldFilter?: boolean;
    /** Controlled selected item value. */
    value?: string;
    /** Set `false` to disable `Ctrl+n/j/p/k` shortcuts. Defaults to `true`. */
    vimBindings?: boolean;
  };

export type ItemProps = Children &
  Omit<DivProps, 'disabled' | 'onSelect' | 'value'> &
  DivRef & {
    /** Whether this item is currently disabled. */
    disabled?: boolean;
    /** Render even when filtered out. */
    forceMount?: boolean;
    /** Extra terms matched during filtering. */
    keywords?: ReadonlyArray<string>;
    /** Fires when the item is selected (click or keyboard). */
    onSelect?: (value: string) => void;
    /** Unique item value. Inferred from rendered text if omitted — pass explicitly when text can change between renders. */
    value?: string;
  };

export type GroupProps = Children &
  Omit<DivProps, 'heading' | 'value'> &
  DivRef & {
    /** Render this group (and its items) even when filtered out. */
    forceMount?: boolean;
    /** Heading rendered above the group's items. */
    heading?: ReactNode;
    /** Required when no `heading` is given; used as the group's id during filtering. */
    value?: string;
  };

export type SeparatorProps = DivProps &
  DivRef & {
    /** Render even while a search is active (defaults to hidden during search). */
    alwaysRender?: boolean;
  };

export type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'onChange' | 'type' | 'value'> &
  InputRef & {
    /** Fires when the search value changes. */
    onValueChange?: (search: string) => void;
    /** Controlled search value. */
    value?: string;
  };

export type ListProps = Children &
  DivProps &
  DivRef & {
    /** **Required.** Accessible label for the suggestion list. Localize in non-English apps. */
    label: string;
  };

export type DialogProps = RadixDialogProps &
  CommandProps & {
    /** Custom container the Dialog portals into. */
    container?: HTMLElement;
    /** className applied to the Dialog content. */
    contentClassName?: string;
    /** className applied to the Dialog overlay. */
    overlayClassName?: string;
  };

export type EmptyProps = Children & DivProps & DivRef;

export type LoadingProps = Children &
  DivProps &
  DivRef & {
    /** **Required.** Accessible label for the progressbar. Localize in non-English apps. */
    label: string;
    /** Estimated load progress (0–100). */
    progress?: number;
  };

// Internal types — exposed within the component module only, not re-exported.

export interface State {
  filtered: { count: number; groups: Set<string>; items: Map<string, number> };
  search: string;
  selectedItemId?: string;
  value: string;
}

export interface Store {
  emit: () => void;
  // `opts` is only meaningful when `key === 'value'` — it signals "do NOT scroll the
  // newly-selected item into view". Conditional rest args keep this enforced at the
  // type level: passing a boolean to `setState('search', '…')` is a compile error.
  setState: <K extends keyof State>(key: K, value: State[K], ...opts: K extends 'value' ? [boolean?] : []) => void;
  snapshot: () => State;
  subscribe: (callback: () => void) => () => void;
}

export interface CommandContextValue {
  filter: () => boolean | undefined;
  getDisablePointerSelection: () => boolean | undefined;
  group: (id: string) => () => void;
  inputId: string;
  item: (id: string, groupId: string | undefined) => () => void;
  label: string | undefined;
  labelId: string;
  listId: string;
  listInnerRef: RefObject<HTMLDivElement | null>;
  value: (id: string, value: string, keywords?: ReadonlyArray<string>) => void;
}

export interface GroupContextValue {
  id: string;
  forceMount?: boolean;
}
