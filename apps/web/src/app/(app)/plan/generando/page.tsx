import { GenerationProgress } from 'components/GenerationProgress';

import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../_shared/metadata';

import type { AllowancesView } from 'core/controllers/Plan';
import type { EventAllowance } from 'components/EventPlanner';
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
  // are why the screen stops to ask before starting, and the allowance is how
  // many more it will take. Read for its `events` field alone — the one
  // `EventAllowance` waits for; until the API sends it, no count shows.
  const [events, allowances] = await Promise.all([
    serverApi<readonly EventView[]>('/events'),
    serverApi<AllowancesView & { events?: EventAllowance | null }>('/meal-plans/allowances')
  ]);

  return <GenerationProgress allowance={allowances?.events ?? null} events={events ?? []} />;
}
