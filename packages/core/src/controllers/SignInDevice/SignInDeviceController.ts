import { isSameAddress, newSignInDeviceToken, SIGN_IN_DEVICE, signInDeviceExpiry } from 'core/domain/SignInDevice';
import { SignInDeviceRepository } from '#repositories/SignInDevice';

/**
 * The browser that signed in before (PLAN 011 phase 7b; the rule and the
 * cookie's life are `core/domain/SignInDevice`). The API reads the cookie and
 * asks here before the per-address brake counts an attempt; it sets the cookie
 * this hands back after a completed sign-in.
 */
export const SignInDeviceController = {
  /**
   * Whether this cookie was earned for the account that owns `email`. False
   * for no cookie, an unknown or expired one, and one earned for another
   * account — for an address with no account too, which therefore sees the
   * brake exactly as before. The answer never says which of those it was.
   */
  async exempts(token: string | null, email: string, now: Date = new Date()): Promise<boolean> {
    if (!token) {
      return false;
    }

    const owner = await SignInDeviceRepository.whoseIs(token, now);

    return owner !== null && isSameAddress(owner, email);
  },

  /** A change or a reset of the password: this account's devices are no longer known. Returns how many went. */
  async forgetAll(userId: string): Promise<number> {
    return SignInDeviceRepository.forgetAll(userId);
  },

  /**
   * A sign-in completed for `userId` (the account Better Auth just signed in,
   * never a body's). The browser's own cookie, if it is still good for this
   * account, is renewed and handed back; otherwise a new one is issued. The
   * caller sets the cookie to the token returned, for `SIGN_IN_DEVICE.maxAgeSeconds`.
   */
  async remember(userId: string, presented: string | null, now: Date = new Date()): Promise<string> {
    const expiresAt = signInDeviceExpiry(now);

    if (presented && (await SignInDeviceRepository.renew(userId, presented, now, expiresAt))) {
      return presented;
    }

    const token = newSignInDeviceToken();

    await SignInDeviceRepository.issue(userId, token, expiresAt, SIGN_IN_DEVICE.perAccount);

    return token;
  }
};
