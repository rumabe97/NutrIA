'use client';
import { useSyncExternalStore } from 'react';

import styles from './ShoppingProgress.module.css';

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
 *
 * Under the words, a bar that grows to the share in the trolley when the screen
 * arrives and moves with every mark (project 024): decoration, `aria-hidden`,
 * because the sentence already says the same figures. It is drawn by
 * `transform` alone — the outer layer grows in from nothing once, the inner one
 * is scaled to the share and eases to each new one — so nothing re-lays the row.
 */
export function ShoppingProgress({ items }: Readonly<{ items: readonly ProgressItem[] }>) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const done = useSyncExternalStore(
    subscribeToMarks,
    () => items.filter(item => isDone(item, boughtOf(item.id, item))).length,
    () => items.filter(item => isDone(item, item.boughtGrams)).length
  );

  const share = items.length === 0 ? 0 : done / items.length;

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <Text size="sm" weight="medium">
          {interpolate(dictionary.shopping.progress, { done: formatNumber(done, locale), total: formatNumber(items.length, locale) })}
        </Text>
        {/* The same share as a figure, at the line's end as the sheet draws it. The sentence
            beside it already says it in full, so this is not read twice. */}
        <span aria-hidden="true" className={styles.share}>
          {new Intl.NumberFormat(locale, { maximumFractionDigits: 0, style: 'percent' }).format(share)}
        </span>
      </div>
      <div aria-hidden="true" className={styles.track}>
        <div className={`${styles.grow} motion-grow-x`}>
          <div className={styles.fill} style={{ transform: `scaleX(${String(share)})` }} />
        </div>
      </div>
    </div>
  );
}
