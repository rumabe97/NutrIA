import { button, escapeHtml, layout, paragraph } from './Layout.js';

import type { EmailKind, EmailLocale, RenderedEmail } from './Layout.js';

/** The product's clock: the person reads the hour as it was where the product lives. */
const TIME_ZONE = 'Europe/Madrid';

/** Where the owner's removal of a lost second factor stands (PLAN 011 phase 4). */
export type TwoFactorRemovalEvent =
  { readonly dueAt: Date; readonly kind: 'requested' } | { readonly kind: 'cancelled' } | { readonly kind: 'removed' };

const KINDS: Record<TwoFactorRemovalEvent['kind'], EmailKind> = {
  cancelled: 'two-factor-removal-cancelled',
  removed: 'two-factor-removed',
  requested: 'two-factor-removal-requested'
};

type Copy = {
  button: string;
  lines: (event: TwoFactorRemovalEvent, when: (at: Date) => string) => readonly string[];
  linkFallback: string;
  subject: (event: TwoFactorRemovalEvent) => string;
};

/**
 * "We received a request to remove your two-step verification", "…the
 * request was cancelled", "We removed your two-step verification" (PLAN 011
 * phase 4). Sent to the account's own address and nowhere else. It says what
 * will happen and when, how to stop it — sign in with a code — and nothing of
 * the request: never who asked, from where, an address, a header, an IP, nor
 * a word of the account's contents (M14). The date is the earliest moment;
 * the daily run means up to a day later, and the copy says so.
 */
const COPY: Record<EmailLocale, Copy> = {
  'en-GB': {
    button: 'Sign in',
    lines: (event, when) => {
      switch (event.kind) {
        case 'requested':
          return [
            'We have received a request to remove two-step verification from the NutrIA account for this address, because its authenticator app and backup codes were lost.',
            `If nobody cancels it, it will be removed from ${when(event.dueAt)} (Madrid time), at the latest one day later. Signing in will then ask for the password alone.`,
            'If it was not you, sign in with a code from your authenticator app or a backup code: that cancels the request. Then change your password, because somebody may know it.',
            'If it was you, there is nothing else to do.'
          ];
        case 'cancelled':
          return [
            'The request to remove two-step verification from the NutrIA account for this address has been cancelled. Nothing has changed: signing in still asks for a code.',
            'If you did not expect this, there is nothing to do.'
          ];
        case 'removed':
          return [
            'We have removed two-step verification from the NutrIA account for this address, as requested two days ago. Signing in now asks for the password alone.',
            'You can turn it on again from your profile, under Security.',
            'If you did not ask for this, change your password now and write to us.'
          ];
      }
    },
    linkFallback: 'If the button does not work, copy this address into your browser:',
    subject: event => {
      switch (event.kind) {
        case 'requested':
          return 'Request to remove your two-step verification';
        case 'cancelled':
          return 'The request to remove your two-step verification was cancelled';
        case 'removed':
          return 'We have removed your two-step verification';
      }
    }
  },
  'es-ES': {
    button: 'Entrar',
    lines: (event, when) => {
      switch (event.kind) {
        case 'requested':
          return [
            'Hemos recibido una petición para quitar la verificación en dos pasos de la cuenta de NutrIA con esta dirección, porque se perdieron la app de autenticación y los códigos de respaldo.',
            `Si nadie la cancela, se quitará a partir del ${when(event.dueAt)} (hora de Madrid), como mucho un día después. Desde entonces, para entrar bastará con la contraseña.`,
            'Si no fuiste tú, entra con un código de tu app de autenticación o un código de respaldo: así se cancela la petición. Después cambia tu contraseña, porque alguien puede conocerla.',
            'Si fuiste tú, no tienes que hacer nada más.'
          ];
        case 'cancelled':
          return [
            'Se ha cancelado la petición para quitar la verificación en dos pasos de la cuenta de NutrIA con esta dirección. No ha cambiado nada: para entrar se sigue pidiendo un código.',
            'Si no lo esperabas, no tienes que hacer nada.'
          ];
        case 'removed':
          return [
            'Hemos quitado la verificación en dos pasos de la cuenta de NutrIA con esta dirección, como se pidió hace dos días. Para entrar, ahora basta con la contraseña.',
            'Puedes volver a activarla desde tu perfil, en Seguridad.',
            'Si no lo pediste, cambia tu contraseña ahora y escríbenos.'
          ];
      }
    },
    linkFallback: 'Si el botón no funciona, copia esta dirección en tu navegador:',
    subject: event => {
      switch (event.kind) {
        case 'requested':
          return 'Petición para quitar tu verificación en dos pasos';
        case 'cancelled':
          return 'Se ha cancelado la petición para quitar tu verificación en dos pasos';
        case 'removed':
          return 'Hemos quitado tu verificación en dos pasos';
      }
    }
  }
};

export function twoFactorRemovalEmail({
  event,
  locale,
  signInUrl
}: {
  event: TwoFactorRemovalEvent;
  locale: EmailLocale;
  signInUrl: string;
}): RenderedEmail {
  const copy = COPY[locale];
  const when = (at: Date) => new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: TIME_ZONE }).format(at);
  const lines = copy.lines(event, when);
  const subject = copy.subject(event);

  const html = layout({
    body: [
      ...lines.map(line => paragraph(line)),
      button(signInUrl, copy.button),
      paragraph(copy.linkFallback, 'muted'),
      `<p style="margin:0;font-size:0.8125rem;word-break:break-all;"><a href="${escapeHtml(signInUrl)}" style="color:#5b7f3a;">${escapeHtml(signInUrl)}</a></p>`
    ].join('\n'),
    locale,
    title: subject
  });

  const text = [...lines, '', signInUrl].join('\n');

  return { html, kind: KINDS[event.kind], subject, text };
}
