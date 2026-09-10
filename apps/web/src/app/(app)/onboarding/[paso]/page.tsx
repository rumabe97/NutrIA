import { notFound } from 'next/navigation';

import { FLOW, OnboardingFlow, TOTAL_STEPS } from 'components/OnboardingFlow';

import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../_shared/metadata';

import type { Allergen } from 'core/entities/Safety';
import type { FullProfileView } from 'core/controllers/Profile';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/onboarding');
}

/**
 * Server-rendered so every step arrives with the user's saved answers already
 * filled in — that is what makes the flow resumable rather than merely
 * restartable.
 */
export default async function OnboardingStepPage({ params, searchParams }: { params: Promise<{ paso: string }>; searchParams: Promise<{ volver?: string }> }) {
  const [{ paso }, { volver }] = await Promise.all([params, searchParams]);
  // Only the profile sends people here to edit one step; anything else is the flow itself.
  const returnTo = volver === 'perfil' ? '/perfil' : null;
  const step = Number(paso);

  if (!Number.isInteger(step) || step < 1 || step > TOTAL_STEPS) {notFound();}

  // Only the allergies step renders the catalogue. Fetching it for the other
  // eight is a whole extra API invocation per step for nothing.
  const [profile, allergens] = await Promise.all([
    serverApi<FullProfileView>('/profile'),
    FLOW[step - 1]?.key === 'allergies' ? serverApi<readonly Allergen[]>('/safety/allergens') : null
  ]);

  return <OnboardingFlow allergens={allergens ?? []} profile={profile} returnTo={returnTo} step={step} />;
}
