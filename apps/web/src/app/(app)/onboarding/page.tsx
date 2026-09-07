import { redirect } from 'next/navigation';

import { serverApi } from 'lib/server-api';

import type { OnboardingView } from 'core/controllers/Onboarding';

export const dynamic = 'force-dynamic';

/**
 * `/onboarding` has no screen of its own — it *is* the resume target.
 *
 * Everything that means "carry on where I left off" points here, so the step
 * number is resolved once from the state instead of being guessed by each
 * caller. Two of them used to guess, and both guessed the same wrong thing.
 */
export default async function OnboardingIndexPage() {
  const state = await serverApi<OnboardingView>('/onboarding');

  redirect(`/onboarding/${state?.resumeStep ?? 1}`);
}
