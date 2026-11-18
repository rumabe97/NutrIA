import { describe, expect, it } from '@jest/globals';

import { ownerAlertEmail } from './OwnerAlert.js';
import { professionalBadgeCodeEmail } from './ProfessionalBadgeCode.js';
import { professionalBadgeDueEmail } from './ProfessionalBadgeDue.js';
import { professionalBadgeLapsedEmail } from './ProfessionalBadgeLapsed.js';
import { professionalBadgeRemovedEmail } from './ProfessionalBadgeRemoved.js';
import { withoutStylesheet } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

const LOCALES: readonly EmailLocale[] = ['es-ES', 'en-GB'];
const PRIVACY = 'https://nutria.example/privacidad#tu-profesional';
const AT = new Date('2026-11-18T09:00:00.000Z');
const LATER = new Date('2026-12-18T09:00:00.000Z');

/** Words a scanned inbox must not carry about anybody's health (`docs/legal/textos/06`). */
const HEALTH_WORDS = [/salud/i, /health/i, /m[eé]dic/i, /enfermedad/i, /alerg/i, /allerg/i, /intoleran/i, /peso\b/i, /weight/i];

function everything(mail: RenderedEmail): string {
  return `${mail.subject}\n${mail.text}\n${withoutStylesheet(mail.html).replace(/<[^>]*>/g, ' ')}`;
}

function code(locale: EmailLocale): RenderedEmail {
  return professionalBadgeCodeEmail({
    code: 'ABCDE-FGHJK',
    expires: LATER,
    locale,
    number: 'MAD00123',
    privacyUrl: PRIVACY,
    register: 'Colegio de Madrid',
    registerName: 'Ana Pérez García'
  });
}

const EVERY: readonly ((locale: EmailLocale) => RenderedEmail)[] = [
  code,
  locale => professionalBadgeDueEmail({ lapsesAt: LATER, locale, register: 'Colegio de Madrid' }),
  locale => professionalBadgeLapsedEmail({ detail: 'our_delay', dueAt: AT, locale }),
  locale =>
    professionalBadgeRemovedEmail({
      checkedOn: AT,
      facts: null,
      kind: 'withdrawn',
      locale,
      number: 'MAD00123',
      reason: 'not_on_register',
      register: 'Colegio de Madrid',
      source: 'own_check'
    })
];

describe('the badge’s mails (project 025, `docs/legal/textos/06` §§ R–W)', () => {
  it.each(LOCALES)('carry no health word and name no client (%s)', locale => {
    for (const render of EVERY) {
      const words = everything(render(locale));

      for (const word of HEALTH_WORDS) {
        expect(words).not.toMatch(word);
      }

      expect(words).not.toMatch(/cliente [A-ZÁÉÍÓÚ]|client [A-Z]/);
    }
  });

  it('§ R: the code, where the address came from, why, what is kept, the way out and the policy — in the approved words', () => {
    const mail = code('es-ES');

    expect(mail.kind).toBe('professional-badge-code');
    expect(mail.subject).toBe('Tu código para comprobar tu colegiación en NutrIA');
    expect(mail.text).toContain(
      'Una cuenta de NutrIA ha pedido nuestra insignia de dietista-nutricionista colegiada/o con este nombre y este número: Ana Pérez García, número MAD00123, de Colegio de Madrid.'
    );
    expect(mail.text).toContain('introduce este código: ABCDE-FGHJK. Caduca el 18 de diciembre de 2026.');
    expect(mail.text).toContain('Si no has sido tú, no hagas nada con el código y respóndenos a este correo');
    expect(mail.text).toContain('Hemos sacado esta dirección del registro público de colegiados de Colegio de Madrid');
    expect(mail.text).toContain('la copia de este correo en nuestro buzón la borramos cuando caduca el código');
    expect(mail.text).toContain(`Agencia Española de Protección de Datos: ${PRIVACY}`);
    expect(mail.html).toContain('<strong>ABCDE-FGHJK</strong>');
  });

  it('§ R: a name or a college typed with a placeholder in it stays text', () => {
    const mail = professionalBadgeCodeEmail({
      code: 'ABCDE-FGHJK',
      expires: LATER,
      locale: 'es-ES',
      number: 'MAD00123',
      privacyUrl: PRIVACY,
      register: '{code}',
      registerName: '<b>{privacyUrl}</b>'
    });

    expect(mail.text).toContain('<b>{privacyUrl}</b>, número MAD00123, de {code}.');
    expect(mail.html).not.toContain('<b>{privacyUrl}</b>');
  });

  it('§ U.2: once due, nothing to do unless a code arrives, and the lapse date even when the delay is ours', () => {
    const mail = professionalBadgeDueEmail({ lapsesAt: LATER, locale: 'es-ES', register: null });

    expect(mail.kind).toBe('professional-badge-due');
    expect(mail.subject).toBe('Toca comprobar tu insignia de NutrIA');
    expect(mail.text).toContain('Vamos a volver a mirar el registro de tu colegio.');
    expect(mail.text).toContain('Si el 18 de diciembre de 2026 no lo hemos completado, tu insignia caducará, aunque el retraso sea nuestro');
  });

  it.each([
    ['code_not_entered', 'Te enviamos un código y no llegó a introducirse.'],
    ['our_delay', 'El retraso ha sido nuestro: no llegamos a hacerla a tiempo.']
  ] as const)('§ V: the lapse says why — %s — and never whether a link ended', (detail, sentence) => {
    const mail = professionalBadgeLapsedEmail({ detail, dueAt: AT, locale: 'es-ES' });

    expect(mail.kind).toBe('professional-badge-lapsed');
    expect(mail.subject).toBe('Tu insignia de NutrIA ha caducado');
    expect(mail.text).toContain(`la comprobación anual vencía el 18 de noviembre de 2026 y, 30 días después, no la habíamos completado. ${sentence}`);
    expect(mail.text).toContain('Puedes volver a pedir la insignia desde tu consulta cuando quieras.');
    expect(mail.text).not.toMatch(/enlace|link/i);
  });

  it('§ W: a refusal says «no te damos», with the closed reason, the owner’s facts and the source', () => {
    const mail = professionalBadgeRemovedEmail({
      checkedOn: AT,
      facts: 'Lo confirmó por teléfono.',
      kind: 'fail',
      locale: 'es-ES',
      number: 'MAD00123',
      reason: 'not_me',
      register: 'Colegio de Madrid',
      source: 'notice'
    });

    expect(mail.kind).toBe('professional-badge-removed');
    expect(mail.subject).toBe('Sobre tu insignia de NutrIA');
    expect(mail.text).toContain('No te damos la insignia «Dietista-nutricionista colegiada/o». Tu consulta sigue abierta como hasta ahora.');
    expect(mail.text).toContain(
      'Por qué: La persona que figura en el registro con ese número nos ha dicho que no ha pedido la insignia. Lo confirmó por teléfono. Es lo que dice el § 4'
    );
    expect(mail.text).toContain('Lo hemos revisado tras un aviso que nos llegó.');
    expect(mail.text).toContain('Puedes pedir la insignia de nuevo desde tu consulta');
  });

  it('§ W: other reasons are the owner’s facts alone', () => {
    const mail = professionalBadgeRemovedEmail({
      checkedOn: AT,
      facts: 'Has usado «dietista» sin la insignia.',
      kind: 'withdrawn',
      locale: 'en-GB',
      number: null,
      reason: 'other',
      register: null,
      source: 'own_check'
    });

    expect(mail.text).toContain('Why: Has usado «dietista» sin la insignia. That is what section 4');
    expect(mail.text).toContain('We are removing the "Registered dietitian-nutritionist" badge from today.');
  });
});

describe('the owner’s badge alert (§ U.1, choice C8)', () => {
  it('carries the counts and the console’s link, and no address', () => {
    const mail = ownerAlertEmail({ alert: { due: 3, soon: 1, type: 'badges-due' }, link: path => `https://nutria.example${path}` });

    expect(mail.kind).toBe('owner-alert');
    expect(mail.subject).toBe('NutrIA: 3 insignias por volver a comprobar');
    expect(mail.text).toContain('Hoy vencen o están vencidas 3 insignias: 1 caducan en los próximos 7 días si no las compruebas.');
    expect(mail.text).toContain('https://nutria.example/admin/profesionales');
    expect(everything(mail)).not.toContain('@');
    expect(mail.text.endsWith('https://nutria.example/admin/profesionales')).toBe(true);
  });
});
