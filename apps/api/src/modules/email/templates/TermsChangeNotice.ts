import { layout, paragraph } from './Layout.js';
import { madridLongDay } from 'core/domain/Period';

import { fill } from './ProfessionalBadgeCode.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

/**
 * The change notice to every account before the `professional` switch
 * (`docs/legal/textos/06-correos.md` § Z, project 025 phase 10): from `{date}`
 * anyone adult may open a practice; what a professional without the badge sees
 * and never sees; the illness rule; no Premium from a link; where the details
 * are, whom to write to, and that the account can be deleted. The approved
 * words, byte for byte, in both languages.
 *
 * It names no client and nothing of the reader. It does carry health words —
 * «tu peso, tus objetivos, tu salud ni tus alergias», «una condición de salud o
 * una medicación» — as the generic list of what a professional without the
 * badge never sees and of what the rule protects, which § Z approves as such
 * (the same criterion as § Q: nothing about the person is revealed). Its spec
 * holds every health word to that one paragraph.
 */
type Copy = { readonly choose: string; readonly intro: string; readonly subject: string; readonly what: string };

const COPY: Record<EmailLocale, Copy> = {
  'en-GB': {
    choose:
      'The details are at {privacyUrl}, under "Your professional on NutrIA", and at {termsUrl}. If you have any question, write to us at {email}. If you do not agree, you can delete your account from your profile.',
    intro:
      'From {date}, any adult will be able to open a practice on NutrIA and make the meal plan of whoever invites them to. If you do not work with a professional, nothing changes for you.',
    subject: "NutrIA's privacy policy and terms are changing",
    what: 'Only someone with our "Registered dietitian-nutritionist" badge is a person we have checked on their college\'s register. A professional without it will see of you the plans they make for you and where they stand, never your weight, your targets, your health or your allergies, and before you accept their invitation you will see exactly what they will see. If you have a health condition or a medication on record, you will only be able to link with a professional who holds the badge. And being linked to a professional does not give you Premium.'
  },
  'es-ES': {
    choose:
      'Los detalles están en {privacyUrl}, en «Tu profesional en NutrIA», y en {termsUrl}. Si tienes cualquier duda, escríbenos a {email}. Si no estás de acuerdo, puedes borrar tu cuenta desde tu perfil.',
    intro:
      'A partir del {date}, cualquier persona mayor de edad podrá abrir una consulta en NutrIA y hacer el plan de comidas de quien la invite a ello. Si no trabajas con ningún profesional, para ti no cambia nada.',
    subject: 'Cambian la política de privacidad y las condiciones de NutrIA',
    what: 'Solo quien lleve nuestra insignia «Dietista-nutricionista colegiada/o» es alguien a quien hemos comprobado en el registro de su colegio. Un profesional sin ella verá de ti los planes que te haga y en qué punto están, nunca tu peso, tus objetivos, tu salud ni tus alergias, y antes de aceptar su invitación verás exactamente qué verá. Si tienes anotada una condición de salud o una medicación, solo podrás vincularte con un profesional con la insignia. Y estar vinculado a un profesional no da Premium.'
  }
};

/**
 * `effectiveOn` is the day the change is made, a Madrid calendar day
 * (`YYYY-MM-DD`), written in the reader's language by `madridLongDay` — the
 * function the console's preview uses to show it before anything is sent. `privacyUrl` and `termsUrl` are the reader's own
 * language's pages (`webUrl`), the policy's at `#tu-profesional`; `email` is the
 * address the service answers at.
 */
export function termsChangeNoticeEmail({
  effectiveOn,
  email,
  locale,
  privacyUrl,
  termsUrl
}: {
  effectiveOn: string;
  email: string;
  locale: EmailLocale;
  privacyUrl: string;
  termsUrl: string;
}): RenderedEmail {
  const copy = COPY[locale];
  const intro = fill(copy.intro, { date: madridLongDay(effectiveOn, locale) });
  const choose = fill(copy.choose, { email, privacyUrl, termsUrl });
  const html = layout({ body: [paragraph(intro), paragraph(copy.what), paragraph(choose)].join('\n'), locale, title: copy.subject });

  return { html, kind: 'terms-change-notice', subject: copy.subject, text: [intro, '', copy.what, '', choose].join('\n') };
}
