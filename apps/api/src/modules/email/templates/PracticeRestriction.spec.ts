import { describe, expect, it } from '@jest/globals';

import { professionalClosingEmail } from './ProfessionalClosing.js';
import { professionalProfileHiddenEmail } from './ProfessionalProfileHidden.js';
import { professionalSuspendedEmail } from './ProfessionalSuspended.js';
import { professionalSuspensionLiftedEmail } from './ProfessionalSuspensionLifted.js';
import { withoutStylesheet } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';
import type { PracticeStatement } from './ProfessionalSuspended.js';

const LOCALES: readonly EmailLocale[] = ['es-ES', 'en-GB'];
const CLOSES = new Date('2026-12-19T09:00:00.000Z');

/** Words a scanned inbox must not carry about anybody's health (`docs/legal/textos/06`). */
const HEALTH_WORDS = [/salud/i, /health/i, /m[eé]dic/i, /enfermedad/i, /alerg/i, /allerg/i, /intoleran/i, /peso\b/i, /weight/i];

const STATEMENT: PracticeStatement = { authority: null, clause: 2, facts: 'Su perfil promete adelgazar', source: 'own_review' };

function everything(mail: RenderedEmail): string {
  return `${mail.subject}\n${mail.text}\n${withoutStylesheet(mail.html).replace(/<[^>]*>/g, ' ')}`;
}

const EVERY: readonly ((locale: EmailLocale) => RenderedEmail)[] = [
  locale => professionalSuspendedEmail({ locale, statement: STATEMENT }),
  locale => professionalSuspensionLiftedEmail({ facts: 'los hechos no se confirmaron', locale }),
  locale => professionalClosingEmail({ closesAt: CLOSES, locale, statement: STATEMENT, suspended: true }),
  locale => professionalProfileHiddenEmail({ afterNotice: false, facts: null, locale, reasons: ['badge_word', 'promises'], word: 'nutricionista' })
];

describe('the restriction and first-look mails (project 025 phase 6, `docs/legal/textos/06` §§ W bis and X)', () => {
  it.each(LOCALES)('carry no health word and name no client (%s) — the hiding’s «a disease» reason aside', locale => {
    for (const render of EVERY) {
      const words = everything(render(locale));

      for (const word of HEALTH_WORDS) {
        expect(words).not.toMatch(word);
      }

      expect(words).not.toMatch(/cliente [A-ZÁÉÍÓÚ]|client [A-Z]/);
    }
  });

  /*
   * § X's approved reasons include «Ofrece un servicio para una enfermedad.»: the
   * kind of service the profile offered, never anybody's condition. It is the
   * one place the word appears, and only when the owner picks that reason.
   */
  it('names a disease only as the service a profile offered, when the owner says so', () => {
    const mail = professionalProfileHiddenEmail({ afterNotice: false, facts: null, locale: 'es-ES', reasons: ['disease'], word: null });

    expect(mail.text).toContain('Por qué: Ofrece un servicio para una enfermedad. Es lo que dicen los §§ 2 y 5');
  });

  it('§ W bis.1: the suspension, its reasons, the clause read with § 13, the source and the way back — in the approved words', () => {
    const mail = professionalSuspendedEmail({ locale: 'es-ES', statement: STATEMENT });

    expect(mail.kind).toBe('professional-suspended');
    expect(mail.subject).toBe('Hemos suspendido tu cuenta como profesional en NutrIA');
    expect(mail.text).toBe(
      [
        'Desde hoy tu cuenta está suspendida como profesional: no ves los datos de ningún cliente, no puedes invitar a nadie y no puedes abrir una consulta hasta que levantemos la suspensión. Tu cuenta personal de NutrIA sigue como estaba.',
        '',
        'Por qué: Su perfil promete adelgazar. Es lo que dice el § 13 del acuerdo del profesional que aceptaste, en relación con su § 2. Lo hemos decidido nosotros, por nuestra propia revisión.',
        '',
        'Para aclarar los hechos o pedir que lo revisemos, responde a este correo: lo revisa una persona y te contesta. Si levantamos la suspensión, te lo diremos y podrás volver a abrir tu consulta. También puedes acudir a los tribunales.'
      ].join('\n')
    );
  });

  it('§ W bis.1: no clause, a notice, an authority — each the approved variant', () => {
    expect(professionalSuspendedEmail({ locale: 'es-ES', statement: { ...STATEMENT, clause: null, source: 'notice' } }).text).toContain(
      'Es lo que dice el § 13 del acuerdo del profesional que aceptaste. Lo hemos revisado tras un aviso que nos llegó.'
    );
    expect(professionalSuspendedEmail({ locale: 'en-GB', statement: { ...STATEMENT, authority: 'The AEPD', source: 'authority' } }).text).toContain(
      'read with its section 2. The AEPD requires it of us.'
    );
  });

  it('§ W bis.2: lifted, with what was found, or the first sentence alone', () => {
    expect(professionalSuspensionLiftedEmail({ facts: 'los hechos no se confirmaron.', locale: 'es-ES' }).text).toBe(
      'Desde hoy puedes volver a abrir tu consulta en NutrIA. Lo hemos revisado y los hechos no se confirmaron.'
    );
    expect(professionalSuspensionLiftedEmail({ facts: null, locale: 'en-GB' })).toMatchObject({
      subject: 'We have lifted the suspension of your account as a professional',
      text: 'From today you can open your practice on NutrIA again.'
    });
  });

  it('§ W bis.3: the day it closes, in the subject, the notice and the redress; suspended until then when it is', () => {
    const es = professionalClosingEmail({ closesAt: CLOSES, locale: 'es-ES', statement: STATEMENT, suspended: false });
    const en = professionalClosingEmail({ closesAt: CLOSES, locale: 'en-GB', statement: STATEMENT, suspended: true });

    expect(es.subject).toBe('Vamos a cerrar tu consulta en NutrIA el 19 de diciembre de 2026');
    expect(es.text).toContain(
      'El 19 de diciembre de 2026 cerraremos definitivamente tu consulta: perderás el acceso a tus clientes y tus invitaciones pendientes se anularán. Hasta esa fecha sigue como está. Tu cuenta personal de NutrIA no cambia.'
    );
    expect(es.text).toContain('Hasta el 19 de diciembre de 2026 puedes aclarar los hechos');
    expect(en.subject).toBe('We are going to close your NutrIA practice on 19 December 2026');
    expect(en.text).toContain('Until then it stays as it is, that is, suspended.');
  });

  it('§ X: the reasons in the table’s order, the word quoted, the facts after them, and the notice', () => {
    const mail = professionalProfileHiddenEmail({
      afterNotice: true,
      facts: 'También anuncia una tienda',
      locale: 'es-ES',
      reasons: ['promises', 'badge_word'],
      word: 'nutricionista'
    });

    expect(mail.kind).toBe('professional-profile-hidden');
    expect(mail.text).toContain(
      'Por qué: Usa una palabra que el acuerdo no permite sin la insignia: «nutricionista». Promete resultados. También anuncia una tienda. Es lo que dicen los §§ 2 y 5 del acuerdo del profesional que aceptaste. Lo ha visto una persona, no un programa, en la revisión que hacemos de cada perfil, después de un aviso que nos llegó.'
    );
    expect(mail.text).toContain('Edita tu perfil y volverá a la revisión');
  });

  it('keeps the owner’s words plain: no markup reaches the HTML, no line break or control character the text', () => {
    const mail = professionalSuspendedEmail({ locale: 'es-ES', statement: { ...STATEMENT, facts: 'Uno <b>dos</b>\n\ntres\u0007' } });

    expect(mail.html).not.toContain('<b>');
    expect(mail.text).toContain('Por qué: Uno b dos /b tres. Es lo que dice');
  });
});
