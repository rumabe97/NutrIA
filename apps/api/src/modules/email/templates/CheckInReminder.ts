import { button, layout, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

/**
 * The one reminder this product sends: the fortnight has closed, and the next
 * plan is built from what they say about this one.
 *
 * It carries no health data — not the plan, not a dish, not a weight. A mail
 * sits in an inbox a provider scans and a phone shows on a lock screen, so it
 * says only that something is waiting, and the thing itself is behind a login.
 */
const COPY: Record<EmailLocale, { button: string; intro: string; optOut: string; subject: string; why: string }> = {
  'en-GB': {
    button: 'Do the check-in',
    intro:
      'Your fortnight is done. Tell us in a minute how it went — the weight, the portions and what you would change — and your next plan starts from that.',
    optOut: 'You can turn these reminders off in your profile.',
    subject: 'Your fortnight is done — two minutes and the next one is better',
    why: 'Without it the next plan is built from the same answers as this one.'
  },
  'es-ES': {
    button: 'Hacer el check-in',
    intro:
      'Tu quincena ha terminado. Cuéntanos en un minuto cómo ha ido — el peso, las cantidades y qué cambiarías — y el siguiente plan parte de ahí.',
    optOut: 'Puedes desactivar estos avisos desde tu perfil.',
    subject: 'Tu quincena ha terminado — dos minutos y la siguiente va mejor',
    why: 'Sin él, el siguiente plan se construye con las mismas respuestas que este.'
  }
};

export function checkInReminderEmail({ locale, url }: { locale: EmailLocale; url: string }): RenderedEmail {
  const copy = COPY[locale];

  const html = layout({
    body: [paragraph(copy.intro), button(url, copy.button), paragraph(copy.why, 'muted'), paragraph(copy.optOut, 'muted')].join('\n'),
    locale,
    title: copy.subject
  });

  const text = [copy.intro, '', url, '', copy.why, copy.optOut].join('\n');

  return { html, subject: copy.subject, text };
}

/** Kept for the notification row: what was sent, without the link. */
export function checkInReminderRecord(locale: EmailLocale): { readonly body: string; readonly title: string } {
  return { body: COPY[locale].intro, title: COPY[locale].subject };
}

/**
 * What a phone shows (`0054`). Short enough for a lock screen, and like the
 * mail, nothing about anybody's health: a lock screen is the most public place
 * this product ever writes to.
 */
const PUSH: Record<EmailLocale, { readonly body: string; readonly title: string }> = {
  'en-GB': { body: 'Two minutes of check-in, and your next plan starts from there.', title: 'Your fortnight is done' },
  'es-ES': { body: 'Dos minutos de check-in y el siguiente plan parte de ahí.', title: 'Tu quincena ha terminado' }
};

export function checkInReminderPush(locale: EmailLocale): { readonly body: string; readonly title: string } {
  return PUSH[locale];
}

const TEST: Record<EmailLocale, string> = { 'en-GB': 'Test', 'es-ES': 'Prueba' };

/** The owner's test from `/admin`: the reminder's own words, so what arrives is what people will get, marked as a test. */
export function checkInReminderTest(locale: EmailLocale): { readonly body: string; readonly title: string } {
  return { body: PUSH[locale].body, title: `${TEST[locale]} · ${PUSH[locale].title}` };
}
