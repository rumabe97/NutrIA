'use client';
import { useSyncExternalStore } from 'react';

import styles from './AisleLeft.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { boughtOf, subscribeToMarks } from 'lib/pendingTicks';
import { interpolate } from 'lib/format';

type AisleItem = { readonly id: string; readonly boughtGrams: number; readonly neededGrams: number; readonly totalGrams: number };

/**
 * «2 por comprar» beside an aisle's name: the rows of it not yet covered for the days on
 * screen, counted from the marks on this device like the bar above (`0055`, `0091`).
 */
export function AisleLeft({ items }: Readonly<{ items: readonly AisleItem[] }>) {
  const dictionary = useDictionary();
  const left = useSyncExternalStore(
    subscribeToMarks,
    () => items.filter(item => !(item.neededGrams > 0 && boughtOf(item.id, item) >= item.neededGrams)).length,
    () => items.filter(item => !(item.neededGrams > 0 && item.boughtGrams >= item.neededGrams)).length
  );

  return (
    <Text className={styles.left} size="sm" tone="tertiary">
      {left === 0 ? dictionary.shopping.aisleDone : interpolate(dictionary.shopping.aisleLeft, { count: left })}
    </Text>
  );
}
