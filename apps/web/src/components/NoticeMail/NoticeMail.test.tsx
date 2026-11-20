import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';
import { esES } from 'i18n/dictionaries/es-ES';

import { NoticeMail } from './NoticeMail';

const links = { privacyUrl: 'https://nutria.example/privacidad#tu-profesional', termsUrl: 'https://nutria.example/condiciones' };

function text(date: string | null): string {
  const markup = renderToStaticMarkup(
    <NoticeMail
      date={date}
      dateUnset={esES.adminNotice.dateUnset}
      email="hola@nutria.example"
      lang="es"
      language="Español"
      links={links}
      subjectLabel={esES.adminNotice.mailSubject}
      words={esES.adminNotice.mail}
    />
  );

  return markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

describe('NoticeMail', () => {
  it('reads as the mail: the subject, the day as the preview writes it, the links and the address filled', () => {
    const mail = text('1 de diciembre de 2026');

    expect(mail).toContain(esES.adminNotice.mail.subject);
    expect(mail).toContain('A partir del 1 de diciembre de 2026, cualquier persona mayor de edad');
    expect(mail).toContain(`Los detalles están en ${links.privacyUrl}, en «Tu profesional en NutrIA», y en ${links.termsUrl}.`);
    expect(mail).toContain('escríbenos a hola@nutria.example');
    expect(mail).not.toMatch(/\{\w+\}/);
  });

  it('says where the day goes before there is one', () => {
    expect(text(null)).toContain(`A partir del ${esES.adminNotice.dateUnset},`);
  });
});
