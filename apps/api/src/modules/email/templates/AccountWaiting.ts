import { button, layout, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

/**
 * To the owner, not to a user: somebody has confirmed their address and is
 * waiting for their account to be opened by hand (`0017`).
 *
 * It says *that* an account is waiting and nothing about who. No address, no
 * name, no id, and no activation link: a mail stays in the owner's inbox with
 * no deletion deadline, so what it carries is decided as what would be left
 * there for years. The owner sees who it is, and opens the account, in the
 * console's Cuentas filtered to the accounts waiting (`url`, `0030`).
 */
const COPY: Record<EmailLocale, { button: string; intro: string; subject: string }> = {
  'en-GB': {
    button: 'See the accounts waiting',
    intro: 'Someone signed up and is waiting for their account to be opened. You will see who in the console.',
    subject: 'NutrIA — an account is waiting'
  },
  'es-ES': {
    button: 'Ver las cuentas esperando',
    intro: 'Alguien se ha registrado y está esperando a que le abras la cuenta. En la consola verás quién es.',
    subject: 'NutrIA — una cuenta está esperando'
  }
};

export function accountWaitingEmail({ locale, url }: { locale: EmailLocale; url: string }): RenderedEmail {
  const copy = COPY[locale];

  const html = layout({ body: [paragraph(copy.intro), button(url, copy.button)].join('\n'), locale, title: copy.subject });

  return { html, kind: 'account-waiting', subject: copy.subject, text: [copy.intro, '', url].join('\n') };
}
