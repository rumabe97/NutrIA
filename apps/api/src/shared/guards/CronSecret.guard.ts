import { timingSafeEqual } from 'node:crypto';

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
 * The header is compared in constant time, like the activation token. `!==` on
 * two strings stops at the first byte that differs, so how long the refusal
 * takes reports how much of the secret a guess got right, and a caller with
 * enough timed attempts reads the secret out one byte at a time. These routes
 * have no second door behind them.
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

    if (!matches(authorization, `Bearer ${this.env.CRON_SECRET}`)) {
      throw new NotFoundException();
    }

    return true;
  }
}

/**
 * Constant time in the secret: `timingSafeEqual` reads both buffers whole, so
 * every wrong guess of the right length costs the same.
 *
 * The length is checked first because `timingSafeEqual` throws on buffers of
 * different sizes. That early return is measurably cheaper than reaching the
 * comparison, so it does leak one thing — the length of the secret — and only
 * ever that. A length is not what keeps anyone out: the secret is generated
 * with `openssl rand -base64 32`, and knowing it is forty-four characters
 * long removes nothing from a search of its thirty-two random bytes. What
 * the byte-by-byte `!==` leaked, and this does not, is the secret itself.
 *
 * `presented` is typed `string | undefined`, but the type is a promise the
 * wire does not keep. A missing header is `undefined`, and `Buffer.from`
 * throws on that, which would answer a probe with a 500 — the one response
 * this guard must never give. So anything that is not a string is compared
 * as the empty buffer and refused like everything else.
 */
function matches(presented: string | undefined, expected: string): boolean {
  const given = Buffer.from(typeof presented === 'string' ? presented : '');
  const wanted = Buffer.from(expected);

  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
