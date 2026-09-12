import { describe, expect, it } from 'vitest';

import { isAboutTheBrief, lowerIngredientNames, methodMentions } from 'core/domain/Method';

const VOCABULARY = [
  'Arroz',
  'Arroz integral',
  'Pechuga de pollo',
  'Pollo',
  'Caldo de pollo',
  'Tomate',
  'Sésamo',
  'Sal',
  'Agua',
  'Pan de molde',
  'Aceite de oliva virgen extra'
];

function steps(...texts: string[]) {
  return texts.map(text => ({ text }));
}

describe('methodMentions', () => {
  const dish = ['Arroz integral', 'Pechuga de pollo', 'Tomate', 'Aceite de oliva virgen extra'];

  it('passes a method that uses every ingredient and nothing else', () => {
    expect(
      methodMentions({
        dish,
        steps: steps('Calentar el aceite y dorar la pechuga de pollo.', 'Añadir los tomates troceados.', 'Incorporar el arroz y remover.'),
        vocabulary: VOCABULARY
      })
    ).toEqual({ foreign: [], missing: [] });
  });

  it('counts an ingredient named by its main word, in the singular or the plural', () => {
    const result = methodMentions({ dish, steps: steps('Dorar el pollo en el aceite, añadir los tomates y el arroz.'), vocabulary: VOCABULARY });

    expect(result.missing).toEqual([]);
  });

  it('names the ingredient a method never says where to put', () => {
    const result = methodMentions({ dish, steps: steps('Dorar el pollo en el aceite y añadir el arroz.'), vocabulary: VOCABULARY });

    expect(result.missing).toEqual(['Tomate']);
  });

  /** The case this exists for: the list was checked against somebody's allergies, the prose was not. */
  it('catches a food the dish does not contain, an allergen included', () => {
    const result = methodMentions({
      dish,
      steps: steps('Dorar el pollo en el aceite, añadir tomate y arroz.', 'Servir espolvoreado con sésamo y una pizca de sal.'),
      vocabulary: VOCABULARY
    });

    expect(result.foreign).toEqual(['Sésamo', 'Sal']);
  });

  it('does not take the dish’s own ingredient under a shorter name for a foreign one', () => {
    // "Arroz" and "Pollo" are catalogue foods too; here they are the dish's rice and chicken.
    const result = methodMentions({ dish, steps: steps('Dorar el pollo en el aceite, añadir el tomate y luego el arroz.'), vocabulary: VOCABULARY });

    expect(result.foreign).toEqual([]);
  });

  it('still catches a longer food built on one of the dish’s words', () => {
    const result = methodMentions({
      dish,
      steps: steps('Dorar el pollo en el aceite, mojar con caldo de pollo, añadir tomate y arroz.'),
      vocabulary: VOCABULARY
    });

    expect(result.foreign).toEqual(['Caldo de pollo']);
  });

  it('allows water, and the words a cook uses for what is already on the plate', () => {
    const result = methodMentions({
      dish,
      steps: steps('Cocer el arroz en agua abundante.', 'Dorar la carne del pollo en el aceite con el tomate.'),
      vocabulary: [...VOCABULARY, 'Carne']
    });

    expect(result).toEqual({ foreign: [], missing: [] });
  });

  it('reads the cues too', () => {
    const result = methodMentions({
      dish,
      steps: [{ cue: 'hasta que el pan de molde esté dorado', text: 'Dorar el pollo en el aceite con tomate y arroz.' }],
      vocabulary: VOCABULARY
    });

    expect(result.foreign).toEqual(['Pan de molde']);
  });

  /** Measured on the stored library: 43 methods said an egg white was "cuajada" — set, not curd. */
  it('does not take a set egg for curd', () => {
    const result = methodMentions({
      dish: ['Clara de huevo', 'Tomate'],
      steps: steps('Verter las claras sobre el tomate y remover hasta que la clara esté cuajada.'),
      vocabulary: [...VOCABULARY, 'Cuajada']
    });

    expect(result.foreign).toEqual([]);
  });

  /** "Pechuga de pavo" in a dish of "Pavo" is the dish's turkey; "Caldo de pollo" is still a broth. */
  it('counts a part of an ingredient as the ingredient, and a product made from it as another food', () => {
    const parts = methodMentions({
      dish: ['Pavo', 'Ternera magra', 'Naranja', 'Huevo'],
      steps: steps('Cortar la pechuga de pavo y el filete de ternera en tiras.', 'Añadir el zumo de naranja y la clara de huevo.'),
      vocabulary: ['Pechuga de pavo', 'Filete de ternera', 'Zumo de naranja', 'Clara de huevo', 'Caldo de ternera']
    });
    const broth = methodMentions({
      dish: ['Ternera magra'],
      steps: steps('Mojar la ternera con caldo de ternera.'),
      vocabulary: ['Caldo de ternera']
    });

    expect(parts.foreign).toEqual([]);
    expect(broth.foreign).toEqual(['Caldo de ternera']);
  });

  /** Three stored methods called their dish by its name: "el arroz negro", "el guacamole", "el pico de gallo". */
  it('does not count the dish’s own name as a food it adds', () => {
    const result = methodMentions({
      dish: ['Arroz', 'Calamar', 'Tinta de calamar'],
      name: 'Arroz negro con calamares',
      steps: steps('Sofreír el calamar, añadir el arroz y la tinta de calamar y dejar que el arroz negro se haga.'),
      vocabulary: ['Arroz negro', 'Arroz', 'Calamar', 'Tinta de calamar']
    });

    expect(result.foreign).toEqual([]);
  });

  /** A real rewrite was refused for "dorada por fuera": golden, not the sea bream. */
  it('does not mistake a cook’s ordinary words for the fish or fruit they also name', () => {
    const result = methodMentions({
      dish,
      steps: steps(
        'Dorar el pollo en el aceite hasta que quede dorada por fuera y sin partes rosadas.',
        'Pasa el tomate y el arroz a un plato y sujeta la sartén por el mango.'
      ),
      vocabulary: [...VOCABULARY, 'Dorada', 'Rosada', 'Pasas', 'Mango']
    });

    expect(result.foreign).toEqual([]);
  });
});

describe('isAboutTheBrief', () => {
  /** What a model once returned as the third step of a cottage-cheese cup. */
  it('catches a step that certifies its own instructions', () => {
    expect(isAboutTheBrief('Todas las 3 ingredientes listados aparecen nombrados exactamente en los pasos.')).toBe(true);
    expect(isAboutTheBrief('Every ingredient on the list is used, and nothing else.')).toBe(true);
    expect(isAboutTheBrief('validate-steps-final-check')).toBe(true);
    expect(isAboutTheBrief('Seca la lubina con papel. Este paso es de preparación, sin cocción.')).toBe(true);
  });

  it('leaves a cook’s method alone, packet instructions and all', () => {
    expect(isAboutTheBrief('Cocer la pasta según las instrucciones del envase hasta que esté al dente.')).toBe(false);
    expect(isAboutTheBrief('Retirar del fuego cuando esté listo y servir.')).toBe(false);
  });
});

describe('lowerIngredientNames', () => {
  const names = ['Boniato', 'Judía verde', 'Aceite de oliva virgen extra'];

  it('drops the catalogue’s capital inside a sentence and keeps it where one starts', () => {
    expect(lowerIngredientNames('Pela el Boniato y trocea la Judía verde. Boniato y judía van juntos.', names)).toBe(
      'Pela el boniato y trocea la judía verde. Boniato y judía van juntos.'
    );
  });

  it('touches only the names it is given', () => {
    expect(lowerIngredientNames('Calienta el Aceite de oliva virgen extra en la sartén de Juan.', names)).toBe(
      'Calienta el aceite de oliva virgen extra en la sartén de Juan.'
    );
  });
});
