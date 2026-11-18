import { describe, expect, it } from 'vitest';

import { ALLOWED_WITH_NOTICE, BADGE_ONLY_WORDS, NEVER_WORDS, normalisedTokens, protectedWordIn, RESULT_WORDS } from './ProtectedWords';

/**
 * The tests `docs/legal/2026-11-18-anyone-can-open-a-practice.md` § 6.5 sets:
 * every listed word refused in each free-text field, with capitals, hyphens,
 * dots and the look-alikes applied; the badge-only ones allowed with the badge,
 * the others never; and the named phrases that must pass or fail.
 */

/** The two kinds of field a profile has (phase 6): a short name and a long declaration. */
const FIELDS: readonly ((word: string) => string)[] = [
  word => `Ana Pérez, ${word}`,
  word => `Estudié en Valencia y trabajo como ${word} desde hace años.`
];

const DIGIT_FOR: Readonly<Record<string, string>> = { a: '4', e: '3', i: '1', o: '0', s: '5' };

/** How a word can be disguised: as typed, in capitals, hyphenated, dotted, and with one look-alike digit. */
function disguises(word: string): readonly string[] {
  const swapped = word.replace(/[aeios]/, char => DIGIT_FOR[char] ?? char);

  return [word, word.toUpperCase(), word.replace(/ /g, '-'), `${word.split(' ').join('.')}.`, ...(swapped === word ? [] : [swapped])];
}

describe('protectedWordIn — every badge-only word (§ 6.1)', () => {
  it.each(BADGE_ONLY_WORDS)('refuses «%s» in every field and disguise without the badge, and allows it with the badge', word => {
    for (const field of FIELDS) {
      for (const disguised of disguises(word)) {
        const hit = protectedWordIn(field(disguised), false);

        expect(hit?.list).toBe('badge_only');
        expect(word.split(' ')).toEqual(expect.arrayContaining(hit?.word.split(' ') ?? ['—']));
        expect(protectedWordIn(field(disguised), true)).toBeNull();
      }
    }
  });
});

describe('protectedWordIn — every word nobody may use (§ 6.2)', () => {
  it.each(NEVER_WORDS)('refuses «%s» in every field and disguise, badge or not', word => {
    for (const field of FIELDS) {
      for (const disguised of disguises(word)) {
        expect(protectedWordIn(field(disguised), false)?.list).toBe('never');
        expect(protectedWordIn(field(disguised), true)?.list).toBe('never');
      }
    }
  });
});

describe('protectedWordIn — a promised result (§ 6.4)', () => {
  it.each(RESULT_WORDS)('refuses «%s» for everybody', word => {
    for (const field of FIELDS) {
      expect(protectedWordIn(field(word.toUpperCase()), true)).toEqual({ list: 'result', word });
    }
  });

  it.each(['Bajé 10 kg de grasa corporal en 2019', '−10kg en un mes', 'Pierde 3,5 kilos', 'un kilo menos: 1 kilo'])(
    'refuses a weight figure in «%s» for everybody, before digits become spaces',
    text => {
      expect(protectedWordIn(text, true)).toEqual({ list: 'result', word: 'kg' });
      expect(protectedWordIn(text, false)).toEqual({ list: 'result', word: 'kg' });
    }
  );

  it.each(['Resultados al 100 %', 'Funciona 100%'])('refuses a certainty in «%s»', text => {
    expect(protectedWordIn(text, true)).toEqual({ list: 'result', word: '100 %' });
  });

  it('reads a number that is not a weight or a certainty as nothing', () => {
    expect(protectedWordIn('Atiendo desde 2019, 1100 % no aplica: 15 años, 3 kms', false)).toBeNull();
  });
});

describe('protectedWordIn — the words that are allowed (§ 6.3)', () => {
  it.each(ALLOWED_WITH_NOTICE)('allows «%s» with and without the badge', word => {
    expect(protectedWordIn(word, false)).toBeNull();
    expect(protectedWordIn(word.toUpperCase(), true)).toBeNull();
  });

  it.each(['nutrición', 'nutricional', 'alimentación', 'dietética'])('allows «%s» alone', word => {
    expect(protectedWordIn(`Me interesa la ${word}`, false)).toBeNull();
  });
});

describe('protectedWordIn — § 6.5, the phrases named', () => {
  it.each([
    'Asesora nutricional',
    'Coach nutricional',
    'Curso de nutrición deportiva',
    'Andén',
    'Medicina tradicional china',
    'consultoría',
    'RD 1487/2009'
  ])('lets «%s» through without the badge', text => {
    expect(protectedWordIn(text, false)).toBeNull();
  });

  it.each([
    ['Dietista-Nutricionista', 'dietista'],
    ['D.N.', 'd n'],
    ['Nutri-cionista', 'nutri cionista'],
    ['colegiada nº 1234', 'colegiada'],
    ['Grado en NHD', 'nhd'],
    ['Asesora de lactancia', 'lactancia']
  ])('refuses «%s» without the badge, naming «%s»', (text, word) => {
    expect(protectedWordIn(text, false)?.word).toBe(word);
    expect(protectedWordIn(text, false)?.list).toBe('badge_only');
    expect(protectedWordIn(text, true)).toBeNull();
  });

  it('names the first listed word the text holds', () => {
    expect(protectedWordIn('Dietista-Nutricionista', false)).toEqual({ list: 'badge_only', word: 'dietista' });
  });

  it.each([
    ['Médico', 'medico'],
    ['Endocrinóloga', 'endocrinologa'],
    ['Farmacéutica', 'farmaceutica'],
    ['Psicóloga sanitaria', 'psicologa'],
    ['Dra. Pérez', 'dra'],
    ['Técnica Superior en Dietética', 'tecnica superior en dietetica']
  ])('refuses «%s» even with the badge', (text, word) => {
    expect(protectedWordIn(text, true)).toEqual({ list: 'never', word });
  });

  it.each([
    ['Clínica', 'clinica'],
    ['Diagnóstico', 'diagnostico'],
    ['Terapéutico', 'terapeutico'],
    ['Colegiación', 'colegiacion'],
    ['Nutrición Humana y Dietética', 'nutricion humana y dietetica'],
    ['Hipertensión', 'hipertension'],
    ['Celiaquía', 'celiaquia'],
    ['Cáncer', 'cancer'],
    ['nutr1c1onista', 'nutricionista'],
    ['nutricionist@', 'nutricionista']
  ])('refuses «%s», accents and look-alikes undone, without the badge', (text, word) => {
    expect(protectedWordIn(text, false)).toEqual({ list: 'badge_only', word });
  });

  it('names a result before a profession, and a profession before the badge’s words', () => {
    expect(protectedWordIn('Médico y dietista, resultados garantizados', false)).toEqual({ list: 'result', word: 'garantizados' });
    expect(protectedWordIn('Dietista y médico', false)).toEqual({ list: 'never', word: 'medico' });
  });

  it('allows an empty text', () => {
    expect(protectedWordIn('', false)).toBeNull();
    expect(protectedWordIn('   ', false)).toBeNull();
  });
});

/*
 * The invariant review of phase 3: every one of these looks like a refused word
 * on screen, or plainly is one, and once read past the function nothing else
 * would catch it — the owner's first look sees «dietista» too.
 */
describe('protectedWordIn — what looks like a word is read as the word', () => {
  it.each([
    ['a zero-width space', 'dieti​sta', 'dietista'],
    ['a soft hyphen', 'dieti­sta', 'dietista'],
    ['a zero-width joiner', 'nutricio‍nista', 'nutricionista'],
    ['a byte-order mark', '﻿dietista', 'dietista'],
    ['a Cyrillic «е»', 'diеtista', 'dietista'],
    ['a Cyrillic «о»', 'cоlegiado', 'colegiado'],
    ['a Greek «ο» and «ι»', 'nutrιcιοnista', 'nutricionista'],
    ['Cyrillic capitals', 'DIЕTIЅTА', 'dietista'],
    ['fullwidth letters', 'ｄｉｅｔｉｓｔａ', 'dietista'],
    ['mathematical bold letters', '\u{1D41D}\u{1D422}\u{1D41E}\u{1D42D}\u{1D422}\u{1D42C}\u{1D42D}\u{1D41A}', 'dietista'],
    ['a dollar for an s', 'dieti$ta', 'dietista'],
    ['a bang for an i', 'd!etista', 'dietista'],
    ['a bar for an i', 'nutr|cionista', 'nutricionista'],
    ['spaced letters', 'd i e t i s t a', 'dietista'],
    ['dotted letters', 'd.i.e.t.i.s.t.a', 'dietista'],
    ['a sign after the word', '¡Consulta!', 'consulta']
  ])('refuses a word with %s without the badge', (_how, text, word) => {
    const hit = protectedWordIn(`Ana, ${text}`, false);

    expect(hit?.list).toBe('badge_only');

    if (word !== null) {
      expect(hit?.word).toBe(word);
    }
  });

  it('refuses a disguised title nobody may use, badge or not', () => {
    expect(protectedWordIn('mеdico', true)).toEqual({ list: 'never', word: 'medico' });
    expect(protectedWordIn('ｍｅｄｉｃｏ', true)).toEqual({ list: 'never', word: 'medico' });
  });

  it('reads a fullwidth weight figure as one', () => {
    expect(protectedWordIn('１０ kg menos', true)).toEqual({ list: 'result', word: 'kg' });
  });

  it('still lets the allowed phrases through, with their accents and signs', () => {
    expect(protectedWordIn('¡Asesora nutricional! Coach nutricional y curso de nutrición deportiva.', false)).toBeNull();
  });
});

describe('normalisedTokens', () => {
  it('lowers, strips accents, undoes look-alikes only inside lettered tokens and splits on every non-letter', () => {
    expect(normalisedTokens('  Ñandú-D.N. 1487/2009 n0ta @lgo ')).toEqual(['nandu', 'd', 'n', 'nota', 'algo']);
  });
});
