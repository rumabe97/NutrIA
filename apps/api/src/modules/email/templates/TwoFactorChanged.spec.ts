import { describe, expect, it } from '@jest/globals';

import { twoFactorChangedEmail } from './TwoFactorChanged.js';

import type { TwoFactorEvent } from './TwoFactorChanged.js';

const RECOVER = 'https://nutria.example/recuperar';
const AT = new Date('2026-10-01T13:05:00.000Z');
const IPHONE_SAFARI = { browser: 'safari', system: 'iphone' } as const;
const EVENTS: TwoFactorEvent[] = [
  { kind: 'enabled' },
  { kind: 'disabled' },
  { kind: 'backup-code-used', remaining: 4 },
  { kind: 'backup-codes-regenerated' }
];

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

function mail(event: TwoFactorEvent, locale: 'en-GB' | 'es-ES' = 'es-ES') {
  return twoFactorChangedEmail({ at: AT, device: IPHONE_SAFARI, event, locale, recoverUrl: RECOVER });
}

describe('twoFactorChangedEmail', () => {
  it('says which change in the subject, in both languages, each with its own kind for the log', () => {
    expect(mail({ kind: 'enabled' })).toMatchObject({ kind: 'two-factor-enabled', subject: 'Has activado la verificación en dos pasos' });
    expect(mail({ kind: 'disabled' })).toMatchObject({ kind: 'two-factor-disabled', subject: 'Has desactivado la verificación en dos pasos' });
    expect(mail({ kind: 'backup-code-used', remaining: 4 })).toMatchObject({
      kind: 'backup-code-used',
      subject: 'Has usado un código de respaldo (te quedan 4)'
    });
    expect(mail({ kind: 'backup-codes-regenerated' })).toMatchObject({
      kind: 'backup-codes-regenerated',
      subject: 'Has generado códigos de respaldo nuevos; los anteriores ya no sirven'
    });
    expect(mail({ kind: 'enabled' }, 'en-GB').subject).toBe('You turned on two-step verification');
    expect(mail({ kind: 'backup-code-used', remaining: 1 }, 'en-GB').subject).toBe('You used a backup code (1 left)');
  });

  it('says when, in the product’s clock, and roughly from what', () => {
    const sent = mail({ kind: 'disabled' });

    expect(sent.text).toContain('1 de octubre de 2026 a las 15:05');
    expect(sent.text).toContain('Desde: Safari en iPhone.');
  });

  it('sends a person who did not do it to reset the password, with the link in both bodies', () => {
    const sent = mail({ kind: 'enabled' });

    expect(sent.text).toContain('Si no has sido tú, alguien conoce tu contraseña');
    expect(sent.text).toContain(RECOVER);
    expect(sent.html).toContain(`href="${RECOVER}"`);
  });

  it.each(['es-ES', 'en-GB'] as const)('says no word of health in %s (M14)', locale => {
    for (const event of EVENTS) {
      const sent = mail(event, locale);

      for (const word of HEALTH_WORDS) {
        expect(`${sent.subject}\n${sent.text}`).not.toMatch(word);
      }
    }
  });
});
