import { CanActivate, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AccountNotActivatedError, EmailNotVerifiedError } from 'core/entities/Error';

import { ALLOW_UNVERIFIED_KEY } from '../decorators/AllowUnverified.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/Public.decorator.js';

import type { AuthenticatedRequest } from '../decorators/CurrentUser.decorator.js';
import type { ExecutionContext } from '@nestjs/common';

/**
 * An account is usable when both locks are open: the address is confirmed and
 * the owner has opened the account
 * ([`0017`](../../../../../docs/decisions/0017-access-opens-account-by-account.md),
 * `0030`, `0031`).
 *
 * Runs after `SessionGuard`, so `request.user` is the session's user. Public
 * routes are not its business; a route marked `@AllowUnverified()` is the
 * small set an account in either state needs — who am I, which mode we are in,
 * and leave. Everything else answers 409 `EMAIL_NOT_VERIFIED` or
 * `ACCOUNT_NOT_ACTIVATED`: not a 404, because the person is signed in and the
 * state is their own, and the screen sends them to the page that explains
 * which of the two is missing.
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {return true;}

    if (this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_KEY, targets)) {return true;}

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    /*
     * Both, and in this order (`0031`, amended). The address first because it is
     * the half the person can fix themselves, and telling somebody their account
     * is closed when what is missing is a click in their own inbox sends them to
     * wait for nothing.
     *
     * A confirmed address is still not a key (`0030`) — it is one of two locks.
     */
    if (user && !user.emailVerified) {throw new EmailNotVerifiedError();}

    if (user && !user.activated) {throw new AccountNotActivatedError();}

    return true;
  }
}
