'use client';
import { useSyncExternalStore } from 'react';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatNumber, interpolate } from 'lib/format';
import { subscribeToTicks, tickOf } from 'lib/pendingTicks';

/**
 * "{done} of {total} in the trolley", counted from the ticks as they are now
 * on this device, including the ones still waiting for a connection (`0055`).
 *
 * Progress, not a promise: the count is derived from the ticks, so it cannot
 * claim something the list does not show. The server's count is where it
 * starts, before anything is ticked on this device.
 */
export function ShoppingProgress({ items }: Readonly<{ items: readonly { readonly id: string; readonly checked: boolean }[] }>) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const done = useSyncExternalStore(
    subscribeToTicks,
    () => items.filter(item => tickOf(item.id) ?? item.checked).length,
    () => items.filter(item => item.checked).length
  );

  return (
    <Text size="sm" tone="secondary">
      {interpolate(dictionary.shopping.progress, { done: formatNumber(done, locale), total: formatNumber(items.length, locale) })}
    </Text>
  );
}
