import { describe, expect, it } from '@jest/globals';

import { twoFactorRemovalEmail } from './TwoFactorRemoval.js';

import type { TwoFactorRemovalEvent } from './TwoFactorRemoval.js';

const SIGN_IN = 'https://nutria.example/acceder';
const DUE = new Date('2026-10-03T17:05:00.000Z');
const EVENTS: TwoFactorRemovalEvent[] = [{ dueAt: DUE, kind: 'requested' }, { kind: 'cancelled' }, { kind: 'removed' }];

/** The same list the other account mails are held to (M14): this mail is about the account, never its contents. */
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

function mail(event: TwoFactorRemovalEvent, locale: 'en-GB' | 'es-ES' = 'es-ES') {
  return twoFactorRemovalEmail({ event, locale, signInUrl: SIGN_IN });
}

/* PLAN 011 phase 4: the owner's removal of a lost second factor, told to the account's own address. */
describe('twoFactorRemovalEmail', () => {
  it('names each step in the subject, in both languages, each with its own kind for the log', () => {
    expect(mail({ dueAt: DUE, kind: 'requested' })).toMatchObject({
      kind: 'two-factor-removal-requested',
      subject: 'Petición para quitar tu verificación en dos pasos'
    });
    expect(mail({ kind: 'cancelled' })).toMatchObject({
      kind: 'two-factor-removal-cancelled',
      subject: 'Se ha cancelado la petición para quitar tu verificación en dos pasos'
    });
    expect(mail({ kind: 'removed' })).toMatchObject({ kind: 'two-factor-removed', subject: 'Hemos quitado tu verificación en dos pasos' });
    expect(mail({ kind: 'removed' }, 'en-GB').subject).toBe('We have removed your two-step verification');
  });

  it('says from when, in the product’s clock, and that the daily run may take up to a day more', () => {
    const sent = mail({ dueAt: DUE, kind: 'requested' });

    expect(sent.text).toContain('a partir del 3 de octubre de 2026');
    expect(sent.text).toContain('19:05 (hora de Madrid), como mucho un día después');
    expect(mail({ dueAt: DUE, kind: 'requested' }, 'en-GB').text).toContain('at the latest one day later');
  });

  it('tells a person who did not ask that signing in with a code cancels it, with the link in both bodies', () => {
    const sent = mail({ dueAt: DUE, kind: 'requested' });

    expect(sent.text).toContain('entra con un código de tu app de autenticación o un código de respaldo: así se cancela la petición');
    expect(sent.text).toContain(SIGN_IN);
    expect(sent.html).toContain(`href="${SIGN_IN}"`);
  });

  it.each(EVENTS)('carries no word of health, no address and no sign of who asked (%o)', event => {
    for (const locale of ['es-ES', 'en-GB'] as const) {
      const sent = mail(event, locale);
      const words = `${sent.subject}\n${sent.text}`;
      const all = `${words}\n${sent.html}`;

      // The words a person reads; the HTML's own `font-weight` is not one.
      for (const word of HEALTH_WORDS) {
        expect(words).not.toMatch(word);
      }

      expect(all).not.toMatch(/@/);
      expect(all).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
    }
  });
});
