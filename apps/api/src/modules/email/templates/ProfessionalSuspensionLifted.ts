import { layout, paragraph } from './Layout.js';
import { fill } from './ProfessionalBadgeCode.js';
import { asClause } from './ProfessionalSuspended.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

const COPY: Record<EmailLocale, { readonly body: string; readonly subject: string; readonly why: string }> = {
  'en-GB': {
    body: 'From today you can open your practice on NutrIA again. {why}',
    subject: 'We have lifted the suspension of your account as a professional',
    why: 'We have looked into it and {facts}.'
  },
  'es-ES': {
    body: 'Desde hoy puedes volver a abrir tu consulta en NutrIA. {why}',
    subject: 'Hemos levantado la suspensión de tu cuenta como profesional',
    why: 'Lo hemos revisado y {facts}.'
  }
};

/**
 * The owner lifts a suspension (`docs/legal/textos/06` § W bis.2, approved by
 * the owner on 2026-11-19; P2B art. 4.3: reinstated without delay, and told).
 * `facts` is what the owner found, written to end the sentence «Lo hemos
 * revisado y …»; without it the mail says only that the practice can be opened
 * again. No health word, no client.
 */
export function professionalSuspensionLiftedEmail({ facts, locale }: { facts: string | null; locale: EmailLocale }): RenderedEmail {
  const copy = COPY[locale];
  const found = facts === null ? '' : asClause(facts);
  const body = fill(copy.body, { why: found === '' ? '' : fill(copy.why, { facts: found }) }).trim();
  const html = layout({ body: paragraph(body), locale, title: copy.subject });

  return { html, kind: 'professional-suspension-lifted', subject: copy.subject, text: body };
}
