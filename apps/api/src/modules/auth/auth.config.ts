import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { isPasswordCompromised } from 'better-auth/plugins/haveibeenpwned';
import { twoFactor } from 'better-auth/plugins/two-factor';

import { AnalyticsController } from 'core/controllers/Analytics';
import { CareController } from 'core/controllers/Care';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from 'core/entities/Password';
import { TERMS_VERSION } from 'core/entities/User';
import { DEFAULT_WEB_LOCALE, webUrl } from 'core/domain/WebUrl';

import { database } from 'database';
import { account, rateLimit, session, twoFactor as twoFactorTable, user, verification } from 'database/schema/auth';

import { APPLE_ORIGIN, configuredSocialProviders, socialProviderOptions } from './services/SocialProviders.js';
import { onAccountCreated, onAddressConfirmed } from './services/SelfService.js';
import { accountSecurityAfter, accountSecurityBefore, onPasswordReset } from './services/AccountSecurity.js';
import { sendPasswordChangedMail } from './services/PasswordChangedMail.js';
import { sendPasswordResetMail } from './services/PasswordResetMail.js';
import { BACKUP_CODE_COUNT, sessionStartedOnSignIn, startsAVisit, TRUST_DEVICE_MAX_AGE, TWO_FACTOR_ISSUER } from './services/TwoFactor.js';
import { sendTwoFactorMail } from './services/TwoFactorMail.js';
import { sendVerificationMail } from './services/VerificationMail.js';

import type { BackgroundTaskService } from '../../shared/services/index.js';
import type { BillingService } from '../billing/services/Billing.service.js';
import type { Env } from '../../config/index.js';
import type { EmailService } from '../email/services/Email.service.js';
import type { TwoFactorNotice } from './services/TwoFactor.js';

const MINUTES = 60;

/**
 * Better Auth guards sign-up and sign-in harder than everything else — three in
 * ten seconds, per address, whatever the global ceiling says — which is right,
 * because those are the requests that guess passwords.
 *
 * The end-to-end suites open dozens of accounts in a couple of minutes from one
 * address, which is precisely that shape of traffic. Only the paths they
 * hammer — and `/two-factor/*`, three in ten seconds by the plugin's rule — are raised, only under `NODE_ENV=test`, and raised rather than switched
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
export function createAuth(
  env: Env,
  mailer: Pick<EmailService, 'configured' | 'send'>,
  billing: Pick<BillingService, 'cancelEverything'>,
  background: Pick<BackgroundTaskService, 'run'>
) {
  const providers = configuredSocialProviders(env);
  const selfService = { link: (path: string) => webUrl(env.APP_URL, path, DEFAULT_WEB_LOCALE), mailer, ownerEmail: env.OWNER_EMAIL };
  // HIBP is never called under `NODE_ENV=test`: the suites must not reach the network.
  const isCompromised = env.NODE_ENV === 'test' ? null : isPasswordCompromised;
  const security = {
    background,
    isCompromised,
    mailPasswordChanged: async ({
      id,
      acceptLanguage,
      email,
      userAgent
    }: {
      id: string;
      acceptLanguage: string | null;
      email: string;
      userAgent: string | null;
    }) => sendPasswordChangedMail(mailer, { acceptLanguage, appUrl: env.APP_URL, to: email, userAgent, userId: id }),
    mailTwoFactor: async ({ id, acceptLanguage, email, event, userAgent }: TwoFactorNotice) =>
      sendTwoFactorMail(mailer, { acceptLanguage, appUrl: env.APP_URL, event, to: email, userAgent, userId: id })
  };

  return betterAuth({
    account: {
      /*
       * Linking exists only while a provider does (`0058`), and only ever in one
       * shape: somebody who signed up with a password and later arrives through
       * Google with the same address is the same person, not a second account.
       *
       * Two conditions, both Better Auth's and both left at their strict
       * setting. The provider must itself say the address is verified — no
       * provider is listed as trusted, which would waive that. And the local
       * account must have confirmed its address already
       * (`requireLocalEmailVerified`, on by default): otherwise anybody could
       * sign up with a stranger's address and a password of their own, wait for
       * the stranger to arrive through Google, and walk into their health data.
       */
      accountLinking: { enabled: providers.length > 0 },
      // Nothing is ever called on anybody's behalf, but the adapter keeps what
      // the provider hands back. At rest it is ciphertext.
      encryptOAuthTokens: true
    },
    advanced: {
      /*
       * What Better Auth hands to `runInBackgroundOrAwait` — the reset mail,
       * the verification mail — runs after the response, kept alive on the
       * platform by `BackgroundTaskService`. Without it the reset waited for
       * SMTP only when the address had an account, and its timing said which
       * addresses do (PRD 011, criterion 5). Consequence: those mails may land
       * after the HTTP response, and a failure is the service's log line, not
       * the request's error — which is what the mail functions already chose.
       */
      backgroundTasks: { handler: promise => background.run('auth', promise) },
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
    database: drizzleAdapter(database(), { provider: 'pg', schema: { account, rateLimit, session, twoFactor: twoFactorTable, user, verification } }),
    databaseHooks: {
      session: {
        create: {
          /*
           * The one thing the schema cannot answer afterwards (`0033`): a
           * session row is deleted when it expires, so "did anybody come back"
           * is unanswerable a fortnight later unless it is written down as it
           * happens. Nothing about the visit travels but the fact of it.
           *
           * Once per real sign-in (PLAN 011 phase 3): a password sign-in is
           * counted by `sessionStartedOnSignIn` once the two-factor plugin has
           * decided whether its session survives, and the plugin's rotations
           * of a session somebody already had are not visits (`startsAVisit`).
           */
          after: async (created: { userId: string }, context: Parameters<typeof startsAVisit>[0]) => {
            if (startsAVisit(context)) {
              await AnalyticsController.record('session_started', created.userId);
            }
          }
        },
        update: {
          /*
           * Somebody used a session they already had (`0071`). A session lasts
           * thirty days and Better Auth renews it at most once a day of use
           * (`updateAge`), from `getSession` — which `SessionGuard` calls on every
           * request — so a person who opens the app daily without signing in
           * again passes here and nowhere else. One `app_used` a Madrid day,
           * however many sessions or parallel requests renewed; nothing about
           * the visit travels but the fact of it, and it never throws.
           */
          after: async (updated: { userId?: string } | null) => {
            if (updated?.userId) {
              // Its own catch as well: a counter never turns a renewal into a 500.
              await AnalyticsController.recordUse(updated.userId).catch(() => undefined);
            }
          }
        }
      },
      user: {
        create: {
          /*
           * An account created through a provider is born with its address
           * confirmed, so the verification link — and the hook behind it, which
           * is what opens an account or tells the owner one is waiting — never
           * runs for it (`0058`). This is that moment for them. It runs after
           * the row is committed, so the activation finds it.
           */
          after: async (created: { id: string; email: string; emailVerified: boolean }) => {
            await onAccountCreated(created, selfService);
          },
          /*
           * Which `/condiciones` the account was created under (`0071`, phase 7),
           * written in the same `INSERT` that creates it — the row and the
           * record cannot part. Every way to an account passes here: email
           * sign-up, Google and Apple (the OAuth callback's `internalAdapter.createUser` runs the same hooks).
           * The values are ours, set after whatever else the data carried. A
           * sign-up body with `termsVersion` in it never gets this far:
           * `input: false` below refuses it (400) and no account is made.
           */
          before: async (created: Record<string, unknown>) => ({ data: { ...created, termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION } })
        }
      }
    },
    emailAndPassword: {
      enabled: true,
      // The rule's one home is `core` (PLAN 011 phase 1); the web forms read the same two numbers.
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      // The mark cleared, the audit row, the "password changed" mail (PLAN 011 phase 2; `services/AccountSecurity.ts`).
      onPasswordReset: onPasswordReset(security),
      // Verification is required before a session is useful, but sign-up still
      // succeeds — bouncing the user back to the form with "check your email"
      // half-completed is worse than letting them in and gating the plan.
      requireEmailVerification: false,
      /*
       * A reset is somebody proving the address is theirs, often because
       * somebody else got there first: signed up with it, never confirmed it,
       * and still holds a session. That session must not outlive the proof —
       * more so now that "reset the password" is what the sign-in page says to
       * a person whose address was taken before they arrived through a
       * provider (`0058`).
       */
      revokeSessionsOnPasswordReset: true,
      // The one mail the product sends (0019). The request's language picks
      // the copy; the web app sends the tag it is rendering in.
      sendResetPassword: ({ url, user: recipient }, request) =>
        sendPasswordResetMail(mailer, {
          acceptLanguage: request?.headers.get('accept-language') ?? null,
          appUrl: env.APP_URL,
          nodeEnv: env.NODE_ENV,
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
      afterEmailVerification: async (verified: { id: string; email: string }) => {
        await onAddressConfirmed(verified, selfService);
      },
      autoSignInAfterVerification: true,
      /*
       * Sent, since `0030`: confirming an address no longer opens the account.
       * That is `activatedAt`, which only the owner writes, so the link proves
       * what the person can prove and nothing more.
       */
      sendOnSignUp: true,
      sendVerificationEmail: ({ url, user: recipient }, request) =>
        sendVerificationMail(mailer, {
          acceptLanguage: request?.headers.get('accept-language') ?? null,
          appUrl: env.APP_URL,
          nodeEnv: env.NODE_ENV,
          to: recipient.email,
          url,
          userId: recipient.id
        })
    },
    /*
     * Before: a new password — sign-up, reset, change — holding a word the
     * account gives away, or one HIBP knows, is refused (`services/PasswordPolicy.ts`);
     * HIBP fails open, and the context check stays on under test. And a change
     * of password always closes every other session, whatever the body says.
     *
     * After, on a 2xx (`services/AccountSecurity.ts`, PLAN 011 phase 2): a
     * change clears the breach mark, leaves its audit row and sends the mail;
     * closing sessions leaves its row; a sign-in checks the password it just
     * proved against HIBP in the background and marks the account on a hit.
     */
    hooks: { after: accountSecurityAfter(security), before: accountSecurityBefore(isCompromised) },
    plugins: [
      /*
       * The second factor (PLAN 011 phase 3): an authenticator app (TOTP) and
       * ten backup codes, for an account with a password — `hooks.before`
       * answers the 404 to anybody else, and to email OTP, which is not
       * offered (no `otpOptions.sendOTP`). `/enable` stores an unverified
       * secret; the first correct `/verify-totp` turns it on. A password
       * sign-in then answers `{ twoFactorRedirect: true }` with no session,
       * and `/verify-totp` or `/verify-backup-code` finishes it. A change or
       * a reset of the password leaves the factor as it was.
       */
      twoFactor({ backupCodeOptions: { amount: BACKUP_CODE_COUNT }, issuer: TWO_FACTOR_ISSUER, trustDeviceMaxAge: TRUST_DEVICE_MAX_AGE }),
      // After `twoFactor`, so it sees what the plugin left of the sign-in's session.
      sessionStartedOnSignIn()
    ],
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
      customRules:
        env.NODE_ENV === 'test' ? { '/sign-in/*': TEST_AUTH_RULE, '/sign-up/*': TEST_AUTH_RULE, '/two-factor/*': TEST_AUTH_RULE } : undefined,
      enabled: true,
      storage: 'database'
    },
    secret: env.BETTER_AUTH_SECRET,
    session: { expiresIn: SESSION_MAX_AGE_DAYS * 24 * MINUTES * MINUTES, updateAge: SESSION_REFRESH_AGE_DAYS * 24 * MINUTES * MINUTES },
    socialProviders: socialProviderOptions(env),
    // Apple posts the person back from its own origin; without it here the
    // callback is refused as a cross-site request, which is what it is.
    trustedOrigins: [
      ...(env.ALLOWED_ORIGINS ?? env.APP_URL).split(',').map(origin => origin.trim()),
      ...(providers.includes('apple') ? [APPLE_ORIGIN] : [])
    ],
    user: {
      additionalFields: {
        /*
         * Declared so it rides the session (`0030`): the guard asks "is this
         * account open" on every request, and a column Better Auth does not
         * know about is a column that is not there when it looks. `input: false`
         * — a client cannot send it, which is the whole point of a door.
         */
        activatedAt: { input: false, required: false, type: 'date' },
        /*
         * Rides the session for the same reason (PLAN 011 phase 2):
         * `PasswordChangeGuard` asks on every request whether a sign-in found
         * the password breached. Written only by the sign-in hook and cleared
         * by a change or a reset; `input: false`, so no body can clear it.
         */
        passwordCompromisedAt: { input: false, required: false, type: 'date' },
        role: { defaultValue: 'user', input: false, required: false, type: 'string' },
        // The terms' record (`0071`): written by `databaseHooks.user.create.before`, never by a client.
        termsAcceptedAt: { input: false, required: false, type: 'date' },
        termsVersion: { input: false, required: false, type: 'string' }
      },
      deleteUser: {
        /*
         * Stripe first (`0056`): every subscription the account still has is
         * cancelled before anything of it is deleted. If Stripe cannot be
         * reached this throws and the account stays — a deletion to retry is
         * better than a card charged for an account that is gone. A failure
         * halfway leaves some subscriptions cancelled and the account still
         * there: Stripe's `deleted` events for those reach the webhook while
         * the account exists, and it writes them as it would any other, so the
         * tier follows what is still charged. Trying the deletion again cancels
         * the rest.
         *
         * The cascade from `user.id` takes everything that references the
         * account. An invitation addressed to it does not — it holds an
         * address a professional typed, never an account id, because whether
         * that address has an account is what an invitation must not say — so
         * it is deleted here, by the account's own address (PRD 004,
         * criterion 14). Before the delete: if this fails the account stays,
         * rather than going and leaving its address behind. Not one transaction
         * with the delete: an invitation written in the milliseconds between
         * the two survives, and expires or is purged like any other.
         */
        beforeDelete: async (deleted: { id: string; email: string }) => {
          await billing.cancelEverything(deleted.id);
          await CareController.forgetAddress(deleted.email);
        },
        enabled: true
      }
    },
    /*
     * No pruning inside a request (PLAN 011). Better Auth deletes expired rows
     * on every verification lookup, and on a reset only the unknown-address
     * branch looks one up — a round trip more, which timed the difference
     * between an address with an account and one without. Every reader checks
     * `expiresAt` itself, so this changes no answer; the daily
     * `/cron/sweep-verifications` owns the pruning now.
     */
    verification: { disableCleanup: true }
  });
}

/** Derived from the factory: `betterAuth` returns a type parameterised by the
 *  exact options passed, so `ReturnType<typeof betterAuth>` is a different,
 *  incompatible type. */
export type Auth = ReturnType<typeof createAuth>;

export const AUTH = Symbol('BETTER_AUTH');
