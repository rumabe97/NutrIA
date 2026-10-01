import { DEVICE_BROWSER_NAMES, DEVICE_SYSTEM_NAMES } from 'core/domain/Device';

import { button, escapeHtml, layout, paragraph } from './Layout.js';

import type { Device } from 'core/domain/Device';
import type { EmailLocale, RenderedEmail } from './Layout.js';

/** The product's clock: the person reads the hour as it was where the product lives. */
const TIME_ZONE = 'Europe/Madrid';

/**
 * "Your password has changed" (PLAN 011 phase 2), sent after a change from a
 * session and after a reset. It says when, roughly from what — a browser and a
 * system family, never an address, a version or a model — and what to do if it
 * was not them. Nothing about the account's contents: no word of health (M14),
 * no name, no plan.
 */
const COPY: Record<
  EmailLocale,
  {
    button: string;
    device: (device: string) => string;
    intro: (when: string) => string;
    linkFallback: string;
    notYou: string;
    on: string;
    subject: string;
    wasYou: string;
  }
> = {
  'en-GB': {
    button: 'Reset my password',
    device: device => `From: ${device}.`,
    intro: when => `The password of the NutrIA account for this address changed on ${when} (Madrid time).`,
    linkFallback: 'If the button does not work, copy this address into your browser:',
    notYou: 'If it was not you, reset your password now:',
    on: 'on',
    subject: 'Your NutrIA password has changed',
    wasYou: 'If it was you, there is nothing else to do.'
  },
  'es-ES': {
    button: 'Restablecer mi contraseña',
    device: device => `Desde: ${device}.`,
    intro: when => `La contraseña de la cuenta de NutrIA con esta dirección ha cambiado el ${when} (hora de Madrid).`,
    linkFallback: 'Si el botón no funciona, copia esta dirección en tu navegador:',
    notYou: 'Si no has sido tú, restablece tu contraseña ahora:',
    on: 'en',
    subject: 'Tu contraseña de NutrIA ha cambiado',
    wasYou: 'Si has sido tú, no tienes que hacer nada más.'
  }
};

/** "Safari en iPhone", "Firefox", "Android" — or null when the agent said nothing we recognise. */
export function deviceLabel(device: Device, locale: EmailLocale): string | null {
  const browser = device.browser ? DEVICE_BROWSER_NAMES[device.browser] : null;
  const system = device.system ? DEVICE_SYSTEM_NAMES[device.system] : null;

  if (browser && system) {
    return `${browser} ${COPY[locale].on} ${system}`;
  }

  return browser ?? system;
}

export function passwordChangedEmail({
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
  const intro = copy.intro(when);
  const from = label ? copy.device(label) : null;

  const html = layout({
    body: [
      paragraph(intro),
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

  const text = [intro, ...(from ? [from] : []), '', copy.notYou, recoverUrl, '', copy.wasYou].join('\n');

  return { html, kind: 'password-changed', subject: copy.subject, text };
}
