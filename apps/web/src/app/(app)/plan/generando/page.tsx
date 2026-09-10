import { GenerationProgress } from 'components/GenerationProgress';

import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../_shared/metadata';

import type { AllowancesView } from 'core/controllers/Plan';
import type { EventView } from 'core/controllers/Event';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/plan/generando');
}

export default async function GeneratingPage() {
  // The API refuses to start a job without a finished profile; this stops the
  // screen from being reached at all, so nobody watches a progress bar for a
  // request that was never going to be accepted.
  await redirectIfOnboardingIncomplete();

  // What will shape this fortnight, fetched before the job exists: the events
  const [events, allowances] = await Promise.all([serverApi<readonly EventView[]>('/events'), serverApi<AllowancesView>('/meal-plans/allowances')]);

  return <GenerationProgress allowance={allowances?.events ?? null} events={events ?? []} />;
}
