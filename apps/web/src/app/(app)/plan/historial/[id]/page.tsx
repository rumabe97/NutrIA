import { notFound, redirect } from 'next/navigation';

import { getDictionary } from 'i18n/server';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';
import { PlanBrowser } from 'components/PlanBrowser';

import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi, serverApiResult } from 'lib/server-api';

import { appMetadata } from '../../../../_shared/metadata';

import type { Metadata } from 'next';
import type { PlanSummaryView, PlanView } from 'core/controllers/Plan';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/plan/historial/[id]');
}

/**
 * One earlier plan, as it was (0021). The plan being lived has its own screen,
 * so a link here to it goes there instead of showing a copy that cannot be
 * marked. A plan that is not theirs is not found, like everywhere else.
 *
 * **And a plan premium opens says so rather than 404ing** (`0021`
 * § *Amended*): the API answers 409 `PREMIUM_ONLY` for a fortnight this account
 * does not open, and the two failures are told apart here — `serverApi` would
 * collapse both into `null`, and the page a paying customer must never see is
 * the one claiming their own past does not exist.
 */
export default async function EarlierPlanPage({ params }: { params: Promise<{ id: string }> }) {
  await redirectIfOnboardingIncomplete();

  const { id } = await params;
  const [answer, plans, dictionary] = await Promise.all([
    serverApiResult<PlanView>(`/meal-plans/${id}`),
    serverApi<readonly PlanSummaryView[]>('/meal-plans'),
    getDictionary()
  ]);
  const plan = answer.body;

  if (answer.code === 'PREMIUM_ONLY') {
    const t = dictionary.plan;

    return (
      <EmptyState body={t.lockedBody} title={t.lockedTitle}>
        <CtaLink href="/perfil" size="lg">
          {t.historyLockedCta}
        </CtaLink>
        <CtaLink href="/plan" size="lg" variant="secondary">
          {t.title}
        </CtaLink>
      </EmptyState>
    );
  }

  if (!plan) {
    notFound();
  }

  if (plan.status === 'active') {
    redirect('/plan');
  }

  const summary = (plans ?? []).find(candidate => candidate.id === plan.id);

  return <PlanBrowser history={{ replaced: summary?.replaced ?? false }} plan={plan} redo={null} />;
}
