import { escapeHtml, layout, markup, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';

const TIME_ZONE = 'Europe/Madrid';

/**
 * The badge's code, by e-mail (`docs/legal/textos/06` § R, PRD 025 scope 6), to
 * the address **a college's public register lists** — typed by the owner from
 * that register, used for this mail and never stored.
 *
 * The recipient may not be the person who applied (finding F2): somebody may
 * have borrowed a real dietitian's name and number. So it carries the art. 14
 * information — where the address came from, why, what is kept, and the policy
 * for the rest — and the way out, "if it was not you". It names nothing of the
 * applicant's account beyond what the register already publishes, and no
 * health word. A reply reaches the owner: the mail leaves from the owner's
 * address.
 */
const COPY: Record<EmailLocale, { ifNot: string; ifYou: string; intro: string; source: string; subject: string; why: string }> = {
  'en-GB': {
    ifNot:
      'If it was not you, do nothing with the code and reply to this email: somebody has used your name and number. We will not give the badge, and we will not write to you about this again.',
    ifYou: 'If it was you, sign in to NutrIA, go to your practice and enter this code: {code}. It expires on {expires}.',
    intro:
      'We are writing from NutrIA, a meal-planning app. A NutrIA account has applied for our registered dietitian-nutritionist badge with this name and number: {registerName}, number {number}, of {register}.',
    source: '{register}’s public register of members, which publishes it so that anyone can check a registration',
    subject: 'Your code to check your registration on NutrIA',
    why: 'We took this address from {source}. We use it only to send you this code, to check that the person applying for the badge is you, in our legitimate interest and that of the people who use NutrIA: that nobody passes themselves off as a dietitian-nutritionist. We do not keep it on NutrIA; we delete the copy of this email in our mailbox when the code expires. We keep the register we looked at, the date, the number, the result and that the code went by email. Who is responsible, your rights and how to complain to the Spanish Data Protection Agency: {privacyUrl}'
  },
  'es-ES': {
    ifNot:
      'Si no has sido tú, no hagas nada con el código y respóndenos a este correo: alguien ha usado tu nombre y tu número. No daremos la insignia y no volveremos a escribirte por esto.',
    ifYou: 'Si has sido tú, entra en NutrIA, ve a tu consulta e introduce este código: {code}. Caduca el {expires}.',
    intro:
      'Te escribimos desde NutrIA, una aplicación de planes de comidas. Una cuenta de NutrIA ha pedido nuestra insignia de dietista-nutricionista colegiada/o con este nombre y este número: {registerName}, número {number}, de {register}.',
    // § R writes «de {source}» with «el registro…»: Spanish contracts «de el» to «del», so the article moves into `why`.
    source: 'registro público de colegiados de {register}, que la publica para que cualquiera pueda comprobar una colegiación',
    subject: 'Tu código para comprobar tu colegiación en NutrIA',
    why: 'Hemos sacado esta dirección del {source}. La usamos solo para enviarte este código, para comprobar que quien pide la insignia eres tú, por nuestro interés legítimo y el de quienes usan NutrIA: que nadie se haga pasar por dietista-nutricionista. En NutrIA no la guardamos; la copia de este correo en nuestro buzón la borramos cuando caduca el código. Guardamos el registro consultado, la fecha, el número, el resultado y que el código fue por correo. Quién es el responsable, tus derechos y cómo reclamar ante la Agencia Española de Protección de Datos: {privacyUrl}'
  }
};

/** Placeholders filled in one pass, so a value that holds `{…}` is never read as another placeholder. Shared by the badge's mails. */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

/** A date as the badge's mails write it: the day, in Madrid. */
export function badgeDay(at: Date, locale: EmailLocale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: TIME_ZONE }).format(at);
}

/** One line, bounded: a name or a college as somebody typed it goes into a sentence. */
export function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function professionalBadgeCodeEmail({
  code,
  expires,
  locale,
  number,
  privacyUrl,
  register,
  registerName
}: {
  code: string;
  expires: Date;
  locale: EmailLocale;
  number: string;
  privacyUrl: string;
  register: string;
  registerName: string;
}): RenderedEmail {
  const copy = COPY[locale];
  const values = {
    code,
    expires: badgeDay(expires, locale),
    number: oneLine(number),
    register: oneLine(register),
    registerName: oneLine(registerName)
  };
  const source = fill(copy.source, values);
  const intro = fill(copy.intro, values);
  const ifYou = fill(copy.ifYou, values);
  const why = fill(copy.why, { ...values, privacyUrl, source });
  // The code in bold where it sits, so it is found at a glance; the sentence is the same as the text part's.
  const [before, after] = fill(copy.ifYou, { ...values, code: '\u0000' }).split('\u0000');

  const html = layout({
    body: [
      paragraph(intro),
      markup(`${escapeHtml(before ?? '')}<strong>${escapeHtml(code)}</strong>${escapeHtml(after ?? '')}`),
      paragraph(copy.ifNot),
      paragraph(why, 'muted')
    ].join('\n'),
    locale,
    title: copy.subject
  });
  const text = [intro, '', ifYou, '', copy.ifNot, '', why].join('\n');

  return { html, kind: 'professional-badge-code', subject: copy.subject, text };
}
