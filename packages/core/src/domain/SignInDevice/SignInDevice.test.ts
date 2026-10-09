import { describe, expect, it } from 'vitest';

import { isSameAddress, newSignInDeviceToken, SIGN_IN_DEVICE, signInDeviceExpiry } from './SignInDevice';

describe('newSignInDeviceToken', () => {
  it('is 256 random bits in URL-safe characters, and never the same twice', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => newSignInDeviceToken()));

    expect(tokens.size).toBe(50);

    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });
});

describe('isSameAddress', () => {
  it('matches the way Better Auth does: case-insensitively', () => {
    expect(isSameAddress('Ana@Example.com', 'ana@example.COM')).toBe(true);
  });

  it('refuses any other address', () => {
    expect(isSameAddress('ana@example.com', 'bea@example.com')).toBe(false);
    expect(isSameAddress('ana@example.com', 'ana@example.com ')).toBe(false);
    expect(isSameAddress('ana@example.com', '')).toBe(false);
  });
});

describe('signInDeviceExpiry', () => {
  it('ends the cookie ninety days after it was issued or renewed', () => {
    expect(SIGN_IN_DEVICE.maxAgeSeconds).toBe(90 * 24 * 60 * 60);
    expect(signInDeviceExpiry(new Date('2026-10-09T10:00:00.000Z'))).toEqual(new Date('2027-01-07T10:00:00.000Z'));
  });
});
