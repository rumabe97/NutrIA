import { layout, paragraph } from './Layout.js';
import { badgeDay, fill, oneLine } from './ProfessionalBadgeCode.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

/**
 * To the practitioner, once, on the day their badge's yearly re-check falls due
 * (`docs/legal/textos/06` § U.2, choice C5): nothing to do unless a new code
 * arrives, and the date it lapses if the re-check is not completed — even when
 * the delay is NutrIA's (finding F5). No health word, no client.
 */
const COPY: Record<EmailLocale, { college: string; intro: string; subject: string; what: string }> = {
  'en-GB': {
    college: 'your college',
    intro: 'It is a year since we checked your registration. We are going to look at {register}’s register again.',
    subject: 'Your NutrIA badge is due for its check',
    what: 'You need do nothing unless a new code reaches you: then enter it in your practice. If we have not completed it by {lapseDate}, your badge will lapse, even if the delay is ours, and from that day you will see of each client only the plans you make for them. You will be able to apply again.'
  },
  'es-ES': {
    college: 'tu colegio',
    intro: 'Hace un año que comprobamos tu colegiación. Vamos a volver a mirar el registro de {register}.',
    subject: 'Toca comprobar tu insignia de NutrIA',
    what: 'No tienes que hacer nada, salvo si te llega un código nuevo: entonces introdúcelo en tu consulta. Si el {lapseDate} no lo hemos completado, tu insignia caducará, aunque el retraso sea nuestro, y desde ese día verás de cada cliente solo los planes que le haces. Podrás volver a pedirla.'
  }
};

export function professionalBadgeDueEmail({
  lapsesAt,
  locale,
  register
}: {
  lapsesAt: Date;
  locale: EmailLocale;
  /** Null for a project 004 grant, which named no college: the mail says "your college". */
  register: string | null;
}): RenderedEmail {
  const copy = COPY[locale];
  const intro = fill(copy.intro, { register: register === null ? copy.college : oneLine(register) });
  const what = fill(copy.what, { lapseDate: badgeDay(lapsesAt, locale) });

  const html = layout({ body: [paragraph(intro), paragraph(what)].join('\n'), locale, title: copy.subject });

  return { html, kind: 'professional-badge-due', subject: copy.subject, text: [intro, '', what].join('\n') };
}
