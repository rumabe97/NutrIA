import { describe, expect, it } from 'vitest';

import { clinicalRefusal } from 'core/domain/Assistant';

describe('clinicalRefusal', () => {
  it.each([
    ['¿Qué dosis de vitamina D tomo?', 'dose'],
    ['¿Cuántas unidades de insulina me pongo?', 'medication'],
    ['Tomo metformina, ¿afecta al plan?', 'medication'],
    ['Estoy embarazada, ¿puedo seguir el plan?', 'pregnancy'],
    ['I am breastfeeding, is this enough?', 'pregnancy'],
    ['Creo que tengo bulimia', 'eating_disorder'],
    ['Soy diabético, ¿cuántos hidratos?', 'condition'],
    ['Estoy en diálisis', 'condition'],
    ['¿Qué papilla le doy al bebé?', 'child'],
    ['Mi hijo de dos años no come verdura', 'child']
  ])('refuses «%s» before any call, as %s', (question, category) => {
    expect(clinicalRefusal(question)).toBe(category);
  });

  /**
   * Nutrition questions that look clinical to a careless lexicon. A recipe has
   * millilitres, a label has milligrams, coeliac disease is the one condition
   * the product serves, and a child in a sentence is not a child being fed.
   */
  it.each([
    'Dame una receta para mis hijos',
    '¿Cuántos mg de sodio tiene el jamón?',
    'Pon 200 ml de leche',
    'Soy celíaco, ¿qué pan puedo tomar?',
    '¿El azúcar causa cáncer?',
    'Una gota de aceite'
  ])('lets «%s» through to the label', question => {
    expect(clinicalRefusal(question)).toBeNull();
  });

  /**
   * Known gaps, kept as tests so they cannot be forgotten: a lexicon reads
   * spelling, and these say the same thing in other words. The label is what
   * catches them, and the figure check what catches what it misses.
   */
  it.each(['Mi azúcar en sangre está alta', 'Tomo algo para el tiroides', 'Me pincho por las noches'])(
    'does not catch the paraphrase «%s» — the label must',
    question => {
      expect(clinicalRefusal(question)).toBeNull();
    }
  );
});
