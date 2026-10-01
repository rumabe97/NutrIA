import { deviceLabel } from './PasswordChanged.js';
import { button, escapeHtml, layout, paragraph } from './Layout.js';

import type { Device } from 'core/domain/Device';
import type { EmailKind, EmailLocale, RenderedEmail } from './Layout.js';

/** The product's clock: the person reads the hour as it was where the product lives. */
const TIME_ZONE = 'Europe/Madrid';

/** What happened to the account's second factor (PLAN 011 phase 3). */
export type TwoFactorEvent =
  | { readonly kind: 'backup-code-used'; readonly remaining: number }
  | { readonly kind: 'backup-codes-regenerated' }
  | { readonly kind: 'disabled' }
  | { readonly kind: 'enabled' };

const KINDS: Record<TwoFactorEvent['kind'], EmailKind> = {
  'backup-code-used': 'backup-code-used',
  'backup-codes-regenerated': 'backup-codes-regenerated',
  disabled: 'two-factor-disabled',
  enabled: 'two-factor-enabled'
};

type Copy = {
  button: string;
  device: (device: string) => string;
  linkFallback: string;
  notYou: string;
  subject: (event: TwoFactorEvent) => string;
  wasYou: string;
  what: (event: TwoFactorEvent, when: string) => string;
};

/**
 * "You turned on two-step verification", "…turned it off", "You used a backup
 * code (N left)", "You generated new backup codes" (PLAN 011 phase 3). Like the password mail: when, roughly from
 * what — a browser and a system family, never an address — and what to do if
 * it was not them, which is to change the password somebody else must know.
 * Never the secret, a code, or anything of the account's contents: no word of
 * health (M14), no name, no plan.
 */
const COPY: Record<EmailLocale, Copy> = {
  'en-GB': {
    button: 'Reset my password',
    device: device => `From: ${device}.`,
    linkFallback: 'If the button does not work, copy this address into your browser:',
    notYou: 'If it was not you, somebody knows your password: reset it now.',
    subject: event => {
      switch (event.kind) {
        case 'enabled':
          return 'You turned on two-step verification';
        case 'disabled':
          return 'You turned off two-step verification';
        case 'backup-code-used':
          return `You used a backup code (${event.remaining} left)`;
        case 'backup-codes-regenerated':
          return 'You generated new backup codes; the old ones no longer work';
      }
    },
    wasYou: 'If it was you, there is nothing else to do.',
    what: (event, when) => {
      const on = `for the NutrIA account for this address on ${when} (Madrid time)`;

      switch (event.kind) {
        case 'enabled':
          return `Two-step verification was turned on ${on}. Signing in with the password now also asks for a code from the authenticator app.`;
        case 'disabled':
          return `Two-step verification was turned off ${on}. Signing in now asks for the password alone.`;
        case 'backup-code-used':
          return `A backup code was used ${on}. ${event.remaining === 1 ? 'One is left' : `${event.remaining} are left`}; each works once.`;
        case 'backup-codes-regenerated':
          return `Ten new backup codes were generated ${on}. The ones from before no longer work.`;
      }
    }
  },
  'es-ES': {
    button: 'Restablecer mi contraseña',
    device: device => `Desde: ${device}.`,
    linkFallback: 'Si el botón no funciona, copia esta dirección en tu navegador:',
    notYou: 'Si no has sido tú, alguien conoce tu contraseña: restablécela ahora.',
    subject: event => {
      switch (event.kind) {
        case 'enabled':
          return 'Has activado la verificación en dos pasos';
        case 'disabled':
          return 'Has desactivado la verificación en dos pasos';
        case 'backup-code-used':
          return `Has usado un código de respaldo (te quedan ${event.remaining})`;
        case 'backup-codes-regenerated':
          return 'Has generado códigos de respaldo nuevos; los anteriores ya no sirven';
      }
    },
    wasYou: 'Si has sido tú, no tienes que hacer nada más.',
    what: (event, when) => {
      const of = `de la cuenta de NutrIA con esta dirección`;
      const at = `el ${when} (hora de Madrid)`;

      switch (event.kind) {
        case 'enabled':
          return `La verificación en dos pasos ${of} se activó ${at}. Para entrar con la contraseña, ahora también se pide un código de la app de autenticación.`;
        case 'disabled':
          return `La verificación en dos pasos ${of} se desactivó ${at}. Para entrar, ahora basta con la contraseña.`;
        case 'backup-code-used':
          return `Se usó un código de respaldo ${of} ${at}. ${event.remaining === 1 ? 'Te queda uno' : `Te quedan ${event.remaining}`}; cada uno sirve una sola vez.`;
        case 'backup-codes-regenerated':
          return `Se generaron diez códigos de respaldo nuevos ${of} ${at}. Los de antes ya no sirven.`;
      }
    }
  }
};

export function twoFactorChangedEmail({
  at,
  device,
  event,
  locale,
  recoverUrl
}: {
  at: Date;
  device: Device;
  event: TwoFactorEvent;
  locale: EmailLocale;
  recoverUrl: string;
}): RenderedEmail {
  const copy = COPY[locale];
  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: TIME_ZONE }).format(at);
  const label = deviceLabel(device, locale);
  const what = copy.what(event, when);
  const from = label ? copy.device(label) : null;
  const subject = copy.subject(event);

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
    title: subject
  });

  const text = [what, ...(from ? [from] : []), '', copy.notYou, recoverUrl, '', copy.wasYou].join('\n');

  return { html, kind: KINDS[event.kind], subject, text };
}
