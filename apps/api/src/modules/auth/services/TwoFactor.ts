import { Logger } from '@nestjs/common';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { symmetricDecrypt } from 'better-auth/crypto';

import { AnalyticsController } from 'core/controllers/Analytics';
import { UserController } from 'core/controllers/User';

import { record, text } from './PasswordPolicy.js';

import type { BackgroundTaskService } from '../../../shared/services/index.js';
import type { TwoFactorEvent } from '../../email/templates/TwoFactorChanged.js';
import type { Context } from './PasswordPolicy.js';
import type { BetterAuthPlugin } from 'better-auth';

/** Whom a change of the second factor is about, and what the mail needs from the request that made it. */
export type TwoFactorNotice = {
  readonly id: string;
  readonly acceptLanguage: string | null;
  readonly email: string;
  readonly event: TwoFactorEvent;
  readonly userAgent: string | null;
};

export type TwoFactorDeps = {
  readonly background: Pick<BackgroundTaskService, 'run'>;
  /** Sends the mail for `notice.event`; run in the background, never awaited by a route. */
  readonly mailTwoFactor: (notice: TwoFactorNotice) => Promise<void>;
};

export const TWO_FACTOR_ISSUER = 'NutrIA';
export const BACKUP_CODE_COUNT = 10;
/** A device the person trusted skips the code for this long (seconds), renewed on every sign-in from it. */
export const TRUST_DEVICE_MAX_AGE = 30 * 24 * 60 * 60;

const ENABLE = '/two-factor/enable';
const DISABLE = '/two-factor/disable';
const VERIFY_TOTP = '/two-factor/verify-totp';
const VERIFY_BACKUP_CODE = '/two-factor/verify-backup-code';
const GENERATE_BACKUP_CODES = '/two-factor/generate-backup-codes';
const SIGN_IN = '/sign-in/email';

/**
 * The plugin's routes this product does not offer, answered the 404 before the
 * plugin sees them: email OTP as a second factor, and `/get-totp-uri`, which
 * would hand the secret to whoever holds the session and the password, with
 * no row and no mail — a silent clone of the authenticator. The secret leaves
 * only in `/enable`'s answer.
 */
const NOT_OFFERED: ReadonlySet<string> = new Set(['/two-factor/get-totp-uri', '/two-factor/send-otp', '/two-factor/verify-otp']);

const logger = new Logger('TwoFactor');

/**
 * Word for word what `SessionGuard`'s `NotFoundException` answers through
 * `AllExceptionsFilter` on the data routes —
 * `{"code":"NOT_FOUND","message":"Not Found","statusCode":404}` — the one
 * denial the product gives, whatever was refused.
 */
function notFound(): APIError {
  return new APIError('NOT_FOUND', { code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 });
}

/**
 * Before the plugin (PLAN 011 phase 3):
 *
 * - `/two-factor/enable` for an account with no credential account — it only
 *   ever arrived through Google or Apple — is the guard's 404. Its second
 *   factor is its provider's, and with no password there is nothing for a
 *   code to stand beside. Without a session the route answers its own 401.
 * - `/two-factor/send-otp`, `/two-factor/verify-otp` and
 *   `/two-factor/get-totp-uri` are the 404 (`NOT_OFFERED`). No
 *   `otpOptions.sendOTP` is configured, so the plugin would refuse the first
 *   two anyway; this keeps it true whatever a later option adds.
 */
export async function twoFactorBefore(context: Context): Promise<void> {
  const path = context.path ?? '';

  if (NOT_OFFERED.has(path)) {
    throw notFound();
  }

  if (path !== ENABLE) {
    return;
  }

  const caller = await getSessionFromCtx(context);

  if (caller && !(await context.context.internalAdapter.findCredentialAccount(caller.user.id))) {
    throw notFound();
  }
}

/** The account a 2xx answer names — the challenge routes answer `{ token, user }`. */
function answeredUser(returned: unknown): { id: string; email: string } | null {
  const user = record(record(returned).user);
  const id = text(user.id);
  const email = text(user.email);

  return id && email ? { id, email } : null;
}

/**
 * How many backup codes the account has left, read from the plugin's own row
 * after it spent one. The codes are decrypted to be counted and go no further:
 * never logged, never returned, never in the row.
 */
async function backupCodesLeft(context: Context, userId: string): Promise<number | null> {
  const row = await context.context.adapter.findOne<{ backupCodes: string }>({ model: 'twoFactor', where: [{ field: 'userId', value: userId }] });

  if (!row) {
    return null;
  }

  const codes: unknown = JSON.parse(await symmetricDecrypt({ data: row.backupCodes, key: context.context.secretConfig }));

  return Array.isArray(codes) ? codes.length : null;
}

/** The row, awaited — the trail must not lag the answer — then the mail in the background. A failed row is a line, not a 500: the factor did change. */
async function changed(deps: TwoFactorDeps, context: Context, user: { id: string; email: string }, event: TwoFactorEvent): Promise<void> {
  try {
    if (event.kind === 'backup-code-used') {
      await UserController.backupCodeUsed(user.id, event.remaining);
    } else if (event.kind === 'backup-codes-regenerated') {
      await UserController.backupCodesRegenerated(user.id);
    } else {
      await UserController.twoFactorChanged(user.id, event.kind === 'enabled');
    }
  } catch {
    logger.error(`two_factor_unrecorded ${JSON.stringify({ event: event.kind, userId: user.id })}`);
  }

  const notice: TwoFactorNotice = {
    id: user.id,
    acceptLanguage: context.headers?.get('accept-language') ?? null,
    email: user.email,
    event,
    userAgent: context.headers?.get('user-agent') ?? null
  };

  deps.background.run('two-factor-mail', () => deps.mailTwoFactor(notice));
}

/**
 * After the plugin, on a 2xx only (called from `accountSecurityAfter`):
 *
 * - `/two-factor/verify-totp` from a session whose account had the factor off:
 *   that is the factor turning on — the first correct code after `/enable`,
 *   never `/enable` itself, which only stores an unverified secret. The plugin
 *   has rotated the session to one whose user has it on. A challenge (no
 *   session before the request) is a sign-in and writes nothing here.
 * - `/two-factor/disable`: off, for the session's own account, when it was on.
 * - `/two-factor/generate-backup-codes`: ten new codes, the old ones dead —
 *   a row and a mail, so nobody holding the session and the password can
 *   swap the owner's codes for their own in silence.
 * - `/two-factor/verify-backup-code`: one code spent, from a challenge or a
 *   session, with how many are left.
 */
export async function twoFactorAfter(deps: TwoFactorDeps, context: Context, returned: unknown): Promise<void> {
  const path = context.path ?? '';

  if (path === VERIFY_TOTP) {
    const before = context.context.session;
    const after = context.context.newSession;

    if (before?.session && before.user.twoFactorEnabled !== true && after?.user.twoFactorEnabled === true) {
      await changed(deps, context, { id: after.user.id, email: after.user.email }, { kind: 'enabled' });
    }

    return;
  }

  if (path === DISABLE) {
    const user = context.context.session?.user;

    // The plugin answers 2xx to `/disable` on an account that never had it on; nothing went off, so nothing is said.
    if (user?.twoFactorEnabled === true) {
      await changed(deps, context, { id: user.id, email: user.email }, { kind: 'disabled' });
    }

    return;
  }

  if (path === GENERATE_BACKUP_CODES) {
    const user = context.context.session?.user;

    if (user) {
      await changed(deps, context, { id: user.id, email: user.email }, { kind: 'backup-codes-regenerated' });
    }

    return;
  }

  if (path === VERIFY_BACKUP_CODE) {
    const user = answeredUser(returned);

    if (!user) {
      return;
    }

    const remaining = await backupCodesLeft(context, user.id).catch(() => null);

    if (remaining === null) {
      logger.error(`two_factor_unrecorded ${JSON.stringify({ event: 'backup-code-used', userId: user.id })}`);

      return;
    }

    await changed(deps, context, user, { kind: 'backup-code-used', remaining });
  }
}

/**
 * `databaseHooks.account.create.before`: whether to refuse linking a provider
 * to an account (PLAN 011 phase 3, invariant review P1).
 *
 * The plugin guards only the password door. Better Auth's implicit link at
 * `/callback/:provider` — a verified provider address matching a verified
 * local one (`0058`) — checks no factor, so whoever controls the mailbox
 * could make a Google account on it, arrive through Google, be linked and get
 * a full session with no code: the same mailbox holder a reset is not allowed
 * to let past the factor. Refused when the provider is not `credential`, the
 * account has the factor on and the request carries no session of that
 * account; Better Auth then answers "unable to link account" and the web its
 * generic social failure. An explicit link from a signed-in session, a new
 * account and an account without the factor are untouched.
 */
export async function refusesLinkPastTheFactor(
  linked: { providerId?: unknown; userId?: unknown },
  context: Context | null | undefined
): Promise<boolean> {
  const userId = text(linked.userId);

  if (!context || linked.providerId === 'credential' || !userId) {
    return false;
  }

  const owner = await context.context.internalAdapter.findUserById(userId);

  if ((owner as { twoFactorEnabled?: unknown } | null)?.twoFactorEnabled !== true) {
    return false;
  }

  const caller = await getSessionFromCtx(context);

  return caller?.user.id !== userId;
}

/**
 * Better Auth paths that create a session without anybody signing in
 * (PLAN 011 phase 3): the plugin replaces the caller's session with one that
 * carries the new `twoFactorEnabled`, and deletes the old.
 */
const ROTATIONS: ReadonlySet<string> = new Set([ENABLE, DISABLE]);

/**
 * Whether a session Better Auth just created is somebody signing in, for
 * `session_started` (`0033`). Not:
 *
 * - `/sign-in/email`: with the factor on, the plugin deletes that session
 *   before the challenge (two-factor/index.mjs:287-288), so it is counted
 *   only once it survives — by `sessionStartedOnSignIn`, which runs after the
 *   plugin. The challenge's own session is the one counted then.
 * - `/two-factor/enable` and `/two-factor/disable`, and `/two-factor/verify-*`
 *   from a session (turning the factor on): rotations of a session somebody
 *   already had.
 */
export function startsAVisit(context: { context?: { session?: { session?: unknown } | null }; path?: string } | null | undefined): boolean {
  const path = context?.path ?? '';

  if (path === SIGN_IN || ROTATIONS.has(path)) {
    return false;
  }

  if (path === VERIFY_TOTP || path === VERIFY_BACKUP_CODE) {
    return !context?.context?.session?.session;
  }

  return true;
}

/**
 * `session_started` for a password sign-in, counted after the two-factor
 * plugin has had its say. Listed after `twoFactor` in `plugins`, so its
 * after-hook runs later: a session that is still `newSession` here is real —
 * no factor, or a trusted device — and a challenge has left `null`.
 */
export function sessionStartedOnSignIn(): BetterAuthPlugin {
  return {
    id: 'session-started',
    hooks: {
      after: [
        {
          handler: createAuthMiddleware(async context => {
            const started = context.context.newSession;

            if (started) {
              await AnalyticsController.record('session_started', started.user.id);
            }
          }),
          matcher: context => context.path === SIGN_IN
        }
      ]
    }
  };
}
