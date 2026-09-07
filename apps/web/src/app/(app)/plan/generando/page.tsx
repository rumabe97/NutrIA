import { GenerationProgress } from 'components/GenerationProgress';

import { redirectIfOnboardingIncomplete } from 'lib/onboarding';

export const dynamic = 'force-dynamic';

export default async function GeneratingPage() {
  // The API refuses to start a job without a finished profile; this stops the
  // screen from being reached at all, so nobody watches a progress bar for a
  // request that was never going to be accepted.
  await redirectIfOnboardingIncomplete();

  return <GenerationProgress />;
}
