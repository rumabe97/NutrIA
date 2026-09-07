import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

export type RateLimitOptions = { readonly limit: number; readonly ttlSeconds: number };

/** Tightens the default limit for one route. Use on anything expensive. */
export function RateLimit(options: RateLimitOptions): ClassDecorator & MethodDecorator {
  return SetMetadata(RATE_LIMIT_KEY, options);
}

/** Exempts a route entirely. Health checks are polled by machines, not people. */
export function SkipRateLimit(): ClassDecorator & MethodDecorator {
  return SetMetadata(SKIP_RATE_LIMIT_KEY, true);
}
