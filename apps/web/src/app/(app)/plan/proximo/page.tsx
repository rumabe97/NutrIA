import { redirect } from 'next/navigation';

import { PlanBrowser } from 'components/PlanBrowser';

import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../_shared/metadata';

import type { Metadata } from 'next';
import type { PlanView } from 'core/controllers/Plan';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/plan/proximo');
}

/** The days of the plan that has not started: the same browser, read and swapped, never marked. */
export default async function NextPlanPage() {
  await redirectIfOnboardingIncomplete();

  const plan = await serverApi<PlanView>('/meal-plans/scheduled');

  // It began since this link was drawn: it is the plan under way now.
  if (!plan) {
    redirect('/plan');
  }

  return <PlanBrowser plan={plan} redo={null} upcoming={true} />;
}
