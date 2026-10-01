import { CanActivate, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PasswordChangeRequiredError } from 'core/entities/Error';

import { ALLOW_PASSWORD_CHANGE_PENDING_KEY } from '../decorators/AllowPasswordChangePending.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/Public.decorator.js';

import type { AuthenticatedRequest } from '../decorators/CurrentUser.decorator.js';
import type { ExecutionContext } from '@nestjs/common';

/**
 * A password a sign-in found in the breach corpus must be changed before the
 * account reaches anything else (PLAN 011 phase 2).
 *
 * Runs after `SessionGuard`, which writes `request.user` from the session it
 * re-read — `passwordChangeRequired` is the row's `password_compromised_at`,
 * never cached — and after `VerifiedEmailGuard` and `AdminGuard`: an
 * unconfirmed or unopened account hears that first, and a non-admin still
 * hears the admin routes' 404, not this. Before `RequiresOnboardingGuard`,
 * because a half-filled profile is no reason to keep a breached password.
 *
 * Public routes are not its business — Better Auth's `/auth/*`, where the
 * password is changed and the session ended, are `@Public()`. A route marked
 * `@AllowPasswordChangePending()` is the small set such an account needs: who
 * am I, and delete me. Everything else answers 409 `PASSWORD_CHANGE_REQUIRED`:
 * not a 404, because the account is the caller's and the screen must say what
 * to do.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    if (this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_PENDING_KEY, targets)) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (user?.passwordChangeRequired) {
      throw new PasswordChangeRequiredError();
    }

    return true;
  }
}
