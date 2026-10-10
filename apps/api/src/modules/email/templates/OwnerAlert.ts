import { button, layout, paragraph } from './Layout.js';

import { PICTURE_COOL_OFF_DAYS } from 'core/controllers/Recipe';
import { PICTURE_REASONS } from 'core/entities/DishPicture';
import { safeCode } from 'core/controllers/Admin';

import type { EmailKind, EmailLocale, RenderedEmail } from './Layout.js';
import type { SpendSource, SpendThreshold } from 'core/controllers/Admin';
import type { PictureReason } from 'core/entities/DishPicture';

/**
 * To the owner, at once, when something cannot wait for the morning's digest
 * (`0071`): three generations in a row that failed, a month's spend that
 * has reached 80 % or 100 % of its cap, the reminders cron gone quiet, or —
 * project 009 — dish pictures that failed and a provider turning the pictures'
 * key away (it cannot pay, or it reached its rate limit).
 *
 * Numbers, codes from a closed list and a link — the same rule as the digest,
 * for the same reason, and held by the same kind of spec. A picture's mail
 * names reasons and counts: never a dish, its id, or what a provider or the
 * judge wrote.
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
  | { readonly codes: readonly string[]; readonly type: 'failures' }
  | { readonly reasons: readonly { readonly n: number; readonly reason: PictureReason }[]; readonly type: 'picture-failures' }
  | { readonly reasons: readonly { readonly n: number; readonly reason: PictureReason }[]; readonly type: 'picture-payment-refused' }
  | { readonly type: 'reminders-silent' };

type Copy = {
  readonly again: string;
  readonly button: string;
  readonly detail: string;
  readonly intro: string;
  readonly subject: string;
  readonly url: string;
};

const SOURCE = { pictures: 'imágenes', text: 'texto' } as const;

/** The closed reasons in the console's own words (`admin.pictures.reasons` in the web's Spanish dictionary). */
const REASON: Readonly<Record<PictureReason, string>> = {
  call_failed: 'La llamada falló',
  cap_reached: 'Tope del mes alcanzado',
  judge_allergen: 'El revisor vio un alérgeno que el plato no tiene',
  judge_rejected: 'El revisor la rechazó',
  model_refused: 'El modelo rechazó la petición',
  no_provenance: 'Sin firma C2PA',
  other: 'Otro motivo',
  // Never in a mail: the failed pictures' count leaves the owner's own removals out (`AdminAlertController.pictureFailures`).
  owner_removed: 'Retirada a mano',
  payment_refused: 'El proveedor no puede cobrar',
  rate_limited: 'El proveedor pidió bajar el ritmo'
};

/** A reason's label; anything outside the closed set is "another reason", never shown as it came. */
function reasonLabel(reason: string): string {
  return REASON[PICTURE_REASONS.find(known => known === reason) ?? 'other'];
}

/** A count as a whole number, whatever arrived. */
function whole(value: number): string {
  return String(Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);
}

/** The counts by reason, each under its label. */
function byReason(reasons: readonly { readonly n: number; readonly reason: string }[]): string {
  return `Por motivo: ${reasons.map(({ n, reason }) => `${reasonLabel(reason)}: ${whole(n)}`).join('; ')}.`;
}

function usd(value: number): string {
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} USD`;
}

function copyOf(alert: OwnerAlert, link: (path: string) => string): Copy {
  switch (alert.type) {
    case 'reminders-silent':
      return {
        again: 'Si sigue sin correr, no volverás a recibir este aviso hasta mañana.',
        button: 'Abrir Sistema',
        detail:
          'Los recordatorios, el resumen de la mañana y el borrado de las invitaciones caducadas salen de esa tarea: mientras no corra, no ocurren.',
        intro: 'La tarea de recordatorios lleva más de 26 h sin correr.',
        subject: 'NutrIA — la tarea de recordatorios lleva más de 26 h sin correr',
        url: link('/admin/ajustes/sistema')
      };
    case 'failures':
      return {
        again: 'Si sigue fallando, no volverás a recibir este aviso durante 6 horas.',
        button: 'Abrir el registro',
        detail: `Códigos, del más reciente al más antiguo: ${alert.codes.map(safeCode).join(', ')}.`,
        intro: 'Las tres últimas generaciones de planes terminaron en fallo, una tras otra.',
        subject: 'NutrIA — tres generaciones seguidas han fallado',
        url: link('/admin/generacion?status=failed&since=24h')
      };

    case 'picture-failures': {
      const total = whole(alert.reasons.reduce((sum, { n }) => sum + n, 0));

      return {
        again: 'Como mucho un aviso por hora: lo que falle mientras tanto irá en el siguiente.',
        button: 'Abrir las imágenes fallidas',
        detail: byReason(alert.reasons),
        intro: `Imágenes de platos que han fallado desde el aviso anterior: ${total}. Cada plato espera al menos ${String(PICTURE_COOL_OFF_DAYS)} días antes de volver a dibujarse solo.`,
        subject: `NutrIA — imágenes de platos fallidas: ${total}`,
        url: link('/admin/catalogo?picture=failed')
      };
    }

    case 'picture-payment-refused': {
      const total = whole(alert.reasons.reduce((sum, { n }) => sum + n, 0));

      return {
        again: 'Mientras dure, no volverás a recibir este aviso durante 6 horas.',
        button: 'Abrir las imágenes',
        detail: `Platos con el dibujo devuelto desde el aviso anterior: ${total}. ${byReason(alert.reasons)} Esos platos no cuentan como fallidos: se dibujan en la siguiente visita, cuando el proveedor vuelva a aceptar peticiones.`,
        intro:
          'El proveedor está devolviendo peticiones de los dibujos. El motivo va debajo, y no son lo mismo: "no puede cobrar" es que la clave no puede pagar o agotó su cuota; "pidió bajar el ritmo" es un límite de velocidad suyo, pasajero y ajeno a tu cuenta; "rechazó la petición" es su propia negativa. Mientras dure, los dibujos que devuelva se devuelven sin dibujar.',
        subject: 'NutrIA — el proveedor de imágenes rechaza las peticiones',
        url: link('/admin/catalogo/imagenes')
      };
    }

    case 'spend':
      return {
        again: 'Un aviso por umbral y mes: no volverá a llegar hasta el mes que viene.',
        button: 'Abrir el gasto',
        detail: `Van ${usd(alert.spentUsd)} de ${usd(alert.capUsd)}, el ${String(Math.round(alert.share * 100))} % del tope.`,
        intro: `El gasto de ${SOURCE[alert.source]} de este mes ha llegado al ${String(alert.threshold)} % de su tope.`,
        subject: `NutrIA — el gasto de ${SOURCE[alert.source]} ha llegado al ${String(alert.threshold)} %`,
        url: link(alert.source === 'text' ? '/admin/generacion/ia' : '/admin/catalogo/imagenes')
      };
  }
}

export function ownerAlertEmail({ alert, link }: { alert: OwnerAlert; link: (path: string) => string }): RenderedEmail {
  const copy = copyOf(alert, link);
  // The pictures' mails have a label of their own, so Sistema counts them apart from the other alerts.
  const kind: EmailKind = alert.type === 'picture-failures' || alert.type === 'picture-payment-refused' ? 'owner-picture-alert' : 'owner-alert';

  const html = layout({
    body: [paragraph(copy.intro), paragraph(copy.detail), button(copy.url, copy.button), paragraph(copy.again, 'muted')].join('\n'),
    locale: LOCALE,
    title: copy.subject
  });

  return { html, kind, subject: copy.subject, text: [copy.intro, copy.detail, '', copy.url, '', copy.again].join('\n') };
}
