import { PASSKEY_ERROR_CODES } from '@better-auth/passkey';
import { Logger } from '@nestjs/common';
import { BASE_ERROR_CODES } from 'better-auth';
import { APIError, createAuthEndpoint, getSessionFromCtx, sessionMiddleware } from 'better-auth/api';
import { z } from 'zod';

import { UserController } from 'core/controllers/User';
import { PASSWORD_MAX_LENGTH } from 'core/entities/Password';

import { record, text } from './PasswordPolicy.js';
import { answeredUser, cancelPendingRemoval, notFound } from './TwoFactor.js';

import type { BackgroundTaskService } from '../../../shared/services/index.js';
import type { Context } from './PasswordPolicy.js';
import type { TwoFactorDeps } from './TwoFactor.js';
import type { PasskeyOptions } from '@better-auth/passkey';
import type { BetterAuthPlugin } from 'better-auth';

/** Whom a new passkey is about, and what the mail needs from the request that added it. */
export type PasskeyNotice = {
  readonly id: string;
  readonly acceptLanguage: string | null;
  readonly email: string;
  readonly userAgent: string | null;
};

export type PasskeyDeps = Pick<TwoFactorDeps, 'mailTwoFactorRemoval'> & {
  readonly background: Pick<BackgroundTaskService, 'run'>;
  /** Sends "you added a passkey"; run in the background, never awaited by a route. */
  readonly mailPasskeyAdded: (notice: PasskeyNotice) => Promise<void>;
};

/** What the person's device shows beside the key it keeps. */
export const PASSKEY_RP_NAME = 'NutrIA';

const CONFIRM_PASSWORD = '/passkey/confirm-password';
const GENERATE_AUTHENTICATE_OPTIONS = '/passkey/generate-authenticate-options';
const GENERATE_REGISTER_OPTIONS = '/passkey/generate-register-options';
const VERIFY_AUTHENTICATION = '/passkey/verify-authentication';
const VERIFY_REGISTRATION = '/passkey/verify-registration';
const DELETE = '/passkey/delete-passkey';
const UPDATE = '/passkey/update-passkey';

/** The plugin's routes that name one passkey by `id` in the body. */
const BY_ID: ReadonlySet<string> = new Set([DELETE, UPDATE]);

/** The two steps of adding a passkey: both ask the same question (`mayAddPasskey`). */
const ADDING: ReadonlySet<string> = new Set([GENERATE_REGISTER_OPTIONS, VERIFY_REGISTRATION]);

/** How long a confirmed password lets its session add one passkey: the options' five minutes, and the person's time to look at their phone. */
export const PASSKEY_GRANT_MS = 10 * 60 * 1000;

/** How young the session of an account with no password must be to add a passkey: the sign-in through its provider is the proof. */
export const PASSWORDLESS_FRESH_MS = 10 * 60 * 1000;

/** The refusal when the account has not confirmed its address: a passkey is a door into the account, and only a proven address may add one. */
export const EMAIL_CONFIRMATION_REQUIRED = { code: 'EMAIL_CONFIRMATION_REQUIRED', message: 'Confirm your email address to add a passkey' } as const;

/** The refusal when a password account has not confirmed it (or the confirmation lapsed or was spent): the web asks for it, then tries again. */
export const PASSWORD_CONFIRMATION_REQUIRED = { code: 'PASSWORD_CONFIRMATION_REQUIRED', message: 'Confirm your password to add a passkey' } as const;

/**
 * The `verification` row a confirmed password leaves (PLAN 011 phase 5): one
 * per session, valued with the account id, spent by the passkey it lets in.
 * Never the password, never anything derived from it.
 */
export function passkeyGrantOf(sessionId: string): string {
  return `passkey-grant-${sessionId}`;
}

const logger = new Logger('Passkey');

/**
 * The relying party, from the web's own address (PLAN 011 phase 5): the
 * browser makes and uses a passkey for the page's origin, which is `APP_URL`
 * — in production the API is reached through the web's rewrite, so
 * `BETTER_AUTH_URL` is that origin too, and locally it is not. No variable of
 * its own: a local run and production each get theirs, and a new domain is a
 * new `APP_URL` that voids every passkey made before it (`0074`).
 */
export function passkeyOptions(appUrl: string): { origin: string; rpID: string; rpName: string } {
  const web = new URL(appUrl);

  return { origin: web.origin, rpID: web.hostname, rpName: PASSKEY_RP_NAME };
}

/** What WebAuthn calls verifying the person, asked of every registration and every sign-in (`PASSKEY_USER_VERIFICATION`). */
const USER_VERIFICATION = 'required';

/**
 * The person, not only their device (PLAN 011 phase 5, the lead's decision
 * on legal's art. 32 finding): a passkey is the thing held *and* the face,
 * fingerprint or device code that unlocks it, so a sign-in with one opens a
 * session with no second step. A key used on possession alone — a security
 * key tapped, an authenticator that skipped the check — would be one factor
 * walking past the second.
 *
 * - The options ask for it: `userVerification: 'required'` at registration
 *   (`authenticatorSelection`) and at sign-in (`passkeyAfter` rewrites the
 *   plugin's fixed `'preferred'`), so the browser refuses a device that
 *   cannot verify the person before anything reaches us.
 * - The answer must carry it: the plugin verifies with
 *   `requireUserVerification: false`, so its `afterVerification` hooks refuse
 *   any registration or sign-in whose authenticator data lacks the UV flag —
 *   the plugin's own 400 `FAILED_TO_VERIFY_REGISTRATION` (no key stored) and
 *   401 `AUTHENTICATION_FAILED` (no session, the counter untouched). A
 *   browser that ignores the options is caught here; the options alone are a
 *   request, never the rule.
 */
export const PASSKEY_USER_VERIFICATION: Pick<PasskeyOptions, 'authentication' | 'authenticatorSelection' | 'registration'> = {
  authentication: {
    afterVerification: ({ verification }) => {
      if (!verification.authenticationInfo.userVerified) {
        throw APIError.from('UNAUTHORIZED', PASSKEY_ERROR_CODES.AUTHENTICATION_FAILED);
      }
    }
  },
  authenticatorSelection: { residentKey: 'preferred', userVerification: USER_VERIFICATION },
  registration: {
    afterVerification: ({ verification }) => {
      if (!verification.registrationInfo?.userVerified) {
        throw APIError.from('BAD_REQUEST', PASSKEY_ERROR_CODES.FAILED_TO_VERIFY_REGISTRATION);
      }
    }
  }
};

/**
 * `POST /passkey/confirm-password { password }` (PLAN 011 phase 5, the lead's
 * decision (b)): a password account proves the password before it may add a
 * passkey, as it does before `/two-factor/enable`, so a session somebody else
 * holds cannot turn itself into a key that outlives it. A right password
 * leaves a grant for this session (`passkeyGrantOf`, `PASSKEY_GRANT_MS`) and
 * answers `{ status: true }`; a wrong one is Better Auth's 400
 * `INVALID_PASSWORD`. An account with no password has nothing to confirm:
 * the guard's 404, as `/two-factor/enable` answers it. No session is the
 * route's own 401. Rate-limited like a sign-in (`auth.config.ts`).
 */
export function passkeyPasswordConfirmation(): BetterAuthPlugin {
  return {
    id: 'passkey-password-confirmation',
    endpoints: {
      confirmPasskeyPassword: createAuthEndpoint(
        CONFIRM_PASSWORD,
        { body: z.object({ password: z.string().min(1).max(PASSWORD_MAX_LENGTH) }), method: 'POST', use: [sessionMiddleware] },
        async context => {
          const caller = context.context.session;
          const credential = await context.context.internalAdapter.findCredentialAccount(caller.user.id);

          if (!credential?.password) {
            throw notFound();
          }

          if (!(await context.context.password.verify({ hash: credential.password, password: context.body.password }))) {
            throw APIError.from('BAD_REQUEST', BASE_ERROR_CODES.INVALID_PASSWORD);
          }

          const identifier = passkeyGrantOf(caller.session.id);

          await context.context.internalAdapter.deleteVerificationByIdentifier(identifier);
          await context.context.internalAdapter.createVerificationValue({
            expiresAt: new Date(Date.now() + PASSKEY_GRANT_MS),
            identifier,
            value: caller.user.id
          });

          return context.json({ status: true });
        }
      )
    }
  };
}

/**
 * Whether the caller may take a step of adding a passkey (the lead's
 * decision (b), and the 2026-10-03 review):
 *
 * - an address not yet confirmed is refused, 403
 *   `EMAIL_CONFIRMATION_REQUIRED`: whoever typed somebody else's address at
 *   sign-up must not leave a key behind for when its owner arrives;
 * - an account with a password needs a live grant from
 *   `/passkey/confirm-password` for this very session. The options only look
 *   at it; the verify (`spend`) spends it in one statement
 *   (`UserController.spendGrant`, `DELETE … RETURNING`), so two parallel
 *   verifies on one confirmation cannot both pass. A verify the plugin then
 *   refuses has spent it all the same: the person confirms again;
 * - one with no password (Google or Apple only) needs a session no older
 *   than `PASSWORDLESS_FRESH_MS`, refused with Better Auth's own 403
 *   `SESSION_NOT_FRESH` so the web asks for a fresh sign-in as it already
 *   does.
 *
 * No session is left to the route's own 401.
 */
async function mayAddPasskey(context: Context, spend: boolean): Promise<void> {
  const caller = await getSessionFromCtx(context);

  if (!caller) {
    return;
  }

  if (!caller.user.emailVerified) {
    throw APIError.from('FORBIDDEN', EMAIL_CONFIRMATION_REQUIRED);
  }

  const credential = await context.context.internalAdapter.findCredentialAccount(caller.user.id);

  if (credential?.password) {
    const identifier = passkeyGrantOf(caller.session.id);
    const live = spend ? await UserController.spendGrant(identifier, caller.user.id) : await liveGrant(context, identifier, caller.user.id);

    if (!live) {
      throw APIError.from('FORBIDDEN', PASSWORD_CONFIRMATION_REQUIRED);
    }

    return;
  }

  if (Date.now() - new Date(caller.session.createdAt).getTime() > PASSWORDLESS_FRESH_MS) {
    throw APIError.from('FORBIDDEN', BASE_ERROR_CODES.SESSION_NOT_FRESH);
  }
}

/** Whether the grant `identifier` is the account's and has not expired, without spending it. */
async function liveGrant(context: Context, identifier: string, userId: string): Promise<boolean> {
  const grant = await context.context.internalAdapter.findVerificationValue(identifier);

  return grant?.value === userId && new Date(grant.expiresAt).getTime() > Date.now();
}

/**
 * Before the plugin (PLAN 011 phase 5):
 *
 * - `/passkey/delete-passkey` and `/passkey/update-passkey` for a passkey that
 *   is not one of the caller's — another account's, or none at all — are the
 *   guard's 404, byte for byte. The plugin would answer 401
 *   `YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY` for another account's and
 *   404 `PASSKEY_NOT_FOUND` for a made-up id: two answers that tell which ids
 *   exist. No session, or no id, is left to the route's own 401 or 400.
 * - `/passkey/generate-register-options` and `/passkey/verify-registration`:
 *   a confirmed address, and the password confirmed — the grant spent by the
 *   verify — or a young session for an account with none (`mayAddPasskey`).
 * - `/passkey/verify-registration`: `createSession` is forced to `false`. A
 *   passkey is added from a session the person already has; minting a second
 *   one there would be a sign-in nobody made.
 */
export async function passkeyBefore(context: Context): Promise<{ context: { body: Record<string, unknown> } } | undefined> {
  const path = context.path ?? '';

  if (ADDING.has(path)) {
    await mayAddPasskey(context, path === VERIFY_REGISTRATION);
  }

  if (path === VERIFY_REGISTRATION) {
    return { context: { body: { ...record(context.body), createSession: false } } };
  }

  if (!BY_ID.has(path)) {
    return undefined;
  }

  const id = text(record(context.body).id);
  const caller = await getSessionFromCtx(context);

  if (!id || !caller) {
    return undefined;
  }

  const owned = await context.context.adapter.findOne<{ userId: string }>({
    model: 'passkey',
    where: [
      { field: 'id', value: id },
      { field: 'userId', value: caller.user.id }
    ]
  });

  if (!owned) {
    throw notFound();
  }

  return undefined;
}

/**
 * After the plugin, on a 2xx only (called from `accountSecurityAfter`):
 *
 * - `/passkey/generate-authenticate-options`: the options ask for the person
 *   to be verified (`PASSKEY_USER_VERIFICATION`); the plugin offers no
 *   setting for it at sign-in, so its answer is returned with
 *   `userVerification: 'required'` in place of its `'preferred'`.
 * - `/passkey/verify-authentication`: a sign-in with a passkey cancels the
 *   owner's pending removal of the account's second factor, as a correct
 *   code does (`cancelPendingRemoval`, `0083`): whoever unlocked one of its
 *   keys has not lost the account.
 * - `/passkey/verify-registration`: `auth.passkey_added`, awaited — the
 *   trail must not lag the answer — then the mail in the background. The
 *   grant was spent before the plugin ran (`mayAddPasskey`). The passkey is
 *   the session's own account's: the plugin refuses a challenge made for
 *   anybody else.
 * - `/passkey/delete-passkey`: `auth.passkey_removed`, no mail — the person
 *   took a key away, and the one who could abuse that already had a session.
 *
 * A failed row is a line, not a 500: the passkey did change. Neither the row
 * nor the line carries the passkey's id, name, key or anything of the device.
 */
export async function passkeyAfter(deps: PasskeyDeps, context: Context): Promise<unknown> {
  const path = context.path ?? '';

  if (path === GENERATE_AUTHENTICATE_OPTIONS) {
    return context.json({ ...record(context.context.returned), userVerification: USER_VERIFICATION });
  }

  if (path === VERIFY_AUTHENTICATION) {
    await cancelPendingRemoval(deps, answeredUser(context.context.returned));

    return undefined;
  }

  const user = context.context.session?.user;

  if (!user || (path !== VERIFY_REGISTRATION && path !== DELETE)) {
    return undefined;
  }

  const added = path === VERIFY_REGISTRATION;

  try {
    await UserController.passkeyChanged(user.id, added);
  } catch {
    logger.error(`passkey_unrecorded ${JSON.stringify({ event: added ? 'added' : 'removed', userId: user.id })}`);
  }

  if (!added) {
    return undefined;
  }

  const notice: PasskeyNotice = {
    id: user.id,
    acceptLanguage: context.headers?.get('accept-language') ?? null,
    email: user.email,
    userAgent: context.headers?.get('user-agent') ?? null
  };

  deps.background.run('passkey-mail', () => deps.mailPasskeyAdded(notice));

  return undefined;
}
