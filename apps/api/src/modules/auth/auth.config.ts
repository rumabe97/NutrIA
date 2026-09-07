import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { database } from 'database';
import { account, session, user, verification } from 'database/schema/auth';

import type { Env } from '../../config/index.js';

const MINUTES = 60;
const SESSION_MAX_AGE_DAYS = 30;
const SESSION_REFRESH_AGE_DAYS = 1;

/**
 * Better Auth owns registration, login, logout, email verification, password
 * reset, sessions and account deletion. It is deliberately not hand-rolled:
 * password hashing, token expiry and session rotation are the parts of an app
 * where a subtle mistake is invisible until it is exploited.
 *
 * `deleteUser` is enabled because the cascade from `user.id` is what actually
 * removes a person's health data — every user-scoped table references it with
 * ON DELETE CASCADE (see `packages/database/src/schemas/_utils.ts`).
 */
export function createAuth(env: Env) {
  return betterAuth({
    account: { accountLinking: { enabled: false } },
    advanced: {
      /*
       * Written for the parent domain when API and web sit on sibling subdomains,
       * which is the deployed shape: the web app reads this cookie itself, both in
       * `proxy.ts` and when forwarding it server-side, and a host-only cookie on
       * the API's subdomain is invisible to it.
       *
       * Still `sameSite: 'lax'` — sibling subdomains of one registrable domain are
       * the *same site*, so nothing is loosened here. A cross-site cookie would be
       * sent on requests the user never initiated, which is the attack this
       * setting exists to prevent, and no deployment shape justifies it.
       */
      crossSubDomainCookies: env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN, enabled: true } : undefined,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production' },
      useSecureCookies: env.NODE_ENV === 'production'
    },
    basePath: `/${env.API_PREFIX}/auth`,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(database(), { provider: 'pg', schema: { account, session, user, verification } }),
    emailAndPassword: {
      enabled: true,
      // Verification is required before a session is useful, but sign-up still
      // succeeds — bouncing the user back to the form with "check your email"
      // half-completed is worse than letting them in and gating the plan.
      requireEmailVerification: false,
      sendResetPassword: async ({ url, user: recipient }) => {
        // Wired to SMTP in the notifications project. Logging the address would
        // put an account identifier in the log stream, so it does not.
        console.info(`[auth] password reset requested; token url issued (user ${recipient.id})`, env.SMTP_HOST ? '' : '(no SMTP configured)');

        if (!env.SMTP_HOST) {console.info(`[auth] reset url: ${url}`);}
      }
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignUp: true,
      sendVerificationEmail: async ({ url, user: recipient }) => {
        console.info(`[auth] verification email queued (user ${recipient.id})`, env.SMTP_HOST ? '' : '(no SMTP configured)');

        if (!env.SMTP_HOST) {console.info(`[auth] verification url: ${url}`);}
      }
    },
    secret: env.BETTER_AUTH_SECRET,
    session: {
      expiresIn: SESSION_MAX_AGE_DAYS * 24 * MINUTES * MINUTES,
      updateAge: SESSION_REFRESH_AGE_DAYS * 24 * MINUTES * MINUTES
    },
    trustedOrigins: (env.ALLOWED_ORIGINS ?? env.APP_URL).split(',').map(origin => origin.trim()),
    user: {
      additionalFields: { role: { defaultValue: 'user', input: false, required: false, type: 'string' } },
      deleteUser: { enabled: true }
    }
  });
}

/** Derived from the factory: `betterAuth` returns a type parameterised by the
 *  exact options passed, so `ReturnType<typeof betterAuth>` is a different,
 *  incompatible type. */
export type Auth = ReturnType<typeof createAuth>;

export const AUTH = Symbol('BETTER_AUTH');
