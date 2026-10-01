import { describe, expect, it } from 'vitest';

import { enGB } from '../../i18n/dictionaries/en-GB';
import { esES } from '../../i18n/dictionaries/es-ES';
import { PASSWORD_LONG_LENGTH, passwordMeterText, readPasswordMeter } from './passwordMeter';

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

/* The sentence is what the meter says without colour: every step has one, in both languages. */
describe('passwordMeterText', () => {
  it('says the minimum before anything is typed', () => {
    expect(passwordMeterText(readPasswordMeter(0), esES)).toBe('Mínimo 12 caracteres.');
    expect(passwordMeterText(readPasswordMeter(0), enGB)).toBe('At least 12 characters.');
  });

  it('says how many characters are missing, one in the singular', () => {
    expect(passwordMeterText(readPasswordMeter(4), esES)).toBe('Faltan 8 caracteres.');
    expect(passwordMeterText(readPasswordMeter(11), esES)).toBe(esES.auth.passwordMeterShortOne);
    expect(passwordMeterText(readPasswordMeter(4), enGB)).toBe('8 more characters needed.');
    expect(passwordMeterText(readPasswordMeter(11), enGB)).toBe(enGB.auth.passwordMeterShortOne);
  });

  it('says when the length is enough, and when it is long', () => {
    expect(passwordMeterText(readPasswordMeter(12), esES)).toBe(esES.auth.passwordMeterEnough);
    expect(passwordMeterText(readPasswordMeter(PASSWORD_LONG_LENGTH), esES)).toBe(esES.auth.passwordMeterLong);
    expect(passwordMeterText(readPasswordMeter(12), enGB)).toBe(enGB.auth.passwordMeterEnough);
    expect(passwordMeterText(readPasswordMeter(PASSWORD_LONG_LENGTH), enGB)).toBe(enGB.auth.passwordMeterLong);
  });

  it('gives each step its own sentence', () => {
    const sentences = [0, 4, 11, 12, PASSWORD_LONG_LENGTH].map(length => passwordMeterText(readPasswordMeter(length), esES));

    expect(new Set(sentences).size).toBe(sentences.length);
  });
});
