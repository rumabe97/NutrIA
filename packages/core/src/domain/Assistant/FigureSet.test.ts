import { describe, expect, it } from 'vitest';

import { assistantContext, FIGURE_KINDS, figuresAreAllSupplied, figureSet, parseLocaleNumber } from 'core/domain/Assistant';

import type { AssistantContextInput } from 'core/domain/Assistant';

/** Supplied: 2079 · 130 · 240 · 69 · 30 (targets), 652 · 45 · 62 · 21 · 9.4 (the meal, and so the day), 33 (lunch's share). */
const CONTEXT = assistantContext({
  cookingTimeMinutes: null,
  cuisines: [],
  days: [
    {
      date: '2026-11-12',
      meals: [{ accompaniments: [], dish: 'Lentejas', macros: { carbsG: 62, fatG: 21, fiberG: 9.4, kcal: 652, proteinG: 45 }, slot: 'lunch' }],
      targets: { carbsG: 240, fatG: 69, fiberG: 30, kcal: 2079, proteinG: 130 }
    }
  ],
  dislikedNames: [],
  kitchen: null,
  language: 'Spanish',
  likedFoods: [],
  lovedNames: [],
  slotShares: new Map([['lunch', 0.33]]),
  targets: { carbsG: 240, fatG: 69, fiberG: 30, kcal: 2079, proteinG: 130 }
} satisfies AssistantContextInput);

const SET = figureSet(CONTEXT, '¿Cuánta proteína llevo el jueves?');

describe('parseLocaleNumber', () => {
  it.each([
    ['2.079', 2079],
    ['2,079', 2079],
    ['1.000', 1000],
    ['2,1', 2.1],
    ['2.5', 2.5],
    ['2.079,5', 2079.5],
    ['2,079.5', 2079.5],
    ['1.234.567', 1234567],
    ['2 079', 2079],
    ['45', 45]
  ])('reads %s as %d', (token, expected) => {
    expect(parseLocaleNumber(token)).toBe(expected);
  });
});

describe('figureSet', () => {
  it('holds every figure the context shows, each under the nutrient it is a figure of', () => {
    expect(SET).toEqual({
      carbs: [62, 240],
      energy: [652, 2079],
      fat: [21, 69],
      fiber: [9.4, 30],
      percent: [33],
      protein: [45, 130],
      saturated: [],
      sugar: []
    });
  });

  /** Never supplied, so never satisfiable: folding them into carbs and fat would let «62 g de azúcar» through. */
  it('keeps sugar and saturated fat empty, whatever the plan holds', () => {
    expect(SET.sugar).toEqual([]);
    expect(SET.saturated).toEqual([]);
    expect(Object.keys(SET).sort()).toEqual([...FIGURE_KINDS]);
  });

  /** A 5 or a 100 in the set would let «5 g de proteína» and «100 g de grasa» through. */
  it('holds no structural constant, because this check never reads a bare number', () => {
    for (const kind of FIGURE_KINDS) {
      expect(SET[kind]).not.toContain(14);
      expect(SET[kind]).not.toContain(100);
    }
  });

  it('adds the nutritional figures the person wrote, by kind, which an answer may repeat', () => {
    const asked = figureSet(CONTEXT, 'Quiero llegar a 120 g de proteína y a 2.200 kcal');

    expect(asked.protein).toContain(120);
    expect(asked.energy).toContain(2200);
    expect(asked.carbs).not.toContain(120);
  });

  /** «Tengo 30 años» used to whitelist every 30 in the answer; a person's age is not a figure of anything. */
  it('adds nothing for a number that is not a nutritional figure', () => {
    expect(figureSet(CONTEXT, 'Tengo 31 años y peso 70 kg')).toEqual(SET);
  });
});

/**
 * The table PRD criterion 4 asks for: each row an answer and whether it may be
 * shown. The withheld rows are the reason the check exists; the shown rows are
 * the reason it is narrow.
 */
describe('figuresAreAllSupplied', () => {
  it.each([
    ['the target, with a Spanish thousands dot', 'Tu jueves son 2.079 kcal.'],
    ['the target, with an English thousands comma', 'Your target is 2,079 kcal.'],
    ['the target said roundly, inside the product’s ±5 %', 'Vas a unas 2.100 kcal al día.'],
    ['a round figure 3.8 % off', 'Unas 2.000 calorías.'],
    ['a supplied macro, unit first', 'El almuerzo lleva 45 g de proteína.'],
    ['a supplied macro, nutrient first', 'Proteína: 45 g.'],
    ['a supplied macro, with an approximator in brackets', 'Proteínas (unos 45 g) en la comida.'],
    ['a decimal comma', 'Aporta 9,4 g de fibra.'],
    ['a decimal point, in English', 'It brings 9.4 g of fibre.'],
    ['a figure rounded to a whole gram', 'Unos 9 g de fibra.'],
    ['a share of the day', 'La comida es el 33 % de tus calorías.'],
    ['a recipe’s nutrition block in label form', 'Calorías: 652. Proteína: 45 g.'],
    ['a label with an approximator after the colon', 'Calorías: unas 652.'],
    ['a share in label form, which is a share and not energy', 'Calorías: 33 %.'],
    ['upper case and accents', 'Son 652 KCAL.'],
    ['a recipe’s quantities, which no service supplies', 'Pon 200 g de arroz, 2 huevos y 1 cucharada de aceite.'],
    ['a recipe that mentions protein without a figure of it', 'Para subir la proteína, añade 150 g de pechuga.'],
    ['an ingredient sold by its fat content', 'Usa nata al 18 % si quieres menos grasa.'],
    ['protein as an ingredient', 'Añade 30 g de proteína en polvo.'],
    ['dates and times', 'El 14 de noviembre, 30 minutos al horno a 180 grados.'],
    ['a figure the person wrote in the question', 'Para llegar a 120 g de proteína…', 'Quiero llegar a 120 g de proteína']
  ])('shows %s', (_case, answer, question = '') => {
    const set = question === '' ? SET : figureSet(CONTEXT, question);

    expect(figuresAreAllSupplied(answer, set)).toEqual({ ok: true });
  });

  it.each([
    ['a target 13 % off', '1.800 kcal al día.', 'not_supplied'],
    ['the diabetic’s figure: a macro 11 % off', 'Toma 50 g de hidratos en cada comida.', 'not_supplied'],
    ['a share nobody supplied', 'El 40 % de tus calorías.', 'not_supplied'],
    ['a label-form figure 7 % off', 'Calorías: 700.', 'not_supplied'],
    ['a range with one end invented', 'Entre 40 y 50 g de proteína.', 'not_supplied'],
    ['a sum the model worked out', 'Comida y cena suman 1.200 kcal.', 'not_supplied'],
    ['a number grouped twice', '1.234.567 kcal.', 'not_supplied'],
    ['a share passed off as a mass: 33 is lunch’s percentage, not a fat figure', 'Lleva 33 g de grasa.', 'not_supplied'],
    ['one nutrient’s figure passed off as another’s: 240 is the carbohydrate target', 'Necesitas 240 g de proteína.', 'not_supplied'],
    ['sugar, which is never supplied, on a 62 g carbohydrate meal', 'Tiene 62 g de azúcar.', 'not_supplied'],
    ['saturated fat, which is never supplied, on a 21 g fat meal', 'Son 21 g de grasas saturadas.', 'not_supplied'],
    ['a protein share nobody supplied', 'Proteína: 30 %.', 'not_supplied'],
    ['a label-form macro figure nobody supplied, at the end of a sentence', 'Proteína: 52.', 'not_supplied'],
    ['energy spelt out', 'Unas dos mil calorías al día.', 'spelled_out'],
    ['a macro spelt out', 'Veinte gramos de proteína.', 'spelled_out']
  ])('withholds %s', (_case, answer, reason) => {
    expect(figuresAreAllSupplied(answer, SET)).toMatchObject({ ok: false, reason });
  });

  it('names the figure it withheld, for the log line that carries no question', () => {
    expect(figuresAreAllSupplied('Toma 50 g de hidratos.', SET)).toEqual({ figure: '50 g de hidratos', ok: false, reason: 'not_supplied' });
  });

  it('can be asked twice in a row and answers the same, because a global pattern keeps state', () => {
    expect(figuresAreAllSupplied('Unas dos mil calorías.', SET)).toMatchObject({ ok: false });
    expect(figuresAreAllSupplied('Unas dos mil calorías.', SET)).toMatchObject({ ok: false });
  });
});
