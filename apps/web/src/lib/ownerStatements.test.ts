import { describe, expect, it } from 'vitest';

import {
  asClause,
  asSentence,
  badgeRemovalStatement,
  checkReason,
  hideStatement,
  liftStatement,
  parseCheckReason,
  restrictionStatement
} from './ownerStatements';
import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';
import { plainText } from './ownerFacts';

function day(iso: string): string {
  return iso.slice(0, 10);
}

describe('asSentence and asClause', () => {
  it('close a sentence the owner left open, and leave a closed one', () => {
    expect(asSentence('Publicó un anuncio')).toBe('Publicó un anuncio.');
    expect(asSentence('Publicó un anuncio.')).toBe('Publicó un anuncio.');
    expect(asSentence('  <b>x</b> \n y ')).toBe('b x /b y.');
  });

  it('strip the stop for the end of somebody else’s sentence', () => {
    expect(asClause('no hay nada más.')).toBe('no hay nada más');
  });
});

describe('hideStatement', () => {
  it('quotes the word, orders the reasons as the mail does, then the facts and the notice', () => {
    const { what, why } = hideStatement(esES, {
      afterNotice: true,
      facts: 'Lo vimos el lunes',
      reasons: ['promises', 'badge_word'],
      word: 'dietista'
    });

    expect(what).toBe(esES.adminProfiles.hide.what);
    expect(plainText(why)).toBe(
      'Por qué: Usa una palabra que el acuerdo no permite sin la insignia: «dietista». Promete resultados. Lo vimos el lunes. Es lo que dicen los §§ 2 y 5 del acuerdo del profesional que aceptaste. Lo ha visto una persona, no un programa, en la revisión que hacemos de cada perfil, después de un aviso que nos llegó.'
    );
    expect(why.facts).toBe('Lo vimos el lunes.');
  });

  it('says the same in English', () => {
    const { why } = hideStatement(enGB, { afterNotice: false, facts: '', reasons: ['disease'], word: '' });

    expect(plainText(why)).toContain('It offers a service for a disease. That is what sections 2 and 5');
    expect(why.facts).toBeNull();
  });
});

describe('badgeRemovalStatement', () => {
  it('fills the register, the number and the day into the closed reason, then adds the facts', () => {
    const { what, why } = badgeRemovalStatement(esES, {
      checkedOn: '19 de noviembre de 2026',
      facts: ' Llamé dos veces ',
      kind: 'fail',
      number: 'CV00412',
      reason: 'not_on_register',
      register: 'Comunitat Valenciana',
      source: 'own_check'
    });

    expect(what).toBe(esES.adminStatements.badge.what.fail);
    expect(plainText(why)).toBe(
      'Por qué: El registro de Comunitat Valenciana no te muestra como colegiada/o habilitada/o con el número CV00412, consultado el 19 de noviembre de 2026. Llamé dos veces Es lo que dice el § 4 del acuerdo del profesional que aceptaste. Lo hemos decidido nosotros, por nuestra comprobación.'
    );
    expect(why.facts).toBe('Llamé dos veces');
  });

  it('makes “other” the facts alone', () => {
    const { why } = badgeRemovalStatement(enGB, {
      checkedOn: 'x',
      facts: 'It is not them',
      kind: 'withdrawn',
      number: '',
      reason: 'other',
      register: '',
      source: 'notice'
    });

    expect(plainText(why)).toBe(
      "Why: It is not them That is what section 4 of the professional's agreement you accepted says. We looked into it after a notice we received."
    );
  });
});

describe('restrictionStatement', () => {
  it('cites § 13, the clause read with it and the authority when it is the source', () => {
    const why = restrictionStatement(esES, { authority: 'la AEPD', clause: 5, facts: 'Hechos del caso', source: 'authority' });

    expect(plainText(why)).toBe(
      'Por qué: Hechos del caso. Es lo que dice el § 13 del acuerdo del profesional que aceptaste, en relación con su § 5. Nos lo exige la AEPD.'
    );
  });

  it('leaves the clause out when there is none', () => {
    expect(plainText(restrictionStatement(enGB, { authority: null, clause: null, facts: 'x', source: 'own_review' }))).toBe(
      "Why: x. That is what section 13 of the professional's agreement you accepted says. We decided it ourselves, from our own review."
    );
  });
});

describe('liftStatement', () => {
  const base = { closeDate: '18 de diciembre de 2026', suspended: false };

  it('adds the found facts to a suspension lifted, or nothing', () => {
    expect(plainText(liftStatement(esES, { ...base, facts: '', kind: 'suspension' }))).toBe('Desde hoy puedes volver a abrir tu consulta en NutrIA.');
    expect(plainText(liftStatement(esES, { ...base, facts: 'se aclaró todo.', kind: 'suspension' }))).toBe(
      'Desde hoy puedes volver a abrir tu consulta en NutrIA. Lo hemos revisado y se aclaró todo.'
    );
  });

  it('says the suspension was lifted too only before the close was carried out', () => {
    expect(plainText(liftStatement(esES, { ...base, facts: '', kind: 'closeBefore', suspended: true }))).toBe(
      'Hemos anulado el cierre de tu consulta que te anunciamos para el 18 de diciembre de 2026: no se va a producir. Tu consulta sigue abierta, y también hemos levantado la suspensión.'
    );
    expect(plainText(liftStatement(esES, { ...base, facts: '', kind: 'closeAfter', suspended: true }))).toContain(
      'Los enlaces con tus clientes terminaron con el cierre y no vuelven solos'
    );
  });
});

describe('checkReason', () => {
  it('reads a stored reason back as its sentence, with the facts kept apart', () => {
    expect(parseCheckReason('other: algo pasó')).toEqual({ code: 'other', facts: 'algo pasó' });
    expect(parseCheckReason('not_me')).toEqual({ code: 'not_me', facts: null });
    expect(parseCheckReason(null)).toEqual({ code: null, facts: null });

    const reason = checkReason(esES, { checkedAt: '2026-11-19T10:00:00.000Z', number: 'CV1', reason: 'not_me: la llamé', register: 'CV' }, day);

    expect(reason?.facts).toBe('la llamé');
    expect(plainText(reason!)).toBe(`${esES.practice.badgeReasons.not_me} la llamé`);
  });
});
