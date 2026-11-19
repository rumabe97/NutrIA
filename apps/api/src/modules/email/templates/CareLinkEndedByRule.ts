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
 *
 * **The name is judged first** (invariant review of phase 6, round two): the
 * badge has just gone, so a title it allowed in the practitioner's account name
 * («Ana, dietista») may not be mailed. The caller passes null for such a name
 * (`shownName`), and the mail is its no-name variant: `noName`.
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

/**
 * The no-name variant, for a name that may not be shown: `subjectNoName` and
 * `bodyNoName` of `docs/legal/textos/06` § Y, as drafted on 2026-11-19 (the
 * owner's approval pending), byte for byte — the approved neutral words («tu
 * profesional» / "your professional") in the name's place.
 */
const NO_NAME: Record<EmailLocale, { body: string; subject: string }> = {
  'en-GB': {
    body: 'Your link with your professional ended today. Your plan, your targets and your history stay with you. Sign in to NutrIA to see why: we explain it on your profile.',
    subject: 'Your link with your professional on NutrIA has ended'
  },
  'es-ES': {
    body: 'Tu enlace con tu profesional ha terminado hoy. Tu plan, tus objetivos y tu historial se quedan contigo. Entra en NutrIA para ver por qué: te lo explicamos en tu perfil.',
    subject: 'Tu enlace con tu profesional en NutrIA ha terminado'
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
  /** Null when the name may not be shown (`shownName`): the no-name variant goes. */
  professionalName: string | null;
  url: string;
}): RenderedEmail {
  const copy = COPY[locale];
  const named = professionalName === null ? null : oneLine(professionalName);
  const subject = named === null ? NO_NAME[locale].subject : copy.subject.replace('{professional}', named);
  const body = named === null ? NO_NAME[locale].body : copy.body.replace('{professional}', named);

  const html = layout({ body: [paragraph(body), button(url, copy.button), fallbackLink(copy.linkFallback, url)].join('\n'), locale, title: subject });

  return { html, kind: 'care-link-ended-by-rule', subject, text: [body, '', url].join('\n') };
}
