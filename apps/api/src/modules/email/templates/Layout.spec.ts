import { describe, expect, it } from '@jest/globals';

import { accountWaitingEmail } from './AccountWaiting.js';
import { checkInReminderEmail } from './CheckInReminder.js';
import { passwordResetEmail } from './PasswordReset.js';
import { verifyEmail } from './VerifyEmail.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

const URL = 'https://nutria.example/check-in';

/**
 * Every message the product sends, in every language it sends them in.
 *
 * The two things asserted here are the ones no single template can be trusted
 * to keep on its own: a client picks the reading direction, the hyphenation and
 * the voice a screen reader uses from `<html lang>`, and a client that shows
 * only plain text — or an inbox drawing a preview line — shows the twin. Both
 * are cheap, both are invisible when they rot, so they are checked centrally
 * and a new template has to be added here.
 */
const TEMPLATES: readonly { readonly name: string; readonly render: (locale: EmailLocale) => RenderedEmail }[] = [
  { name: 'accountWaitingEmail', render: locale => accountWaitingEmail({ email: 'ana@example.invalid', locale, url: URL }) },
  { name: 'checkInReminderEmail', render: locale => checkInReminderEmail({ locale, url: URL }) },
  { name: 'passwordResetEmail', render: locale => passwordResetEmail({ locale, url: URL }) },
  { name: 'verifyEmail', render: locale => verifyEmail({ locale, url: URL }) }
];

const LANGUAGE: Record<EmailLocale, string> = { 'en-GB': 'en', 'es-ES': 'es' };

describe.each(TEMPLATES)('$name', ({ render }) => {
  it.each(['es-ES', 'en-GB'] as const)('declares the language of its own copy in %s', locale => {
    expect(render(locale).html).toContain(`<html lang="${LANGUAGE[locale]}">`);
  });

  it.each(['es-ES', 'en-GB'] as const)('travels with a plain-text twin carrying the link in %s', locale => {
    const mail = render(locale);

    expect(mail.text.trim()).not.toBe('');
    expect(mail.text).toContain(URL);
    expect(mail.subject.trim()).not.toBe('');
  });
});
