import { describe, expect, it } from 'vitest';

import { FOOD_GROUP_SLUGS } from 'core/domain/MealFit';
import { LEGUME_RULES, legumeCheck, legumeIndex, legumeKind, pulseKind } from 'core/domain/Variety';

function dish(...items: [string, number][]) {
  return { ingredients: items.map(([slug, grams]) => ({ grams, slug })) };
}

describe('legumeKind', () => {
  it('names a dish by its legume, whatever the tin or the cooking', () => {
    expect(legumeKind(dish(['garbanzos-cocidos', 200], ['espinaca', 100]))).toBe('garbanzos');
    expect(legumeKind(dish(['garbanzos-secos', 70]))).toBe('garbanzos');
    expect(legumeKind(dish(['cocido-madrileno-en-lata', 300]))).toBe('garbanzos');
    expect(legumeKind(dish(['lentejas-rojas-cocidas', 150]))).toBe('lentejas');
    expect(legumeKind(dish(['fabada-en-lata', 300]))).toBe('alubias-blancas');
    expect(legumeKind(dish(['judiones', 150]))).toBe('alubias-blancas');
    expect(legumeKind(dish(['alubias-negras-cocidas', 150]))).toBe('otras-alubias');
  });

  it('takes the heaviest pulse, and any amount counts, as 0079 judges a pulse', () => {
    expect(legumeKind(dish(['lentejas-cocidas', 60], ['garbanzos-cocidos', 150]))).toBe('garbanzos');
    expect(legumeKind(dish(['alubias-blancas-cocidas', 20], ['pechuga-de-pollo', 150]))).toBe('alubias-blancas');
  });

  it('is null without a pulse: tofu, edamame and hummus are not stewed pulses', () => {
    expect(legumeKind(dish(['pechuga-de-pollo', 150]))).toBeNull();
    expect(legumeKind(dish(['tofu-firme', 150], ['edamame-cocido', 80]))).toBeNull();
  });

  it('knows every row of 0079’s pulses group', () => {
    for (const slug of FOOD_GROUP_SLUGS.pulses) {
      expect(pulseKind(slug), slug).not.toBe(slug);
    }
  });
});

describe('LEGUME_RULES — the same legume three times a fortnight, never on days running', () => {
  it('is pinned: loosening it is the change worth noticing', () => {
    expect(LEGUME_RULES).toEqual({ apart: true, perFortnight: 3 });
  });

  it('reads a placement’s own legume before the pool’s', () => {
    const check = legumeCheck(legumeIndex([{ ...dish(['garbanzos-cocidos', 200]), slug: 'garbanzos' }]));

    expect(check.named?.({ dayIndex: 1, dishSlug: 'not-in-pool', legume: 'lentejas', slot: 'lunch' })).toBe('lentejas');
    expect(check.named?.({ dayIndex: 1, dishSlug: 'garbanzos', slot: 'lunch' })).toBeUndefined();
    expect(check.index.get('garbanzos')).toBe('garbanzos');
  });
});
