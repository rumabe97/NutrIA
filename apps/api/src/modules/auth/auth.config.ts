import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { isPasswordCompromised } from 'better-auth/plugins/haveibeenpwned';
import { twoFactor } from 'better-auth/plugins/two-factor';

import { AnalyticsController } from 'core/controllers/Analytics';
import { CareController } from 'core/controllers/Care';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from 'core/entities/Password';
import { TERMS_VERSION } from 'core/entities/User';
import { MAIL_BUDGET } from 'core/domain/MailBudget';
import { DEFAULT_WEB_LOCALE, webUrl } from 'core/domain/WebUrl';

import { database } from 'database';
import { account, passkey as passkeyTable, rateLimit, session, twoFactor as twoFactorTable, user, verification } from 'database/schema/auth';

import { APPLE_ORIGIN, configuredSocialProviders, socialProviderOptions } from './services/SocialProviders.js';
import { onAccountCreated, onAddressConfirmed } from './services/SelfService.js';
import { accountSecurityAfter, accountSecurityBefore, onPasswordReset } from './services/AccountSecurity.js';
import { authLogger } from './services/AuthLogger.js';
import { sendExistingAccountMail } from './services/ExistingAccountMail.js';
import { mailBudget } from './services/MailBudget.js';
import { PASSKEY_USER_VERIFICATION, passkeyOptions, passkeyPasswordConfirmation } from './services/Passkey.js';
import { sendPasskeyAddedMail } from './services/PasskeyMail.js';
import { sendPasswordChangedMail } from './services/PasswordChangedMail.js';
import { sendPasswordResetMail } from './services/PasswordResetMail.js';
import { signInBrake } from './services/SignInBrake.js';
import { resetConfirmsAddress } from './services/ResetConfirmsAddress.js';
import { signUpFloor } from './services/SignUpFloor.js';
import {
  BACKUP_CODE_COUNT,
  refusesLinkPastTheFactor,
  sessionStartedOnSignIn,
  startsAVisit,
  TRUST_DEVICE_MAX_AGE,
  TWO_FACTOR_ISSUER
} from './services/TwoFactor.js';
import { sendTwoFactorMail } from './services/TwoFactorMail.js';
import { sendTwoFactorRemovalMail } from './services/TwoFactorRemovalMail.js';
import { sendVerificationMail } from './services/VerificationMail.js';

import type { BackgroundTaskService } from '../../shared/services/index.js';
import type { BillingService } from '../billing/services/Billing.service.js';
import type { Env } from '../../config/index.js';
import type { EmailService } from '../email/services/Email.service.js';
import type { PasswordChangedNotice } from './services/AccountSecurity.js';
import type { PasskeyNotice } from './services/Passkey.js';
import type { TwoFactorNotice, TwoFactorRemovalNotice } from './services/TwoFactor.js';

const MINUTES = 60;

/**
 * Better Auth guards sign-up and sign-in harder than everything else — three in
 * ten seconds, per address, whatever the global ceiling says — which is right,
 * because those are the requests that guess passwords.
 *
 * The end-to-end suites open dozens of accounts in a couple of minutes from one
 * address, which is precisely that shape of traffic. Only the paths they
 * hammer — and `/two-factor/*`, three in ten seconds by the plugin's rule, `/passkey/*`, and
 * `/request-password-reset`, three a minute, which the reset suites and the
 * squatter's reset in `access` share — are raised, only under `NODE_ENV=test`, and raised rather than switched
 * off: the limiter stays on its real path, so a broken `rate_limit` table still
 * fails the suites, and every other route keeps the production rule.
 */
const TEST_AUTH_RULE = { max: 100_000, window: 60 };
/**
 * The passkey sign-in's two public routes (PLAN 011 phase 5), held to what a
 * password sign-in is held to rather than the global hundred in ten seconds:
 * each options call writes a challenge row anybody can ask for, and the
 * verify is the guess. The password confirmation before adding one is a
 * password guess too. The options are asked again on every visit to
 * `/acceder` (the autofill), hence the wider window there.
 */
const PASSKEY_SIGN_IN_RULES = {
  '/passkey/confirm-password': { max: 3, window: 10 },
  '/passkey/generate-authenticate-options': { max: 20, window: 60 },
  '/passkey/verify-authentication': { max: 3, window: 10 }
};
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
  // On under `NODE_ENV=test` as well: the suites sign in with addresses of their own.
  const brake = signInBrake(env.BETTER_AUTH_SECRET);
  // Three mails of a kind per address per hour from the doors anybody can knock at (PLAN 011 phase 8).
  const budget = mailBudget(env.BETTER_AUTH_SECRET);
  // A sign-up answers no earlier than its floor, a new address and an existing one alike (PLAN 011 phase 8).
  const floor = signUpFloor();
  const security = {
    background,
    brake,
    floor,
    isCompromised,
    mailPasskeyAdded: async ({ id, acceptLanguage, email, userAgent }: PasskeyNotice) =>
      sendPasskeyAddedMail(mailer, { acceptLanguage, appUrl: env.APP_URL, to: email, userAgent, userId: id }),
    mailPasswordChanged: async ({ id, acceptLanguage, email, passkeysRemoved, userAgent }: PasswordChangedNotice) =>
      sendPasswordChangedMail(mailer, { acceptLanguage, appUrl: env.APP_URL, passkeysRemoved, to: email, userAgent, userId: id }),
    mailTwoFactor: async ({ id, acceptLanguage, email, event, userAgent }: TwoFactorNotice) =>
      sendTwoFactorMail(mailer, { acceptLanguage, appUrl: env.APP_URL, event, to: email, userAgent, userId: id }),
    mailTwoFactorRemoval: async ({ id, email, event }: TwoFactorRemovalNotice) =>
      sendTwoFactorRemovalMail(mailer, { appUrl: env.APP_URL, event, to: email, userId: id }),
    resetConfirmation: resetConfirmsAddress({
      addressConfirmed: async account => {
        await onAddressConfirmed(account, { ...selfService, background });
      }
    })
  };

  /*
   * Which `/condiciones` an account is created under (`0071`, phase 7), written
   * by `databaseHooks.user.create.before` into the real row and repeated in the
   * synthetic one an existing address is answered with, so the two sign-up
   * answers carry the same fields.
   */
  const termsRecord = () => ({ termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION });

  return betterAuth({
    account: {
      /*
       * Never implicit (`0058`, amended 2026-10-08). A provider that arrives
       * with the address of an account it is not linked to is refused with
       * `account_not_linked`, and the sign-in page sends the person to the
       * password or a reset. Accounts linked before stay linked: a provider's
       * own account row is found first, so they keep signing in.
       *
       * "Same address, same person" assumed that whoever confirmed the address
       * also chose the password. They need not have. A stranger signs the
       * victim's address up with a password of their own; the victim opens the
       * confirmation link, which marks the address confirmed on the stranger's
       * account; then the victim presses "Continuar con Google", Better Auth
       * joins Google to that account and opens a session, the victim enters
       * health data, and the stranger reads it with the password. Neither
       * `requireLocalEmailVerified` nor the provider vouching for the address
       * tells the two people apart, so no condition on linking can — only not
       * linking. `enabled` stays on while a provider is, for the explicit,
       * signed-in `linkSocial`, which nothing in the web app offers yet.
       *
       * No provider is listed as trusted either, which would waive the
       * provider's own verified-address check. Pinned by
       * `EmailVerification.spec.ts` and `social-sign-in.e2e-spec.ts`.
       */
      accountLinking: { disableImplicitLinking: true, enabled: providers.length > 0 },
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
    database: drizzleAdapter(database(), {
      provider: 'pg',
      schema: { account, passkey: passkeyTable, rateLimit, session, twoFactor: twoFactorTable, user, verification }
    }),
    databaseHooks: {
      account: {
        create: {
          /*
           * No provider is linked past the second factor (PLAN 011 phase 3):
           * the implicit link at the provider's callback would otherwise open
           * a full session for an account with the factor on, with no code
           * (`services/TwoFactor.ts`, `refusesLinkPastTheFactor`). `false`
           * makes Better Auth answer "unable to link account". Since
           * `disableImplicitLinking` (above) that link never starts; this
           * stays as the second lock behind it.
           */
          before: async (linked: { providerId?: unknown; userId?: unknown }, context: Parameters<typeof refusesLinkPastTheFactor>[1]) =>
            (await refusesLinkPastTheFactor(linked, context)) ? false : undefined
        }
      },
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
          before: async (created: Record<string, unknown>) => ({ data: { ...created, ...termsRecord() } })
        }
      }
    },
    emailAndPassword: {
      /*
       * Sign-up reveals nothing (PLAN 011 phase 8, `0074`): it never opens a
       * session, so Better Auth answers an address that already has an
       * account with the same 200 and a synthetic user, instead of 422. A new
       * person signs in by opening the confirmation link
       * (`autoSignInAfterVerification`); the owner of an existing address is
       * mailed instead (`onExistingUserSignUp`).
       */
      autoSignIn: false,
      /*
       * The synthetic user an existing address is answered with, shaped as the
       * real one is: the terms' record the create hook writes, the rest as
       * Better Auth builds it. The id is fresh and names no account.
       */
      customSyntheticUser: ({ id, additionalFields, coreFields }) => ({ ...coreFields, ...additionalFields, ...termsRecord(), id }),
      enabled: true,
      // The rule's one home is `core` (PLAN 011 phase 1); the web forms read the same two numbers.
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      /*
       * "Somebody tried to create an account with your address" (PLAN 011
       * phase 8), to that address only, within its hourly budget
       * (`services/MailBudget.ts`): anybody can sign up any address, as often
       * as Better Auth's per-IP limit lets them. Better Auth hands it to
       * `runInBackgroundOrAwait`, so it goes after the response, as the new
       * address's verification mail does.
       */
      onExistingUserSignUp: async ({ user: existing }, request) =>
        budget.within('existing-account', existing, async () =>
          sendExistingAccountMail(mailer, {
            acceptLanguage: request?.headers.get('accept-language') ?? null,
            appUrl: env.APP_URL,
            to: existing.email,
            userId: existing.id
          })
        ),
      // The mark cleared, the audit row, the "password changed" mail (PLAN 011 phase 2; `services/AccountSecurity.ts`).
      onPasswordReset: onPasswordReset(security),
      /*
       * Sign-up no longer signs anybody in (`autoSignIn: false` above, `0074`):
       * a session at sign-up for a new address, and none for an existing one,
       * was the difference that told a stranger which addresses have an
       * account. So the form ends on "check your email" for every address, and
       * a new person is signed in by the confirmation link.
       *
       * And no password sign-in before the address is confirmed (PLAN 011
       * phase 8, amended). Otherwise sign-up then sign-in is the same oracle:
       * a stranger signs up somebody's address with a password of their own
       * and signs in with it — let in where the address was new, refused where
       * it already had an account. Better Auth refuses the unconfirmed one 403
       * `EMAIL_NOT_VERIFIED`; `hooks.after` makes that the 401 a wrong password
       * gets (`services/UnconfirmedSignIn.ts`), the brake counts it as one, and
       * the address is sent a fresh link (`emailVerification.sendOnSignIn`).
       * Google and passkeys never pass here: Google's own address is verified,
       * and a passkey needs a confirmed address to be added.
       */
      requireEmailVerification: true,
      // A reset link lives the mail budget's hour too, written out rather than left to the default (PLAN 011 phase 8).
      resetPasswordTokenExpiresIn: MAIL_BUDGET.windowMs / 1000,
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
      // the copy; the web app sends the tag it is rendering in. Anybody can
      // ask for one for any address, so within its hourly budget too
      // (`services/MailBudget.ts`, PLAN 011 phase 8); Better Auth sends it
      // after the response (`runInBackgroundOrAwait`), so the budget's lookup
      // is never in the answer's time.
      sendResetPassword: ({ url, user: recipient }, request) =>
        budget.within('reset', recipient, async () =>
          sendPasswordResetMail(mailer, {
            acceptLanguage: request?.headers.get('accept-language') ?? null,
            appUrl: env.APP_URL,
            nodeEnv: env.NODE_ENV,
            to: recipient.email,
            url,
            userId: recipient.id
          })
        )
    },
    emailVerification: {
      /*
       * The door decides what confirming an address does (`0031`, amended):
       * self-service while registration is open, an admin's act while it is
       * closed. The hook runs after `emailVerified` is written, and
       * `SessionGuard` re-reads the row on every request, so a session the
       * person already has is in on its next navigation.
       */
      afterEmailVerification: async (verified: { id: string; email: string }) => {
        await onAddressConfirmed(verified, selfService);
      },
      /*
       * Never on (hotfix, 011 phase 8 invariant review). The link proves the
       * mailbox and nothing more: a stranger can sign an address up with a
       * password of their own, and with this on, the owner of the mailbox who
       * opened the link was signed into the stranger's account, entered their
       * health data there, and the stranger — who holds the password — read
       * it. The link lands on the web's "confirmed, now sign in" page
       * (`VerificationMail.ts`); the real owner, not knowing that password,
       * resets it, and `revokeSessionsOnPasswordReset` ends the stranger's
       * sessions. Pinned by `EmailVerification.spec.ts`.
       */
      autoSignInAfterVerification: false,
      /*
       * A link lives an hour, written here rather than left to Better Auth's
       * default (PLAN 011 phase 8): the mail budget's window is the same hour
       * (`MAIL_BUDGET.windowMs`), so a held link is never the only one that
       * could still work — the three sent in the window are.
       */
      expiresIn: MAIL_BUDGET.windowMs / 1000,
      /*
       * A fresh link to an unconfirmed account that signs in with its right
       * password (PLAN 011 phase 8, amended): the person who lost the first
       * mail gets another, though the answer is a wrong password's. Better
       * Auth sends it only when the address is unconfirmed, so a confirmed
       * account never gets one, and through `runInBackgroundOrAwait`, after
       * the response.
       */
      sendOnSignIn: true,
      /*
       * Sent, since `0030`: confirming an address no longer opens the account.
       * That is `activatedAt`, which only the owner writes, so the link proves
       * what the person can prove and nothing more.
       */
      sendOnSignUp: true,
      /*
       * Every link — at sign-up, at a sign-in, asked again — within the
       * address's hourly budget (`services/MailBudget.ts`): a stranger who
       * signed up somebody's address knows its password, and could otherwise
       * mail that address on every sign-in the brake lets through.
       *
       * Handed to `BackgroundTaskService` here, and this returns at once
       * (PLAN 011 phase 8, invariant review P1): sign-up and sign-in already
       * run it after the response, but the anonymous `/send-verification-email`
       * awaits it, and its 500 ms is a floor, not a ceiling — the budget's
       * lookup and SMTP would make an unconfirmed address slower than an
       * unknown or a confirmed one.
       */
      sendVerificationEmail: async ({ url, user: recipient }, request) => {
        background.run('verification-mail', async () =>
          budget.within('verification', recipient, async () =>
            sendVerificationMail(mailer, {
              acceptLanguage: request?.headers.get('accept-language') ?? null,
              appUrl: env.APP_URL,
              nodeEnv: env.NODE_ENV,
              to: recipient.email,
              url,
              userId: recipient.id
            })
          )
        );

        return Promise.resolve();
      }
    },
    /*
     * Before: a password sign-in is counted against its address, and answered
     * 429 while the address waits (`services/SignInBrake.ts`, PLAN 011 phase 7).
     * A new password — sign-up, reset, change — holding a word the
     * account gives away, or one HIBP knows, is refused (`services/PasswordPolicy.ts`);
     * HIBP fails open, and the context check stays on under test. And a change
     * of password always closes every other session, whatever the body says.
     *
     * After, on a 2xx (`services/AccountSecurity.ts`, PLAN 011 phase 2): a
     * change clears the breach mark, removes the passkeys, leaves its audit
     * rows and sends the mail;
     * closing sessions leaves its row; a sign-in clears its address's brake,
     * checks the password it just proved against HIBP in the background and
     * marks the account on a hit.
     */
    hooks: { after: accountSecurityAfter(security), before: accountSecurityBefore(isCompromised, brake, floor) },
    // Better Auth's own lines through Nest's logger, never with a WebAuthn challenge in them (`services/AuthLogger.ts`).
    logger: authLogger(),
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
      sessionStartedOnSignIn(),
      /*
       * Passkeys (PLAN 011 phase 5, `0083`): Face ID or iCloud Keychain, bound
       * to the web's own host (`passkeyOptions`, from `APP_URL`). Added only by
       * an account with a confirmed address, after the password is confirmed
       * at `/passkey/confirm-password` (the plugin below; the grant is spent by
       * the one verify it lets in), or from a session ten minutes young for an
       * account with no password (`hooks.before`); listed and removed by their
       * own account — another account's id is the guard's 404 (`hooks.before`,
       * `services/Passkey.ts`). Every registration and every sign-in must
       * verify the person — Face ID, a fingerprint, the device's code — asked
       * for in the options and refused when the authenticator's answer lacks it
       * (`PASSKEY_USER_VERIFICATION`). That is why a sign-in with one opens a
       * session at once, even for an account with TOTP on: the device held and
       * the person who unlocked it are the two factors, and the two-factor
       * plugin only guards the password door. A key on possession alone never
       * signs in. A sign-in with one cancels a pending removal of the second
       * factor. Adding one writes `auth.passkey_added` and mails the account;
       * removing one writes `auth.passkey_removed`. A change or a reset of the
       * password removes every passkey of the account
       * (`UserController.passwordChanged`).
       */
      passkey({ ...passkeyOptions(env.APP_URL), ...PASSKEY_USER_VERIFICATION }),
      passkeyPasswordConfirmation()
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
        env.NODE_ENV === 'test'
          ? {
              '/passkey/*': TEST_AUTH_RULE,
              '/request-password-reset': TEST_AUTH_RULE,
              '/sign-in/*': TEST_AUTH_RULE,
              '/sign-up/*': TEST_AUTH_RULE,
              '/two-factor/*': TEST_AUTH_RULE
            }
          : PASSKEY_SIGN_IN_RULES,
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
