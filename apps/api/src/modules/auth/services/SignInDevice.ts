import { Logger } from '@nestjs/common';
import { createAuthMiddleware } from 'better-auth/api';

import { SignInDeviceController } from 'core/controllers/SignInDevice';
import { SIGN_IN_DEVICE } from 'core/domain/SignInDevice';

import type { Context } from './PasswordPolicy.js';
import type { BetterAuthPlugin } from 'better-auth';

const SIGN_IN = '/sign-in/email';
/** The two routes that finish a sign-in an account with a second factor began (`TwoFactor.ts`). */
const FINISH_TWO_FACTOR: ReadonlySet<string> = new Set(['/two-factor/verify-totp', '/two-factor/verify-backup-code']);

/** Better Auth prefixes it (`__Secure-` under `useSecureCookies`, the cookie domain when one is set), as it does the session's. */
const DEVICE_COOKIE = 'sign_in_device';

const logger = new Logger('SignInDevice');

export type SignInDevices = {
  /**
   * `hooks.before` on `/sign-in/email`: whether the request carries a device
   * cookie earned for the account that owns `email`. Never throws: if it
   * cannot tell, the answer is no, and the brake applies as it would to
   * anybody.
   */
  readonly exempts: (context: Context, email: string) => Promise<boolean>;
  /**
   * A completed sign-in for `userId`, the account Better Auth just signed in
   * (never a body's): the browser's cookie is renewed or a new one issued and
   * set on the response. Never throws: a sign-in that succeeded must not fail
   * for want of a cookie.
   */
  readonly remember: (context: Context, userId: string) => Promise<void>;
};

/**
 * The device cookie (PLAN 011 phase 7b; the rule is `core/domain/SignInDevice`).
 *
 * - A browser that signed in to an account with its password holds an opaque
 *   token the database knows only by its digest, beside the account it was
 *   earned for. It carries no address and signs nothing about one.
 * - It is `HttpOnly`, `SameSite=Lax` and `Secure` under production, the very
 *   attributes of the session cookie (`advanced.defaultCookieAttributes`), and
 *   lives ninety days from the last sign-in that used it.
 * - It waives one thing: the per-address brake (`SignInBrake.ts`). Better
 *   Auth's per-IP limit, the password, and the second factor with its own
 *   lock all still apply — an account with the factor on earns the cookie
 *   only once the factor is also proved.
 * - It is the account's, not the address's: a cookie earned for one account
 *   waives nothing for any other address, and an address with no account has
 *   no cookie. A request without a valid cookie for that very address is
 *   counted and answered the same 429 as ever, whether the address has an
 *   account or not, and whatever else the cookie header says.
 * - A change or a reset of the password ends every one
 *   (`UserRepository.passwordChanged`).
 * - It is earned by `deviceOnSignIn`, once a password sign-in has opened a
 *   session (see there).
 */
export const signInDevices: SignInDevices = {
  async exempts(context, email) {
    const token = context.getCookie(deviceCookie(context).name);

    try {
      return await SignInDeviceController.exempts(token ?? null, email);
    } catch {
      logger.error('sign_in_device_unavailable');

      return false;
    }
  },

  async remember(context, userId) {
    const { attributes, name } = deviceCookie(context);

    try {
      const token = await SignInDeviceController.remember(userId, context.getCookie(name) ?? null);

      context.setCookie(name, token, attributes);
    } catch {
      logger.error('sign_in_device_unrecorded');
    }
  }
};

function deviceCookie(context: Context) {
  return context.context.createAuthCookie(DEVICE_COOKIE, { maxAge: SIGN_IN_DEVICE.maxAgeSeconds });
}

/**
 * Sets the device cookie when a password sign-in has opened a session (PLAN
 * 011 phase 7b). Listed after `twoFactor` in `plugins`, like
 * `sessionStartedOnSignIn`, so its after-hook runs once the plugin has had its
 * say: a session still `newSession` here is real — no second factor, or a
 * device the person trusted — and a challenge has left it `null`, so a
 * password that is right but whose code is not yet proved earns nothing. The
 * routes that finish the challenge (`/two-factor/verify-totp` and
 * `/verify-backup-code` with no session before them) earn it then. The same
 * two routes called by somebody already signed in, to turn the factor on,
 * open nothing new. A passkey and Google are not matched: neither is a
 * password, and neither is braked.
 */
export function deviceOnSignIn(devices: Pick<SignInDevices, 'remember'>): BetterAuthPlugin {
  return {
    id: 'sign-in-device',
    hooks: {
      after: [
        {
          handler: createAuthMiddleware(async context => {
            const opened = context.context.newSession;

            if (opened) {
              await devices.remember(context, opened.user.id);
            }
          }),
          matcher: context => context.path === SIGN_IN || (FINISH_TWO_FACTOR.has(context.path ?? '') && !context.context?.session?.session)
        }
      ]
    }
  };
}
