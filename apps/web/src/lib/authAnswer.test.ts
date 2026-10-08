import { describe, expect, it } from 'vitest';

import { arriveAtSent, signInRefusal, signUpOutcome } from './authAnswer';
import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';

const EMAIL = 'ana@example.invalid';

describe('signUpOutcome', () => {
  it('ends every accepted sign-up on the same conditional "an email will reach you", in both languages', () => {
    expect(signUpOutcome(null, EMAIL, esES)).toEqual({
      kind: 'sent',
      message: `Si ${EMAIL} es correcta, te llegará un correo en unos minutos. Abre el enlace, confirma tu correo y luego inicia sesión.`
    });
    expect(signUpOutcome(null, EMAIL, enGB)).toEqual({
      kind: 'sent',
      message: `If ${EMAIL} is right, an email will reach you in a few minutes. Open the link, confirm your email, then sign in.`
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
    expect(signInRefusal(401, esES).message).toBe(
      'Correo o contraseña incorrectos. Si aún no has confirmado tu dirección y la contraseña era la buena, te enviamos el enlace de nuevo (como mucho tres veces por hora; mira también en el correo no deseado).'
    );
    expect(signInRefusal(401, enGB).message).toBe(
      'Wrong email or password. If you have not confirmed your address yet and the password was right, we send you the link again (at most three times an hour; check your spam folder too).'
    );

    for (const dictionary of [esES, enGB]) {
      expect(signInRefusal(401, dictionary).message).not.toMatch(
        /tu cuenta existe|ya existe|tu cuenta no|your account exists|already exists|your account is|no está confirmada|has not been confirmed|te hemos enviado|we have sent/i
      );
    }
  });

  it('keeps a wait a wait and an outage an outage', () => {
    expect(signInRefusal(429, esES)).toEqual({ message: esES.auth.signInPaused, where: 'alert' });
    expect(signInRefusal(503, enGB)).toEqual({ message: 'We could not sign you in (error 503). Try again in a moment.', where: 'alert' });
  });
});

describe('signInRefusal — where', () => {
  it('puts a 401 on the password field, and nothing else there', () => {
    expect(signInRefusal(401, esES).where).toBe('password');
    expect(signInRefusal(429, esES).where).toBe('alert');
    expect(signInRefusal(500, esES).where).toBe('alert');
  });
});

describe('arriveAtSent', () => {
  it('focuses the heading and titles the tab, and puts the old title back on the way out', () => {
    const page = { title: 'Crea tu cuenta · NutrIA' };
    let focused = 0;
    const heading = {
      focus: () => {
        focused += 1;
      }
    };

    const leave = arriveAtSent(heading, esES.auth.checkEmail, page);

    expect(focused).toBe(1);
    expect(page.title).toBe('Revisa tu correo · NutrIA');

    leave();
    expect(page.title).toBe('Crea tu cuenta · NutrIA');
  });

  it('still titles the tab when the heading is not there yet', () => {
    const page = { title: '' };

    arriveAtSent(null, enGB.auth.checkEmail, page);

    expect(page.title).toBe('Check your email · NutrIA');
  });
});
