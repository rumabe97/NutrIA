import { describe, expect, it } from 'vitest';

import { flushSentences, releaseSentences } from 'core/domain/Assistant';

describe('releaseSentences', () => {
  it.each([
    [
      'two whole sentences and the start of a third',
      'Tu jueves lleva lentejas. Son 652 kcal. Y la ce',
      'Tu jueves lleva lentejas. Son 652 kcal. ',
      'Y la ce'
    ],
    ['a question and an exclamation', '¿Te apetece? ¡Claro! Pues', '¿Te apetece? ¡Claro! ', 'Pues'],
    ['an ellipsis, in either spelling', 'Bueno... Mira… La cena', 'Bueno... Mira… ', 'La cena'],
    ['a recipe, a line at a time', '- 200 g de arroz\n- 1 cebolla\n- 2 dien', '- 200 g de arroz\n- 1 cebolla\n', '- 2 dien'],
    ['a sentence that starts with a number', 'Pon el horno. 180 grados bastan. Lue', 'Pon el horno. 180 grados bastan. ', 'Lue'],
    ['a closing quote after the mark', 'Lo llaman «sofrito». Se hace', 'Lo llaman «sofrito». ', 'Se hace']
  ])('releases %s', (_case, buffer, released, remainder) => {
    expect(releaseSentences(buffer)).toEqual({ released, remainder });
  });

  /** Each of these is a way a careless splitter lets an unchecked sentence out. */
  it.each([
    ['a decimal point', 'Añade 2.5 g de sal y remueve'],
    ['an abbreviation followed by lower case', 'Pon 1 cda. de aceite y sofríe'],
    ['a listed abbreviation followed by a capital', 'Legumbres, p. ej. Lentejas o garbanzos'],
    ['«aprox.» followed by a capital', 'Unos 20 minutos aprox. Luego'],
    ['a mark at the very end, before the next word has arrived', 'Tu jueves lleva lentejas. '],
    ['a mark with nothing after it at all', 'Tu jueves lleva lentejas.'],
    ['a buffer with no mark', 'Tu jueves lleva lent']
  ])('holds back %s', (_case, buffer) => {
    expect(releaseSentences(buffer).released).toBe('');
  });

  it('releases up to the last boundary, never past it', () => {
    const { released, remainder } = releaseSentences('Uno. Dos. Tres aprox. Cuatro');

    expect(released).toBe('Uno. Dos. ');
    expect(remainder).toBe('Tres aprox. Cuatro');
  });

  it('loses nothing: released and remainder are the buffer', () => {
    const buffer = 'Uno. Dos.\nTres? Cuat';
    const { released, remainder } = releaseSentences(buffer);

    expect(released + remainder).toBe(buffer);
  });
});

describe('flushSentences', () => {
  it('releases the last sentence when the answer ends, whether or not it ends in a mark', () => {
    expect(flushSentences('Y la cena es merluza')).toEqual({ released: 'Y la cena es merluza', remainder: '' });
  });
});
