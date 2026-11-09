import { describe, expect, it } from 'vitest';

import { claimsToAct } from 'core/domain/Assistant';

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
    expect(claimsToAct(answer)).toBe(true);
  });

  it.each([
    'El jueves tienes lentejas; si no te apetecen, puedes cambiarlas desde la app.',
    'Lunes y martes llevas legumbre, por eso el miércoles no.',
    'Pon 200 g de arroz a hervir 18 minutos.'
  ])('shows «%s»: a mention, not a change or a plan', answer => {
    expect(claimsToAct(answer)).toBe(false);
  });
});
