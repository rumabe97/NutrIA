import { describe, expect, it } from '@jest/globals';

import { careLinkEndedByRuleEmail } from './CareLinkEndedByRule.js';
import { withoutStylesheet } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

const URL = 'https://nutria.example/es/perfil';

/** Words a scanned inbox must not carry about anybody's health (`docs/legal/textos/06`), the rule's own included. */
const HEALTH_WORDS = [
  /salud/i,
  /health/i,
  /m[eé]dic/i,
  /enfermedad/i,
  /condici[oó]n/i,
  /condition/i,
  /embarazo/i,
  /pregnan/i,
  /lactancia/i,
  /breastfeed/i,
  /insignia/i,
  /badge/i,
  /verific/i,
  /alerg/i,
  /allerg/i
];

function everything(mail: RenderedEmail): string {
  return `${mail.subject}\n${mail.text}\n${withoutStylesheet(mail.html).replace(/<[^>]*>/g, ' ')}`;
}

/*
 * `docs/legal/textos/06` § Y (project 025 phase 5): the client's notice when the
 * daily sweep ends their link under the illness rule. Its words are the approved
 * ones, byte for byte, and no word of health — nor of the badge, which would say
 * why on a lock screen.
 */
describe('careLinkEndedByRuleEmail', () => {
  it('says what § Y says, in Spanish', () => {
    const mail = careLinkEndedByRuleEmail({ locale: 'es-ES', professionalName: 'Ana Pérez', url: URL });

    expect(mail.kind).toBe('care-link-ended-by-rule');
    expect(mail.subject).toBe('Tu enlace con Ana Pérez en NutrIA ha terminado');
    expect(mail.text).toBe(
      `Tu enlace con Ana Pérez ha terminado hoy. Tu plan, tus objetivos y tu historial se quedan contigo. Entra en NutrIA para ver por qué: te lo explicamos en tu perfil.\n\n${URL}`
    );
    expect(mail.html).toContain('Abrir mi perfil');
    expect(mail.html).toContain(URL);
  });

  it('says what § Y says, in English', () => {
    const mail = careLinkEndedByRuleEmail({ locale: 'en-GB', professionalName: 'Ana Pérez', url: URL });

    expect(mail.subject).toBe('Your link with Ana Pérez on NutrIA has ended');
    expect(mail.text.split('\n')[0]).toBe(
      'Your link with Ana Pérez ended today. Your plan, your targets and your history stay with you. Sign in to NutrIA to see why: we explain it on your profile.'
    );
    expect(mail.html).toContain('Open my profile');
  });

  it.each<EmailLocale>(['es-ES', 'en-GB'])('carries no word of health, nor of the badge (%s)', locale => {
    const text = everything(careLinkEndedByRuleEmail({ locale, professionalName: 'Ana', url: URL }));

    for (const word of HEALTH_WORDS) {
      expect(text).not.toMatch(word);
    }
  });

  it('keeps a name to one line in the subject, and escapes it in the HTML', () => {
    const mail = careLinkEndedByRuleEmail({ locale: 'es-ES', professionalName: 'Ana\r\nBcc: x@y <b>', url: URL });

    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.html).not.toContain('<b>');
  });
});
