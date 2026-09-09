import { getDictionary } from 'i18n/server';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';
import { PlanBrowser } from 'components/PlanBrowser';

import { LIVED_PLAN_STATUSES } from 'core/entities/Plan';

import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import type { AllowancesView, PlanSummaryView, PlanView } from 'core/controllers/Plan';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  await redirectIfOnboardingIncomplete();

  // `active` returns null rather than 404 when there is no plan — having none is a
  // normal state, so the empty state is an ordinary render, not an error path.
  const [dictionary, plan, allowances, plans] = await Promise.all([
    getDictionary(),
    serverApi<PlanView | null>('/meal-plans/active'),
    serverApi<AllowancesView>('/meal-plans/allowances'),
    serverApi<readonly PlanSummaryView[]>('/meal-plans')
  ]);

  if (plan) {
    const earlier = (plans ?? []).filter(candidate => candidate.id !== plan.id && LIVED_PLAN_STATUSES.has(candidate.status));

    return <PlanBrowser hasHistory={earlier.length > 0} plan={plan} redo={allowances?.planRedo ?? null} />;
  }

  return (
    <EmptyState body={dictionary.plan.emptyBody} title={dictionary.plan.emptyTitle}>
      <CtaLink href="/plan/generando" size="lg">
        {dictionary.plan.createCta}
      </CtaLink>
    </EmptyState>
  );
}
