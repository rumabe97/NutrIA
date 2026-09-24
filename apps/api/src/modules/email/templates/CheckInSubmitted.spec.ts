import { describe, expect, it } from '@jest/globals';

import { checkInSubmittedEmail, checkInSubmittedPush, checkInSubmittedRecord } from './CheckInSubmitted.js';

import type { EmailLocale } from './Layout.js';

const URL = 'https://nutria.example/consulta';
const LOCALES: readonly EmailLocale[] = ['es-ES', 'en-GB'];

/**
 * None of a check-in's own fields — weight, the three ratings, the free-text
 * comment — reach the professional's mail or push (PRD 004, criterion 10):
 * the function that builds them never receives that data, and this checks the
 * rendered output carries no word naming it either, in both languages.
 */
const CHECK_IN_WORDS = [
  /kcal/i,
  /kg\b/,
  /peso/i,
  /weight/i,
  /hambre/i,
  /hungr/i,
  /dificultad/i,
  /difficult/i,
  /satisfacci[oó]n/i,
  /satisfaction/i,
  /coment/i,
  /comment/i,
  /salud/i,
  /health/i
];

describe('checkInSubmittedEmail', () => {
  it.each(LOCALES)('carries the client’s name and the link, in the text and the HTML (%s)', locale => {
    const mail = checkInSubmittedEmail({ clientName: 'Lucía', locale, url: URL });

    expect(mail.subject).toContain('Lucía');
    expect(mail.text).toContain('Lucía');
    expect(mail.text).toContain(URL);
    expect(mail.html).toContain(`href="${URL}"`);
  });

  it.each(LOCALES)('carries none of the check-in’s own fields (%s)', locale => {
    const mail = checkInSubmittedEmail({ clientName: 'Lucía', locale, url: URL });
    // What a reader sees of the HTML: its text, not its inline styles.
    const visible = mail.html.replace(/<[^>]*>/g, ' ');

    for (const word of CHECK_IN_WORDS) {
      expect(`${mail.subject}\n${mail.text}\n${visible}`).not.toMatch(word);
    }
  });

  it('speaks the professional’s stored language', () => {
    expect(checkInSubmittedEmail({ clientName: 'Lucía', locale: 'es-ES', url: URL }).subject).toBe('Lucía ha hecho su check-in');
    expect(checkInSubmittedEmail({ clientName: 'Lucía', locale: 'en-GB', url: URL }).subject).toBe('Lucía has checked in');
    expect(checkInSubmittedEmail({ clientName: 'Lucía', locale: 'en-GB', url: URL }).html).toContain('lang="en"');
  });

  it('escapes a name that carries markup, and keeps a name to one line in the subject', () => {
    const mail = checkInSubmittedEmail({ clientName: '<b>Lucía</b>\r\nBcc: x@example.com', locale: 'es-ES', url: URL });

    expect(mail.html).not.toContain('<b>Lucía</b>');
    expect(mail.html).toContain('&lt;b&gt;Lucía&lt;/b&gt;');
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });
});

describe('checkInSubmittedPush', () => {
  it.each(LOCALES)('carries the client’s name and none of the check-in’s own fields (%s)', locale => {
    const push = checkInSubmittedPush(locale, 'Lucía');

    expect(push.title).toContain('Lucía');

    for (const word of CHECK_IN_WORDS) {
      expect(`${push.title}\n${push.body}`).not.toMatch(word);
    }
  });
});

describe('checkInSubmittedRecord', () => {
  it.each(LOCALES)('is the mail’s own words, kept for the notifications row, with none of the check-in’s fields (%s)', locale => {
    const record = checkInSubmittedRecord(locale, 'Lucía');
    const mail = checkInSubmittedEmail({ clientName: 'Lucía', locale, url: URL });

    expect(record.title).toBe(mail.subject);

    for (const word of CHECK_IN_WORDS) {
      expect(`${record.title}\n${record.body}`).not.toMatch(word);
    }
  });
});
