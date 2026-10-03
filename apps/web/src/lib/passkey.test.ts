import { describe, expect, it } from 'vitest';

import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';
import { passkeyAddRefusal, passkeySignInRefusal } from './passkey';

describe('passkeySignInRefusal', () => {
  it('says nothing when the prompt was closed, aborted or never finished', () => {
    for (const code of ['AUTH_CANCELLED', 'ERROR_CEREMONY_ABORTED', 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY']) {
      expect(passkeySignInRefusal({ code, status: 400 }, esES)).toBeUndefined();
    }
  });

  it('says one sentence for every refusal, so a known key and an unknown one read alike', () => {
    for (const code of ['PASSKEY_NOT_FOUND', 'AUTHENTICATION_FAILED', 'CHALLENGE_NOT_FOUND', undefined]) {
      expect(passkeySignInRefusal({ code, status: 400 }, esES)).toBe(esES.passkeys.signInFailed);
    }

    expect(passkeySignInRefusal({ code: 'PASSKEY_NOT_FOUND', status: 401 }, enGB)).toBe(enGB.passkeys.signInFailed);
  });

  it('turns the rate limit into a wait', () => {
    expect(passkeySignInRefusal({ status: 429 }, esES)).toBe(esES.auth.tooManyAttempts);
  });
});

describe('passkeyAddRefusal', () => {
  it('says nothing when the prompt was closed', () => {
    expect(passkeyAddRefusal({ code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY', status: 400 }, esES)).toEqual({ kind: 'cancelled' });
    expect(passkeyAddRefusal({ code: 'ERROR_CEREMONY_ABORTED', status: 400 }, esES)).toEqual({ kind: 'cancelled' });
  });

  it('puts a wrong password on the field', () => {
    expect(passkeyAddRefusal({ code: 'INVALID_PASSWORD', status: 400 }, esES)).toEqual({ kind: 'password', message: esES.twoFactor.wrongPassword });
  });

  it('asks for the password again once its confirmation has lapsed', () => {
    expect(passkeyAddRefusal({ code: 'PASSWORD_CONFIRMATION_REQUIRED', status: 403 }, esES)).toEqual({
      kind: 'password',
      message: esES.passkeys.confirmAgain
    });
  });

  it('asks for a fresh sign-in when the session is too old', () => {
    expect(passkeyAddRefusal({ code: 'SESSION_NOT_FRESH', status: 403 }, esES)).toEqual({ kind: 'stale' });
  });

  it('asks for the address to be confirmed first, in either language', () => {
    expect(passkeyAddRefusal({ code: 'EMAIL_CONFIRMATION_REQUIRED', status: 403 }, esES)).toEqual({
      kind: 'failed',
      message: 'Confirma tu dirección de correo antes de añadir una llave de acceso: abre el enlace que te enviamos al crear la cuenta.'
    });
    expect(passkeyAddRefusal({ code: 'EMAIL_CONFIRMATION_REQUIRED', status: 403 }, enGB)).toEqual({
      kind: 'failed',
      message: enGB.passkeys.emailUnconfirmed
    });
  });

  it('says this device already holds one when the browser says so', () => {
    expect(passkeyAddRefusal({ code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED', status: 400 }, esES)).toEqual({
      kind: 'failed',
      message: esES.passkeys.alreadyAdded
    });
  });

  it('says one generic sentence for every other refusal, and a wait for the rate limit', () => {
    for (const code of ['CHALLENGE_NOT_FOUND', 'FAILED_TO_VERIFY_REGISTRATION', 'UNKNOWN_ERROR', undefined]) {
      expect(passkeyAddRefusal({ code, status: 400 }, enGB)).toEqual({ kind: 'failed', message: enGB.passkeys.addFailed });
    }

    expect(passkeyAddRefusal({ status: 429 }, esES)).toEqual({ kind: 'failed', message: esES.auth.tooManyAttempts });
  });
});
