import { button, fallbackLink, layout, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

/** Longer than any name a person goes by; a subject is one line. */
const NAME_LIMIT = 80;

/**
 * The client's notice when the illness rule's daily sweep ends their link
 * (`docs/legal/textos/06` § Y, `0111` § 8, PRD 025 criterion 22): the
 * practitioner no longer holds NutrIA's badge while the client has a condition or
 * a medication on record.
 *
 * **To the client only, and only from the sweep** — a declaration's ending is told
 * on the screen of the person saving it, and a refused acceptance on the
 * invitation's page. **No word of health**: a mailbox and a lock screen are read
 * by others (RGPD arts. 5.1.f and 32), so the mail says only that the link ended
 * and where the reason is explained — the person's own profile
 * (`docs/legal/textos/05` § G.3). **Nothing to the practitioner** (legal F4): to
 * them the link reads as one the client ended, and no mail fires for them.
 */
const COPY: Record<EmailLocale, { body: string; button: string; linkFallback: string; subject: string }> = {
  'en-GB': {
    body: 'Your link with {professional} ended today. Your plan, your targets and your history stay with you. Sign in to NutrIA to see why: we explain it on your profile.',
    button: 'Open my profile',
    linkFallback: 'If the button does not work, copy this address into your browser:',
    subject: 'Your link with {professional} on NutrIA has ended'
  },
  'es-ES': {
    body: 'Tu enlace con {professional} ha terminado hoy. Tu plan, tus objetivos y tu historial se quedan contigo. Entra en NutrIA para ver por qué: te lo explicamos en tu perfil.',
    button: 'Abrir mi perfil',
    linkFallback: 'Si el botón no funciona, copia esta dirección en tu navegador:',
    subject: 'Tu enlace con {professional} en NutrIA ha terminado'
  }
};

/** The practitioner's name as a line of text: no line breaks (it goes in a subject header), no runs of spaces, and bounded. */
function oneLine(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT);
}

export function careLinkEndedByRuleEmail({
  locale,
  professionalName,
  url
}: {
  locale: EmailLocale;
  professionalName: string;
  url: string;
}): RenderedEmail {
  const copy = COPY[locale];
  const name = oneLine(professionalName);
  const subject = copy.subject.replace('{professional}', name);
  const body = copy.body.replace('{professional}', name);

  const html = layout({ body: [paragraph(body), button(url, copy.button), fallbackLink(copy.linkFallback, url)].join('\n'), locale, title: subject });

  return { html, kind: 'care-link-ended-by-rule', subject, text: [body, '', url].join('\n') };
}
