import { notFound, redirect } from 'next/navigation';

import { PlanBrowser } from 'components/PlanBrowser';

import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

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
 */
export default async function EarlierPlanPage({ params }: { params: Promise<{ id: string }> }) {
  await redirectIfOnboardingIncomplete();

  const { id } = await params;
  const [plan, plans] = await Promise.all([serverApi<PlanView>(`/meal-plans/${id}`), serverApi<readonly PlanSummaryView[]>('/meal-plans')]);

  if (!plan) {
    notFound();
  }

  if (plan.status === 'active') {
    redirect('/plan');
  }

  const summary = (plans ?? []).find(candidate => candidate.id === plan.id);

  return <PlanBrowser history={{ replaced: summary?.replaced ?? false }} plan={plan} redo={null} />;
}
