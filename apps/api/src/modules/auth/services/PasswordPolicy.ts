import { Logger } from '@nestjs/common';
import { APIError, createAuthMiddleware, getAuthoritativeSessionFromCtx } from 'better-auth/api';

import { PASSWORD_ERROR_CODES, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordHasContext } from 'core/entities/Password';

type Context = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];
type AccountWords = { email?: string | null; name?: string | null };

/** Answers whether a password is in the breach corpus, or throws when it cannot tell. */
export type CompromisedCheck = (password: string) => Promise<boolean>;

/** A breached password that HIBP could not confirm in time is let through: a sign-up that fails is a failure the person sees. */
export const HIBP_TIMEOUT_MS = 2000;

const logger = new Logger('PasswordPolicy');

/**
 * Whether HIBP knows the password, failing open (report `0007` § 4.1).
 *
 * Better Auth's own plugin answers a 500 when HIBP is down, which would close
 * sign-up, reset and change together for as long as somebody else's service is
 * out. Here a timeout or an error lets the request through and leaves one line,
 * `hibp_unavailable`, with the route and which of the two it was — never the
 * password, its SHA-1, its prefix or the error's own text, which is not ours
 * and could carry the URL the prefix travelled in.
 *
 * The request HIBP receives is the five-character prefix only: that is
 * `isPasswordCompromised`'s job, not this function's.
 */
export async function breachedOrPass(
  password: string,
  route: string,
  isCompromised: CompromisedCheck,
  timeoutMs: number = HIBP_TIMEOUT_MS
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>(resolve => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  try {
    // `race` holds a handler on both, so a check that rejects after losing is not an unhandled rejection.
    const answer = await Promise.race([isCompromised(password), timeout]);

    if (answer === 'timeout') {
      logger.warn(`hibp_unavailable ${JSON.stringify({ reason: 'timeout', route })}`);

      return false;
    }

    return answer;
  } catch {
    logger.warn(`hibp_unavailable ${JSON.stringify({ reason: 'error', route })}`);

    return false;
  } finally {
    clearTimeout(timer);
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * The account a reset belongs to, by its token — read, never consumed, which
 * stays Better Auth's to do. No row, or one past its time, and the checks are
 * skipped: Better Auth answers its own `INVALID_TOKEN`, and a stranger holding
 * a dead token learns nothing about the account it once named.
 */
async function resetAccount(context: Context, body: Record<string, unknown>): Promise<AccountWords | null> {
  // `||`, exactly as Better Auth reads it: an empty body token falls through to
  // the query's, and Better Auth goes on with that one — `??` kept the "" and
  // skipped the checks on a reset that then went through.
  const token = text(body.token) || text(record(context.query).token);

  if (!token) {
    return null;
  }

  const verification = await context.context.internalAdapter.findVerificationValue(`reset-password:${token}`);

  if (!verification || new Date(verification.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const user = await context.context.internalAdapter.findUserById(verification.value);

  return user ? { email: user.email, name: user.name } : null;
}

/** The session's own account, read the way `/change-password` itself reads it. No session, and Better Auth answers its 401. */
async function sessionAccount(context: Context): Promise<AccountWords | null> {
  const session = await getAuthoritativeSessionFromCtx(context);

  return session ? { email: session.user.email, name: session.user.name } : null;
}

/** The three doors a password is set through, which field carries it, and whose words it may not contain. */
const DOORS: Record<string, { account: (context: Context, body: Record<string, unknown>) => Promise<AccountWords | null>; field: string }> = {
  '/change-password': { account: sessionAccount, field: 'newPassword' },
  '/reset-password': { account: resetAccount, field: 'newPassword' },
  '/sign-up/email': { account: async (_context, body) => Promise.resolve({ email: text(body.email), name: text(body.name) }), field: 'password' }
};

/**
 * Better Auth's `hooks.before`: on the three doors, a new password that holds
 * a word the account gives away is refused, then one HIBP knows. Both refusals
 * are Better Auth's own `APIError`, so the body is `{ code, message }` like
 * every other auth error and the web app reads `error.code`.
 *
 * Length is checked first, by Better Auth, inside the route — which runs after
 * this hook. So a password outside the lengths is left alone here, and the
 * person hears `PASSWORD_TOO_SHORT` or `PASSWORD_TOO_LONG` rather than a
 * context or breach refusal for a password that was never going to be set. A
 * body that is not what the route expects is left alone too: the route's own
 * validation answers it.
 *
 * `isCompromised` is null where HIBP must not be called — under `NODE_ENV=test`
 * — and the context check stays on there.
 */
export function passwordPolicy(isCompromised: CompromisedCheck | null) {
  return createAuthMiddleware(async context => {
    const door = DOORS[context.path ?? ''];

    if (!door) {
      return;
    }

    const body = record(context.body);
    const password = text(body[door.field]);

    if (password === null || password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      return;
    }

    const account = await door.account(context, body);

    if (!account) {
      return;
    }

    if (passwordHasContext(password, account)) {
      throw APIError.from('BAD_REQUEST', {
        code: PASSWORD_ERROR_CODES.hasContext,
        message: 'Choose a password that does not contain your name, your email address or the name of the service.'
      });
    }

    if (isCompromised && (await breachedOrPass(password, context.path ?? '', isCompromised))) {
      throw APIError.from('BAD_REQUEST', {
        code: PASSWORD_ERROR_CODES.compromised,
        message: 'This password has appeared in a data breach. Choose a different one.'
      });
    }
  });
}
