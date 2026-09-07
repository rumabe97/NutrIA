import { createParamDecorator } from '@nestjs/common';

import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export type SessionUser = {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string;
  readonly role: 'admin' | 'user';
};

/** `SessionGuard` is the only writer of this property. */
export type AuthenticatedRequest = Request & { user?: SessionUser };

/**
 * The authenticated user, taken from the session `SessionGuard` verified.
 *
 * This is the *only* sanctioned source of a user id in a controller. A user id
 * arriving in a path parameter, query string or request body is an id the caller
 * chose, and using one to scope a query is how one account reads another's data.
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): SessionUser => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

  if (!request.user) {
    // Unreachable behind SessionGuard. Throwing rather than returning undefined
    // means a route that forgets the guard fails loudly instead of silently
    // scoping a query to `undefined`.
    throw new Error('CurrentUser used on a route without SessionGuard');
  }

  return request.user;
});
