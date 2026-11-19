import { button, fallbackLink, layout, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

/** Longest inviter name a subject line carries; a display name is not a paragraph. */
const NAME_LIMIT = 80;

/**
 * A professional's invitation to follow somebody's plan (`0059`).
 *
 * Sent to an address that may or may not have an account, and it must read
 * the same either way: the same words go to both, so the mail cannot say which
 * it is. It says who invites, what accepting means — the practitioner makes
 * the plan and adjusts it, what else they see depends on what is accepted, and
 * either side can end it at any time — that the list is shown before anything
 * is shared, and that the link expires. **It never names a title** («dietista»
 * or any other): one neutral sentence for both tiers (`docs/legal/textos/06` §
 * A bis, approved by the owner on 2026-11-19), because the name before it is
 * the account's and nobody checked it. **It carries no health word**: an inbox is scanned and a lock
 * screen is public, and what is shared is read behind a login.
 *
 * The recipient's language is unknown — the address may have no account — so
 * it is written in the inviter's.
 *
 * `privacy` is what RGPD art. 14 asks be said to somebody whose address came
 * from someone else (`docs/legal/textos/06` § A): who gave it, how long it is
 * kept, and where the controller and their rights are named — a link to the
 * privacy policy, the first layer and the second.
 *
 * `{name}` is the account's name, judged by the core when the invitation was
 * made (`CareController.invite`, invariant review of phase 6, P1-2), never the
 * session's copy of it. Each sentence lives in one key, so a change of words is
 * one edit.
 */
const COPY: Record<
  EmailLocale,
  {
    button: string;
    choose: string;
    expires: string;
    ignore: string;
    intro: string;
    linkFallback: string;
    meaning: string;
    privacy: string;
    subject: string;
  }
> = {
  'en-GB': {
    button: 'See the invitation',
    choose:
      'Before anything is shared you will see exactly what they will be able to see, and you can say yes or no. Either of you can end it at any time. If you do not have a NutrIA account yet, create one with this address.',
    expires: 'The invitation works for 14 days.',
    ignore: 'If you do not know who this is, ignore this message: nothing is shared unless you accept.',
    intro: '{name} has invited you to let them make your meal plan on NutrIA.',
    linkFallback: 'If the button does not work, copy this address into your browser:',
    meaning:
      'If you accept, they can make your plan and adjust it with you. What else they can see depends on what you accept, and before accepting you will see the exact list.',
    privacy:
      'We are writing because {name} gave us your address to invite you, and we use it for nothing else. If you accept or decline, we delete the invitation there and then; if you do not answer, it expires after 14 days and we delete it, with your address, by the following day at the latest. Who is responsible and your rights: {privacyUrl}',
    subject: '{name} has invited you to NutrIA'
  },
  'es-ES': {
    button: 'Ver la invitación',
    choose:
      'Antes de compartir nada verás exactamente qué podrá ver, y podrás decir que sí o que no. Cualquiera de los dos puede terminarlo cuando quiera. Si todavía no tienes cuenta en NutrIA, créala con esta dirección.',
    expires: 'La invitación funciona durante 14 días.',
    ignore: 'Si no sabes quién es, ignora este mensaje: no se comparte nada si no aceptas.',
    intro: '{name} te ha invitado a que te haga el plan de comidas en NutrIA.',
    linkFallback: 'Si el botón no funciona, copia esta dirección en tu navegador:',
    meaning:
      'Si aceptas, podrá hacerte el plan y ajustarlo contigo. Qué más podrá ver depende de lo que aceptes, y antes de aceptar verás la lista exacta.',
    privacy:
      'Te escribimos porque {name} nos ha dado tu dirección para invitarte, y no la usamos para nada más. Si aceptas o rechazas, borramos la invitación en ese momento; si no respondes, caduca a los 14 días y la borramos, con tu dirección, como muy tarde al día siguiente. Quién es el responsable y tus derechos: {privacyUrl}',
    subject: '{name} te ha invitado a NutrIA'
  }
};

/**
 * The inviter's name as a line of text: no line breaks (it goes in a subject
 * header), no runs of spaces, and bounded.
 */
function oneLine(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT);
}

export function careInvitationEmail({
  inviterName,
  locale,
  privacyUrl,
  url
}: {
  inviterName: string;
  locale: EmailLocale;
  privacyUrl: string;
  url: string;
}): RenderedEmail {
  const copy = COPY[locale];
  const name = oneLine(inviterName);
  const intro = copy.intro.replace('{name}', name);
  const subject = copy.subject.replace('{name}', name);
  const privacy = copy.privacy.replace('{name}', name).replace('{privacyUrl}', privacyUrl);

  const html = layout({
    body: [
      paragraph(intro),
      paragraph(copy.meaning),
      button(url, copy.button),
      paragraph(copy.choose, 'muted'),
      paragraph(copy.expires, 'muted'),
      paragraph(copy.ignore, 'muted'),
      paragraph(privacy, 'muted'),
      fallbackLink(copy.linkFallback, url)
    ].join('\n'),
    locale,
    title: subject
  });

  const text = [intro, copy.meaning, '', url, '', copy.choose, copy.expires, copy.ignore, '', privacy].join('\n');

  return { html, kind: 'care-invitation', subject, text };
}
