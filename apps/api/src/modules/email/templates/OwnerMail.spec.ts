import { describe, expect, it } from '@jest/globals';

import { ownerAlertEmail } from './OwnerAlert.js';
import { ownerDigestEmail } from './OwnerDigest.js';

import type { OwnerAlert } from './OwnerAlert.js';
import type { OwnerDigest } from 'core/controllers/Admin';

function link(path: string): string {
  return `https://nutria.example${path}`;
}

/**
 * What is in the database and must never reach the owner's inbox (`0071`): an
 * address, an account id, anybody's text. The renderers take types with no room
 * for them, so this fills the only strings that do travel — a code, a template
 * label — with the worst a source could hold and proves none of it survives,
 * and renders a realistic case to prove the rest carries no `@` or id.
 */
const SENTINELS = [
  'SENTINEL-MESSAGE-BODY',
  'SENTINEL-DISH-NAME',
  'SENTINEL-ERROR-TEXT',
  'someone@example.com',
  '3f2b8c1e-9d4a-4b7e-8a11-0c5d6e7f8a90',
  'usr-ab12cd34'
];

const DIGEST: OwnerDigest = {
  crons: ['rewrite'],
  failedGenerations: [
    { code: 'GENERATION_AI_UNAVAILABLE', n: 3 },
    { code: 'OTHER', n: 1 }
  ],
  failedMail: [{ kind: 'verify-email', n: 2 }],
  newMessages: 4,
  pictureSpend: { capUsd: 10, share: 0.93, spentUsd: 9.3 },
  shouldBeZero: { mealsOutsideServingBounds: 2, overBound: 5, refusalLimit: 1, uncosted: 0, unserved: 3 },
  textSpend: { capUsd: 25, share: 0.84, spentUsd: 21 },
  waitingAccounts: 2
};

const ALERTS: readonly OwnerAlert[] = [
  { codes: ['GENERATION_AI_UNAVAILABLE', 'GENERATION_TIMED_OUT', 'OTHER'], type: 'failures' },
  { capUsd: 25, share: 0.84, source: 'text', spentUsd: 21, threshold: 80, type: 'spend' },
  { capUsd: 10, share: 1.02, source: 'pictures', spentUsd: 10.2, threshold: 100, type: 'spend' },
  { type: 'reminders-silent' }
];

function everything(mail: { html: string; subject: string; text: string }): string {
  return [mail.subject, mail.text, mail.html].join('\n');
}

function expectNothingPersonal(output: string): void {
  expect(output).not.toContain('@');
  expect(output).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  expect(output).not.toMatch(/\busr-/i);

  for (const sentinel of SENTINELS) {
    expect(output).not.toContain(sentinel);
  }
}

describe('the owner’s digest', () => {
  it('carries numbers and a console link for each item, and nothing personal', () => {
    const mail = ownerDigestEmail({ digest: DIGEST, link });
    const output = everything(mail);

    expectNothingPersonal(output);
    expect(mail.kind).toBe('owner-digest');

    for (const path of [
      '/admin/cuentas?activated=no',
      '/admin/buzon?state=waiting',
      '/admin/generacion?status=failed&since=24h',
      '/admin/generacion/ia',
      '/admin/catalogo/imagenes',
      '/admin/catalogo?check=over_bound',
      '/admin/catalogo?check=unserved',
      '/admin/catalogo?check=refusal_limit',
      '/admin/catalogo/calidad',
      '/admin/ajustes/sistema'
    ]) {
      expect(mail.text).toContain(`https://nutria.example${path}`);
    }

    expect(mail.text).toContain('Cuentas esperando: 2');
    expect(mail.text).toContain('Mensajes nuevos en el buzón: 4');
    expect(mail.text).toContain('Generaciones fallidas en 24 h: 4');
    expect(mail.text).toContain('GENERATION_AI_UNAVAILABLE: 3');
    expect(mail.text).toContain('Gasto de texto este mes: 21,00 USD de 25,00 USD (84 %)');
    expect(mail.text).toContain('Gasto de imágenes este mes: 9,30 USD de 10,00 USD (93 %)');
    expect(mail.text).toContain('Correos fallidos en 24 h: 2');
    expect(mail.text).toContain('reescritura nocturna');
  });

  it('leaves out what is zero and the spend below 80 % of its cap', () => {
    const quiet: OwnerDigest = {
      ...DIGEST,
      crons: [],
      failedGenerations: [],
      failedMail: [],
      newMessages: 0,
      pictureSpend: { capUsd: 10, share: 0.5, spentUsd: 5 },
      shouldBeZero: { mealsOutsideServingBounds: 0, overBound: 0, refusalLimit: 0, uncosted: 0, unserved: 1 },
      textSpend: { capUsd: 25, share: 0.79, spentUsd: 19.75 },
      waitingAccounts: 0
    };
    const { text } = ownerDigestEmail({ digest: quiet, link });

    expect(text).not.toContain('Cuentas esperando');
    expect(text).not.toContain('buzón');
    expect(text).not.toContain('Generaciones fallidas');
    expect(text).not.toContain('Gasto');
    expect(text).not.toContain('Correos fallidos');
    expect(text).not.toContain('Tareas programadas');
    expect(text).toContain('(debería ser cero): 1');
  });

  it('shows a code or a label from its closed set and never free text, whatever a source held', () => {
    const hostile: OwnerDigest = {
      ...DIGEST,
      failedGenerations: [
        { code: '<b>SENTINEL-ERROR-TEXT</b>', n: 1 },
        { code: 'Error: someone@example.com had no plan', n: 1 }
      ],
      failedMail: [{ kind: 'SENTINEL-MESSAGE-BODY someone@example.com', n: 1 }]
    };
    const output = everything(ownerDigestEmail({ digest: hostile, link }));

    expectNothingPersonal(output);
    expect(output).not.toContain('SENTINEL');
    expect(output).toContain('OTHER: 1');
    expect(output).toContain('unknown: 1');
  });
});

describe('the owner’s immediate alerts', () => {
  it.each(ALERTS)('carries numbers, codes and one link, and nothing personal (%#)', alert => {
    const mail = ownerAlertEmail({ alert, link });

    expectNothingPersonal(everything(mail));
    expect(mail.kind).toBe('owner-alert');
    expect(mail.text).toContain('https://nutria.example/admin/');
  });

  it('shows a code from its closed set in the streak alert, never free text', () => {
    const mail = ownerAlertEmail({
      alert: { codes: ['SENTINEL-ERROR-TEXT', 'GENERATION_TIMED_OUT', 'a-code-with-an-address'], type: 'failures' },
      link
    });

    expectNothingPersonal(everything(mail));
    expect(mail.text).toContain('OTHER, GENERATION_TIMED_OUT, OTHER');
  });

  it('names the source and the threshold in the subject of a spend alert', () => {
    expect(ownerAlertEmail({ alert: ALERTS[1] as OwnerAlert, link }).subject).toBe('NutrIA — el gasto de texto ha llegado al 80 %');
    expect(ownerAlertEmail({ alert: ALERTS[2] as OwnerAlert, link }).subject).toBe('NutrIA — el gasto de imágenes ha llegado al 100 %');
  });
});
