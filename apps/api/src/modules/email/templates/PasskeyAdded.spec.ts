import { describe, expect, it } from '@jest/globals';

import { passkeyAddedEmail } from './PasskeyAdded.js';

const RECOVER = 'https://nutria.example/recuperar';
const AT = new Date('2026-10-01T13:05:00.000Z');
const IPHONE_SAFARI = { browser: 'safari', system: 'iphone' } as const;

/** The same list the password mail is held to (M14): this mail is about the account, never its contents. */
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
  return passkeyAddedEmail({ at: AT, device: IPHONE_SAFARI, locale, recoverUrl: RECOVER });
}

describe('passkeyAddedEmail', () => {
  it('says what happened in the subject, in both languages, with its own kind for the log', () => {
    expect(mail()).toMatchObject({ kind: 'passkey-added', subject: 'Has añadido una llave de acceso' });
    expect(mail('en-GB')).toMatchObject({ kind: 'passkey-added', subject: 'You added a passkey' });
  });

  it('says when, in the product’s clock, and roughly from what', () => {
    const sent = mail();

    expect(sent.text).toContain('1 de octubre de 2026 a las 15:05');
    expect(sent.text).toContain('Desde: Safari en iPhone.');
  });

  it('sends a person who did not do it to reset the password and remove the passkey, with the link in both bodies', () => {
    const sent = mail();

    expect(sent.text).toContain('restablece la contraseña ahora, entra y quita esa llave en Perfil › Seguridad');
    expect(sent.text).toContain(RECOVER);
    expect(sent.html).toContain(`href="${RECOVER}"`);
    expect(mail('en-GB').text).toContain('remove that passkey under Profile › Security');
  });

  it.each(['es-ES', 'en-GB'] as const)('says no word of health in %s (M14)', locale => {
    const sent = mail(locale);

    for (const word of HEALTH_WORDS) {
      expect(`${sent.subject}\n${sent.text}`).not.toMatch(word);
    }
  });
});
