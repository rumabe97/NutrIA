// Selectors used internally to locate items, groups, and headings via querySelector.
// The component renders `data-spotlight-*` attributes directly in JSX; these selectors
// are the read side of that contract.

export const GROUP_SELECTOR = '[data-spotlight-group]';
export const GROUP_ITEMS_SELECTOR = '[data-spotlight-group-items]';
export const GROUP_HEADING_SELECTOR = '[data-spotlight-group-heading]';
export const ITEM_SELECTOR = '[data-spotlight-item]';
export const VALID_ITEM_SELECTOR = `${ITEM_SELECTOR}:not([aria-disabled="true"])`;

// Element attribute used to store the resolved item value on the DOM.
export const VALUE_ATTR = 'data-value';

// Custom event the Spotlight root dispatches on the focused item when Enter is pressed.
export const SELECT_EVENT = 'spotlight-item-select';
