import type { ShoppingRangeRow } from 'core/domain/ShoppingList';

/**
 * Which days of the plan the shopping list is being read for (`0091`).
 *
 * Nobody shops for a fortnight. People buy for a week, or for the next three
 * days, and before this the list could only ever be the whole plan. The range
 * lives on the device rather than in the address: `/compra` is the one screen
 * the product promises in a supermarket with no signal, its cached copy is
 * keyed by path ([`0053`](../../../../docs/decisions/0053-the-shopping-list-survives-the-supermarket.md)),
 * and a query string would be a different page to the worker that stored it.
 *
 * So a filter change touches no network at all: every row arrives carrying
 * what each day owes it, and the quantities are computed here by the same
 * domain function the server uses.
 */
const KEY = 'nutria-shopping-range-v1';

/** How many days a week of the plan is, for the two presets that are positional. */
const WEEK = 7;

export const RANGE_CHOICES = ['fortnight', 'week1', 'week2', 'days'] as const;

export type RangeChoice = (typeof RANGE_CHOICES)[number];

/** A choice, and — only for `days` — the plan dates that were ticked. Not named for the component: the component renders one of these. */
export type RangeSelection = { readonly choice: RangeChoice; readonly days: readonly string[] };

/** What a reader who has never chosen sees: the whole plan, exactly the list this screen showed before. */
export const WHOLE_PLAN: RangeSelection = { choice: 'fortnight', days: [] };

/** One row as this screen reads it: what a range needs of it, plus what it is called and whether it is bought. */
export type ShoppingListItem = ShoppingRangeRow & {
  readonly id: string;
  /** How much of it is already bought, in grams (`0091`). Phase 4 is what moves it. */
  readonly boughtGrams: number;
  readonly category: string;
  readonly checked: boolean;
  readonly name: string;
};

/**
 * Every day the plan covers, in order — read off the rows themselves, because
 * the breakdown's keys *are* the plan's dates and no second request is needed
 * to learn them.
 *
 * Empty for a list stored before the breakdown existed, which is every list in
 * production until its plan is next regenerated, swapped or rebuilt. Those read
 * as the whole plan's need under every range, so the screen simply offers no
 * filter rather than offering one that could do nothing.
 */
export function planDays(items: readonly ShoppingListItem[]): readonly string[] {
  return [...new Set(items.flatMap(item => Object.keys(item.perDay)))].sort((a, b) => a.localeCompare(b));
}

/** Whether the plan is long enough for its two weeks to be different ranges. */
export function hasWeeks(days: readonly string[]): boolean {
  return days.length > WEEK;
}

/** The dates one range covers, out of the days the plan has. */
export function daysIn(range: RangeSelection, days: readonly string[]): readonly string[] {
  if (range.choice === 'days') {
    // Intersected rather than trusted: a stored day belongs to the plan that was
    // on screen when it was ticked, and this may not be that plan.
    return days.filter(day => range.days.includes(day));
  }

  if (range.choice === 'week1') {
    return days.slice(0, WEEK);
  }

  return range.choice === 'week2' ? days.slice(WEEK) : days;
}

/**
 * The stored range, made safe for the plan actually on screen.
 *
 * One key serves both shopping screens, and the plan under way changes when it
 * is regenerated, so chosen days can outlive the days they named. A set of days
 * this plan does not have would draw an empty list for no visible reason, so it
 * falls back to the whole plan — but a reader who unticked every day keeps that
 * state, because they chose it and the screen says so. The two week presets are positional and survive
 * any plan; `week2` does not survive a plan too short to have one.
 */
export function resolveRange(stored: RangeSelection, days: readonly string[]): RangeSelection {
  if (stored.choice === 'days') {
    // Named days that this plan does not have are stale and fall back. Having
    // named *none* is a reader who unticked their last day: that is a state to
    // show ("you have not chosen a day"), not one to overrule — snapping back
    // to the fortnight would hide the very checkboxes they were using.
    return stored.days.length > 0 && daysIn(stored, days).length === 0 ? WHOLE_PLAN : stored;
  }

  return stored.choice === 'week2' && !hasWeeks(days) ? WHOLE_PLAN : stored;
}

const listeners = new Set<() => void>();
// Parsed once and handed back by reference: `useSyncExternalStore` compares
// snapshots by identity, and a fresh object every call is an infinite render.
let cached: RangeSelection | null = null;

function isChoice(value: unknown): value is RangeChoice {
  return typeof value === 'string' && RANGE_CHOICES.includes(value as RangeChoice);
}

function parse(raw: string | null): RangeSelection {
  if (raw === null) {
    return WHOLE_PLAN;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (parsed === null || typeof parsed !== 'object') {
      return WHOLE_PLAN;
    }

    const { choice, days } = parsed as { choice?: unknown; days?: unknown };

    if (!isChoice(choice)) {
      return WHOLE_PLAN;
    }

    return { choice, days: Array.isArray(days) ? days.filter((day): day is string => typeof day === 'string') : [] };
  } catch {
    return WHOLE_PLAN;
  }
}

/** The range this device last chose. The whole plan when it has never chosen, or when what it stored makes no sense. */
export function storedRange(): RangeSelection {
  cached ??= parse(localStorage.getItem(KEY));

  return cached;
}

/** What the server rendered, and what the first client render must match: the whole plan. */
export function serverRange(): RangeSelection {
  return WHOLE_PLAN;
}

export function rememberRange(range: RangeSelection): void {
  cached = range;

  try {
    if (range.choice === 'fortnight') {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(range));
    }
  } catch {
    // A device that will not store it still filters; the choice is only lost on reload.
  }

  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToRange(onChange: () => void): () => void {
  function onStorage(event: StorageEvent) {
    // Another tab of the app chose a different range.
    if (event.key === KEY) {
      cached = null;
      onChange();
    }
  }

  listeners.add(onChange);
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Dropped with the rest of this device's state when the session ends or changes, beside the pending ticks (`0055`). */
export function forgetRange(): void {
  cached = null;

  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored is nothing to forget.
  }

  for (const listener of listeners) {
    listener();
  }
}
