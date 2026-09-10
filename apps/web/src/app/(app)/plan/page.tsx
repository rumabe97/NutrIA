import { getDictionary } from 'i18n/server';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';
import { PlanBrowser } from 'components/PlanBrowser';

import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../_shared/metadata';

import type { AllowancesView, PlanView } from 'core/controllers/Plan';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/plan');
}

export default async function PlanPage() {
  await redirectIfOnboardingIncomplete();

  // `active` returns null rather than 404 when there is no plan — having none is a
  // normal state, so the empty state is an ordinary render, not an error path.
  const [dictionary, plan, allowances] = await Promise.all([
    getDictionary(),
    serverApi<PlanView | null>('/meal-plans/active'),
    serverApi<AllowancesView>('/meal-plans/allowances')
  ]);

  if (plan) {
    return <PlanBrowser plan={plan} redo={allowances?.planRedo ?? null} />;
  }

  return (
    <EmptyState body={dictionary.plan.emptyBody} title={dictionary.plan.emptyTitle}>
      <CtaLink href="/plan/generando" size="lg">
        {dictionary.plan.createCta}
      </CtaLink>
    </EmptyState>
  );
}
