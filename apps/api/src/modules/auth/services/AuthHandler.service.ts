import { Inject, Injectable } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';

import { AUTH } from '../auth.config.js';

import type { Auth } from '../auth.config.js';
import type { Request, Response } from 'express';

/**
 * Better Auth's own Node handler, built once.
 *
 * It is a service rather than a field on the controller because it is the one
 * place this app hands a raw request and response to somebody else's router,
 * and that hand-off is worth being findable.
 *
 * The body must reach it **unread**: `CreateApp.ts` deliberately mounts
 * `express.json()` after this path, because a consumed stream arrives here
 * empty and the failure looks like bad credentials.
 */
@Injectable()
export class AuthHandlerService {
  private readonly handler: ReturnType<typeof toNodeHandler>;

  constructor(@Inject(AUTH) auth: Auth) {
    this.handler = toNodeHandler(auth);
  }

  async handle(request: Request, response: Response): Promise<void> {
    await this.handler(request, response);
  }
}
