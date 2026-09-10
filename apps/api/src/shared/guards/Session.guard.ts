import { CanActivate, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';

import { AUTH } from '../../modules/auth/auth.config.js';
import { IS_PUBLIC_KEY } from '../decorators/Public.decorator.js';

import type { Auth } from '../../modules/auth/auth.config.js';
import type { AuthenticatedRequest } from '../decorators/CurrentUser.decorator.js';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Deny-by-default authentication, registered globally in `app.module.ts`.
 *
 * A route is protected unless it carries `@Public()`. The inverse — opting in to
 * protection — makes a forgotten decorator an open endpoint, and forgotten
 * decorators are the normal case.
 *
 * The session is re-read from Better Auth on every request rather than trusted
 * from a decoded token, so a logout or a deleted account takes effect
 * immediately instead of at the end of the token's lifetime.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });

    // 404, not 401/403 — see the denial rule in `apps/api/AGENTS.md`. An
    // unauthenticated caller learns that the path exists either way, but keeping
    // one shape for every denial means no handler can accidentally become the
    // one that confirms a resource.
    if (!session?.user) {
      throw new NotFoundException();
    }

    request.user = {
      id: session.user.id,
      activated: (session.user as { activatedAt?: Date | string | null }).activatedAt != null,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      name: session.user.name,
      role: (session.user as { role?: 'admin' | 'user' }).role ?? 'user'
    };

    return true;
  }
}
