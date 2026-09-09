import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';

/**
 * Lets a signed-in account that has not been activated reach this route.
 *
 * `VerifiedEmailGuard` is global and deny-by-default, so the routes an
 * unactivated account may use — see who it is, leave — are an explicit,
 * greppable list rather than whatever was forgotten.
 */
export function AllowUnverified(): MethodDecorator & ClassDecorator {
  return SetMetadata(ALLOW_UNVERIFIED_KEY, true);
}
