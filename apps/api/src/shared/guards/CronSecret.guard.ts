import { CanActivate, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { ENV } from '../../config/index.js';

import type { Env } from '../../config/index.js';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * The cron's door. The platform sends `Authorization: Bearer <CRON_SECRET>`;
 * nothing else may through.
 *
 * Anything else — the wrong secret, no secret, no secret configured at all — is
 * a 404 like every other denial here, so probing does not confirm the route
 * exists.
 *
 * The unconfigured case is logged, once per call, at warn: an operator watching
 * a cron quietly 404 every ten minutes needs to be able to tell "you have not
 * set CRON_SECRET" from "someone is knocking", and the response deliberately
 * cannot tell them.
 *
 * A guard rather than a private method on the controller, because it is the
 * whole authorisation of three routes, and a check a route has to remember to
 * call is a check a fourth route will not.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  private readonly logger = new Logger(CronSecretGuard.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.env.CRON_SECRET) {
      this.logger.warn('A cron route was called but CRON_SECRET is not configured; every call will 404 until it is set');
      throw new NotFoundException();
    }

    const { authorization } = context.switchToHttp().getRequest<Request>().headers;

    if (authorization !== `Bearer ${this.env.CRON_SECRET}`) {
      throw new NotFoundException();
    }

    return true;
  }
}
