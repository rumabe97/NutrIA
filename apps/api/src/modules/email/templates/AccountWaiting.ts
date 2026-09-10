import { button, escapeHtml, layout, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

/**
 * To the owner, not to a user: someone has signed up and is waiting for their
 * account to be opened by hand (`0017`).
 *
 * The one mail this product sends that carries someone's address, and it does
 * so because activation *is* an email — the runbook's SQL matches on it, and
 * the alternative is the owner querying the database blind to find out who is
 * waiting. Nothing else about the person travels: no name, no answers, no
 * profile, because none of it is needed to decide whether to open an account.
 */
const COPY: Record<EmailLocale, { activate: string; button: string; byHand: string; intro: string; subject: string; unconfirmed: string }> = {
  'en-GB': {
    activate: 'One click opens it. The link works for a month.',
    button: 'Open this account',
    byHand: 'Or by hand, against the database:',
    intro: 'Someone signed up and is waiting for their account to be opened.',
    subject: 'NutrIA — an account is waiting',
    unconfirmed: 'They have not confirmed their address yet.'
  },
  'es-ES': {
    activate: 'Con un clic queda abierta. El enlace funciona durante un mes.',
    button: 'Abrir esta cuenta',
    byHand: 'O a mano, contra la base de datos:',
    intro: 'Alguien se ha registrado y está esperando a que le abras la cuenta.',
    subject: 'NutrIA — una cuenta está esperando',
    unconfirmed: 'Todavía no ha confirmado su correo.'
  }
};

export function accountWaitingEmail({
  email,
  emailVerified = true,
  locale,
  url
}: {
  email: string;
  emailVerified?: boolean;
  locale: EmailLocale;
  url: string;
}): RenderedEmail {
  const copy = COPY[locale];
  const statement = `update "user" set activated_at = now(), updated_at = now() where email = '${email}';`;

  const html = layout({
    body: [
      paragraph(copy.intro),
      `<p style="margin:0 0 1rem;font-size:1rem;"><strong>${escapeHtml(email)}</strong></p>`,
      emailVerified ? '' : paragraph(copy.unconfirmed, 'muted'),
      button(url, copy.button),
      paragraph(copy.activate, 'muted'),
      paragraph(copy.byHand, 'muted'),
      `<pre style="margin:0;padding:0.75rem;background:#f0f1ee;border-radius:0.5rem;font-size:0.8125rem;white-space:pre-wrap;word-break:break-all;">${escapeHtml(statement)}</pre>`
    ]
      .filter(Boolean)
      .join('\n'),
    locale,
    title: copy.subject
  });

  return { html, subject: copy.subject, text: [copy.intro, '', email, '', copy.activate, url, '', copy.byHand, statement].join('\n') };
}
