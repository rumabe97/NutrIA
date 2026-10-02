import { getDictionary } from 'i18n/server';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';
import { PlanSwitch } from 'components/PlanSwitch';
import { ShoppingList } from 'components/ShoppingList';

import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../_shared/metadata';

import type { Metadata } from 'next';
import type { PlanView } from 'core/controllers/Plan';
import type { ShoppingListView } from 'components/ShoppingList';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/compra');
}

export default async function ShoppingPage() {
  await redirectIfOnboardingIncomplete();

  // A plan that has not started has its own list, one switch away (project 015).
  const [dictionary, list, scheduled] = await Promise.all([
    getDictionary(),
    serverApi<ShoppingListView>('/shopping-lists/active'),
    serverApi<PlanView>('/meal-plans/scheduled')
  ]);
  const switcher = scheduled ? (
    <PlanSwitch
      hrefs={{ current: '/compra', next: '/compra/proxima' }}
      labels={{ current: dictionary.shopping.switchCurrent, legend: dictionary.shopping.switchLabel, next: dictionary.shopping.switchNext }}
      on="current"
    />
  ) : null;

  if (!list) {
    return (
      <EmptyState body={dictionary.shopping.emptyBody} title={dictionary.shopping.emptyTitle}>
        <CtaLink href="/plan" size="lg">
          {dictionary.shopping.emptyCta}
        </CtaLink>
      </EmptyState>
    );
  }

  return <ShoppingList list={list} subtitle={dictionary.shopping.subtitle} switcher={switcher} />;
}
