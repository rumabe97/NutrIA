import { button, layout, paragraph } from './Layout.js';

import { safeCode } from 'core/controllers/Admin';

import type { EmailLocale, RenderedEmail } from './Layout.js';
import type { SpendSource, SpendThreshold } from 'core/controllers/Admin';

/**
 * To the owner, at once, when something cannot wait for the morning's digest
 * (`0071`): three generations in a row that failed, or a month's spend that
 * has reached 80 % or 100 % of its cap.
 *
 * Numbers, codes from a closed list and a link — the same rule as the digest,
 * for the same reason, and held by the same kind of spec.
 */
const LOCALE: EmailLocale = 'es-ES';

export type OwnerAlert =
  | {
      readonly capUsd: number;
      readonly share: number;
      readonly source: SpendSource;
      readonly spentUsd: number;
      readonly threshold: SpendThreshold;
      readonly type: 'spend';
    }
  | { readonly codes: readonly string[]; readonly type: 'failures' };

const SOURCE = { pictures: 'imágenes', text: 'texto' } as const;

function usd(value: number): string {
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} USD`;
}

export function ownerAlertEmail({ alert, link }: { alert: OwnerAlert; link: (path: string) => string }): RenderedEmail {
  const copy =
    alert.type === 'failures'
      ? {
          again: 'Si sigue fallando, no volverás a recibir este aviso durante 6 horas.',
          button: 'Abrir el registro',
          detail: `Códigos, del más reciente al más antiguo: ${alert.codes.map(safeCode).join(', ')}.`,
          intro: 'Las tres últimas generaciones de planes terminaron en fallo, una tras otra.',
          subject: 'NutrIA — tres generaciones seguidas han fallado',
          url: link('/admin/generacion?status=failed&since=24h')
        }
      : {
          again: 'Un aviso por umbral y mes: no volverá a llegar hasta el mes que viene.',
          button: 'Abrir el gasto',
          detail: `Van ${usd(alert.spentUsd)} de ${usd(alert.capUsd)}, el ${String(Math.round(alert.share * 100))} % del tope.`,
          intro: `El gasto de ${SOURCE[alert.source]} de este mes ha llegado al ${String(alert.threshold)} % de su tope.`,
          subject: `NutrIA — el gasto de ${SOURCE[alert.source]} ha llegado al ${String(alert.threshold)} %`,
          url: link(alert.source === 'text' ? '/admin/generacion/ia' : '/admin/catalogo/imagenes')
        };

  const html = layout({
    body: [paragraph(copy.intro), paragraph(copy.detail), button(copy.url, copy.button), paragraph(copy.again, 'muted')].join('\n'),
    locale: LOCALE,
    title: copy.subject
  });

  return { html, kind: 'owner-alert', subject: copy.subject, text: [copy.intro, copy.detail, '', copy.url, '', copy.again].join('\n') };
}
