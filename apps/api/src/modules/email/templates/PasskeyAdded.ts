import { deviceLabel } from './PasswordChanged.js';
import { button, escapeHtml, layout, paragraph } from './Layout.js';

import type { Device } from 'core/domain/Device';
import type { EmailLocale, RenderedEmail } from './Layout.js';

/** The product's clock: the person reads the hour as it was where the product lives. */
const TIME_ZONE = 'Europe/Madrid';

type Copy = {
  button: string;
  device: (device: string) => string;
  linkFallback: string;
  notYou: string;
  subject: string;
  wasYou: string;
  what: (when: string) => string;
};

/**
 * "You added a passkey" (PLAN 011 phase 5). Like the two-factor mail: when,
 * roughly from what — a browser and a system family, never an address — and
 * what to do if it was not them: a reset, which signs every device out and
 * removes every passkey of the account (PLAN 011 phase 5).
 * Never the passkey's name — whoever added it chose the words — nor anything
 * of the account's contents: no word of health (M14), no name, no plan.
 */
const COPY: Record<EmailLocale, Copy> = {
  'en-GB': {
    button: 'Reset my password',
    device: device => `From: ${device}.`,
    linkFallback: 'If the button does not work, copy this address into your browser:',
    notYou:
      'If it was not you, somebody has been inside your account: reset your password now. A reset signs every device out and removes every passkey of the account, this one included.',
    subject: 'You added a passkey',
    wasYou: 'If it was you, there is nothing else to do.',
    what: when =>
      `A passkey was added to the NutrIA account for this address on ${when} (Madrid time). Whoever holds the device that keeps it can sign in with it, without the password.`
  },
  'es-ES': {
    button: 'Restablecer mi contraseña',
    device: device => `Desde: ${device}.`,
    linkFallback: 'Si el botón no funciona, copia esta dirección en tu navegador:',
    notYou:
      'Si no has sido tú, alguien ha entrado en tu cuenta: restablece la contraseña ahora. Al restablecerla se cierran todas las sesiones y se quitan todas las llaves de acceso de la cuenta, también esta.',
    subject: 'Has añadido una llave de acceso',
    wasYou: 'Si has sido tú, no tienes que hacer nada más.',
    what: when =>
      `Se añadió una llave de acceso a la cuenta de NutrIA con esta dirección el ${when} (hora de Madrid). Quien tenga el dispositivo que la guarda puede entrar con ella, sin la contraseña.`
  }
};

export function passkeyAddedEmail({
  at,
  device,
  locale,
  recoverUrl
}: {
  at: Date;
  device: Device;
  locale: EmailLocale;
  recoverUrl: string;
}): RenderedEmail {
  const copy = COPY[locale];
  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: TIME_ZONE }).format(at);
  const label = deviceLabel(device, locale);
  const what = copy.what(when);
  const from = label ? copy.device(label) : null;

  const html = layout({
    body: [
      paragraph(what),
      ...(from ? [paragraph(from)] : []),
      paragraph(copy.notYou),
      button(recoverUrl, copy.button),
      paragraph(copy.wasYou, 'muted'),
      paragraph(copy.linkFallback, 'muted'),
      `<p style="margin:0;font-size:0.8125rem;word-break:break-all;"><a href="${escapeHtml(recoverUrl)}" style="color:#5b7f3a;">${escapeHtml(recoverUrl)}</a></p>`
    ].join('\n'),
    locale,
    title: copy.subject
  });

  const text = [what, ...(from ? [from] : []), '', copy.notYou, recoverUrl, '', copy.wasYou].join('\n');

  return { html, kind: 'passkey-added', subject: copy.subject, text };
}
