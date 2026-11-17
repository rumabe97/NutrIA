import { describe, expect, it } from 'vitest';

import { claimsToAct } from 'core/domain/Assistant';

/** The dishes of a plan, as the context carries them. */
const PLAN = ['Tostada con tomate y aceite', 'Lentejas estofadas con verduras', 'Merluza al horno con patata', 'Yogur con nueces'];

describe('claimsToAct', () => {
  it.each([
    'He cambiado la cena del jueves por merluza.',
    'Listo, lo he cambiado.',
    'Te he preparado un plan nuevo.',
    'I’ve updated your plan.',
    'I have replaced the chicken.',
    'Lunes: lentejas. Martes: pollo. Miércoles: merluza. Jueves: garbanzos. Viernes: arroz.',
    'Día 1: avena. Día 2: tostada. Día 3: yogur. Día 4: fruta. Día 5: huevos.'
  ])('withholds «%s»: it claims a change, or writes a plan', answer => {
    expect(claimsToAct(answer, [])).toBe(true);
    expect(claimsToAct(answer, PLAN)).toBe(true);
  });

  it.each([
    'El jueves tienes lentejas; si no te apetecen, puedes cambiarlas desde la app.',
    'Lunes y martes llevas legumbre, por eso el miércoles no.',
    'Pon 200 g de arroz a hervir 18 minutos.',
    'Esta receta te sirve para comida y cena: guarda la mitad en la nevera.',
    'Para la cena: merluza al vapor con verduras. Para el desayuno de mañana: avena con fruta.',
    'Tres ideas de cena:\n1. Tortilla de calabacín\n2. Crema de calabaza\n3. Ensalada de garbanzos'
  ])('shows «%s»: a mention, a recipe or ideas for a meal, not a menu', answer => {
    expect(claimsToAct(answer, [])).toBe(false);
    expect(claimsToAct(answer, PLAN)).toBe(false);
  });

  describe('a menu of its own (0109)', () => {
    it.each([
      'Desayuno: avena con plátano. Comida: arroz con pollo. Cena: tortilla francesa.',
      '**Desayuno:** avena con plátano\n**Almuerzo:** arroz con pollo\n**Cena:** tortilla francesa',
      '- **Desayuno** — avena con plátano\n- **Comida** — arroz con pollo\n- **Merienda** — fruta\n- **Cena** — tortilla',
      '### Desayuno\n- Avena con plátano\n\n### Comida\n- Arroz con pollo\n\n### Cena\n- Tortilla francesa',
      'Opción 1\nDesayuno: avena\nComida: arroz con pollo\nCena: tortilla\n\nOpción 2\nDesayuno: tostada',
      'Breakfast: porridge with banana\nLunch: chicken and rice\nDinner: omelette'
    ])('withholds a day of meals «%s», with a plan or without one', answer => {
      expect(claimsToAct(answer, [])).toBe(true);
      expect(claimsToAct(answer, PLAN)).toBe(true);
    });

    it.each([
      'Lunes: arroz con pollo. Martes: tortilla francesa.',
      '### Lunes\n- Comida: arroz con pollo\n- Cena: sopa\n\n### Martes\n- Comida: pasta\n- Cena: ensalada',
      'Día 1: avena y fruta\nDía 2: huevos revueltos',
      'Monday: chicken and rice\nTuesday: omelette'
    ])('withholds two days laid out «%s», one meal each or more', answer => {
      expect(claimsToAct(answer, [])).toBe(true);
      expect(claimsToAct(answer, PLAN)).toBe(true);
    });

    it('shows the plan read back: a day of the plan’s own dishes is an explanation', () => {
      const thursday =
        'El jueves tienes:\n- **Desayuno:** Tostada con tomate y aceite, con pan integral\n- **Almuerzo:** Lentejas estofadas con verduras\n- **Cena:** Merluza al horno con patata';

      expect(claimsToAct(thursday, PLAN)).toBe(false);
      // The same words to somebody with no plan are a menu: there is nothing of theirs to read back.
      expect(claimsToAct(thursday, [])).toBe(true);
    });

    it('shows two days of the plan read back, and a dish named with its words in another order', () => {
      expect(claimsToAct('Lunes: Lentejas estofadas con verduras.\nMartes: merluza con patata al horno.', PLAN)).toBe(false);
    });

    it('shows the shares of the day: a heading followed by a percentage or an energy is not a dish', () => {
      expect(claimsToAct('- Desayuno: 20 % del día\n- Almuerzo: 45 %, la comida fuerte\n- Cena: 35 %', PLAN)).toBe(false);
      expect(claimsToAct('Desayuno: 362 kcal\nAlmuerzo: 810 kcal\nCena: 590 kcal', [])).toBe(false);
    });

    it('withholds a day where the dishes are not the plan’s, even beside one that is', () => {
      const mixed = 'Desayuno: Tostada con tomate y aceite\nMedia mañana: fruta\nComida: arroz con pollo\nCena: tortilla francesa';

      expect(claimsToAct(mixed, PLAN)).toBe(true);
    });

    // Known gaps, named so nobody takes the net for a guarantee.
    it('does not see a menu written with no heading', () => {
      expect(claimsToAct('Empieza con avena, a mediodía toma arroz con pollo y de noche una tortilla.', [])).toBe(false);
    });

    it('does not stop the first two meals of a three-meal menu: each sentence is released as it passes', () => {
      expect(claimsToAct('Desayuno: avena con plátano. Comida: arroz con pollo.', [])).toBe(false);
    });
  });
});
