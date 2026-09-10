import { redirect } from 'next/navigation';

import { serverApi } from './server-api';

import type { OnboardingView } from 'core/controllers/Onboarding';

/**
 * Sends someone with an unfinished profile back to the step they stopped at.
 *
 * Called at the top of each signed-in page rather than once in the layout,
 * because a layout is not a gate: Next reuses a shared layout across
 * navigations between the pages under it, so it renders when the section is
 * entered and not again. A per-page call runs on every entry, which is what
 * "entering with an incomplete profile redirects" actually requires.
 *
 * It is a redirect, not an authorisation check — the enforcement is
 * `RequiresOnboardingGuard` in the API. Which is why it only acts on a state it
 * positively read: `serverApi` returns null when the API is unreachable, and
 * treating "we could not ask" as "incomplete" would loop a signed-in user
 * through onboarding every time the backend hiccups.
 */
export async function redirectIfOnboardingIncomplete(): Promise<void> {
  const state = await serverApi<OnboardingView>('/onboarding');

  if (state && !state.isComplete) {
    redirect(`/onboarding/${state.resumeStep}`);
  }
}
