import { Fragment } from 'react';

import styles from './page.module.css';

import { getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';
import { ShoppingItem } from 'components/ShoppingItem';
import { ShoppingProgress } from 'components/ShoppingProgress';

import { categoryLabel } from 'lib/generation';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../_shared/metadata';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/compra');
}

type ShoppingListView = {
  id: string;
  items: readonly {
    id: string;
    category: string;
    checked: boolean;
    displayQuantity: number;
    displayUnit: string;
    name: string;
    totalGrams: number;
  }[];
  planId: string;
};

/** Category order follows how a supermarket is walked, matching the API's own sort. */
const ORDER = ['produce', 'protein', 'dairy', 'bakery', 'frozen', 'pantry', 'beverages', 'other'];

export default async function ShoppingPage() {
  await redirectIfOnboardingIncomplete();

  const [dictionary, list] = await Promise.all([getDictionary(), serverApi<ShoppingListView>('/shopping-lists/active')]);

  if (!list) {
    return (
      <EmptyState body={dictionary.shopping.emptyBody} title={dictionary.shopping.emptyTitle}>
        <CtaLink href="/plan" size="lg">
          {dictionary.shopping.emptyCta}
        </CtaLink>
      </EmptyState>
    );
  }

  const groups = ORDER.map(category => ({ category, items: list.items.filter(item => item.category === category) })).filter(
    group => group.items.length > 0
  );

  return (
    <Fragment>
      <h1 className={styles.title}>{dictionary.shopping.title}</h1>
      <Text tone="secondary">{dictionary.shopping.subtitle}</Text>

      {/* Counted on the device, so a tick still waiting for a connection counts too (`0055`). */}
      <div className={styles.progress}>
        <ShoppingProgress items={list.items} />
      </div>

      {groups.map(group => (
        <section className={`${styles.group} motion-enter`} key={group.category}>
          <h2 className={styles.groupTitle}>{categoryLabel(group.category, dictionary)}</h2>
          <ul className={styles.items}>
            {group.items.map(item => (
              <ShoppingItem
                checked={item.checked}
                displayQuantity={item.displayQuantity}
                displayUnit={item.displayUnit}
                id={item.id}
                key={item.id}
                name={item.name}
              />
            ))}
          </ul>
        </section>
      ))}
    </Fragment>
  );
}
