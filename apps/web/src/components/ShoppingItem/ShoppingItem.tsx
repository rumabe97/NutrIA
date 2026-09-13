'use client';
import { useState, useSyncExternalStore } from 'react';

import styles from './ShoppingItem.module.css';

import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatQuantity } from 'lib/format';
import { queueTick, sendTick, subscribeToTicks, tickOf } from 'lib/pendingTicks';

interface ShoppingItemProps {
  id: string;
  checked: boolean;
  displayQuantity: number;
  displayUnit: string;
  name: string;
}

/**
 * One line of the shopping list, tickable with a connection or without one
 * (`0055`).
 *
 * Optimistic: the tick lands before the request does, because someone standing
 * in a supermarket aisle should not wait on a round trip to see that they
 * pressed something. The tick is queued on the device and sent at once. With no
 * connection it stays ticked, and goes out when one comes back.
 *
 * Only a tick the server refuses — an item no longer on their list — is put
 * back, and silently: the visible state *is* the message here, and a toast over
 * a list you are reading one-handed is worse than the thing it reports.
 */
export function ShoppingItem({ id, checked, displayQuantity, displayUnit, name }: ShoppingItemProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  // What this device knows that the page may not: a tick still waiting, or one confirmed since the page loaded.
  const known = useSyncExternalStore(
    subscribeToTicks,
    () => tickOf(id),
    () => undefined
  );
  const [ticked, setTicked] = useState(checked);
  const shown = known ?? ticked;

  async function toggle() {
    const next = !shown;

    setTicked(next);
    queueTick(id, next);

    if ((await sendTick(id, next)) === 'refused') {
      setTicked(!next);
    }
  }

  return (
    <li className={styles.item} data-checked={shown}>
      <label className={styles.label}>
        <input checked={shown} className={styles.checkbox} onChange={() => void toggle()} type="checkbox" />
        <span className={styles.name}>{name}</span>
      </label>
      <span className={styles.quantity}>{formatQuantity(displayQuantity, displayUnit, locale, dictionary)}</span>
    </li>
  );
}
