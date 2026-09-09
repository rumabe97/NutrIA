import { button, escapeHtml, layout, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

/**
 * The reset link is good for an hour (Better Auth's default), and the copy says
 * so in the same words the web form used when it promised the mail. Someone
 * who did not ask is told to ignore it and that nothing has changed: that is
 * the sentence that stops a person who never requested a reset from panicking.
 */
const COPY: Record<EmailLocale, { button: string; expires: string; ignore: string; intro: string; linkFallback: string; subject: string }> = {
  'en-GB': {
    button: 'Choose a new password',
    expires: 'The link works for one hour.',
    ignore: 'If you did not ask for this, ignore this message: your password has not changed.',
    intro: 'Someone asked to reset the password of the NutrIA account for this address. If it was you, choose a new one here:',
    linkFallback: 'If the button does not work, copy this address into your browser:',
    subject: 'Reset your NutrIA password'
  },
  'es-ES': {
    button: 'Elegir una nueva contraseña',
    expires: 'El enlace funciona durante una hora.',
    ignore: 'Si no has sido tú, ignora este mensaje: tu contraseña no ha cambiado.',
    intro: 'Alguien ha pedido restablecer la contraseña de la cuenta de NutrIA con esta dirección. Si has sido tú, elige una nueva aquí:',
    linkFallback: 'Si el botón no funciona, copia esta dirección en tu navegador:',
    subject: 'Restablece tu contraseña de NutrIA'
  }
};

export function passwordResetEmail({ locale, url }: { locale: EmailLocale; url: string }): RenderedEmail {
  const copy = COPY[locale];

  const html = layout({
    body: [
      paragraph(copy.intro),
      button(url, copy.button),
      paragraph(copy.expires, 'muted'),
      paragraph(copy.ignore, 'muted'),
      paragraph(copy.linkFallback, 'muted'),
      `<p style="margin:0;font-size:0.8125rem;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#5b7f3a;">${escapeHtml(url)}</a></p>`
    ].join('\n'),
    locale,
    title: copy.subject
  });

  const text = [copy.intro, '', url, '', copy.expires, copy.ignore].join('\n');

  return { html, subject: copy.subject, text };
}
