import { describe, expect, it } from 'vitest';

import { enGB } from '../../i18n/dictionaries/en-GB';
import { esES } from '../../i18n/dictionaries/es-ES';
import { PASSWORD_LONG_LENGTH, passwordMeterHint, passwordMeterLevel, passwordMeterMissing, readPasswordMeter } from './passwordMeter';

describe('readPasswordMeter', () => {
  it('starts empty, with nothing filled', () => {
    expect(readPasswordMeter(0)).toEqual({ fill: 0, missing: 12, step: 'empty' });
  });

  it('counts down to the minimum', () => {
    expect(readPasswordMeter(1)).toMatchObject({ missing: 11, step: 'short' });
    expect(readPasswordMeter(11)).toMatchObject({ missing: 1, step: 'short' });
  });

  it('is enough at the minimum and long from a phrase on', () => {
    expect(readPasswordMeter(12)).toMatchObject({ missing: 0, step: 'enough' });
    expect(readPasswordMeter(PASSWORD_LONG_LENGTH - 1)).toMatchObject({ step: 'enough' });
    expect(readPasswordMeter(PASSWORD_LONG_LENGTH)).toMatchObject({ step: 'long' });
  });

  it('advances the bar with every character and stops at full', () => {
    const fills = [0, 5, 11, 12, 19, 20].map(length => readPasswordMeter(length).fill);

    expect(fills).toEqual([...fills].sort((a, b) => a - b));
    expect(new Set(fills).size).toBe(fills.length);
    expect(readPasswordMeter(PASSWORD_LONG_LENGTH).fill).toBe(1);
    expect(readPasswordMeter(128).fill).toBe(1);
  });
});

/* The level is what the meter says without colour, and its one live region. */
describe('passwordMeterLevel', () => {
  it('says nothing before anything is typed', () => {
    expect(passwordMeterLevel(readPasswordMeter(0), esES)).toBe('');
  });

  it('names the length at each step, in both languages', () => {
    expect([4, 12, PASSWORD_LONG_LENGTH].map(length => passwordMeterLevel(readPasswordMeter(length), esES))).toEqual([
      'Longitud: corta.',
      'Longitud: suficiente.',
      'Longitud: buena.'
    ]);
    expect([4, 12, PASSWORD_LONG_LENGTH].map(length => passwordMeterLevel(readPasswordMeter(length), enGB))).toEqual([
      'Length: too short.',
      'Length: enough.',
      'Length: good.'
    ]);
  });

  it('changes only when the step does, never with each character', () => {
    // A live region that changed per keystroke would be read out per keystroke.
    const levels = Array.from({ length: 30 }, (_, length) => passwordMeterLevel(readPasswordMeter(length), esES));

    expect(new Set(levels.slice(1, 12)).size).toBe(1);
    expect(new Set(levels.slice(12, PASSWORD_LONG_LENGTH)).size).toBe(1);
    expect(new Set(levels.slice(PASSWORD_LONG_LENGTH)).size).toBe(1);
  });

  it('never calls a password strong or safe: the API may still refuse it', () => {
    for (const dictionary of [esES, enGB]) {
      for (const length of [4, 12, PASSWORD_LONG_LENGTH]) {
        expect(passwordMeterLevel(readPasswordMeter(length), dictionary)).not.toMatch(/fuerte|segura|strong|safe|secure/i);
      }
    }
  });
});

describe('passwordMeterMissing', () => {
  it('counts the missing characters while short, one in the singular', () => {
    expect(passwordMeterMissing(readPasswordMeter(4), esES)).toBe('Faltan 8 caracteres.');
    expect(passwordMeterMissing(readPasswordMeter(11), esES)).toBe('Falta 1 carácter.');
    expect(passwordMeterMissing(readPasswordMeter(4), enGB)).toBe('8 more characters needed.');
    expect(passwordMeterMissing(readPasswordMeter(11), enGB)).toBe('1 more character needed.');
  });

  it('is gone before anything is typed and from the minimum on', () => {
    expect(passwordMeterMissing(readPasswordMeter(0), esES)).toBeUndefined();
    expect(passwordMeterMissing(readPasswordMeter(12), esES)).toBeUndefined();
  });
});

describe('passwordMeterHint', () => {
  it('says the minimum and that a phrase is best', () => {
    expect(passwordMeterHint(esES)).toBe('Mínimo 12 caracteres. Mejor una frase de varias palabras.');
    expect(passwordMeterHint(enGB)).toBe('At least 12 characters. A phrase of several words is best.');
  });
});
