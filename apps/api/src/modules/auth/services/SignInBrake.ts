import { Logger } from '@nestjs/common';
import { APIError } from 'better-auth/api';

import { SignInBrakeController } from 'core/controllers/SignInBrake';
import { signInBrakeKey } from 'core/domain/SignInBrake';

import { record, text } from './PasswordPolicy.js';

import type { Context } from './PasswordPolicy.js';

const SIGN_IN = '/sign-in/email';

/** The 429's code: the same for an address with an account and one without. */
export const SIGN_IN_BRAKED = 'TOO_MANY_ATTEMPTS';

const logger = new Logger('SignInBrake');

export type SignInBrake = {
  /** `hooks.before` on `/sign-in/email`: counts the attempt, or answers 429 with `Retry-After` while the address waits. */
  readonly before: (context: Context) => Promise<void>;
  /** The address proved its password — a sign-in, or a reset by its mailbox: its count goes. Never throws. */
  readonly signedIn: (email: string) => Promise<void>;
};

/**
 * The per-address brake on password sign-in (PLAN 011 phase 7; the rule is
 * `core/domain/SignInBrake`). Better Auth's limiter counts per IP; this counts
 * per address, before the password is checked, so a thousand IPs guessing one
 * account slow down together.
 *
 * - The key is an HMAC of the lower-cased address with `BETTER_AUTH_SECRET`;
 *   no address is stored. Nothing is looked up about the account, so an
 *   unknown address is counted and braked exactly like a known one, in the
 *   same round trips, with the same 429.
 * - Every attempt is counted before Better Auth runs, under the row's lock, so
 *   attempts fired at once cannot all read the count before any has written
 *   it. A correct password clears the row, so what stays counted is the
 *   failures.
 * - Never a hard lock: the longest wait is fifteen minutes, and the right
 *   password gets in once it is over. A passkey and Google never pass here:
 *   neither has a password to guess, and both stay open to the owner of an
 *   address somebody else is braking.
 * - It fails open: if its row cannot be read or written, the sign-in goes on
 *   behind Better Auth's own per-IP limit, and the line
 *   `sign_in_brake_unavailable` says so. A brake that broke must not lock
 *   everybody out. The line never carries the address or its key.
 */
export function signInBrake(secret: string): SignInBrake {
  const keyOf = (email: string): string => signInBrakeKey(email, secret);

  return {
    async before(context) {
      if (context.path !== SIGN_IN) {
        return;
      }

      const email = text(record(context.body).email);

      if (!email) {
        return;
      }

      let decision;

      try {
        decision = await SignInBrakeController.attempt(keyOf(email));
      } catch {
        logger.error('sign_in_brake_unavailable');

        return;
      }

      if (decision.kind === 'braked') {
        const seconds = String(decision.retryAfterSeconds);

        // `X-Retry-After` as well: the header Better Auth's own limiter sends, so a client that reads that one sees this wait too.
        throw new APIError(
          'TOO_MANY_REQUESTS',
          { code: SIGN_IN_BRAKED, message: 'Too many attempts. Try again later.' },
          { 'Retry-After': seconds, 'X-Retry-After': seconds }
        );
      }
    },

    async signedIn(email) {
      await SignInBrakeController.signedIn(keyOf(email)).catch(() => {
        logger.error('sign_in_brake_uncleared');
      });
    }
  };
}
