import { CanActivate, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { EmailUnverifiedError } from 'core/entities/Error';

import { ALLOW_UNVERIFIED_KEY } from '../decorators/AllowUnverified.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/Public.decorator.js';

import type { AuthenticatedRequest } from '../decorators/CurrentUser.decorator.js';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Only an activated account may use the product
 * ([`0017`](../../../../../docs/decisions/0017-access-opens-account-by-account.md)).
 *
 * Runs after `SessionGuard`, so `request.user` is the session's user. Public
 * routes are not its business; a route marked `@AllowUnverified()` is the
 * small set an unactivated account needs — who am I, and leave. Everything
 * else answers 409 `EMAIL_UNVERIFIED`: not a 404, because the person is
 * signed in and the state is their own, and the screen sends them to the
 * page that explains it.
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {return true;}

    if (this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_KEY, targets)) {return true;}

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (user && !user.emailVerified) {throw new EmailUnverifiedError();}

    return true;
  }
}
