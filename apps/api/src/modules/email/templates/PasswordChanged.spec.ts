import { describe, expect, it } from '@jest/globals';

import { deviceLabel, passwordChangedEmail } from './PasswordChanged.js';

const RECOVER = 'https://nutria.example/recuperar';
const AT = new Date('2026-10-01T13:05:00.000Z');
const IPHONE_SAFARI = { browser: 'safari', system: 'iphone' } as const;

/** The same list the care mails are held to (M14): this mail is about the account, never its contents. */
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

describe('passwordChangedEmail', () => {
  it('says when, in the product’s clock and the reader’s language', () => {
    expect(passwordChangedEmail({ at: AT, device: IPHONE_SAFARI, locale: 'es-ES', recoverUrl: RECOVER }).text).toContain(
      '1 de octubre de 2026 a las 15:05'
    );
    expect(passwordChangedEmail({ at: AT, device: IPHONE_SAFARI, locale: 'en-GB', recoverUrl: RECOVER }).text).toContain('1 October 2026');
  });

  it('says roughly from what: a browser on a system, and nothing finer', () => {
    const mail = passwordChangedEmail({ at: AT, device: IPHONE_SAFARI, locale: 'es-ES', recoverUrl: RECOVER });

    expect(mail.text).toContain('Desde: Safari en iPhone.');
    expect(mail.html).toContain('Desde: Safari en iPhone.');
  });

  it('leaves the device line out when the agent said nothing it recognises', () => {
    const mail = passwordChangedEmail({ at: AT, device: { browser: null, system: null }, locale: 'en-GB', recoverUrl: RECOVER });

    expect(mail.text).not.toContain('From:');
  });

  it('tells a person who did not do it to reset, with the /recuperar link in both bodies', () => {
    const mail = passwordChangedEmail({ at: AT, device: IPHONE_SAFARI, locale: 'es-ES', recoverUrl: RECOVER });

    expect(mail.text).toContain('Si no has sido tú, restablece tu contraseña ahora');
    expect(mail.text).toContain(RECOVER);
    expect(mail.html).toContain(`href="${RECOVER}"`);
  });

  it('says the passkeys a change or a reset removed, counted, and tells to add them again; says nothing of passkeys when none went', () => {
    const one = passwordChangedEmail({ at: AT, device: IPHONE_SAFARI, locale: 'es-ES', passkeysRemoved: 1, recoverUrl: RECOVER });
    const two = passwordChangedEmail({ at: AT, device: IPHONE_SAFARI, locale: 'en-GB', passkeysRemoved: 2, recoverUrl: RECOVER });
    const none = passwordChangedEmail({ at: AT, device: IPHONE_SAFARI, locale: 'es-ES', recoverUrl: RECOVER });

    expect(one.text).toContain(
      'Con el cambio se ha quitado la llave de acceso de la cuenta. Si era tuya, entra y añádela de nuevo en Perfil › Seguridad.'
    );
    expect(one.html).toContain('se ha quitado la llave de acceso');
    expect(two.text).toContain('The change also removed the 2 passkeys of the account.');
    expect(none.text).not.toMatch(/llave/);
  });

  it('speaks both languages, with its own kind for the log', () => {
    expect(passwordChangedEmail({ at: AT, device: IPHONE_SAFARI, locale: 'es-ES', recoverUrl: RECOVER }).subject).toBe(
      'Tu contraseña de NutrIA ha cambiado'
    );
    expect(passwordChangedEmail({ at: AT, device: IPHONE_SAFARI, locale: 'en-GB', recoverUrl: RECOVER })).toMatchObject({
      kind: 'password-changed',
      subject: 'Your NutrIA password has changed'
    });
  });

  it.each(['es-ES', 'en-GB'] as const)('says no word of health in %s (M14)', locale => {
    const mail = passwordChangedEmail({ at: AT, device: IPHONE_SAFARI, locale, recoverUrl: RECOVER });

    for (const word of HEALTH_WORDS) {
      expect(`${mail.subject}\n${mail.text}`).not.toMatch(word);
    }
  });
});

describe('deviceLabel', () => {
  it('names whichever half it has', () => {
    expect(deviceLabel({ browser: 'firefox', system: null }, 'en-GB')).toBe('Firefox');
    expect(deviceLabel({ browser: null, system: 'android' }, 'es-ES')).toBe('Android');
    expect(deviceLabel({ browser: 'chrome', system: 'windows' }, 'en-GB')).toBe('Chrome on Windows');
    expect(deviceLabel({ browser: null, system: null }, 'es-ES')).toBeNull();
  });
});
