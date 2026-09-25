import { ProfileConsentInterstitial } from 'components/ProfileConsentInterstitial';

import { redirectIfOnboardingIncomplete } from 'lib/onboarding';

import { appMetadata } from '../../_shared/metadata';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/consentimiento');
}

/**
 * The one-time screen an existing account meets before `/inicio` when its
 * health-data consent (P0-2) is still missing — an onboarding finished before
 * that consent existed, so nothing ever asked. Someone still mid-onboarding
 * belongs in the flow that is about to ask them, at the allergies step, not
 * here.
 *
 * TODO(backend): once `OnboardingView` (or `/users/me`) carries the consent
 * flag, redirect straight to `/inicio` here when it is already `true` — the
 * same self-guard `redirectIfOnboardingIncomplete` gives every other signed-in
 * page — so a direct visit after consenting is not shown the form again.
 */
export default async function ProfileConsentPage() {
  await redirectIfOnboardingIncomplete();

  return <ProfileConsentInterstitial />;
}
