import { Logger } from '@nestjs/common';
import { createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api';

import { UserController } from 'core/controllers/User';

import { breachedOrPass, checkNewPassword, record, text } from './PasswordPolicy.js';

import type { BackgroundTaskService } from '../../../shared/services/index.js';
import type { CompromisedCheck, Context } from './PasswordPolicy.js';
import type { PasswordChangedVia, SessionsRevokedScope } from 'core/entities/Audit';

/** Whom a password change is about, and what the mail needs from the request that made it. */
export type PasswordChangedNotice = {
  readonly id: string;
  readonly acceptLanguage: string | null;
  readonly email: string;
  readonly userAgent: string | null;
};

export type AccountSecurityDeps = {
  readonly background: Pick<BackgroundTaskService, 'run'>;
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
 * 409 — then the mail, in the background.
 *
 * Better Auth has stored the new password by now and cannot be undone from
 * here, so a failure to record is logged rather than turned into a 500 that
 * would tell the person a change failed when it did not. The line names the
 * account and the door, never anything of the password.
 */
async function passwordChanged(deps: AccountSecurityDeps, notice: PasswordChangedNotice, via: PasswordChangedVia): Promise<void> {
  try {
    await UserController.passwordChanged(notice.id, via);
  } catch {
    logger.error(`password_change_unrecorded ${JSON.stringify({ userId: notice.id, via })}`);
  }

  deps.background.run('password-changed-mail', () => deps.mailPasswordChanged(notice));
}

/**
 * Better Auth's `hooks.before`. First the password rule on the three doors a
 * password is set through (`PasswordPolicy.ts`). On `/revoke-session`, a
 * token that is not the caller's is answered here (`notTheCallersSession`).
 * On `/change-password`, `revokeOtherSessions` is forced to `true` whatever
 * the body said: a password
 * changed because somebody else may know it must not leave that somebody's
 * session alive. Better Auth then deletes every session of the account and
 * issues the caller a new one.
 */
export function accountSecurityBefore(isCompromised: CompromisedCheck | null) {
  const check = checkNewPassword(isCompromised);

  return createAuthMiddleware(async context => {
    await check(context);

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
 * sign-in leaves no trace here.
 *
 * - `/change-password`: the mark cleared, `auth.password_changed {via:'change'}`,
 *   the mail.
 * - `/revoke-session`, `/revoke-other-sessions`, `/revoke-sessions`:
 *   `auth.sessions_revoked` with `one` / `others` / `all`, for the session's own
 *   user — Better Auth scoped the deletion to that user already. A
 *   `/revoke-session` for a token that is not the caller's is answered by
 *   `hooks.before` and never gets here, so a `one` row is a session that went.
 * - `/sign-in/email`: the password just proved checked against HIBP, in the
 *   background — sign-in never waits for it — and the account marked on a hit
 *   if it is not already. A timeout or an error marks nothing (`breachedOrPass`
 *   fails open). Off where `isCompromised` is null.
 */
export function accountSecurityAfter(deps: AccountSecurityDeps) {
  return createAuthMiddleware(async context => {
    const returned: unknown = context.context.returned;

    if (returned === undefined || isAPIError(returned)) {
      return;
    }

    const path = context.path ?? '';

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

    if (path === SIGN_IN && deps.isCompromised) {
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
 * the other door — the mark cleared, `auth.password_changed {via:'reset'}`, the
 * mail. Runs only after a valid token set the password, so it says nothing
 * about whether an address has an account.
 */
export function onPasswordReset(deps: AccountSecurityDeps) {
  return async ({ user }: { user: { id: string; email: string } }, request?: Request): Promise<void> => {
    await passwordChanged(deps, { ...headersOf(request), id: user.id, email: user.email }, 'reset');
  };
}
