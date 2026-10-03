import { Logger } from '@nestjs/common';
import { createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api';

import { UserController } from 'core/controllers/User';

import { breachedOrPass, checkNewPassword, record, text } from './PasswordPolicy.js';
import { passkeyAfter, passkeyBefore } from './Passkey.js';
import { twoFactorAfter, twoFactorBefore } from './TwoFactor.js';
import { unconfirmedAsInvalid } from './UnconfirmedSignIn.js';

import type { BackgroundTaskService } from '../../../shared/services/index.js';
import type { CompromisedCheck, Context } from './PasswordPolicy.js';
import type { PasskeyDeps } from './Passkey.js';
import type { SignInBrake } from './SignInBrake.js';
import type { SignUpFloor } from './SignUpFloor.js';
import type { TwoFactorDeps } from './TwoFactor.js';
import type { PasswordChangedVia, SessionsRevokedScope } from 'core/entities/Audit';

/** Whom a password change is about, and what the mail needs from the request that made it. */
export type PasswordChangedNotice = {
  readonly id: string;
  readonly acceptLanguage: string | null;
  readonly email: string;
  /** How many passkeys the change or the reset removed: every one the account had (PLAN 011 phase 5, `0083`). */
  readonly passkeysRemoved: number;
  readonly userAgent: string | null;
};

export type AccountSecurityDeps = PasskeyDeps &
  TwoFactorDeps & {
    /** What confirming an address runs (`SelfService.onAddressConfirmed`), for an address a reset just confirmed (PLAN 011 phase 8). */
    readonly addressConfirmed: (account: { id: string; email: string }) => Promise<void>;
    readonly background: Pick<BackgroundTaskService, 'run'>;
    /** The per-address brake on password sign-in (PLAN 011 phase 7): cleared by a sign-in and by a reset. */
    readonly brake: Pick<SignInBrake, 'signedIn'>;
    /** The time floor on `/sign-up/email` (PLAN 011 phase 8): held here, started by `accountSecurityBefore`. */
    readonly floor: Pick<SignUpFloor, 'hold'>;
    /** Null where HIBP must not be called — under `NODE_ENV=test`. */
    readonly isCompromised: CompromisedCheck | null;
    /** Sends "your password has changed"; run in the background, never awaited by a route. */
    readonly mailPasswordChanged: (notice: PasswordChangedNotice) => Promise<void>;
  };

const CHANGE_PASSWORD = '/change-password';
const REVOKE_ONE = '/revoke-session';
const SIGN_IN = '/sign-in/email';

/** Better Auth's three ways to close sessions, and the word the trail records for each. */
const REVOKES: Readonly<Record<string, SessionsRevokedScope>> = {
  '/revoke-other-sessions': 'others',
  '/revoke-session': 'one',
  '/revoke-sessions': 'all'
};

const logger = new Logger('AccountSecurity');

function headersOf(source: { headers?: Headers | null } | null | undefined): { acceptLanguage: string | null; userAgent: string | null } {
  return { acceptLanguage: source?.headers?.get('accept-language') ?? null, userAgent: source?.headers?.get('user-agent') ?? null };
}

/** The request's headers, wherever Better Auth put them for this call. */
function requestHeaders(context: Context): { acceptLanguage: string | null; userAgent: string | null } {
  return headersOf(context.headers ? { headers: context.headers } : context.request);
}

/** The account a 2xx answer names — `/change-password` and `/sign-in/email` both answer `{ user }`. */
function answeredUser(returned: unknown): { id: string; email: string; marked: boolean } | null {
  const user = record(record(returned).user);
  const id = text(user.id);
  const email = text(user.email);

  return id && email ? { id, email, marked: user.passwordCompromisedAt != null } : null;
}

/**
 * The password changed (PLAN 011 phase 2): the breach mark goes and the audit
 * row is written, awaited — the very next request must not still be refused
 * 409 — then the mail, in the background. A change or a reset also removes
 * every passkey of the account in that transaction (phase 5, `0083`), and the
 * mail says how many.
 *
 * Better Auth has stored the new password by now and cannot be undone from
 * here, so a failure to record is logged rather than turned into a 500 that
 * would tell the person a change failed when it did not. The passkeys are
 * then tried again on their own: a key added from a stolen session must not
 * outlive the password that throws its holder out, whatever happened to the
 * rest. If that fails too, the line `passkeys_not_removed` says so. The lines
 * name the account and the door, never anything of the password.
 */
async function passwordChanged(
  deps: AccountSecurityDeps,
  notice: Omit<PasswordChangedNotice, 'passkeysRemoved'>,
  via: PasswordChangedVia
): Promise<void> {
  let passkeysRemoved = 0;

  try {
    passkeysRemoved = await UserController.passwordChanged(notice.id, via);
  } catch {
    logger.error(`password_change_unrecorded ${JSON.stringify({ userId: notice.id, via })}`);

    try {
      passkeysRemoved = await UserController.forgetPasskeys(notice.id);
    } catch {
      logger.error(`passkeys_not_removed ${JSON.stringify({ userId: notice.id })}`);
    }
  }

  deps.background.run('password-changed-mail', () => deps.mailPasswordChanged({ ...notice, passkeysRemoved }));
}

/**
 * Better Auth's `hooks.before`. First the per-address brake on
 * `/sign-in/email` (`SignInBrake.ts`), which answers 429 while an address
 * waits. Then the password rule on the three doors a
 * password is set through (`PasswordPolicy.ts`). On `/revoke-session`, a
 * token that is not the caller's is answered here (`notTheCallersSession`).
 * On `/change-password`, `revokeOtherSessions` is forced to `true` whatever
 * the body said: a password
 * changed because somebody else may know it must not leave that somebody's
 * session alive. Better Auth then deletes every session of the account and
 * issues the caller a new one. On `/two-factor/*`, the password-only rule and
 * no email OTP (`TwoFactor.ts`). On `/passkey/*`, another account's passkey is
 * the 404 and a registration mints no session (`Passkey.ts`).
 */
export function accountSecurityBefore(isCompromised: CompromisedCheck | null, brake: Pick<SignInBrake, 'before'>, floor: Pick<SignUpFloor, 'start'>) {
  const check = checkNewPassword(isCompromised);

  return createAuthMiddleware(async context => {
    await brake.before(context);
    await check(context);
    // The sign-up floor's clock starts once the password has passed (`SignUpFloor.ts`).
    floor.start(context);
    await twoFactorBefore(context);

    const passkey = await passkeyBefore(context);

    if (passkey) {
      return passkey;
    }

    if (context.path === CHANGE_PASSWORD) {
      return { context: { body: { ...record(context.body), revokeOtherSessions: true } } };
    }

    if (context.path === REVOKE_ONE) {
      return notTheCallersSession(context);
    }

    return undefined;
  });
}

/**
 * `/revoke-session` for a token that is not one of the caller's own sessions.
 * Better Auth deletes nothing then and still answers `{ status: true }`; this
 * gives the same answer before the route, so the after-hook never runs and the
 * trail never records a revoke that did not happen. It reveals nothing:
 * another person's token, an expired one and a made-up one all get the answer
 * Better Auth would have given. No caller session and no token are left to the
 * route, which answers its own 401 or 400.
 */
async function notTheCallersSession(context: Context): Promise<{ status: true } | undefined> {
  const token = text(record(context.body).token);
  const caller = await getSessionFromCtx(context);

  if (!token || !caller) {
    return undefined;
  }

  const target = await context.context.internalAdapter.findSession(token);

  return target?.session.userId === caller.user.id ? undefined : { status: true };
}

/**
 * Better Auth's `hooks.after`, on a 2xx only — a refused change, revoke or
 * sign-in leaves no trace here. The one refusal it touches is an unconfirmed
 * account's right password, answered as a wrong one (`UnconfirmedSignIn.ts`,
 * PLAN 011 phase 8).
 *
 * - `/change-password`: the mark cleared, `auth.password_changed {via:'change'}`,
 *   every passkey removed, the mail.
 * - `/revoke-session`, `/revoke-other-sessions`, `/revoke-sessions`:
 *   `auth.sessions_revoked` with `one` / `others` / `all`, for the session's own
 *   user — Better Auth scoped the deletion to that user already. A
 *   `/revoke-session` for a token that is not the caller's is answered by
 *   `hooks.before` and never gets here, so a `one` row is a session that went.
 * - `/sign-in/email`: the address's brake cleared, awaited — the next
 *   attempt starts from nothing — whether or not a second factor follows,
 *   since the password is what the brake guards. Then the password just
 *   proved checked against HIBP, in the
 *   background — sign-in never waits for it — and the account marked on a hit
 *   if it is not already. A timeout or an error marks nothing (`breachedOrPass`
 *   fails open). Off where `isCompromised` is null. It runs before the
 *   two-factor plugin's own after-hook, so an account with the factor on is
 *   checked too, though it answers a challenge.
 * - `/two-factor/*`: the factor on or off and a backup code spent, each with
 *   its row and its mail (`TwoFactor.ts`).
 * - `/passkey/*`: a passkey added (its row and its mail) or removed (its row),
 *   and the sign-in options returned asking for the person to be verified
 *   (`Passkey.ts`).
 */
export function accountSecurityAfter(deps: AccountSecurityDeps) {
  return createAuthMiddleware(async context => {
    const returned: unknown = context.context.returned;

    // A sign-up answers no earlier than its floor, whatever the answer (`SignUpFloor.ts`).
    await deps.floor.hold(context);

    if (returned === undefined) {
      return;
    }

    if (isAPIError(returned)) {
      return unconfirmedAsInvalid(context);
    }

    const path = context.path ?? '';

    if (path.startsWith('/two-factor/')) {
      await twoFactorAfter(deps, context, returned);

      return;
    }

    if (path.startsWith('/passkey/')) {
      return passkeyAfter(deps, context);
    }

    if (path === CHANGE_PASSWORD) {
      const user = answeredUser(returned);

      if (user) {
        await passwordChanged(deps, { ...requestHeaders(context), id: user.id, email: user.email }, 'change');
      }

      return;
    }

    const scope = REVOKES[path];

    if (scope) {
      const userId = context.context.session?.user.id;

      if (userId) {
        await UserController.sessionsRevoked(userId, scope).catch(() => {
          logger.error(`sessions_revoked_unrecorded ${JSON.stringify({ scope, userId })}`);
        });
      }

      return;
    }

    if (path !== SIGN_IN) {
      return;
    }

    const email = text(record(context.body).email);

    if (email) {
      await deps.brake.signedIn(email);
    }

    if (deps.isCompromised) {
      const user = answeredUser(returned);
      const password = text(record(context.body).password);
      const isCompromised = deps.isCompromised;

      if (user && !user.marked && password) {
        deps.background.run('hibp-sign-in', async () => {
          if (await breachedOrPass(password, SIGN_IN, isCompromised)) {
            await UserController.markPasswordCompromised(user.id);
          }
        });
      }
    }
  });
}

/**
 * Better Auth's `emailAndPassword.onPasswordReset`: the same as a change, by
 * the other door — the mark cleared, `auth.password_changed {via:'reset'}`,
 * every passkey removed, the mail. Runs only after a valid token set the password, so it says nothing
 * about whether an address has an account.
 *
 * Whoever reset holds the mailbox, so:
 * - the address is confirmed, if it was not (PLAN 011 phase 8), with what
 *   confirming one runs — the account opens itself or the owner is told.
 *   Better Auth's reset does not, and an unconfirmed account cannot sign in
 *   with its password: the person whose address a stranger signed up first,
 *   with a password of the stranger's, resets it and signs in with the new
 *   one. A failure here leaves the address as it was and one line: the
 *   password did change, and the next sign-in sends a link;
 * - the address's sign-in brake is cleared (PLAN 011 phase 7): they must not
 *   wait out a brake somebody else's guesses at the old password left.
 */
export function onPasswordReset(deps: AccountSecurityDeps) {
  return async ({ user }: { user: { id: string; email: string } }, request?: Request): Promise<void> => {
    try {
      if (await UserController.confirmAddressByReset(user.id)) {
        await deps.addressConfirmed(user);
      }
    } catch {
      logger.error(`address_not_confirmed_on_reset ${JSON.stringify({ userId: user.id })}`);
    }

    await deps.brake.signedIn(user.email);
    await passwordChanged(deps, { ...headersOf(request), id: user.id, email: user.email }, 'reset');
  };
}
