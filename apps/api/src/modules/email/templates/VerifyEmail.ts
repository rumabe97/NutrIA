import { button, escapeHtml, layout, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

/**
 * Confirms that an address is real, and nothing else (`0030`).
 *
 * It cannot open the account — that is the owner's switch, on a different
 * column — so the copy says what clicking does and what still has to happen.
 * Promising access here and then showing a waiting screen would be worse than
 * saying nothing.
 */
const COPY: Record<EmailLocale, { button: string; ignore: string; intro: string; linkFallback: string; next: string; subject: string }> = {
  'en-GB': {
    button: 'Confirm my address',
    ignore: 'If you did not sign up, ignore this message and nothing happens.',
    intro: 'Confirm this address so we know it is yours.',
    linkFallback: 'If the button does not work, copy this address into your browser:',
    next: 'NutrIA is opening a few accounts at a time. Once yours is opened you can sign in and start; we will not ask for this again.',
    subject: 'Confirm your address for NutrIA'
  },
  'es-ES': {
    button: 'Confirmar mi correo',
    ignore: 'Si no te has registrado, ignora este mensaje: no pasa nada.',
    intro: 'Confirma este correo para que sepamos que es tuyo.',
    linkFallback: 'Si el botón no funciona, copia esta dirección en tu navegador:',
    next: 'NutrIA se está abriendo poco a poco. En cuanto activemos tu cuenta podrás entrar y empezar; esto no volverá a pedírtelo.',
    subject: 'Confirma tu correo en NutrIA'
  }
};

export function verifyEmail({ locale, url }: { locale: EmailLocale; url: string }): RenderedEmail {
  const copy = COPY[locale];

  const html = layout({
    body: [
      paragraph(copy.intro),
      button(url, copy.button),
      paragraph(copy.next, 'muted'),
      paragraph(copy.ignore, 'muted'),
      paragraph(copy.linkFallback, 'muted'),
      `<p style="margin:0;font-size:0.8125rem;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#5b7f3a;">${escapeHtml(url)}</a></p>`
    ].join('\n'),
    locale,
    title: copy.subject
  });

  return { html, subject: copy.subject, text: [copy.intro, '', url, '', copy.next, copy.ignore].join('\n') };
}
