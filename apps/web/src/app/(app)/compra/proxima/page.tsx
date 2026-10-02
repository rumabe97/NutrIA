import { redirect } from 'next/navigation';

import { activeLocale, getDictionary } from 'i18n/server';

import { PlanSwitch } from 'components/PlanSwitch';
import { ShoppingList } from 'components/ShoppingList';

import { formatDate, interpolate } from 'lib/format';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../_shared/metadata';

import type { Metadata } from 'next';
import type { PlanView } from 'core/controllers/Plan';
import type { ShoppingListView } from 'components/ShoppingList';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/compra/proxima');
}

/** The shopping list of the plan that has not started: the same screen, for the days that come next. */
export default async function NextShoppingPage() {
  await redirectIfOnboardingIncomplete();

  const [dictionary, locale, list, scheduled] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<ShoppingListView>('/meal-plans/scheduled/shopping-list'),
    serverApi<PlanView>('/meal-plans/scheduled')
  ]);

  // The plan began since this link was drawn: its list is the current one now.
  if (!list || !scheduled) {
    redirect('/compra');
  }

  return (
    <ShoppingList
      list={list}
      subtitle={interpolate(dictionary.shopping.nextSubtitle, { date: formatDate(scheduled.startDate, locale, { day: 'numeric', month: 'long' }) })}
      switcher={
        <PlanSwitch
          hrefs={{ current: '/compra', next: '/compra/proxima' }}
          labels={{ current: dictionary.shopping.switchCurrent, legend: dictionary.shopping.switchLabel, next: dictionary.shopping.switchNext }}
          on="next"
        />
      }
    />
  );
}
