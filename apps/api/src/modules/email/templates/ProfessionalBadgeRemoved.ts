import { layout, paragraph } from './Layout.js';
import { badgeDay, fill, oneLine } from './ProfessionalBadgeCode.js';
import { asSentence } from 'core/domain/OwnerText';

import type { BadgeRemovalReason, BadgeRemovalSource } from 'core/entities/Professional';
import type { EmailLocale, RenderedEmail } from './Layout.js';

/**
 * The statement of reasons when the owner does not give a badge (`fail`) or
 * takes one back (`withdrawn`) (`docs/legal/textos/06` § W, DSA art. 17, P2B
 * art. 4): the decision, the facts, whether the owner acted on their own check
 * or on a notice — never who sent it — the clause, and how to ask again. No
 * health word, no client.
 */
type Copy = {
  readonly college: string;
  readonly reason: Readonly<Record<Exclude<BadgeRemovalReason, 'other'>, string>>;
  readonly redress: string;
  readonly source: Readonly<Record<BadgeRemovalSource, string>>;
  readonly subject: string;
  readonly what: { readonly fail: string; readonly withdrawn: string };
  readonly why: string;
};

const COPY: Record<EmailLocale, Copy> = {
  'en-GB': {
    college: 'your college',
    reason: {
      code_expired: 'The code expired without being entered.',
      not_me: 'The person listed on the register under that number has told us they did not apply for the badge.',
      not_on_register:
        '{register}’s register does not show you as registered and entitled to practise under number {number}, as checked on {checkedOn}.'
    },
    redress:
      'You can apply for the badge again from your practice whenever you like. If you think this is a mistake, reply to this email: a person reviews it and answers you, and if we reverse it you get the badge back as it was. You can also go to the courts.',
    source: { notice: 'We looked into it after a notice we received.', own_check: 'We decided it ourselves, from our own check.' },
    subject: 'About your NutrIA badge',
    what: {
      fail: 'We are not giving you the "Registered dietitian-nutritionist" badge. Your practice stays open as before.',
      withdrawn:
        'We are removing the "Registered dietitian-nutritionist" badge from today. Your practice stays open, and from your next request you see of each client what section 3 of the professional’s agreement describes "without the badge". The rest of what changes is in its section 4. The words in your profile that only the badge allows are no longer shown.'
    },
    why: 'Why: {reason} That is what section 4 of the professional’s agreement you accepted says. {source}'
  },
  'es-ES': {
    college: 'tu colegio',
    reason: {
      code_expired: 'El código caducó sin introducirse.',
      not_me: 'La persona que figura en el registro con ese número nos ha dicho que no ha pedido la insignia.',
      not_on_register: 'El registro de {register} no te muestra como colegiada/o habilitada/o con el número {number}, consultado el {checkedOn}.'
    },
    redress:
      'Puedes pedir la insignia de nuevo desde tu consulta cuando quieras. Si crees que es un error, responde a este correo: lo revisa una persona y te contesta, y si lo deshacemos recuperas la insignia como estaba. También puedes acudir a los tribunales.',
    source: { notice: 'Lo hemos revisado tras un aviso que nos llegó.', own_check: 'Lo hemos decidido nosotros, por nuestra comprobación.' },
    subject: 'Sobre tu insignia de NutrIA',
    what: {
      fail: 'No te damos la insignia «Dietista-nutricionista colegiada/o». Tu consulta sigue abierta como hasta ahora.',
      withdrawn:
        'Te retiramos la insignia «Dietista-nutricionista colegiada/o» desde hoy. Tu consulta sigue abierta, y desde tu siguiente petición ves de cada cliente lo que el § 3 del acuerdo del profesional describe «sin la insignia». Lo demás que cambia está en su § 4. Las palabras de tu perfil que solo permite la insignia ya no se muestran.'
    },
    why: 'Por qué: {reason} Es lo que dice el § 4 del acuerdo del profesional que aceptaste. {source}'
  }
};

export function professionalBadgeRemovedEmail({
  checkedOn,
  facts,
  kind,
  locale,
  number,
  reason,
  register,
  source
}: {
  checkedOn: Date;
  facts: string | null;
  kind: 'fail' | 'withdrawn';
  locale: EmailLocale;
  number: string | null;
  reason: BadgeRemovalReason;
  register: string | null;
  source: BadgeRemovalSource;
}): RenderedEmail {
  const copy = COPY[locale];
  // A sentence of their own, as §§ W bis and X close them: a stop when the owner typed none, so the next sentence does not run on.
  const written = facts === null ? null : asSentence(facts);
  const closed =
    reason === 'other'
      ? null
      : fill(copy.reason[reason], {
          checkedOn: badgeDay(checkedOn, locale),
          number: number === null ? '' : oneLine(number),
          register: register === null ? copy.college : oneLine(register)
        });
  // A closed reason, and the owner's facts after it when they added any (§ W: "puede añadir los hechos").
  const said = [closed, written].filter((part): part is string => part !== null && part.length > 0).join(' ');
  const why = fill(copy.why, { reason: said, source: copy.source[source] });
  const what = copy.what[kind];

  const html = layout({ body: [paragraph(what), paragraph(why), paragraph(copy.redress, 'muted')].join('\n'), locale, title: copy.subject });

  return { html, kind: 'professional-badge-removed', subject: copy.subject, text: [what, '', why, '', copy.redress].join('\n') };
}
