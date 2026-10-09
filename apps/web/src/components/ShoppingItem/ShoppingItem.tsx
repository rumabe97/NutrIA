'use client';
import { useSyncExternalStore } from 'react';

import styles from './ShoppingItem.module.css';

import { toDisplay } from 'core/domain/ShoppingList';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { boughtOf, flushMarks, queueMark, subscribeToMarks } from 'lib/pendingTicks';
import { formatQuantity, interpolate } from 'lib/format';

import type { ShoppingRangeRow } from 'core/domain/ShoppingList';

interface ShoppingItemProps {
  id: string;
  /** How much of the row the server says is bought, in grams. */
  boughtGrams: number;
  displayQuantity: number;
  displayUnit: ShoppingRangeRow['displayUnit'];
  /** What one unit of a countable weighs; null for anything sold by weight. */
  gramsPerUnit: number | null;
  name: string;
  /** What the days on screen need of this row, in grams. */
  neededGrams: number;
  /** Says what the row itself cannot, through the list's one live region. */
  onNotice: (notice: string) => void;
  /** What the whole plan needs of it, which is the ceiling a mark is capped at. */
  totalGrams: number;
}

/**
 * One line of the shopping list, marked with a connection or without one
 * (`0055`), by an amount rather than a tick (`0091`).
 *
 * Marking buys the days on screen: it sends `max(bought, needed)`, so marking a
 * week does not undo a fortnight already bought. Unmarking gives back only this
 * range's share, `max(0, bought - needed)` — it says "not these days", not
 * "nothing at all", which is what the owner chose.
 *
 * That makes three states where there were two. A row can be untouched, **partly
 * bought** — the week's 500 g of the fortnight's 1.2 kg, showing the 700 g still
 * to find — or done. The partial state is the point of the whole project: it is
 * what a real shop looks like.
 *
 * Optimistic: the mark lands before the request does, because someone standing
 * in a supermarket aisle should not wait on a round trip to see that they
 * pressed something. The mark is queued on the device and sent at once. With no
 * connection it stays, and goes out when one comes back.
 *
 * Only a mark the server refuses — an item no longer on their list — is put
 * back, and silently: the visible state *is* the message here, and a toast over
 * a list you are reading one-handed is worse than the thing it reports.
 */
export function ShoppingItem({
  id,
  boughtGrams,
  displayQuantity,
  displayUnit,
  gramsPerUnit,
  name,
  neededGrams,
  onNotice,
  totalGrams
}: ShoppingItemProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  // What this device knows that the page may not: a mark still waiting, or one
  // confirmed since the page loaded. The server's figure until it knows better.
  const bought = useSyncExternalStore(
    subscribeToMarks,
    () => boughtOf(id, { boughtGrams, totalGrams }),
    () => boughtGrams
  );
  const done = neededGrams > 0 && bought >= neededGrams;
  const left = Math.max(neededGrams - bought, 0);
  const partly = !done && bought > 0 && left > 0;
  const quantity = formatQuantity(displayQuantity, displayUnit, locale, dictionary);
  // Through the domain's own unit rules, so "4 eggs left of 7" rounds the way
  // the 7 was rounded. A remainder takes no dry round-up: the need was rounded
  // once when the range was summed, and rounding the leftover would invent grams.
  const remaining = toDisplay(left, displayUnit, gramsPerUnit);
  const leftQuantity = formatQuantity(remaining.quantity, remaining.unit, locale, dictionary);

  function mark(next: boolean) {
    // Capped at the whole plan's need and floored at zero here as well as on the
    // server: what this device shows before the round trip must be what the
    // round trip will agree with.
    const amount = next ? Math.min(Math.max(bought, neededGrams), totalGrams) : Math.max(bought - neededGrams, 0);

    // Giving back this range's share can still leave more than these days need
    // — a row marked across the fortnight, unmarked from one week. The box
    // would spring straight back to checked, nothing on screen would move, and
    // the write would have happened anyway: from a single day's view that is
    // eleven taps that each change nothing and each reach the server. So the
    // gesture is refused and the reason is said, because a narrow range cannot
    // express "give back more than these days needed".
    if (!next && neededGrams > 0 && amount >= neededGrams) {
      onNotice(
        interpolate(dictionary.shopping.boughtBeyondRange, {
          bought: formatQuantity(toDisplay(bought, displayUnit, gramsPerUnit).quantity, displayUnit, locale, dictionary)
        })
      );

      return;
    }

    const body = { boughtGrams: amount, checked: amount >= totalGrams && totalGrams > 0 };

    onNotice('');
    queueMark(id, body);
    // Through the queue, never straight to the server: one write to a row at a
    // time per device, or a flush already draining could land an older mark
    // after this one.
    void flushMarks();
  }

  return (
    <li className={styles.item} data-checked={done} data-partly={partly}>
      <label className={styles.label}>
        {/*
          A row with some of it in the trolley is the textbook indeterminate
          checkbox: some, not all. Native, so it is announced as "mixed" without
          a colour or a word of our own, and it cannot be set from markup —
          `indeterminate` is a property, not an attribute — and the callback is
          written inline on purpose: a new identity each render is what reapplies
          it, and a `useCallback` here would quietly freeze the mixed state.

          Never `aria-checked="mixed"`: invalid on a native checkbox, and the
          obvious "fix" to reach for if VoiceOver turns out not to speak the
          mixed state. It does not need to — the name carries all three states.
        */}
        <input
          checked={done}
          className={styles.checkbox}
          onChange={event => mark(event.target.checked)}
          ref={element => {
            if (element) {
              element.indeterminate = partly;
            }
          }}
          type="checkbox"
        />
        <span className={styles.name}>{name}</span>
        {/*
          The quantity lives *inside* the label, which is what puts it in the
          checkbox's accessible name: a screen reader used to hear "Tomate,
          casilla" and nothing about how much, and since the range filter that
          number changes with the days on screen. One node, seen and announced,
          so the two readings cannot drift apart — and the whole row becomes the
          target the stylesheet already claimed it was.
        */}
        <span className={styles.quantity}>{partly ? interpolate(dictionary.shopping.leftToBuy, { left: leftQuantity }) : quantity}</span>
      </label>
    </li>
  );
}
