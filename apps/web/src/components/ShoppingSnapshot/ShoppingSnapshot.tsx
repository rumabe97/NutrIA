'use client';
import Link from 'next/link';

import styles from './ShoppingSnapshot.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatNumber, interpolate } from 'lib/format';

/**
 * How much shopping is waiting, without opening the list.
 *
 * Two counts, both real: items, and the aisles they fall across. The link is the
 * only thing here that does anything — the list itself is read-only until the
 * project that makes it tickable, and a checkbox here would be a control that
 * pretends.
 */
export function ShoppingSnapshot({ items }: { items: readonly { category: string }[] }) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const aisles = new Set(items.map(item => item.category)).size;

  return (
    <section className={styles.panel}>
      <Text size="sm" tone="tertiary">
        {dictionary.dashboard.shoppingTitle}
      </Text>

      <p className={styles.count}>
        {interpolate(dictionary.dashboard.shoppingCount, { aisles: formatNumber(aisles, locale), items: formatNumber(items.length, locale) })}
      </p>

      <Link className={styles.link} href="/compra">
        {dictionary.dashboard.shoppingCta}
      </Link>
    </section>
  );
}
