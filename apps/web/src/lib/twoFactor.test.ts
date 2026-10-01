import { describe, expect, it } from 'vitest';

import { backupCode, backupCodesFile, secretGroups, totpCode, totpSecret, twoFactorRefusal } from './twoFactor';
import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';

describe('totpCode', () => {
  it('takes six digits as an authenticator shows or a paste carries them', () => {
    expect(totpCode('123456')).toBe('123456');
    expect(totpCode('123 456')).toBe('123456');
    expect(totpCode(' 123-456 ')).toBe('123456');
    expect(totpCode('123.456')).toBe('123456');
  });

  it('refuses anything that is not six digits', () => {
    expect(totpCode('12345')).toBeUndefined();
    expect(totpCode('1234567')).toBeUndefined();
    expect(totpCode('12a456')).toBeUndefined();
    expect(totpCode('')).toBeUndefined();
  });
});

describe('backupCode', () => {
  it('keeps the format the API stores, case and all', () => {
    expect(backupCode('aB3dE-9fGh1')).toBe('aB3dE-9fGh1');
    expect(backupCode(' aB3dE-9fGh1 ')).toBe('aB3dE-9fGh1');
  });

  it('puts the dash back in ten characters typed without it', () => {
    expect(backupCode('aB3dE9fGh1')).toBe('aB3dE-9fGh1');
    expect(backupCode('aB3dE 9fGh1')).toBe('aB3dE-9fGh1');
  });

  it('refuses what cannot be one', () => {
    expect(backupCode('aB3dE-9fGh')).toBeUndefined();
    expect(backupCode('aB3dE_9fGh1')).toBeUndefined();
    expect(backupCode('123456')).toBeUndefined();
    expect(backupCode('')).toBeUndefined();
  });
});

describe('totpSecret', () => {
  it('reads the key out of the address', () => {
    expect(totpSecret('otpauth://totp/NutrIA:ana%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=NutrIA')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('groups it in fours, the last group short when it must be', () => {
    expect(secretGroups('JBSWY3DPEHPK3PXP').map(group => group.text)).toEqual(['JBSW', 'Y3DP', 'EHPK', '3PXP']);
    expect(secretGroups('JBSWY3')).toEqual([
      { at: 0, text: 'JBSW' },
      { at: 4, text: 'Y3' }
    ]);
  });

  it('says nothing when there is no key to read', () => {
    expect(totpSecret('otpauth://totp/NutrIA?issuer=NutrIA')).toBeUndefined();
    expect(totpSecret('not a url')).toBeUndefined();
  });
});

describe('backupCodesFile', () => {
  it('names the account and the date, and lists one code a line', () => {
    const file = backupCodesFile(['aaaaa-11111', 'bbbbb-22222'], 'ana@example.com', '1 de octubre de 2026', esES);

    expect(file.split('\n')).toEqual([
      esES.twoFactor.fileTitle,
      'ana@example.com',
      'Generados el 1 de octubre de 2026',
      '',
      'aaaaa-11111',
      'bbbbb-22222',
      '',
      esES.twoFactor.fileNote,
      ''
    ]);
  });
});

describe('twoFactorRefusal', () => {
  it('puts a wrong code or password on its field, in the words of where it was typed', () => {
    expect(twoFactorRefusal('INVALID_CODE', 401, esES, 'challenge')).toEqual({ field: 'code', message: esES.twoFactor.wrongCode, restart: false });
    expect(twoFactorRefusal('INVALID_CODE', 401, esES, 'settings').message).toBe(esES.twoFactor.setupWrongCode);
    expect(twoFactorRefusal('INVALID_BACKUP_CODE', 401, enGB, 'challenge')).toEqual({
      field: 'code',
      message: enGB.twoFactor.wrongBackupCode,
      restart: false
    });
    expect(twoFactorRefusal('INVALID_PASSWORD', 400, esES, 'settings')).toEqual({
      field: 'password',
      message: esES.twoFactor.wrongPassword,
      restart: false
    });
  });

  it('sends a sign-in that expired, ran out of attempts or locked the account back to the password', () => {
    expect(twoFactorRefusal('INVALID_TWO_FACTOR_COOKIE', 401, esES, 'challenge')).toEqual({
      field: null,
      message: esES.twoFactor.expired,
      restart: true
    });
    expect(twoFactorRefusal('TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE', 400, esES, 'challenge').restart).toBe(true);
    expect(twoFactorRefusal('ACCOUNT_TEMPORARILY_LOCKED', 429, esES, 'challenge')).toEqual({
      field: null,
      message: esES.twoFactor.locked,
      restart: true
    });
  });

  it('says a lock in /perfil is a wait, not a sign-in', () => {
    expect(twoFactorRefusal('ACCOUNT_TEMPORARILY_LOCKED', 429, esES, 'settings')).toEqual({
      field: null,
      message: esES.twoFactor.lockedSettings,
      restart: false
    });
  });

  it('tells a rate limit from any other failure', () => {
    expect(twoFactorRefusal(undefined, 429, esES, 'challenge').message).toBe(esES.auth.tooManyAttempts);
    expect(twoFactorRefusal(undefined, 503, esES, 'challenge').message).toBe(
      'No hemos podido iniciar sesión (error 503). Inténtalo de nuevo en un momento.'
    );
    expect(twoFactorRefusal('SOMETHING_ELSE', 500, esES, 'settings').message).toBe(esES.errors.internal);
  });
});
