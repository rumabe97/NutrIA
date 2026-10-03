import { describe, expect, it } from 'vitest';

import { secondFactorMissing } from './SecondFactor';

describe('secondFactorMissing — a privileged account with a password needs TOTP', () => {
  it('is missing for a password account with the factor off', () => {
    expect(secondFactorMissing({ hasPassword: true, twoFactorEnabled: false })).toBe(true);
  });

  it('is there once the factor is on, whatever door the session came through', () => {
    expect(secondFactorMissing({ hasPassword: true, twoFactorEnabled: true })).toBe(false);
  });
});

describe('secondFactorMissing — an account with no password', () => {
  it('passes: its second factor is its provider’s', () => {
    expect(secondFactorMissing({ hasPassword: false, twoFactorEnabled: false })).toBe(false);
  });

  it('passes with the flag set too — the flag never makes an account fail', () => {
    expect(secondFactorMissing({ hasPassword: false, twoFactorEnabled: true })).toBe(false);
  });
});
