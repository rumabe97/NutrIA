import { layout, paragraph } from './Layout.js';
import { badgeDay, fill } from './ProfessionalBadgeCode.js';
import { statementWhy } from './ProfessionalSuspended.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';
import type { PracticeStatement } from './ProfessionalSuspended.js';

const COPY: Record<EmailLocale, { readonly redress: string; readonly subject: string; readonly suspendedSuffix: string; readonly what: string }> = {
  'en-GB': {
    redress:
      'Until {closeDate} you can clarify the facts or ask us to look again by replying to this email: a person reviews it and answers you. You can also go to the courts.',
    subject: 'We are going to close your NutrIA practice on {closeDate}',
    suspendedSuffix: ', that is, suspended',
    what: 'On {closeDate} we will close your practice for good: you will lose access to your clients and your pending invitations will be cancelled. Until then it stays as it is{suspendedSuffix}. Your personal NutrIA account does not change.'
  },
  'es-ES': {
    redress:
      'Hasta el {closeDate} puedes aclarar los hechos o pedirnos que lo revisemos respondiendo a este correo: lo revisa una persona y te contesta. También puedes acudir a los tribunales.',
    subject: 'Vamos a cerrar tu consulta en NutrIA el {closeDate}',
    suspendedSuffix: ', es decir, suspendida',
    what: 'El {closeDate} cerraremos definitivamente tu consulta: perderás el acceso a tus clientes y tus invitaciones pendientes se anularán. Hasta esa fecha sigue como está{suspendedSuffix}. Tu cuenta personal de NutrIA no cambia.'
  }
};

/**
 * The notice of a close (`docs/legal/textos/06` § W bis.3, approved by the owner
 * on 2026-11-19; P2B art. 4.2: 30 days before, with the reasons), sent the day
 * the owner decides it. `closesAt` is the day it closes; `suspended` says the
 * practice stays suspended until then. Only the 30-day form: the approved
 * `immediate` variant is not built, because this code never closes before the
 * notice runs out. No health word, no client's name.
 */
export function professionalClosingEmail({
  closesAt,
  locale,
  statement,
  suspended
}: {
  closesAt: Date;
  locale: EmailLocale;
  statement: PracticeStatement;
  suspended: boolean;
}): RenderedEmail {
  const copy = COPY[locale];
  const closeDate = badgeDay(closesAt, locale);
  const subject = fill(copy.subject, { closeDate });
  const what = fill(copy.what, { closeDate, suspendedSuffix: suspended ? copy.suspendedSuffix : '' });
  const why = statementWhy(statement, locale);
  const redress = fill(copy.redress, { closeDate });
  const html = layout({ body: [paragraph(what), paragraph(why), paragraph(redress, 'muted')].join('\n'), locale, title: subject });

  return { html, kind: 'professional-closing', subject, text: [what, '', why, '', redress].join('\n') };
}
