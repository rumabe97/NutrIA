import { Fragment } from 'react';

import styles from './page.module.css';

import { Text } from 'ui/components/Text';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';

import { CATEGORY_LABELS, formatQuantity } from 'lib/generation';
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
  const list = await serverApi<ShoppingListView>('/shopping-lists/active');

  if (!list) {
    return (
      <EmptyState body="La lista se genera junto con tu plan, ya sumada y agrupada por pasillo." title="Todavía no hay lista">
        <CtaLink href="/plan" size="lg">
          Ver mi plan
        </CtaLink>
      </EmptyState>
    );
  }

  const groups = ORDER.map(category => ({ category, items: list.items.filter(item => item.category === category) })).filter(group => group.items.length > 0);

  return (
    <Fragment>
      <h1 className={styles.title}>Lista de la compra</h1>
      <Text tone="secondary">Todo lo que necesitas para los catorce días, ya sumado.</Text>

      {/* Said plainly rather than rendered as checkboxes that do nothing. A control
          that looks interactive and is not is worse than its absence. */}
      <div className={styles.notice}>
        <Text size="sm" tone="secondary">
          Por ahora la lista es solo de consulta. Poder marcar lo que ya tienes, ajustar cantidades y añadir cosas llega en la próxima entrega.
        </Text>
      </div>

      {groups.map(group => (
        <section className={styles.group} key={group.category}>
          <h2 className={styles.groupTitle}>{CATEGORY_LABELS[group.category] ?? group.category}</h2>
          <ul className={styles.items}>
            {group.items.map(item => (
              <li className={styles.item} key={item.id}>
                <span>{item.name}</span>
                <span className={styles.quantity}>{formatQuantity(item.displayQuantity, item.displayUnit)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Fragment>
  );
}
