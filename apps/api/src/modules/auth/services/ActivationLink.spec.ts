import { describe, expect, it } from '@jest/globals';

import { activationToken, verifyActivationToken } from './ActivationLink.js';

const SECRET = 'a-secret-at-least-thirty-two-characters-long';
const USER = 'usr_1';

describe('activationToken', () => {
  it('names the account it opens, and nothing else opens it', () => {
    const token = activationToken(USER, SECRET);

    expect(verifyActivationToken(token, SECRET)).toBe(USER);
  });

  it('is worthless with the wrong secret', () => {
    expect(verifyActivationToken(activationToken(USER, SECRET), 'another-secret-of-a-similar-length!!')).toBeNull();
  });

  it('cannot be edited to name a different account', () => {
    const [, expiresAt, signature] = activationToken(USER, SECRET).split('.');

    expect(verifyActivationToken(`usr_2.${expiresAt ?? ''}.${signature ?? ''}`, SECRET)).toBeNull();
  });

  it('cannot be edited to last longer', () => {
    const [userId, expiresAt, signature] = activationToken(USER, SECRET).split('.');
    const later = String(Number(expiresAt) + 60_000);

    expect(verifyActivationToken(`${userId ?? ''}.${later}.${signature ?? ''}`, SECRET)).toBeNull();
  });

  it('expires', () => {
    const issued = Date.UTC(2026, 0, 1);
    const token = activationToken(USER, SECRET, issued);
    const month = 30 * 24 * 60 * 60 * 1000;

    expect(verifyActivationToken(token, SECRET, issued + month - 1000)).toBe(USER);
    expect(verifyActivationToken(token, SECRET, issued + month + 1000)).toBeNull();
  });

  it('refuses anything that is not a token', () => {
    for (const nonsense of ['', 'x', 'a.b', 'a.b.c.d', 'usr_1.9999999999999.']) {
      expect(verifyActivationToken(nonsense, SECRET)).toBeNull();
    }
  });
});
