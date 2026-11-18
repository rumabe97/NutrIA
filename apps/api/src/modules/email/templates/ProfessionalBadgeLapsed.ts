import { layout, paragraph } from './Layout.js';
import { badgeDay, fill } from './ProfessionalBadgeCode.js';

import type { BadgeLapseDetail } from 'core/entities/Professional';
import type { EmailLocale, RenderedEmail } from './Layout.js';

/**
 * The statement of reasons for a lapsed badge (`docs/legal/textos/06` § V, DSA
 * art. 17), once, when the daily sweep writes the `lapsed` row: what changes,
 * why — the re-check fell due and, 30 days on, was not completed, and which of
 * the two reasons the sweep can tell (a code never entered, or the owner's
 * delay) — and how to ask again. It never says whether a link ended, or how
 * many: that would tell the practitioner which client had something on record
 * (finding F4). No health word, no client.
 */
const COPY: Record<EmailLocale, { detail: Readonly<Record<BadgeLapseDetail, string>>; redress: string; subject: string; what: string; why: string }> =
  {
    'en-GB': {
      detail: { code_not_entered: 'We sent you a code and it was not entered.', our_delay: 'The delay was ours: we did not get to it in time.' },
      redress:
        'You can apply for the badge again from your practice whenever you like. If you think this is a mistake, reply to this email: a person reviews it and answers you, and if we reverse it you get the badge back as it was. You can also go to the courts.',
      subject: 'Your NutrIA badge has lapsed',
      what: 'From today you no longer hold the "Registered dietitian-nutritionist" badge. Your practice stays open, and from your next request you see of each client what section 3 of the professional’s agreement describes "without the badge". The rest of what changes is in its section 4. The words in your profile that only the badge allows are no longer shown, and your profile goes back for review.',
      why: 'Why: the yearly check was due on {dueDate} and, 30 days later, we had not completed it. {detail} That is what section 4 of the professional’s agreement you accepted says. We decided it ourselves, with no third-party notice.'
    },
    'es-ES': {
      detail: {
        code_not_entered: 'Te enviamos un código y no llegó a introducirse.',
        our_delay: 'El retraso ha sido nuestro: no llegamos a hacerla a tiempo.'
      },
      redress:
        'Puedes volver a pedir la insignia desde tu consulta cuando quieras. Si crees que es un error, responde a este correo: lo revisa una persona y te contesta, y si lo deshacemos recuperas la insignia como estaba. También puedes acudir a los tribunales.',
      subject: 'Tu insignia de NutrIA ha caducado',
      what: 'Desde hoy no tienes la insignia «Dietista-nutricionista colegiada/o». Tu consulta sigue abierta, y desde tu siguiente petición ves de cada cliente lo que el § 3 del acuerdo del profesional describe «sin la insignia». Lo demás que cambia está en su § 4. Las palabras de tu perfil que solo permite la insignia ya no se muestran, y tu perfil vuelve a revisión.',
      why: 'Por qué: la comprobación anual vencía el {dueDate} y, 30 días después, no la habíamos completado. {detail} Es lo que dice el § 4 del acuerdo del profesional que aceptaste. Lo hemos decidido nosotros, sin ninguna notificación de terceros.'
    }
  };

export function professionalBadgeLapsedEmail({
  detail,
  dueAt,
  locale
}: {
  detail: BadgeLapseDetail;
  dueAt: Date;
  locale: EmailLocale;
}): RenderedEmail {
  const copy = COPY[locale];
  const why = fill(copy.why, { detail: copy.detail[detail], dueDate: badgeDay(dueAt, locale) });

  const html = layout({ body: [paragraph(copy.what), paragraph(why), paragraph(copy.redress, 'muted')].join('\n'), locale, title: copy.subject });

  return { html, kind: 'professional-badge-lapsed', subject: copy.subject, text: [copy.what, '', why, '', copy.redress].join('\n') };
}
