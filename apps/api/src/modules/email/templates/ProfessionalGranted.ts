import { button, layout, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

/**
 * Tells a dietitian the owner has given them the practice (`0059`,
 * `docs/legal/textos/06` § B): the collegiate number the grant was made with,
 * that the agreement comes before any client's data, and a way to say it was
 * not them. Their own number, and nothing about anybody else.
 */
const COPY: Record<EmailLocale, { agreement: string; button: string; intro: string; notYou: string; subject: string }> = {
  'en-GB': {
    agreement:
      'Before you see any client’s data we will ask you to accept the professional’s agreement: secrecy, who is responsible for the data and what you may not do. Take your time reading it; it is short.',
    button: 'Open my practice',
    intro: 'We have given you access to the NutrIA practice as a dietitian-nutritionist, with registration number {collegiateNumber}.',
    notYou: 'If you did not ask for this, reply and we will revoke it.',
    subject: 'Your NutrIA practice is ready'
  },
  'es-ES': {
    agreement:
      'Antes de ver datos de ningún paciente te pediremos que aceptes el acuerdo del profesional: secreto, quién responde de los datos y qué no puedes hacer. Léelo con calma; es corto.',
    button: 'Abrir mi consulta',
    intro: 'Te hemos dado acceso a la consulta de NutrIA como dietista-nutricionista, con el número de colegiado {collegiateNumber}.',
    notYou: 'Si no has pedido esto, respóndenos y lo retiramos.',
    subject: 'Tu consulta en NutrIA está lista'
  }
};

export function professionalGrantedEmail({
  collegiateNumber,
  locale,
  url
}: {
  collegiateNumber: string;
  locale: EmailLocale;
  url: string;
}): RenderedEmail {
  const copy = COPY[locale];
  const intro = copy.intro.replace('{collegiateNumber}', collegiateNumber);

  const html = layout({
    body: [paragraph(intro), paragraph(copy.agreement), button(url, copy.button), paragraph(copy.notYou, 'muted')].join('\n'),
    locale,
    title: copy.subject
  });
  const text = [intro, '', copy.agreement, '', url, '', copy.notYou].join('\n');

  return { html, kind: 'professional-granted', subject: copy.subject, text };
}
