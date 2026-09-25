import { describe, expect, it } from '@jest/globals';

import { careInvitationEmail } from './CareInvitation.js';

import type { EmailLocale } from './Layout.js';

const URL = 'https://nutria.example/invitacion/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';
const PRIVACY = 'https://nutria.example/privacidad';
const LOCALES: readonly EmailLocale[] = ['es-ES', 'en-GB'];

/**
 * No health word, in either language (`0059`, Phase 2 step 5): the mail sits in
 * an inbox a provider scans. Checked against every part a client could show —
 * subject, text and HTML.
 */
const HEALTH_WORDS = [
  /salud/i,
  /health/i,
  /m[eé]dic/i,
  /enfermedad/i,
  /condici[oó]n/i,
  /condition/i,
  /diagn/i,
  /alerg/i,
  /allerg/i,
  /intoleran/i,
  /suplement/i,
  /supplement/i,
  /peso/i,
  /weight/i,
  /pacient/i,
  /patient/i
];

describe('careInvitationEmail', () => {
  it.each(LOCALES)('says who invites and carries the link, in the text and the HTML (%s)', locale => {
    const mail = careInvitationEmail({ inviterName: 'Ana Dietista', locale, privacyUrl: PRIVACY, url: URL });

    expect(mail.subject).toContain('Ana Dietista');
    expect(mail.text).toContain('Ana Dietista');
    expect(mail.text).toContain(URL);
    expect(mail.html).toContain(`href="${URL}"`);
  });

  it.each(LOCALES)('carries no health word (%s)', locale => {
    const mail = careInvitationEmail({ inviterName: 'Ana Dietista', locale, privacyUrl: PRIVACY, url: URL });
    // What a reader sees of the HTML: its text, not its inline styles (`font-weight`).
    const visible = mail.html.replace(/<[^>]*>/g, ' ');

    for (const word of HEALTH_WORDS) {
      expect(`${mail.subject}\n${mail.text}\n${visible}`).not.toMatch(word);
    }
  });

  it('speaks the inviter’s language', () => {
    expect(careInvitationEmail({ inviterName: 'Ana', locale: 'es-ES', privacyUrl: PRIVACY, url: URL }).subject).toBe('Ana te ha invitado a NutrIA');
    expect(careInvitationEmail({ inviterName: 'Ana', locale: 'en-GB', privacyUrl: PRIVACY, url: URL }).subject).toBe('Ana has invited you to NutrIA');
    expect(careInvitationEmail({ inviterName: 'Ana', locale: 'en-GB', privacyUrl: PRIVACY, url: URL }).html).toContain('lang="en"');
  });

  it('says it expires, that nothing is shared without a yes, and how to answer without an account', () => {
    const mail = careInvitationEmail({ inviterName: 'Ana', locale: 'es-ES', privacyUrl: PRIVACY, url: URL });

    expect(mail.text).toContain('14 días');
    expect(mail.text).toContain('no se comparte nada si no aceptas');
    expect(mail.text).toContain('créala con esta dirección');
  });

  it('escapes a name that carries markup, and keeps a name to one line in the subject', () => {
    const mail = careInvitationEmail({ inviterName: '<b>Ana</b>\r\nBcc: x@example.com', locale: 'es-ES', privacyUrl: PRIVACY, url: URL });

    expect(mail.html).not.toContain('<b>Ana</b>');
    expect(mail.html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  /* RGPD art. 14 (`docs/legal/textos/06` § A): the address came from somebody else, so the mail says who, for how long, and where the rights are. */
  it.each([
    ['es-ES', 'Te escribimos porque Ana nos ha dado tu dirección para invitarte', '14 días como máximo'],
    ['en-GB', 'We are writing because Ana gave us your address to invite you', '14 days at most']
  ] as const)('says where the address came from, how long it is kept and where the rights are (%s)', (locale, source, term) => {
    const mail = careInvitationEmail({ inviterName: 'Ana', locale, privacyUrl: PRIVACY, url: URL });

    for (const part of [mail.text, mail.html]) {
      expect(part).toContain(source);
      expect(part).toContain(term);
      expect(part).toContain(PRIVACY);
    }
  });

  it('says the exact list comes before accepting', () => {
    expect(careInvitationEmail({ inviterName: 'Ana', locale: 'es-ES', privacyUrl: PRIVACY, url: URL }).text).toContain(
      'Antes de aceptar verás la lista exacta.'
    );
  });
});
