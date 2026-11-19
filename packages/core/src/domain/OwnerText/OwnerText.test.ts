import { describe, expect, it } from 'vitest';

import { asClause, asSentence, OWNER_TEXT_LIMIT, plainFacts } from './OwnerText';

/*
 * The owner's facts reach a practitioner in a mail and on their own screen;
 * both must read the same sentence, whatever the owner typed (project 025
 * phase 9: «…hace meses Es lo que dice el § 4…»).
 */
describe('plainFacts', () => {
  it('turns control characters and markup into spaces, folds whitespace and trims', () => {
    expect(plainFacts('  Se\npresenta\tcomo <b>médico</b>\u0007  ')).toBe('Se presenta como b médico /b');
  });

  it('is bounded', () => {
    expect(plainFacts('x'.repeat(OWNER_TEXT_LIMIT + 50))).toHaveLength(OWNER_TEXT_LIMIT);
  });

  it('is empty for nothing but whitespace', () => {
    expect(plainFacts(' \n\t ')).toBe('');
  });
});

describe('asSentence', () => {
  it('closes words typed without a stop, trailing spaces or not', () => {
    expect(asSentence('Lo dijo hace meses')).toBe('Lo dijo hace meses.');
    expect(asSentence('  Lo dijo hace meses   ')).toBe('Lo dijo hace meses.');
  });

  it.each(['Lo dijo.', 'Lo dijo…', '¿Lo dijo?', '¡Lo dijo!', 'Dijo «basta»', 'Dijo "basta"', 'Dijo “basta”', 'Lo dijo (por teléfono)'])(
    'leaves «%s» as typed: it is closed already',
    closed => {
      expect(asSentence(`${closed}  `)).toBe(closed);
    }
  );

  it('stays empty rather than becoming a lone stop', () => {
    expect(asSentence('   ')).toBe('');
  });
});

describe('asClause', () => {
  it('drops the closing stops and spaces, for a sentence that supplies its own', () => {
    expect(asClause('la suspensión no procedía.  ')).toBe('la suspensión no procedía');
    expect(asClause('la suspensión no procedía...')).toBe('la suspensión no procedía');
    expect(asClause('la suspensión no procedía')).toBe('la suspensión no procedía');
  });

  it('keeps a question or exclamation mark: only stops are dropped', () => {
    expect(asClause('¿no procedía?')).toBe('¿no procedía?');
  });
});
