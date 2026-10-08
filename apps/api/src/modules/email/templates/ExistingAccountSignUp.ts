import { button, escapeHtml, layout, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

type Copy = { button: string; google: string; linkFallback: string; notYou: string; reset: string; squatted: string; subject: string; what: string };

/**
 * "Somebody tried to create an account with your address" (PLAN 011 phase 8).
 * Sign-up answers the same for a new and an existing address, so the person
 * who already has an account learns it here, in their own mailbox, and
 * nowhere else: sign in, or reset the password if they forgot it — or if
 * they never made the account: a stranger may have signed the address up
 * first, and a completed reset confirms the address and lets its owner in
 * (`onPasswordReset`, `docs/legal/textos/06-correos.md` § O).
 *
 * Nothing of the attempt — no name typed, no device, no time — and nothing of
 * the account's contents: no word of health (M14). Whoever typed the address
 * chose those words, and the mail must not repeat them to its owner.
 */
const COPY: Record<EmailLocale, Copy> = {
  'en-GB': {
    button: 'Sign in',
    google: 'If you created the account with Google, sign in with Google.',
    linkFallback: 'If the button does not work, copy this address into your browser:',
    notYou: 'If it was not you, there is nothing to do: no account was created and nothing of yours changed.',
    reset: 'If you have forgotten your password, you can set a new one here:',
    squatted:
      'If you do not remember creating an account, somebody may have created one with your address: set a new password with the link below and sign in with it.',
    subject: 'Somebody tried to create an account with your address',
    what: 'Somebody tried to create a NutrIA account with this address, which already has one. If it was you, you do not need another: sign in with the one you have.'
  },
  'es-ES': {
    button: 'Entrar',
    google: 'Si creaste la cuenta con Google, entra con Google.',
    linkFallback: 'Si el botón no funciona, copia esta dirección en tu navegador:',
    notYou: 'Si no has sido tú, no tienes que hacer nada: no se ha creado ninguna cuenta y no ha cambiado nada de la tuya.',
    reset: 'Si no recuerdas la contraseña, puedes poner una nueva aquí:',
    squatted:
      'Si no recuerdas haber creado una cuenta, puede que alguien la creara con tu dirección: pon una contraseña nueva en el enlace de abajo y entra con ella.',
    subject: 'Alguien ha intentado crear una cuenta con tu correo',
    what: 'Alguien ha intentado crear una cuenta de NutrIA con esta dirección, que ya tiene una. Si has sido tú, no necesitas otra: entra con la que ya tienes.'
  }
};

export function existingAccountSignUpEmail({
  locale,
  recoverUrl,
  signInUrl
}: {
  locale: EmailLocale;
  recoverUrl: string;
  signInUrl: string;
}): RenderedEmail {
  const copy = COPY[locale];

  const html = layout({
    body: [
      paragraph(copy.what),
      button(signInUrl, copy.button),
      paragraph(copy.google),
      paragraph(copy.squatted),
      paragraph(copy.reset),
      `<p style="margin:0 0 1rem;font-size:0.875rem;word-break:break-all;"><a href="${escapeHtml(recoverUrl)}" style="color:#5b7f3a;">${escapeHtml(recoverUrl)}</a></p>`,
      paragraph(copy.notYou, 'muted'),
      paragraph(copy.linkFallback, 'muted'),
      `<p style="margin:0;font-size:0.8125rem;word-break:break-all;"><a href="${escapeHtml(signInUrl)}" style="color:#5b7f3a;">${escapeHtml(signInUrl)}</a></p>`
    ].join('\n'),
    locale,
    title: copy.subject
  });

  const text = [copy.what, signInUrl, '', copy.google, '', copy.squatted, copy.reset, recoverUrl, '', copy.notYou].join('\n');

  return { html, kind: 'existing-account-sign-up', subject: copy.subject, text };
}
