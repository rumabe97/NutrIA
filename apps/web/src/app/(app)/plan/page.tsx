import { getDictionary } from 'i18n/server';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';
import { PlanBrowser } from 'components/PlanBrowser';

import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import type { PlanView } from 'core/controllers/Plan';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  await redirectIfOnboardingIncomplete();

  // `active` returns null rather than 404 when there is no plan — having none is a
  // normal state, so the empty state is an ordinary render, not an error path.
  const [dictionary, plan] = await Promise.all([getDictionary(), serverApi<PlanView | null>('/meal-plans/active')]);

  if (plan) {return <PlanBrowser plan={plan} />;}

  return (
    <EmptyState body={dictionary.plan.emptyBody} title={dictionary.plan.emptyTitle}>
      <CtaLink href="/plan/generando" size="lg">
        {dictionary.plan.createCta}
      </CtaLink>
    </EmptyState>
  );
}
