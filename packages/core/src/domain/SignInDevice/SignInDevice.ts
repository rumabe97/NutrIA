import { createHmac, randomBytes } from 'node:crypto';

const DAY_SECONDS = 24 * 60 * 60;

/**
 * The browser that signed in before (PLAN 011 phase 7b). The per-address brake
 * (`core/domain/SignInBrake`) slows an address down for everybody who asks
 * after it, its owner included; a browser that has already signed in to that
 * account with its password carries a device cookie, and the brake does not
 * apply to it. Nothing else is waived: Better Auth's per-IP limit, the
 * second factor's own lock and the password itself still stand.
 *
 * The cookie is an opaque random token. The database holds only its digest,
 * beside the account it was earned for — never the address, never the token —
 * so a copy of the table opens nothing. It is earned by a completed sign-in
 * (for an account with a second factor, once the factor is also proved),
 * renewed by the next one from the same browser, and ends with a change or a
 * reset of the password, as a trusted device does.
 */
export const SIGN_IN_DEVICE = {
  /** The cookie's life, renewed on every sign-in from that browser. */
  maxAgeSeconds: 90 * DAY_SECONDS,
  /** Browsers one account may hold at once: the newest ten, so a script signing in without cookies cannot grow the table. */
  perAccount: 10
} as const;

/** A fresh token for the cookie: 256 random bits, URL-safe. */
export function newSignInDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Whether a cookie earned for the account at `accountEmail` is being used to sign in to `typedEmail` — the way Better Auth matches addresses: case-insensitively. */
export function isSameAddress(accountEmail: string, typedEmail: string): boolean {
  return accountEmail.toLowerCase() === typedEmail.toLowerCase();
}

/** When a cookie issued or renewed at `now` ends. */
export function signInDeviceExpiry(now: Date): Date {
  return new Date(now.getTime() + SIGN_IN_DEVICE.maxAgeSeconds * 1000);
}

/**
 * The key a device's own attempts are counted under, in the same brake as an
 * address's (`core/domain/SignInBrake`): an HMAC of the cookie's token with the
 * auth secret, under a label of its own. The token is a bearer secret, so a
 * stolen cookie must not be a licence to guess without limit: a browser that
 * holds one is exempt from the *address's* wait, never from its own.
 */
export function signInDeviceBrakeKey(token: string, secret: string): string {
  return createHmac('sha256', secret).update(`sign-in-device-brake:${token}`).digest('hex');
}
