import { escapeHtml, layout, paragraph } from './Layout.js';

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
const COPY: Record<EmailLocale, { activate: string; intro: string; subject: string }> = {
  'en-GB': {
    activate: 'To open it, run this against the database:',
    intro: 'Someone signed up and is waiting for their account to be opened.',
    subject: 'NutrIA — an account is waiting'
  },
  'es-ES': {
    activate: 'Para abrirla, ejecuta esto contra la base de datos:',
    intro: 'Alguien se ha registrado y está esperando a que le abras la cuenta.',
    subject: 'NutrIA — una cuenta está esperando'
  }
};

export function accountWaitingEmail({ email, locale }: { email: string; locale: EmailLocale }): RenderedEmail {
  const copy = COPY[locale];
  const statement = `update "user" set email_verified = true, updated_at = now() where email = '${email}';`;

  const html = layout({
    body: [
      paragraph(copy.intro),
      `<p style="margin:0 0 1rem;font-size:1rem;"><strong>${escapeHtml(email)}</strong></p>`,
      paragraph(copy.activate, 'muted'),
      `<pre style="margin:0;padding:0.75rem;background:#f0f1ee;border-radius:0.5rem;font-size:0.8125rem;white-space:pre-wrap;word-break:break-all;">${escapeHtml(statement)}</pre>`
    ].join('\n'),
    locale,
    title: copy.subject
  });

  return { html, subject: copy.subject, text: [copy.intro, '', email, '', copy.activate, statement].join('\n') };
}
