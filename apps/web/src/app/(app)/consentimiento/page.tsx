import { redirect } from 'next/navigation';

import { ProfileConsentInterstitial } from 'components/ProfileConsentInterstitial';

import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../_shared/metadata';

import type { Metadata } from 'next';
import type { OnboardingView } from 'core/controllers/Onboarding';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/consentimiento');
}

/**
 * The one-time screen an existing account meets before `/inicio` when
 * `OnboardingView.profileConsentRequired` is still true — an onboarding
 * finished before this health-data consent existed (P0-2), so nothing ever
 * asked. Someone still mid-onboarding belongs in the flow that already asks
 * them, on the about-you step, not here — `redirectIfOnboardingIncomplete`
 * sends them there first.
 */
export default async function ProfileConsentPage() {
  await redirectIfOnboardingIncomplete();

  const state = await serverApi<OnboardingView>('/onboarding');

  // Read positively, like every other guard here: `null` means the API could
  // not be asked, and showing the form once more on a hiccup is the safe
  // failure — sending someone who *has* consented straight past `/inicio`
  // on a hiccup would not be.
  if (state && !state.profileConsentRequired) {
    redirect('/inicio');
  }

  return <ProfileConsentInterstitial />;
}
