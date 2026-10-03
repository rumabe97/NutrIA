import { safeCode, safeKind, SPEND_WARN_SHARE, ZERO_ITEMS } from 'core/controllers/Admin';

import { escapeHtml, layout, paragraph } from './Layout.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';
import type { OwnerDigest, SpendFigure } from 'core/controllers/Admin';

/**
 * To the owner, once a day and only when something wants a look (`0071`).
 *
 * **Numbers and links, nothing else.** The mail leaves through a provider and
 * sits in an inbox that is less safe than the console, so it names nobody: no
 * address, no id, no message, no dish, no error text. That is enforced by the
 * type it renders — `OwnerDigest` has no free-text field — and by a spec that
 * fills every source with a sentinel and refuses to find it here.
 *
 * The only two strings that come from the database — a failure code and a mail
 * template's label — are passed through `safeCode` / `safeKind` here as well as in
 * core, so this file alone guarantees they are a code or a label and never text.
 *
 * Spanish only, like the other mails to the owner (`OWNER_LOCALE`).
 */
const LOCALE: EmailLocale = 'es-ES';

const SUBJECT = 'NutrIA — resumen del día';
const INTRO = 'Esto es lo que hoy pide una mirada. Solo hay números, códigos y enlaces.';
const OPEN = 'Abrir en la consola';
const FOOT = 'Este correo no lleva el correo electrónico, el nombre ni el texto de ninguna persona usuaria.';

const ZERO_LABEL: Record<(typeof ZERO_ITEMS)[number]['key'], string> = {
  mealsOutsideServingBounds: 'Comidas con raciones fuera de los límites',
  overBound: 'Recetas por encima del límite de una ración',
  refusalLimit: 'Recetas que el barrido ya no reintenta',
  uncosted: 'Recetas cuyos macros no se pueden calcular',
  unserved: 'Platos sin ingredientes que sirvan a sus comidas'
};

const CRON_LABEL = {
  activations: 'activación de planes en su día',
  reminders: 'recordatorios',
  rewrite: 'reescritura nocturna',
  twoFactorRemovals: 'retirada de segundos factores',
  verifications: 'borrado de enlaces caducados'
} as const;

type Section = { readonly lines: readonly string[]; readonly title: string; readonly url: string };

function number(value: number): string {
  return value.toLocaleString('es-ES');
}

function usd(value: number): string {
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} USD`;
}

function percent(share: number): string {
  return `${String(Math.round(share * 100))} %`;
}

function spend(label: string, figure: SpendFigure | undefined, url: string): Section[] {
  return figure !== undefined && figure.share >= SPEND_WARN_SHARE
    ? [{ lines: [], title: `${label}: ${usd(figure.spentUsd)} de ${usd(figure.capUsd)} (${percent(figure.share)})`, url }]
    : [];
}

function sections(digest: OwnerDigest, link: (path: string) => string): Section[] {
  const failed = digest.failedGenerations.reduce((sum, row) => sum + row.n, 0);
  const mail = digest.failedMail.reduce((sum, row) => sum + row.n, 0);

  return [
    ...(digest.waitingAccounts > 0
      ? [{ lines: [], title: `Cuentas esperando: ${number(digest.waitingAccounts)}`, url: link('/admin/cuentas?activated=no') }]
      : []),
    ...(digest.newMessages > 0
      ? [{ lines: [], title: `Mensajes nuevos en el buzón: ${number(digest.newMessages)}`, url: link('/admin/buzon?state=waiting') }]
      : []),
    ...(failed > 0
      ? [
          {
            lines: digest.failedGenerations.map(row => `${safeCode(row.code)}: ${number(row.n)}`),
            title: `Generaciones fallidas en 24 h: ${number(failed)}`,
            url: link('/admin/generacion?status=failed&since=24h')
          }
        ]
      : []),
    ...spend('Gasto de texto este mes', digest.textSpend, link('/admin/generacion/ia')),
    ...spend('Gasto de imágenes este mes', digest.pictureSpend, link('/admin/catalogo/imagenes')),
    ...ZERO_ITEMS.flatMap(item =>
      digest.shouldBeZero[item.key] > 0
        ? [
            {
              lines: [],
              title: `${ZERO_LABEL[item.key]} (debería ser cero): ${number(digest.shouldBeZero[item.key])}`,
              url: link('check' in item ? `/admin/catalogo?check=${item.check}` : '/admin/catalogo/calidad')
            }
          ]
        : []
    ),
    ...(mail > 0
      ? [
          {
            lines: digest.failedMail.map(row => `${safeKind(row.kind)}: ${number(row.n)}`),
            title: `Correos fallidos en 24 h: ${number(mail)}`,
            url: link('/admin/ajustes/sistema')
          }
        ]
      : []),
    ...(digest.crons.length > 0
      ? [
          {
            lines: digest.crons.map(job => CRON_LABEL[job]),
            title: 'Tareas programadas sin correr en más de 26 h',
            url: link('/admin/ajustes/sistema')
          }
        ]
      : [])
  ];
}

/** `link` turns a console path into an absolute address (`webUrl` over `APP_URL`). */
export function ownerDigestEmail({ digest, link }: { digest: OwnerDigest; link: (path: string) => string }): RenderedEmail {
  const list = sections(digest, link);

  const html = layout({
    body: [
      paragraph(INTRO),
      ...list.map(
        section =>
          `<p style="margin:0 0 1rem;font-size:1rem;line-height:1.5;"><strong>${escapeHtml(section.title)}</strong>${section.lines
            .map(line => `<br>${escapeHtml(line)}`)
            .join('')}<br><a href="${escapeHtml(section.url)}">${OPEN}</a></p>`
      ),
      paragraph(FOOT, 'muted')
    ].join('\n'),
    locale: LOCALE,
    title: SUBJECT
  });

  return {
    html,
    kind: 'owner-digest',
    subject: SUBJECT,
    text: [INTRO, '', ...list.flatMap(section => [section.title, ...section.lines.map(line => `  ${line}`), `  ${section.url}`, '']), FOOT].join('\n')
  };
}
