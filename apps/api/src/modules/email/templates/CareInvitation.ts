import { button, escapeHtml, layout, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

/** Longest inviter name a subject line carries; a display name is not a paragraph. */
const NAME_LIMIT = 80;

/**
 * A professional's invitation to follow somebody's plan (`0059`).
 *
 * Sent to an address that may or may not have an account, and it must read
 * the same either way: the same words go to both, so the mail cannot say which
 * it is. It says who invites, what accepting means — the dietitian sees the
 * plan and how it goes, can adjust it, and either side can end it at any
 * time — that the list is shown before anything is shared, and that the link
 * expires. **It carries no health word**: an inbox is scanned and a lock
 * screen is public, and what is shared is read behind a login.
 *
 * The recipient's language is unknown — the address may have no account — so
 * it is written in the inviter's.
 *
 * `privacy` is what RGPD art. 14 asks be said to somebody whose address came
 * from someone else (`docs/legal/textos/06` § A): who gave it, how long it is
 * kept, and where the controller and their rights are named — a link to the
 * privacy policy, the first layer and the second.
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
    intro: '{name} has invited you to follow your meal plan together on NutrIA, as your dietitian.',
    linkFallback: 'If the button does not work, copy this address into your browser:',
    meaning: 'If you accept, they will see your plan and how it is going, and can adjust it with you. Before accepting you will see the exact list.',
    privacy:
      'We are writing because {name} gave us your address to invite you. NutrIA keeps it only while the invitation is open, 14 days at most, and uses it for nothing else. If you do not accept, it is deleted. Who is responsible and your rights: {privacyUrl}',
    subject: '{name} has invited you to NutrIA'
  },
  'es-ES': {
    button: 'Ver la invitación',
    choose:
      'Antes de compartir nada verás exactamente qué podrá ver, y podrás decir que sí o que no. Cualquiera de los dos puede terminarlo cuando quiera. Si todavía no tienes cuenta en NutrIA, créala con esta dirección.',
    expires: 'La invitación funciona durante 14 días.',
    ignore: 'Si no sabes quién es, ignora este mensaje: no se comparte nada si no aceptas.',
    intro: '{name} te ha invitado a llevar tu plan de comidas juntos en NutrIA, como tu dietista.',
    linkFallback: 'Si el botón no funciona, copia esta dirección en tu navegador:',
    meaning: 'Si aceptas, verá tu plan y cómo lo llevas, y podrá ajustarlo contigo. Antes de aceptar verás la lista exacta.',
    privacy:
      'Te escribimos porque {name} nos ha dado tu dirección para invitarte. NutrIA la guarda solo mientras la invitación está abierta, 14 días como máximo, y no la usa para nada más. Si no aceptas, se borra. Quién es el responsable y tus derechos: {privacyUrl}',
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
      paragraph(copy.linkFallback, 'muted'),
      `<p style="margin:0;font-size:0.8125rem;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#5b7f3a;">${escapeHtml(url)}</a></p>`
    ].join('\n'),
    locale,
    title: subject
  });

  const text = [intro, copy.meaning, '', url, '', copy.choose, copy.expires, copy.ignore, '', privacy].join('\n');

  return { html, kind: 'care-invitation', subject, text };
}
