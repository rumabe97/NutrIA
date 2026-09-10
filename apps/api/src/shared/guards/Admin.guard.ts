import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

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
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    if (isPublic) {return true;}

    const roles = this.reflector.getAllAndOverride<readonly string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!roles || roles.length === 0) {return true;}

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 404 again: a 403 tells someone probing /admin that /admin is real.
    if (!user || !roles.includes(user.role)) {throw new NotFoundException();}

    return true;
  }
}
