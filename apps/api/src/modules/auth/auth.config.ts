import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { AnalyticsController } from 'core/controllers/Analytics';

import { database } from 'database';
import { account, rateLimit, session, user, verification } from 'database/schema/auth';

import { absoluteCallback, sendPasswordResetMail } from './PasswordResetMail.js';
import { onAddressConfirmed } from './SelfService.js';
import { recipientLocale } from '../email/RecipientLocale.js';
import { verifyEmail } from '../email/templates/VerifyEmail.js';

import type { Env } from '../../config/index.js';
import type { EmailService } from '../email/Email.service.js';

const MINUTES = 60;

/**
 * Better Auth guards sign-up and sign-in harder than everything else — three in
 * ten seconds, per address, whatever the global ceiling says — which is right,
 * because those are the requests that guess passwords.
 *
 * The end-to-end suites open dozens of accounts in a couple of minutes from one
 * address, which is precisely that shape of traffic. Only the two paths they
 * hammer are raised, only under `NODE_ENV=test`, and raised rather than switched
 * off: the limiter stays on its real path, so a broken `rate_limit` table still
 * fails the suites, and every other route keeps the production rule.
 */
const TEST_AUTH_RULE = { max: 100_000, window: 60 };
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
export function createAuth(env: Env, mailer: Pick<EmailService, 'configured' | 'send'>) {
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
    database: drizzleAdapter(database(), { provider: 'pg', schema: { account, rateLimit, session, user, verification } }),
    databaseHooks: {
      session: {
        create: {
          /*
           * The one thing the schema cannot answer afterwards (`0033`): a
           * session row is deleted when it expires, so "did anybody come back"
           * is unanswerable a fortnight later unless it is written down as it
           * happens. Nothing about the visit travels but the fact of it.
           */
          after: async (created: { userId: string }) => {
            await AnalyticsController.record('session_started', created.userId);
          }
        }
      }
    },
    emailAndPassword: {
      enabled: true,
      // Verification is required before a session is useful, but sign-up still
      // succeeds — bouncing the user back to the form with "check your email"
      // half-completed is worse than letting them in and gating the plan.
      requireEmailVerification: false,
      // The one mail the product sends (0019). The request's language picks
      // the copy; the web app sends the tag it is rendering in.
      sendResetPassword: ({ url, user: recipient }, request) =>
        sendPasswordResetMail(mailer, {
          acceptLanguage: request?.headers.get('accept-language') ?? null,
          appUrl: env.APP_URL,
          to: recipient.email,
          url,
          userId: recipient.id
        })
    },
    emailVerification: {
      /*
       * The door decides what confirming an address does (`0031`, amended):
       * self-service while registration is open, an admin's act while it is
       * closed. The hook runs after `emailVerified` is written and before the
       * session cookie is set, and `SessionGuard` re-reads the row on every
       * request, so the person is in on their next navigation.
       */
      afterEmailVerification: async (verified: { id: string; email: string; }) => {
        await onAddressConfirmed(verified, { link: { apiUrl: `${env.BETTER_AUTH_URL}/${env.API_PREFIX}`, secret: env.BETTER_AUTH_SECRET }, mailer, ownerEmail: env.OWNER_EMAIL });
      },
      autoSignInAfterVerification: true,
      /*
       * Sent, since `0030`: confirming an address no longer opens the account.
       * That is `activatedAt`, which only the owner writes, so the link proves
       * what the person can prove and nothing more.
       */
      sendOnSignUp: true,
      sendVerificationEmail: async ({ url, user: recipient }, request) => {
        // Nobody has a profile at sign-up, so this is the one mail whose language
        // the request really does decide — but a resent confirmation reaches an
        // account that has one, and then the profile is the better answer.
        const locale = await recipientLocale(recipient.id, request?.headers.get('accept-language'));
        const link = absoluteCallback(url, env.APP_URL, locale);

        if (!mailer.configured) {
          console.info(`[auth] no SMTP configured; verification url for ${recipient.id}: ${link}`);

          return;
        }

        const sent = await mailer.send({ ...verifyEmail({ locale, url: link }), to: recipient.email });

        console.info(`[auth] verification ${sent ? 'mail sent' : 'mail NOT sent'} (user ${recipient.id})`);
      }
    },
    /*
     * Counted in the database, not in the process.
     *
     * Better Auth limits its own routes by default in production and keeps the
     * counters in memory, which on a serverless host means the effective limit
     * is multiplied by however many instances are warm — and these are the
     * routes where that matters, because the thing being counted is password
     * guesses. A row per key is a write on a path that sees a handful of
     * requests, which is a price worth paying exactly here and nowhere else
     * (`0007`, amended).
     */
    rateLimit: {
      customRules: env.NODE_ENV === 'test' ? { '/sign-in/*': TEST_AUTH_RULE, '/sign-up/*': TEST_AUTH_RULE } : undefined,
      enabled: true,
      storage: 'database'
    },
    secret: env.BETTER_AUTH_SECRET,
    session: {
      expiresIn: SESSION_MAX_AGE_DAYS * 24 * MINUTES * MINUTES,
      updateAge: SESSION_REFRESH_AGE_DAYS * 24 * MINUTES * MINUTES
    },
    trustedOrigins: (env.ALLOWED_ORIGINS ?? env.APP_URL).split(',').map(origin => origin.trim()),
    user: {
      additionalFields: {
        /*
         * Declared so it rides the session (`0030`): the guard asks "is this
         * account open" on every request, and a column Better Auth does not
         * know about is a column that is not there when it looks. `input: false`
         * — a client cannot send it, which is the whole point of a door.
         */
        activatedAt: { input: false, required: false, type: 'date' },
        role: { defaultValue: 'user', input: false, required: false, type: 'string' }
      },
      deleteUser: { enabled: true }
    }
  });
}

/** Derived from the factory: `betterAuth` returns a type parameterised by the
 *  exact options passed, so `ReturnType<typeof betterAuth>` is a different,
 *  incompatible type. */
export type Auth = ReturnType<typeof createAuth>;

export const AUTH = Symbol('BETTER_AUTH');
