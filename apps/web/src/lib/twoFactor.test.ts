import { describe, expect, it } from 'vitest';

import { backupCode, backupCodesFile, totpCode, totpSecret, twoFactorRefusal } from './twoFactor';
import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';

describe('totpCode', () => {
  it('takes six digits as an authenticator shows or a paste carries them', () => {
    expect(totpCode('123456')).toBe('123456');
    expect(totpCode('123 456')).toBe('123456');
    expect(totpCode(' 123-456 ')).toBe('123456');
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
  it('reads the key out of the address, in groups of four', () => {
    expect(totpSecret('otpauth://totp/NutrIA:ana%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=NutrIA')).toBe('JBSW Y3DP EHPK 3PXP');
  });

  it('says nothing when there is no key to read', () => {
    expect(totpSecret('otpauth://totp/NutrIA?issuer=NutrIA')).toBeUndefined();
    expect(totpSecret('not a url')).toBeUndefined();
  });
});

describe('backupCodesFile', () => {
  it('names the account and lists one code a line', () => {
    const file = backupCodesFile(['aaaaa-11111', 'bbbbb-22222'], 'ana@example.com', esES);

    expect(file.split('\n')).toEqual([
      esES.twoFactor.fileTitle,
      'ana@example.com',
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
  it('puts a wrong code or password on its field', () => {
    expect(twoFactorRefusal('INVALID_CODE', 401, esES)).toEqual({ field: 'code', message: esES.twoFactor.wrongCode, restart: false });
    expect(twoFactorRefusal('INVALID_BACKUP_CODE', 401, enGB)).toEqual({ field: 'code', message: enGB.twoFactor.wrongBackupCode, restart: false });
    expect(twoFactorRefusal('INVALID_PASSWORD', 400, esES)).toEqual({ field: 'password', message: esES.twoFactor.wrongPassword, restart: false });
  });

  it('sends a sign-in that expired or ran out of attempts back to the password', () => {
    expect(twoFactorRefusal('INVALID_TWO_FACTOR_COOKIE', 401, esES).restart).toBe(true);
    expect(twoFactorRefusal('TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE', 401, esES).restart).toBe(true);
  });

  it('says a lock is a wait, on no field', () => {
    expect(twoFactorRefusal('ACCOUNT_TEMPORARILY_LOCKED', 401, esES)).toEqual({ field: null, message: esES.twoFactor.locked, restart: false });
  });

  it('tells a rate limit from any other failure', () => {
    expect(twoFactorRefusal(undefined, 429, esES).message).toBe(esES.auth.tooManyAttempts);
    expect(twoFactorRefusal('SOMETHING_ELSE', 500, esES).message).toBe(esES.errors.internal);
  });
});
