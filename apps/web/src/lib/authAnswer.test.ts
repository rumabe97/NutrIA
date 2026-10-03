import { describe, expect, it } from 'vitest';

import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';
import { signInRefusal, signUpOutcome } from './authAnswer';

const EMAIL = 'ana@example.invalid';

describe('signUpOutcome', () => {
  it('ends every accepted sign-up on "we have written to" the address, in both languages', () => {
    expect(signUpOutcome(null, EMAIL, esES)).toEqual({
      kind: 'sent',
      message: `Te hemos escrito a ${EMAIL}. Abre el enlace del correo para entrar.`
    });
    expect(signUpOutcome(null, EMAIL, enGB)).toEqual({
      kind: 'sent',
      message: `We have written to ${EMAIL}. Open the link in the email to sign in.`
    });
  });

  it('never says an address is taken: a 422 is the generic failure, like any other refusal', () => {
    for (const dictionary of [esES, enGB]) {
      expect(signUpOutcome({ code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', status: 422 }, EMAIL, dictionary)).toEqual({
        kind: 'refused',
        message: dictionary.auth.signUpFailed
      });
      expect(signUpOutcome({ status: 500 }, EMAIL, dictionary)).toEqual({ kind: 'refused', message: dictionary.auth.signUpFailed });
    }
  });

  it('says why a password was refused, and that a 429 is a wait', () => {
    expect(signUpOutcome({ code: 'PASSWORD_COMPROMISED', status: 400 }, EMAIL, esES)).toEqual({
      kind: 'password',
      message: esES.auth.passwordCompromised
    });
    expect(signUpOutcome({ status: 429 }, EMAIL, esES)).toEqual({ kind: 'refused', message: esES.auth.tooManyAttempts });
  });

  it('tells an iPhone user where the link opens and how the installed app then gets in', () => {
    expect(esES.auth.signUpSentInstalled).toMatch(/Safari/);
    expect(enGB.auth.signUpSentInstalled).toMatch(/Safari/);
  });
});

describe('signInRefusal', () => {
  it('answers a 401 with one message that tells an unconfirmed person what to do, and implies no account', () => {
    expect(signInRefusal(401, esES)).toBe(
      'Correo o contraseña incorrectos. Si acabas de crear la cuenta, confirma antes tu dirección: si la contraseña era la buena, te acabamos de enviar el enlace de nuevo.'
    );
    expect(signInRefusal(401, enGB)).toBe(
      'Wrong email or password. If you have just created your account, confirm your address first: if the password was right, we have just sent you the link again.'
    );

    for (const dictionary of [esES, enGB]) {
      expect(signInRefusal(401, dictionary)).not.toMatch(
        /tu cuenta existe|ya existe|your account exists|already exists|no está confirmada|not been confirmed/i
      );
    }
  });

  it('keeps a wait a wait and an outage an outage', () => {
    expect(signInRefusal(429, esES)).toBe(esES.auth.signInPaused);
    expect(signInRefusal(503, enGB)).toBe('We could not sign you in (error 503). Try again in a moment.');
  });
});
