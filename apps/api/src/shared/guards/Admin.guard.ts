import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

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
    const roles = this.reflector.getAllAndOverride<readonly string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!roles || roles.length === 0) {return true;}

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 404 again: a 403 tells someone probing /admin that /admin is real.
    if (!user || !roles.includes(user.role)) {throw new NotFoundException();}

    return true;
  }
}
