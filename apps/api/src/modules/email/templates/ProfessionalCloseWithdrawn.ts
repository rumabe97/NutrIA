import { layout, paragraph } from './Layout.js';
import { badgeDay, fill } from './ProfessionalBadgeCode.js';
import { asClause } from './ProfessionalSuspended.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

type Copy = {
  /** After the close was carried out on its day: the practice can be opened again, empty. */
  readonly after: { readonly body: string; readonly subject: string };
  /** Before the close was carried out: it will not happen. */
  readonly before: { readonly body: string; readonly subject: string };
  readonly liftedSuffix: string;
  readonly why: string;
};

/**
 * `docs/legal/textos/06` § W bis.4, approved by the owner on 2026-11-19. Each
 * sentence lives in one key, so a change of words is one edit, and the text is
 * copied from the file byte for byte.
 */
const COPY: Record<EmailLocale, Copy> = {
  'en-GB': {
    after: {
      body: "We have reversed the close of your practice of {closeDate}. From today you can open it again on NutrIA; when you do, we will ask you to accept the professional's agreement again. Your profile is still there. If you held the badge, it was withdrawn with the close: you can apply for it again from your practice and, until then, the words in your profile that only the badge allows are not shown and, if it carries any, your profile has gone back for review. The links with your clients ended with the close and do not come back by themselves: to pick them up again, invite each person again, and they will see the list again and decide. {why}",
      subject: 'You can open your NutrIA practice again'
    },
    before: {
      body: 'We have cancelled the close of your practice we announced for {closeDate}: it will not happen. Your practice stays open{liftedSuffix}. {why}',
      subject: 'We are not going to close your NutrIA practice'
    },
    liftedSuffix: ', and we have also lifted the suspension',
    why: 'We have looked into it and {facts}.'
  },
  'es-ES': {
    after: {
      body: 'Hemos revocado el cierre de tu consulta del {closeDate}. Desde hoy puedes volver a abrirla en NutrIA; al hacerlo te pediremos aceptar de nuevo el acuerdo del profesional. Tu perfil sigue ahí. Si tenías la insignia, se retiró con el cierre: puedes volver a pedirla desde tu consulta y, mientras tanto, las palabras de tu perfil que solo permite la insignia no se muestran y, si las lleva, tu perfil ha vuelto a revisión. Los enlaces con tus clientes terminaron con el cierre y no vuelven solos: para retomarlos, invita de nuevo a cada persona, que verá otra vez la lista y decidirá. {why}',
      subject: 'Puedes volver a abrir tu consulta en NutrIA'
    },
    before: {
      body: 'Hemos anulado el cierre de tu consulta que te anunciamos para el {closeDate}: no se va a producir. Tu consulta sigue abierta{liftedSuffix}. {why}',
      subject: 'No vamos a cerrar tu consulta en NutrIA'
    },
    liftedSuffix: ', y también hemos levantado la suspensión',
    why: 'Lo hemos revisado y {facts}.'
  }
};

/**
 * The owner withdraws a close (`docs/legal/textos/06` § W bis.4; P2B art. 4.3):
 * `carriedOut` picks the variant — before the close was carried out it will not
 * happen; after, the practice can be opened again and starts empty. `closesAt`
 * is the close's day. `liftedSuspension` says a suspension was lifted in the
 * same act (only the "before" variant has room for it). `facts` is what the
 * owner found, plain text, ending the sentence «Lo hemos revisado y …». No
 * health word, no client.
 */
export function professionalCloseWithdrawnEmail({
  carriedOut,
  closesAt,
  facts,
  liftedSuspension,
  locale
}: {
  carriedOut: boolean;
  closesAt: Date;
  facts: string | null;
  liftedSuspension: boolean;
  locale: EmailLocale;
}): RenderedEmail {
  const copy = COPY[locale];
  const variant = carriedOut ? copy.after : copy.before;
  const found = facts === null ? '' : asClause(facts);
  const body = fill(variant.body, {
    closeDate: badgeDay(closesAt, locale),
    liftedSuffix: liftedSuspension ? copy.liftedSuffix : '',
    why: found === '' ? '' : fill(copy.why, { facts: found })
  }).trim();
  const html = layout({ body: paragraph(body), locale, title: variant.subject });

  return { html, kind: 'professional-close-withdrawn', subject: variant.subject, text: body };
}
