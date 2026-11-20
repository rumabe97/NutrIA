import { describe, expect, it } from '@jest/globals';

import { madridMidnight } from 'core/domain/Period';

import { termsChangeNoticeEmail } from './TermsChangeNotice.js';
import { withoutStylesheet } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

const LOCALES: readonly EmailLocale[] = ['es-ES', 'en-GB'];
const DAY = madridMidnight('2026-12-01');
const LINKS: Record<EmailLocale, { privacyUrl: string; termsUrl: string }> = {
  'en-GB': { privacyUrl: 'https://nutria.example/en/privacidad#tu-profesional', termsUrl: 'https://nutria.example/en/condiciones' },
  'es-ES': { privacyUrl: 'https://nutria.example/privacidad#tu-profesional', termsUrl: 'https://nutria.example/condiciones' }
};

/** Words a scanned inbox must not carry about anybody's health (`docs/legal/textos/06`). */
const HEALTH_WORDS = [/salud/i, /health/i, /m[eé]dic/i, /enfermedad/i, /alerg/i, /allerg/i, /intoleran/i, /peso\b/i, /weight/i];

function render(locale: EmailLocale): RenderedEmail {
  return termsChangeNoticeEmail({ effectiveOn: DAY, email: 'hola@nutria.example', locale, ...LINKS[locale] });
}

function everything(mail: RenderedEmail): string {
  return `${mail.subject}\n${mail.text}\n${withoutStylesheet(mail.html).replace(/<[^>]*>/g, ' ')}`;
}

/* `docs/legal/textos/06-correos.md` § Z, approved: the change notice before the `professional` switch. */
describe('the change notice (project 025 phase 10, § Z)', () => {
  it('says the approved words in Spanish, byte for byte, with the day and the links filled in', () => {
    const mail = render('es-ES');

    expect(mail.kind).toBe('terms-change-notice');
    expect(mail.subject).toBe('Cambian la política de privacidad y las condiciones de NutrIA');
    expect(mail.text).toBe(
      [
        'A partir del 1 de diciembre de 2026, cualquier persona mayor de edad podrá abrir una consulta en NutrIA y hacer el plan de comidas de quien la invite a ello. Si no trabajas con ningún profesional, para ti no cambia nada.',
        '',
        'Solo quien lleve nuestra insignia «Dietista-nutricionista colegiada/o» es alguien a quien hemos comprobado en el registro de su colegio. Un profesional sin ella verá de ti los planes que te haga y en qué punto están, nunca tu peso, tus objetivos, tu salud ni tus alergias, y antes de aceptar su invitación verás exactamente qué verá. Si tienes anotada una condición de salud o una medicación, solo podrás vincularte con un profesional con la insignia. Y estar vinculado a un profesional no da Premium.',
        '',
        'Los detalles están en https://nutria.example/privacidad#tu-profesional, en «Tu profesional en NutrIA», y en https://nutria.example/condiciones. Si tienes cualquier duda, escríbenos a hola@nutria.example. Si no estás de acuerdo, puedes borrar tu cuenta desde tu perfil.'
      ].join('\n')
    );
  });

  it('says the approved words in English, byte for byte, with the English pages', () => {
    const mail = render('en-GB');

    expect(mail.subject).toBe("NutrIA's privacy policy and terms are changing");
    expect(mail.text).toBe(
      [
        'From 1 December 2026, any adult will be able to open a practice on NutrIA and make the meal plan of whoever invites them to. If you do not work with a professional, nothing changes for you.',
        '',
        'Only someone with our "Registered dietitian-nutritionist" badge is a person we have checked on their college\'s register. A professional without it will see of you the plans they make for you and where they stand, never your weight, your targets, your health or your allergies, and before you accept their invitation you will see exactly what they will see. If you have a health condition or a medication on record, you will only be able to link with a professional who holds the badge. And being linked to a professional does not give you Premium.',
        '',
        'The details are at https://nutria.example/en/privacidad#tu-profesional, under "Your professional on NutrIA", and at https://nutria.example/en/condiciones. If you have any question, write to us at hola@nutria.example. If you do not agree, you can delete your account from your profile.'
      ].join('\n')
    );
  });

  it('writes the day as Madrid’s calendar has it, whatever the server’s clock zone', () => {
    expect(render('es-ES').text).toContain('A partir del 1 de diciembre de 2026,');
    expect(render('en-GB').text).toContain('From 1 December 2026,');
  });

  /*
   * § Z's own exception: the middle paragraph names, generically, what a
   * professional without the badge never sees and what the rule protects. Every
   * health word of the mail is in that one approved paragraph; the rest carries
   * none, and nothing names a client or the reader.
   */
  it.each(LOCALES)('carries health words only in § Z’s approved generic paragraph, and names no client (%s)', locale => {
    const mail = render(locale);
    const [intro, , what, , choose] = mail.text.split('\n');

    for (const word of HEALTH_WORDS) {
      expect(`${mail.subject}\n${intro ?? ''}\n${choose ?? ''}`).not.toMatch(word);
    }

    expect(HEALTH_WORDS.some(word => word.test(what ?? ''))).toBe(true);
    expect(everything(mail)).not.toMatch(/cliente [A-ZÁÉÍÓÚ]|client [A-Z]/);
  });

  it.each(LOCALES)('escapes the links in the HTML part and keeps them whole (%s)', locale => {
    const mail = render(locale);

    expect(mail.html).toContain(LINKS[locale].privacyUrl);
    expect(mail.html).toContain(LINKS[locale].termsUrl);
  });
});
