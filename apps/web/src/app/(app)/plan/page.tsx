import { Fragment } from 'react';

import { activeLocale, getDictionary } from 'i18n/server';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';
import { PlanBrowser } from 'components/PlanBrowser';
import { PlanPendingNotice } from 'components/PlanPendingNotice';

import { formatDate, interpolate } from 'lib/format';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../_shared/metadata';

import type { AllowancesView, PlanView } from 'core/controllers/Plan';
import type { EventView } from 'core/controllers/Event';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/plan');
}

export default async function PlanPage() {
  await redirectIfOnboardingIncomplete();

  // `active` returns null rather than 404 when there is no plan — having none is a
  // normal state, so the empty state is an ordinary render, not an error path.
  const [dictionary, locale, plan, scheduled, allowances, events] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<PlanView | null>('/meal-plans/active'),
    // The plan waiting for its day (project 015); 404 is the usual answer.
    serverApi<PlanView>('/meal-plans/scheduled'),
    serverApi<AllowancesView>('/meal-plans/allowances'),
    serverApi<readonly EventView[]>('/events')
  ]);

  const notice = (
    <PlanPendingNotice
      body={dictionary.plan.pendingReviewBody}
      currentPlanId={plan?.id ?? null}
      heading={false}
      title={dictionary.plan.pendingReviewTitle}
    />
  );

  const next = scheduled ? formatDate(scheduled.startDate, locale, { day: 'numeric', month: 'long' }) : '';

  if (plan) {
    // Adding an event to a plan under way is premium's alone (`0043` left the
    // rebuild out; the paid tier buys it). Free sees nothing — no upsell, no
    // disabled control — which is why the standing is null rather than zero.
    const midPlan = allowances?.tier === 'premium' ? (allowances.events?.midPlan ?? null) : null;

    return (
      <Fragment>
        {notice}
        {scheduled ? (
          <CtaLink href="/plan/proximo" size="sm" variant="tertiary">
            {interpolate(dictionary.plan.scheduledLink, { date: next })}
          </CtaLink>
        ) : null}
        <PlanBrowser events={events ?? []} midPlan={midPlan} plan={plan} redo={allowances?.planRedo ?? null} />
      </Fragment>
    );
  }

  return (
    <Fragment>
      {notice}
      {scheduled ? (
        <EmptyState body={dictionary.plan.scheduledBody} title={interpolate(dictionary.plan.scheduledTitle, { date: next })}>
          <CtaLink href="/plan/proximo" size="lg">
            {dictionary.plan.scheduledCta}
          </CtaLink>
        </EmptyState>
      ) : (
        <EmptyState body={dictionary.plan.emptyBody} title={dictionary.plan.emptyTitle}>
          <CtaLink href="/plan/generando" size="lg">
            {dictionary.plan.createCta}
          </CtaLink>
        </EmptyState>
      )}
    </Fragment>
  );
}
