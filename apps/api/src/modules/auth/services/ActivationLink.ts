import { createHmac, timingSafeEqual } from 'node:crypto';

/** A month: long enough that an owner who was away can still use the link, short enough that an old inbox is not a key for ever. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A signed one-click activation link for the owner's own mail (`0030`).
 *
 * The token names one account and expires; it is signed with the auth secret,
 * so it cannot be forged without the secret, and it is compared in constant
 * time. It grants exactly one thing — open *this* account — and nothing else.
 *
 * Its security is the owner's inbox, which is already the thing that can reset
 * the owner's own password. That is a deliberate trade for a button that works
 * from a phone at a bus stop, and it is why the token cannot do anything but
 * this.
 */
export function activationToken(userId: string, secret: string, now = Date.now()): string {
  const expiresAt = now + TTL_MS;
  const payload = `${userId}.${expiresAt}`;

  return `${payload}.${sign(payload, secret)}`;
}

/** The account this token opens, or null if it is forged, malformed or expired. */
export function verifyActivationToken(token: string, secret: string, now = Date.now()): string | null {
  const parts = token.split('.');

  if (parts.length !== 3) {return null;}

  const [userId, expiresAt, signature] = parts as [string, string, string];
  const expected = sign(`${userId}.${expiresAt}`, secret);

  if (signature.length !== expected.length) {return null;}

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {return null;}

  return Number(expiresAt) > now ? userId : null;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
