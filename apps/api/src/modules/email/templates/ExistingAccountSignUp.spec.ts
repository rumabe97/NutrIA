import { describe, expect, it } from '@jest/globals';

import { existingAccountSignUpEmail } from './ExistingAccountSignUp.js';

const RECOVER = 'https://nutria.example/recuperar';
const SIGN_IN = 'https://nutria.example/acceder';

/** The same list the other security mails are held to (M14): this mail is about the account, never its contents. */
const HEALTH_WORDS = [
  /salud/i,
  /health/i,
  /m[eé]dic/i,
  /enfermedad/i,
  /alerg/i,
  /allerg/i,
  /intoleran/i,
  /peso\b/i,
  /weight/i,
  /plan\b/i,
  /dieta?\b/i
];

function mail(locale: 'en-GB' | 'es-ES' = 'es-ES') {
  return existingAccountSignUpEmail({ locale, recoverUrl: RECOVER, signInUrl: SIGN_IN });
}

describe('existingAccountSignUpEmail', () => {
  it('says what happened in the subject, in both languages, with its own kind for the log', () => {
    expect(mail()).toMatchObject({ kind: 'existing-account-sign-up', subject: 'Alguien ha intentado crear una cuenta con tu correo' });
    expect(mail('en-GB')).toMatchObject({ kind: 'existing-account-sign-up', subject: 'Somebody tried to create an account with your address' });
  });

  it('sends the owner to sign in, or to reset a forgotten password, with both links in both bodies', () => {
    const sent = mail();

    expect(sent.text).toContain('Si has sido tú, no necesitas otra: entra con la que ya tienes.');
    expect(sent.text).toContain(SIGN_IN);
    expect(sent.text).toContain(RECOVER);
    expect(sent.html).toContain(`href="${SIGN_IN}"`);
    expect(sent.html).toContain(`href="${RECOVER}"`);
    expect(mail('en-GB').text).toContain('sign in with the one you have');
  });

  it('tells somebody who did not try that nothing was created and nothing of theirs changed', () => {
    expect(mail().text).toContain('no se ha creado ninguna cuenta y no ha cambiado nada de la tuya');
    expect(mail('en-GB').text).toContain('no account was created and nothing of yours changed');
  });

  it('names Google for an account that was created with it', () => {
    expect(mail().text).toContain('Si creaste la cuenta con Google, entra con Google.');
  });

  it.each(['es-ES', 'en-GB'] as const)('says no word of health in %s (M14)', locale => {
    const sent = mail(locale);

    for (const word of HEALTH_WORDS) {
      expect(`${sent.subject}\n${sent.text}`).not.toMatch(word);
    }
  });
  it('tells somebody who never made the account that a stranger may have, and that a new password lets them in', () => {
    for (const [locale, words] of [
      ['es-ES', 'puede que alguien la creara con tu dirección'],
      ['en-GB', 'somebody may have created one with your address']
    ] as const) {
      const mail = existingAccountSignUpEmail({
        locale,
        recoverUrl: 'https://nutria.example/recuperar',
        signInUrl: 'https://nutria.example/acceder'
      });

      expect(mail.text).toContain(words);
      expect(mail.html).toContain(words);
      // Before the reset link it points to.
      expect(mail.text.indexOf(words)).toBeLessThan(mail.text.indexOf('https://nutria.example/recuperar'));
    }
  });
});
