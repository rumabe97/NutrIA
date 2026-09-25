import { describe, expect, it } from '@jest/globals';

import { professionalGrantedEmail } from './ProfessionalGranted.js';

import type { EmailLocale } from './Layout.js';

const URL = 'https://nutria.example/consulta';
const LOCALES: readonly EmailLocale[] = ['es-ES', 'en-GB'];

/** Words a scanned inbox must not carry about anybody's health (`docs/legal/textos/06`). */
const HEALTH_WORDS = [/salud/i, /health/i, /m[eé]dic/i, /enfermedad/i, /alerg/i, /allerg/i, /intoleran/i, /peso\b/i, /weight/i];

describe('professionalGrantedEmail', () => {
  it.each(LOCALES)('names the number granted, the agreement before any data, and carries the link (%s)', locale => {
    const mail = professionalGrantedEmail({ collegiateNumber: '28/12345', locale, url: URL });

    expect(mail.kind).toBe('professional-granted');
    expect(mail.text).toContain('28/12345');
    expect(mail.text).toContain(URL);
    expect(mail.html).toContain(`href="${URL}"`);
  });

  it('speaks the professional’s language, in the words of textos/06 § B', () => {
    const es = professionalGrantedEmail({ collegiateNumber: 'MAD00123', locale: 'es-ES', url: URL });
    const en = professionalGrantedEmail({ collegiateNumber: 'MAD00123', locale: 'en-GB', url: URL });

    expect(es.subject).toBe('Tu consulta en NutrIA está lista');
    expect(es.text).toContain('te pediremos que aceptes el acuerdo del profesional');
    expect(es.text).toContain('Si no has pedido esto, respóndenos y lo retiramos.');
    expect(en.subject).toBe('Your NutrIA practice is ready');
    expect(en.html).toContain('lang="en"');
  });

  it.each(LOCALES)('carries no health word (%s)', locale => {
    const mail = professionalGrantedEmail({ collegiateNumber: 'MAD00123', locale, url: URL });
    const visible = mail.html.replace(/<[^>]*>/g, ' ');

    for (const word of HEALTH_WORDS) {
      expect(`${mail.subject}\n${mail.text}\n${visible}`).not.toMatch(word);
    }
  });
});
