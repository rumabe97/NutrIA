import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserController } from 'core/controllers/User';

import { IS_PUBLIC_KEY } from '../decorators/Public.decorator.js';
import { ROLES_KEY } from '../decorators/Roles.decorator.js';

import type { AuthenticatedRequest } from '../decorators/CurrentUser.decorator.js';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Role check, applied per route with `@Roles('admin')`. Runs after
 * `SessionGuard`, so `request.user` is already verified.
 *
 * The role comes from the database row, never from the request — a client-
 * supplied role is a client-supplied privilege.
 *
 * **An admin with a password must have a second factor** (PLAN 011 phase 6,
 * `0074`): the console reads every account, so without the authenticator app
 * on, every `@Roles('admin')` route is the same 404 as for anybody else —
 * `UserController.needsSecondFactor`, asked only of an admin, only on a
 * role-protected route, and with no query when the factor is on. A
 * Google-only admin passes; a passkey sign-in on an admin with TOTP on passes
 * (`0083`). The web's console gate reads the same rule from `/users/me` and
 * says what to do instead of drawing the console.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    /*
     * A public route on a role-protected controller is public.
     *
     * `@Roles` is read from the handler *or its class*, so a controller-wide
     * `@Roles('admin')` also lands on the one handler that deliberately runs
     * without a session — `SessionGuard` returns early for `@Public()` and
     * never sets `request.user`, so this guard would then deny a route whose
     * authority was never a role in the first place. That is what silently
     * killed the owner's one-click activation link: it 404'd every click,
     * indistinguishably from a bad token.
     */
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    const roles = this.reflector.getAllAndOverride<readonly string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 404 again: a 403 tells someone probing /admin that /admin is real.
    if (!user || !roles.includes(user.role)) {
      throw new NotFoundException();
    }

    if (user.role === 'admin' && (await UserController.needsSecondFactor(user))) {
      throw new NotFoundException();
    }

    return true;
  }
}
