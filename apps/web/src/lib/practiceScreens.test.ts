import { describe, expect, it } from 'vitest';
import { enGB } from 'i18n/dictionaries/en-GB';
import { esES } from 'i18n/dictionaries/es-ES';

import { badgeReason, badgeSentence, badgeStands } from './badgeState';
import { restrictionParagraphs } from './practiceRestriction';
import { wordRefusal } from './protectedWord';

import type { BadgeView } from 'core/controllers/Professional';

function day(iso: string): string {
  return iso.slice(0, 10);
}

const NONE: BadgeView = {
  checkedAt: null,
  codeEntered: false,
  codeExpiresAt: null,
  decision: null,
  dueAt: null,
  lapsesAt: null,
  number: null,
  register: null,
  state: 'none'
};

describe('wordRefusal — the server word refusals in their approved sentences (textos/01 § P4)', () => {
  it.each([
    ['badge_only:dietista', esES.practice.profileWordRefused],
    ['never:doctor', esES.practice.profileWordNever],
    ['result:10 kg', esES.practice.profilePromiseRefused]
  ])('%s', (code, template) => {
    expect(wordRefusal(code, esES.practice)).toBe(template.replace('{word}', code.slice(code.indexOf(':') + 1)));
  });

  it('is null for anything that is not a word refusal, so the field keeps its own message', () => {
    expect(wordRefusal('Too small: expected string to have >=1 characters', esES.practice)).toBeNull();
    expect(wordRefusal(undefined, esES.practice)).toBeNull();
    expect(wordRefusal('own_address', esES.practice)).toBeNull();
  });
});

describe('the badge, in the words of textos/01 § P3', () => {
  it('draws the title only from a standing badge', () => {
    expect(badgeStands({ state: 'badged' })).toBe(true);
    expect(badgeStands({ state: 'due' })).toBe(true);

    for (const state of ['none', 'applied', 'code_sent', 'lapsed', 'refused', 'withdrawn'] as const) {
      expect(badgeStands({ state })).toBe(false);
    }
  });

  it('says every state the API gives, in both languages, with no placeholder left', () => {
    const states = [
      NONE,
      { ...NONE, state: 'applied' },
      { ...NONE, codeExpiresAt: '2026-12-01T00:00:00Z', state: 'code_sent' },
      { ...NONE, codeEntered: true, codeExpiresAt: '2026-12-01T00:00:00Z', state: 'code_sent' },
      { ...NONE, checkedAt: '2026-11-01T00:00:00Z', number: 'AND-1', register: 'CODINAN', state: 'badged' },
      { ...NONE, lapsesAt: '2026-12-01T00:00:00Z', state: 'due' },
      { ...NONE, state: 'lapsed' },
      { ...NONE, state: 'refused' },
      { ...NONE, state: 'withdrawn' }
    ] satisfies BadgeView[];

    for (const dictionary of [esES, enGB]) {
      const sentences = states.map(badge => badgeSentence(badge, dictionary.practice, day));

      expect(new Set(sentences).size).toBe(states.length);
      sentences.forEach(sentence => expect(sentence).not.toMatch(/\{\w+\}/));
    }

    expect(badgeSentence(states[3], esES.practice, day)).toBe(esES.practice.badgeCodeDone);
  });

  it('gives a decision its statement’s reason, then the owner’s facts', () => {
    const withdrawn: BadgeView = {
      ...NONE,
      decision: { at: '2026-11-10T00:00:00Z', facts: 'Baja en el registro.', kind: 'withdrawn', reason: 'not_me' },
      state: 'withdrawn'
    };

    expect(badgeReason(withdrawn, esES.practice, day)).toBe(`Por qué: ${esES.practice.badgeReasons.not_me} Baja en el registro.`);
    expect(
      badgeReason(
        { ...NONE, decision: { at: '2026-11-10T00:00:00Z', facts: null, kind: 'lapsed', reason: null }, state: 'lapsed' },
        enGB.practice,
        day
      )
    ).toBe(`Why: ${enGB.practice.badgeReasons.unconfirmed}`);
    // The register's sentence needs what it names: without it, only the facts.
    expect(
      badgeReason(
        { ...NONE, decision: { at: '2026-11-10T00:00:00Z', facts: null, kind: 'fail', reason: 'not_on_register' }, state: 'refused' },
        esES.practice,
        day
      )
    ).toBeNull();
    expect(badgeReason(NONE, esES.practice, day)).toBeNull();
  });
});

describe('a restriction on the practice page (textos/06 § W bis)', () => {
  const statement = { authority: null, clause: 2, facts: 'Uso del título sin la insignia.', source: 'own_review' } as const;

  it('says a suspension with its reasons', () => {
    const [what, reasons] = restrictionParagraphs({ closing: null, suspended: { since: '2026-11-10T00:00:00Z', statement } }, esES.practice, day);

    expect(what).toBe(esES.practice.restrictionSuspended);
    expect(reasons).toBe(
      'Por qué: Uso del título sin la insignia. Es lo que dice el § 13 del acuerdo del profesional que aceptaste, en relación con su § 2. Lo hemos decidido nosotros, por nuestra propia revisión.'
    );
  });

  it('says a close to come with its day, and that it is suspended meanwhile', () => {
    const [what] = restrictionParagraphs(
      {
        closing: { closed: false, closesAt: '2026-12-10T00:00:00Z', decidedAt: '2026-11-10T00:00:00Z', statement },
        suspended: { since: '2026-11-10T00:00:00Z', statement: null }
      },
      enGB.practice,
      day
    );

    expect(what).toContain('On 2026-12-10 we will close your practice for good');
    expect(what).toContain(', that is, suspended.');
  });

  it('says only the day once a close has come', () => {
    expect(
      restrictionParagraphs(
        { closing: { closed: true, closesAt: '2026-12-10T00:00:00Z', decidedAt: '2026-11-10T00:00:00Z', statement }, suspended: null },
        esES.practice,
        day
      )
    ).toEqual(['Tu consulta se cerró el 2026-12-10.']);
  });

  it('names the authority when one required it', () => {
    const [, reasons] = restrictionParagraphs(
      {
        closing: null,
        suspended: { since: '2026-11-10T00:00:00Z', statement: { ...statement, authority: 'la AEPD', clause: null, source: 'authority' } }
      },
      esES.practice,
      day
    );

    expect(reasons).toBe(
      'Por qué: Uso del título sin la insignia. Es lo que dice el § 13 del acuerdo del profesional que aceptaste. Nos lo exige la AEPD.'
    );
  });
});
