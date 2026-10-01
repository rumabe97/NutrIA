import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_PENDING_KEY = 'allowPasswordChangePending';

/**
 * Lets a signed-in account whose password was found breached reach this route
 * (PLAN 011 phase 2).
 *
 * `PasswordChangeGuard` is global and deny-by-default, so the routes such an
 * account may use — see who it is, delete itself — are an explicit, greppable
 * list rather than whatever was forgotten. Better Auth's own routes, the change
 * of password and sign-out among them, are `@Public()` and never reach it.
 */
export function AllowPasswordChangePending(): MethodDecorator & ClassDecorator {
  return SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING_KEY, true);
}
