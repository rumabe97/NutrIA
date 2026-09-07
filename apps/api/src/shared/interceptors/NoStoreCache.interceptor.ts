import { Injectable } from '@nestjs/common';

import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Response } from 'express';

/**
 * Every response defaults to `no-store`.
 *
 * Without an explicit directive, RFC 9111 permits a shared cache to apply
 * heuristic freshness to a response — including an authenticated one carrying
 * another person's dietary and health data. Practically nothing this API returns
 * is genuinely public, so the safe default is the one applied everywhere and
 * opted out of deliberately.
 */
@Injectable()
export class NoStoreCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();

    if (!response.getHeader('Cache-Control')) {
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }

    return next.handle();
  }
}
