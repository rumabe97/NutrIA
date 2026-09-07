'use client';
import { useState } from 'react';

import styles from './ShoppingItem.module.css';

import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api } from 'lib/api';
import { formatQuantity } from 'lib/format';

interface ShoppingItemProps {
  id: string;
  checked: boolean;
  displayQuantity: number;
  displayUnit: string;
  name: string;
}

/**
 * One line of the shopping list, tickable.
 *
 * Optimistic: the tick lands before the request does, because someone standing
 * in a supermarket aisle should not wait on a round trip to see that they
 * pressed something. A failure puts it back — silently, because the visible
 * state *is* the message here, and a toast over a list you are reading
 * one-handed is worse than the thing it reports.
 */
export function ShoppingItem({ id, checked, displayQuantity, displayUnit, name }: ShoppingItemProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const [ticked, setTicked] = useState(checked);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !ticked;

    setTicked(next);
    setPending(true);

    try {
      await api(`/shopping-lists/items/${id}`, { body: { checked: next }, method: 'PATCH' });
    } catch {
      setTicked(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <li className={styles.item} data-checked={ticked}>
      <label className={styles.label}>
        <input aria-busy={pending || undefined} checked={ticked} className={styles.checkbox} onChange={() => void toggle()} type="checkbox" />
        <span className={styles.name}>{name}</span>
      </label>
      <span className={styles.quantity}>{formatQuantity(displayQuantity, displayUnit, locale, dictionary)}</span>
    </li>
  );
}
