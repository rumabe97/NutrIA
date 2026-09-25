import { ONBOARDING_STEPS } from 'core/entities/Onboarding';
import { PROFILE_CONSENT_VERSION } from 'core/entities/Profile';
import { ProfileConsentRequiredError } from 'core/entities/Error';
import { ProfileConsentRepository } from '#repositories/Profile';
import type { OnboardingStep } from 'core/entities/Onboarding';
import type { StoredProfileConsent } from '#repositories/Profile';

/**
 * The onboarding steps that collect what the profile consent covers: the goal
 * (and its weights), body and activity (height, weight), and allergies with the
 * way of eating. Refused without consent, and reopened when it is withdrawn.
 */
export const PROFILE_CONSENT_STEPS: readonly OnboardingStep[] = ['goal', 'body-activity', 'allergies'];

// --- Presenters ---------------------------------------------------------------

export interface ProfileConsentView {
  /** The version a person has to give now; what the screen sends back. */
  currentVersion: string;
  /** When the stored consent was given (ISO), or null when there is none. */
  grantedAt: string | null;
  /** False when absent, withdrawn, or given to an older notice. */
  isCurrent: boolean;
}

function presentConsent(stored: StoredProfileConsent | undefined): ProfileConsentView {
  return {
    currentVersion: PROFILE_CONSENT_VERSION,
    grantedAt: stored?.grantedAt.toISOString() ?? null,
    isCurrent: stored?.version === PROFILE_CONSENT_VERSION
  };
}

/** Whether this account holds consent to the current notice. */
export async function hasProfileConsent(userId: string): Promise<boolean> {
  return (await ProfileConsentRepository.find(userId))?.version === PROFILE_CONSENT_VERSION;
}

/**
 * The one check every writer of the covered data and every generation runs
 * before it acts. A named function, so a path that skips it can be found by
 * grepping for it — the same reasoning as `getSafetyProfile`.
 */
export async function requireProfileConsent(userId: string): Promise<void> {
  if (!(await hasProfileConsent(userId))) {
    throw new ProfileConsentRequiredError();
  }
}

// --- Controller ---------------------------------------------------------------

export const ProfileConsentController = {
  async get(userId: string): Promise<ProfileConsentView> {
    return presentConsent(await ProfileConsentRepository.find(userId));
  },

  /** The version is checked by the body's schema (`z.literal`); an older one never reaches here. */
  async give(userId: string, version: string): Promise<ProfileConsentView> {
    return presentConsent(await ProfileConsentRepository.give(userId, version));
  },

  /** `requireProfileConsent`, for a caller in `apps/api` — a method, so a spec can stand it in. */
  async requireCurrent(userId: string): Promise<void> {
    await requireProfileConsent(userId);
  },

  /**
   * Withdrawal deletes the data with the consent and sends the account back to
   * the first step that collects it. Idempotent: withdrawing twice deletes
   * nothing more and answers the same.
   */
  async withdraw(userId: string): Promise<ProfileConsentView> {
    const first = PROFILE_CONSENT_STEPS[0] ?? 'goal';

    await ProfileConsentRepository.withdraw(userId, PROFILE_CONSENT_STEPS, ONBOARDING_STEPS.indexOf(first) + 1);

    return presentConsent(undefined);
  }
};
