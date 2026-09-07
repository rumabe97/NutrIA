import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opens a route to unauthenticated callers.
 *
 * The guard is global and deny-by-default, so exposure is always an explicit,
 * greppable decision on the route rather than the consequence of forgetting to
 * add protection.
 */
export function Public(): MethodDecorator & ClassDecorator {
  return SetMetadata(IS_PUBLIC_KEY, true);
}
