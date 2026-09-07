import { CanActivate, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ENV } from '../../config/index.js';
import { RATE_LIMIT_KEY, SKIP_RATE_LIMIT_KEY } from '../decorators/RateLimit.decorator.js';

import type { AuthenticatedRequest } from '../decorators/CurrentUser.decorator.js';
import type { Env } from '../../config/index.js';
import type { ExecutionContext } from '@nestjs/common';
import type { RateLimitOptions } from '../decorators/RateLimit.decorator.js';

const SECONDS = 1000;
/** Prune at most this often, so a burst does not walk the whole map per request. */
const PRUNE_INTERVAL_MS = 60 * SECONDS;

type Window = { count: number; expiresAt: number };

/**
 * Fixed-window rate limiting, in memory.
 *
 * Replaces `@nestjs/throttler`, whose latest release does not support NestJS 12 —
 * see [`0007`](../../../../docs/decisions/0007-own-the-rate-limiter.md).
 *
 * Keyed on the authenticated user where there is one, and only on IP otherwise, so
 * a shared network (an office, a mobile carrier's NAT) does not have one user's
 * traffic throttle everyone behind it.
 *
 * **Counters live in this process.** With several instances the effective limit
 * multiplies by instance count, and a restart resets them. That is a deliberate
 * trade while the job runner is in-process too; both want a shared store at the
 * same moment.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();
  private lastPrune = Date.now();

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, targets)) {return true;}

    const options: RateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, targets) ?? {
      limit: this.env.RATE_LIMIT_MAX,
      ttlSeconds: this.env.RATE_LIMIT_TTL
    };

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // The route *pattern*, not the URL, so `/plans/abc` and `/plans/def` share one
    // window rather than letting a client sidestep the limit by varying the id.
    // Express types `route` as `any`; the cast is what keeps the rest type-safe.
    const route = (request.route as { path?: string } | undefined)?.path ?? request.url;
    const key = `${request.user?.id ?? request.ip ?? 'unknown'}:${request.method}:${route}`;
    const now = Date.now();

    this.prune(now);

    const window = this.windows.get(key);

    if (!window || window.expiresAt <= now) {
      this.windows.set(key, { count: 1, expiresAt: now + options.ttlSeconds * SECONDS });

      return true;
    }

    window.count += 1;

    if (window.count > options.limit) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Demasiadas peticiones. Inténtalo de nuevo en un momento.', statusCode: HttpStatus.TOO_MANY_REQUESTS },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  /** Drops expired windows so the map cannot grow without bound. */
  private prune(now: number): void {
    if (now - this.lastPrune < PRUNE_INTERVAL_MS) {return;}

    this.lastPrune = now;

    for (const [key, window] of this.windows) {
      if (window.expiresAt <= now) {this.windows.delete(key);}
    }
  }
}
