import { button, layout, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

/** Longest client name a subject line carries; a display name is not a paragraph. */
const NAME_LIMIT = 80;

/**
 * Tells a professional their client answered a check-in (`0059`, PRD 004
 * criterion 10). Carries the client's name and a link to `/consulta`, and
 * nothing else: no answer, no weight, no rating, no comment — an inbox is
 * scanned and a lock screen is the most public place this product ever writes
 * to. The suggested kcal a supervised client's nudge would have set is
 * behind the professional's own, audited read of the check-in
 * (`CareController.overview`), never in this message.
 */
const COPY: Record<EmailLocale, { button: string; intro: string; subject: string }> = {
  'en-GB': {
    button: 'Open your practice',
    intro: '{name} has just done their check-in on NutrIA. Open your practice to see it.',
    subject: '{name} has checked in'
  },
  'es-ES': {
    button: 'Abrir tu consulta',
    intro: '{name} acaba de hacer su check-in en NutrIA. Abre tu consulta para verlo.',
    subject: '{name} ha hecho su check-in'
  }
};

/** The client's name as a line of text: no line breaks (it goes in a subject header), no runs of spaces, and bounded. */
function oneLine(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT);
}

export function checkInSubmittedEmail({ clientName, locale, url }: { clientName: string; locale: EmailLocale; url: string }): RenderedEmail {
  const copy = COPY[locale];
  const name = oneLine(clientName);
  const intro = copy.intro.replace('{name}', name);
  const subject = copy.subject.replace('{name}', name);

  const html = layout({ body: [paragraph(intro), button(url, copy.button)].join('\n'), locale, title: subject });
  const text = [intro, '', url].join('\n');

  return { html, kind: 'checkin-submitted', subject, text };
}

/** Kept for the notification row: what was sent, without the link. */
export function checkInSubmittedRecord(locale: EmailLocale, clientName: string): { readonly body: string; readonly title: string } {
  const copy = COPY[locale];
  const name = oneLine(clientName);

  return { body: copy.intro.replace('{name}', name), title: copy.subject.replace('{name}', name) };
}

/**
 * What a phone shows (`0054`). The client's name and nothing else about
 * them — like the mail, no health word ever reaches a lock screen.
 */
const PUSH: Record<EmailLocale, { readonly body: string; readonly title: string }> = {
  'en-GB': { body: 'Open your practice to see it.', title: '{name} has checked in' },
  'es-ES': { body: 'Abre tu consulta para verlo.', title: '{name} ha hecho su check-in' }
};

export function checkInSubmittedPush(locale: EmailLocale, clientName: string): { readonly body: string; readonly title: string } {
  const copy = PUSH[locale];

  return { body: copy.body, title: copy.title.replace('{name}', oneLine(clientName)) };
}
