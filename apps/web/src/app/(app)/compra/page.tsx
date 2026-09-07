import { Fragment } from 'react';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';

import { categoryLabel } from 'lib/generation';
import { formatQuantity } from 'lib/format';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

export const dynamic = 'force-dynamic';

type ShoppingListView = {
  id: string;
  items: readonly { id: string; category: string; checked: boolean; displayQuantity: number; displayUnit: string; name: string; totalGrams: number }[];
  planId: string;
};

/** Category order follows how a supermarket is walked, matching the API's own sort. */
const ORDER = ['produce', 'protein', 'dairy', 'bakery', 'frozen', 'pantry', 'beverages', 'other'];

export default async function ShoppingPage() {
  await redirectIfOnboardingIncomplete();

  const [dictionary, locale, list] = await Promise.all([getDictionary(), activeLocale(), serverApi<ShoppingListView>('/shopping-lists/active')]);

  if (!list) {
    return (
      <EmptyState body={dictionary.shopping.emptyBody} title={dictionary.shopping.emptyTitle}>
        <CtaLink href="/plan" size="lg">
          {dictionary.shopping.emptyCta}
        </CtaLink>
      </EmptyState>
    );
  }

  const groups = ORDER.map(category => ({ category, items: list.items.filter(item => item.category === category) })).filter(group => group.items.length > 0);

  return (
    <Fragment>
      <h1 className={styles.title}>{dictionary.shopping.title}</h1>
      <Text tone="secondary">{dictionary.shopping.subtitle}</Text>

      {/* Said plainly rather than rendered as checkboxes that do nothing. A control
          that looks interactive and is not is worse than its absence. */}
      <div className={styles.notice}>
        <Text size="sm" tone="secondary">
          {dictionary.shopping.notice}
        </Text>
      </div>

      {groups.map(group => (
        <section className={`${styles.group} motion-enter`} key={group.category}>
          <h2 className={styles.groupTitle}>{categoryLabel(group.category, dictionary)}</h2>
          <ul className={styles.items}>
            {group.items.map(item => (
              <li className={styles.item} key={item.id}>
                <span>{item.name}</span>
                <span className={styles.quantity}>{formatQuantity(item.displayQuantity, item.displayUnit, locale, dictionary)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Fragment>
  );
}
