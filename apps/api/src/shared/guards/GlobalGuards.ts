import { AdminGuard } from './Admin.guard.js';
import { RateLimitGuard } from './RateLimit.guard.js';
import { RequiresOnboardingGuard } from './RequiresOnboarding.guard.js';
import { SessionGuard } from './Session.guard.js';
import { VerifiedEmailGuard } from './VerifiedEmail.guard.js';

import type { CanActivate, Type } from '@nestjs/common';

/**
 * The global guards, in the order `app.module.ts` registers them — Nest runs
 * them in registration order, so this list *is* that order. It lives in its own
 * file because the order is a security decision rather than a detail of wiring,
 * and because a spec can then pin it without importing the whole application.
 *
 * `SessionGuard` runs first: it is the only writer of `request.user`, and every
 * guard after it reads that. `RateLimitGuard` used to run ahead of it and so
 * keyed every window on `request.ip` — the per-account limits it claimed (three
 * generated plans an hour, five pieces of feedback) were really per address, and
 * one account got a fresh window from every address it called from.
 *
 * Authenticating first costs an anonymous flood nothing. Better Auth answers a
 * missing or wrongly-signed session cookie without reading the database, and a
 * `@Public()` route is let through without consulting the session at all. The
 * trade this order makes: a session-less request to a protected route is now
 * refused before the limiter ever counts it, so an anonymous flood is not
 * throttled, only denied per request — accepted because the counters are
 * in-process (a Vercel invocation is already spent either way) and an
 * authenticated flood, the case the limiter exists for, is unaffected.
 */
export const GLOBAL_GUARDS: readonly Type<CanActivate>[] = [SessionGuard, RateLimitGuard, VerifiedEmailGuard, AdminGuard, RequiresOnboardingGuard];
