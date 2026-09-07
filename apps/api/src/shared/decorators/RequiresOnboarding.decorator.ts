import { SetMetadata } from '@nestjs/common';

export const REQUIRES_ONBOARDING_KEY = 'requiresOnboarding';

/**
 * Marks a route as needing a finished onboarding. Enforced by
 * `RequiresOnboardingGuard`.
 *
 * Opt-in rather than deny-by-default, unlike `SessionGuard`: most routes are
 * how someone *finishes* onboarding, so gating everything by default would
 * lock the door from the inside.
 */
export function RequiresOnboarding(): ClassDecorator & MethodDecorator {
  return SetMetadata(REQUIRES_ONBOARDING_KEY, true);
}
