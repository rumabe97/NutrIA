import { layout, paragraph } from './Layout.js';
import { fill, oneLine } from './ProfessionalBadgeCode.js';
import { asSentence, plainFacts } from 'core/domain/OwnerText';
import { inHideOrder } from 'core/entities/Professional';

import type { ProfileHideReason } from 'core/entities/Professional';
import type { EmailLocale, RenderedEmail } from './Layout.js';

type Copy = {
  readonly noticeSuffix: string;
  readonly reason: Readonly<Record<ProfileHideReason, string>>;
  readonly redress: string;
  readonly subject: string;
  readonly what: string;
  readonly why: string;
};

const COPY: Record<EmailLocale, Copy> = {
  'en-GB': {
    noticeSuffix: ', after a notice we received',
    reason: {
      advertising: 'It is advertising unrelated to your services.',
      badge_word: 'It uses a word the agreement does not allow without the badge: "{word}".',
      disease: 'It offers a service for a disease.',
      promises: 'It promises results.',
      unchecked_title: 'It presents a title NutrIA does not check: "{word}".'
    },
    redress:
      'Edit your profile and it goes back for review: if it no longer has what we mention, it will stop being hidden. If you think this is a mistake, reply to this email: a person reviews it and answers you. You can also go to the courts.',
    subject: 'We have hidden your NutrIA profile',
    what: 'We have hidden your profile. Today no profile is shown to anyone outside your practice, so in practice nothing changes; but while it stays hidden it will not appear anywhere NutrIA shows profiles. Your practice and your clients carry on as they were.',
    why: 'Why: {reason} That is what sections 2 and 5 of the professional’s agreement you accepted say. A person saw it, not a program, in the review we make of every profile{noticeSuffix}.'
  },
  'es-ES': {
    noticeSuffix: ', después de un aviso que nos llegó',
    reason: {
      advertising: 'Es publicidad que no tiene que ver con tus servicios.',
      badge_word: 'Usa una palabra que el acuerdo no permite sin la insignia: «{word}».',
      disease: 'Ofrece un servicio para una enfermedad.',
      promises: 'Promete resultados.',
      unchecked_title: 'Se presenta con un título que NutrIA no comprueba: «{word}».'
    },
    redress:
      'Edita tu perfil y volverá a la revisión: si ya no tiene lo que te decimos, dejará de estar oculto. Si crees que es un error, responde a este correo: lo revisa una persona y te contesta. También puedes acudir a los tribunales.',
    subject: 'Hemos ocultado tu perfil de NutrIA',
    what: 'Hemos ocultado tu perfil. Hoy ningún perfil se muestra a nadie fuera de tu consulta, así que en la práctica no cambia nada; pero mientras siga oculto no aparecerá en ningún sitio donde NutrIA muestre perfiles. Tu consulta y tus clientes siguen como estaban.',
    why: 'Por qué: {reason} Es lo que dicen los §§ 2 y 5 del acuerdo del profesional que aceptaste. Lo ha visto una persona, no un programa, en la revisión que hacemos de cada perfil{noticeSuffix}.'
  }
};

/**
 * The statement of reasons when the owner hides a profile from the first look
 * (`docs/legal/textos/06` § X, approved by the owner on 2026-11-19; DSA art.
 * 17.1.a and 17.3): refusing and hiding are one act (legal F6), so this is the
 * one mail for both. The closed reasons in the order the table lists them,
 * the owner's facts after them, whether a notice set it off — never who sent
 * it — and how to have it looked at again.
 *
 * `word` is the word the owner quotes, as plain text on one line. The approved
 * text names a disease only as the kind of service offered («un servicio para
 * una enfermedad»), never anybody's; it names no client.
 */
export function professionalProfileHiddenEmail({
  afterNotice,
  facts,
  locale,
  reasons,
  word
}: {
  afterNotice: boolean;
  facts: string | null;
  locale: EmailLocale;
  reasons: readonly ProfileHideReason[];
  word: string | null;
}): RenderedEmail {
  const copy = COPY[locale];
  const quoted = word === null ? '' : oneLine(plainFacts(word));
  // The approved table's order (`PROFILE_HIDE_REASONS`), never the keys' alphabetical one nor the owner's click order.
  const closed = inHideOrder(reasons).map(reason => fill(copy.reason[reason], { word: quoted }));
  const said = [...closed, ...(facts === null ? [] : [asSentence(facts)])].filter(part => part !== '').join(' ');
  const why = fill(copy.why, { noticeSuffix: afterNotice ? copy.noticeSuffix : '', reason: said });
  const html = layout({ body: [paragraph(copy.what), paragraph(why), paragraph(copy.redress, 'muted')].join('\n'), locale, title: copy.subject });

  return { html, kind: 'professional-profile-hidden', subject: copy.subject, text: [copy.what, '', why, '', copy.redress].join('\n') };
}
