'use client';
import { useSyncExternalStore } from 'react';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { boughtOf, subscribeToMarks } from 'lib/pendingTicks';
import { formatNumber, interpolate } from 'lib/format';

type ProgressItem = {
  readonly id: string;
  readonly boughtGrams: number;
  /** What the days on screen need of this row. */
  readonly neededGrams: number;
  readonly totalGrams: number;
};

/** Bought enough for the days on screen — the same rule the row itself draws (`0091`). */
function isDone(item: ProgressItem, bought: number): boolean {
  return item.neededGrams > 0 && bought >= item.neededGrams;
}

/**
 * "{done} of {total} in the trolley", counted from the marks as they are now
 * on this device, including the ones still waiting for a connection (`0055`),
 * and over the days on screen rather than the whole plan (`0091`).
 *
 * Progress, not a promise: the count is derived from the marks, so it cannot
 * claim something the list does not show. The server's count is where it
 * starts, before anything is marked on this device.
 */
export function ShoppingProgress({ items }: Readonly<{ items: readonly ProgressItem[] }>) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const done = useSyncExternalStore(
    subscribeToMarks,
    () => items.filter(item => isDone(item, boughtOf(item.id, item))).length,
    () => items.filter(item => isDone(item, item.boughtGrams)).length
  );

  return (
    <Text size="sm" tone="secondary">
      {interpolate(dictionary.shopping.progress, { done: formatNumber(done, locale), total: formatNumber(items.length, locale) })}
    </Text>
  );
}
