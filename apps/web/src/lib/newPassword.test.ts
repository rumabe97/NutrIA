import { describe, expect, it } from 'vitest';

import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';
import { PASSWORD_RULES, passwordLengthRefusal, passwordRefusalMessage } from './newPassword';

describe('PASSWORD_RULES', () => {
  it('tells a password manager the length and nothing else', () => {
    expect(PASSWORD_RULES).toBe('minlength: 12; maxlength: 128;');
  });
});

describe('passwordLengthRefusal', () => {
  it('refuses 11 characters and accepts 12 to 128', () => {
    expect(passwordLengthRefusal('a'.repeat(11))).toBe('PASSWORD_TOO_SHORT');
    expect(passwordLengthRefusal('a'.repeat(12))).toBeUndefined();
    expect(passwordLengthRefusal('a'.repeat(128))).toBeUndefined();
    expect(passwordLengthRefusal('a'.repeat(129))).toBe('PASSWORD_TOO_LONG');
  });

  it('counts as the API counts: six emoji are twelve', () => {
    expect(passwordLengthRefusal('🍎'.repeat(6))).toBeUndefined();
    expect(passwordLengthRefusal('🍎'.repeat(5))).toBe('PASSWORD_TOO_SHORT');
  });
});

/*
 * The API refuses a new password with one of four codes. Each has its own copy in both
 * languages; anything else is left to the caller, which keeps what it said before.
 */
describe('passwordRefusalMessage', () => {
  it.each([
    ['es-ES', esES],
    ['en-GB', enGB]
  ] as const)('maps every password code to copy in %s', (_, dictionary) => {
    expect(passwordRefusalMessage('PASSWORD_HAS_CONTEXT', dictionary)).toBe(dictionary.auth.passwordHasContext);
    expect(passwordRefusalMessage('PASSWORD_COMPROMISED', dictionary)).toBe(dictionary.auth.passwordCompromised);
    expect(passwordRefusalMessage('PASSWORD_TOO_SHORT', dictionary)).toBe(dictionary.auth.passwordTooShort.replace('{count}', '12'));
    expect(passwordRefusalMessage('PASSWORD_TOO_LONG', dictionary)).toBe(dictionary.auth.passwordTooLong.replace('{count}', '128'));
  });

  it('fills every placeholder', () => {
    for (const dictionary of [esES, enGB]) {
      for (const code of ['PASSWORD_HAS_CONTEXT', 'PASSWORD_COMPROMISED', 'PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG']) {
        expect(passwordRefusalMessage(code, dictionary)).not.toMatch(/[{}]/);
      }
    }
  });

  it('never names the word that matched', () => {
    // One code covers the name, the email and "nutria": the copy lists all three, always.
    expect(esES.auth.passwordHasContext).toMatch(/nombre.*correo.*nutria/);
    expect(enGB.auth.passwordHasContext).toMatch(/name.*email.*nutria/);
  });

  it('leaves every other code to the caller', () => {
    expect(passwordRefusalMessage('INVALID_TOKEN', esES)).toBeUndefined();
    expect(passwordRefusalMessage('USER_ALREADY_EXISTS', esES)).toBeUndefined();
    expect(passwordRefusalMessage(undefined, esES)).toBeUndefined();
  });
});
