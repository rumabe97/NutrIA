import { Logger } from '@nestjs/common';
import { APIError } from 'better-auth/api';

import { SignInBrakeController } from 'core/controllers/SignInBrake';
import { signInBrakeKey } from 'core/domain/SignInBrake';
import { signInDeviceBrakeKey } from 'core/domain/SignInDevice';

import { record, text } from './PasswordPolicy.js';

import type { Context } from './PasswordPolicy.js';
import type { SignInDevices } from './SignInDevice.js';

const SIGN_IN = '/sign-in/email';

/** The 429's code: the same for an address with an account and one without. */
export const SIGN_IN_BRAKED = 'TOO_MANY_ATTEMPTS';

const logger = new Logger('SignInBrake');

export type SignInBrake = {
  /** `hooks.before` on `/sign-in/email`: counts the attempt, or answers 429 with `Retry-After` while the address waits. */
  readonly before: (context: Context) => Promise<void>;
  /**
   * The address proved its password — a sign-in, or a reset by its mailbox: its count goes. Never throws.
   * `request` is the sign-in's own: when `before` exempted it, only the device's count goes — the address's
   * wait is somebody else's to have built, and an owner's sign-in does not give an attacker a fresh window.
   */
  readonly signedIn: (email: string, request?: object | null) => Promise<void>;
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
 * - No wait is longer than fifteen minutes, but the attempt at its end goes to
 *   whoever asks first: an attacker who spends each one on a wrong password
 *   keeps the address braked while they keep at it, and a reset that clears
 *   the row is braked again after ten more. A passkey and Google never pass
 *   here: neither has a password to guess, and both stay open to the owner of
 *   an address somebody else is braking.
 * - Clearing on a correct password is itself a signal: an address whose row
 *   was cleared between two probes had an owner who signed in. Accepted (LOG).
 * - A browser that has signed in to that account before is not braked: its
 *   device cookie (`SignInDevice.ts`, PLAN 011 phase 7b) skips both the 429
 *   address's wait, so an attacker who knows an address can no longer keep its
 *   owner out from the browser the owner has always used. Its attempts are
 *   counted instead under a key of its own (an HMAC of the cookie's token),
 *   by the same rule: a stolen cookie is a bearer token, and must not be a
 *   licence to guess at the speed of the per-IP limit alone. Its success
 *   clears that key, never the address's. The per-IP limit, the password and
 *   the second factor's lock still apply. A cookie for any other account, an
 *   expired one and no cookie at all change nothing.
 * - It fails open: if its row cannot be read or written, the sign-in goes on
 *   behind Better Auth's own per-IP limit, and the line
 *   `sign_in_brake_unavailable` says so. A brake that broke must not lock
 *   everybody out. The line never carries the address or its key.
 */
export function signInBrake(secret: string, devices: Pick<SignInDevices, 'exempts'>): SignInBrake {
  const keyOf = (email: string): string => signInBrakeKey(email, secret);
  // The requests `before` exempted, and the device key each is counted under; read by `signedIn`.
  const exempted = new WeakMap<object, string>();

  return {
    async before(context) {
      if (context.path !== SIGN_IN) {
        return;
      }

      const email = text(record(context.body).email);

      if (!email) {
        return;
      }

      // Only a cookie earned for this very account is counted apart; nothing is looked up about the typed address itself.
      const token = await devices.exempts(context, email);
      const key = token ? signInDeviceBrakeKey(token, secret) : keyOf(email);

      if (token && context.request) {
        exempted.set(context.request, key);
      }

      let decision;

      try {
        decision = await SignInBrakeController.attempt(key);
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

    async signedIn(email, request) {
      await SignInBrakeController.signedIn((request && exempted.get(request)) ?? keyOf(email)).catch(() => {
        logger.error('sign_in_brake_uncleared');
      });
    }
  };
}
