import { describe, expect, it } from 'vitest';

import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';
import { professionalLabel, withProfessional } from './professionalName';

const UNNAMED = [
  ['es-ES', esES.care.professionalUnnamed],
  ['en-GB', enGB.care.professionalUnnamed]
] as const;

/*
 * PRD 025: when the practitioner's account name may not be shown the API sends
 * `professionalName: null`, and the client reads the approved neutral words in its place.
 */
describe('professionalLabel', () => {
  it('shows the name when there is one', () => {
    expect(professionalLabel('Ana Pérez', 'tu profesional')).toBe('Ana Pérez');
  });

  it.each(UNNAMED)('shows the neutral words, capitalised, for a null name in %s', (_locale, unnamed) => {
    expect(professionalLabel(null, unnamed)).toBe(unnamed.charAt(0).toUpperCase() + unnamed.slice(1));
  });
});

describe('withProfessional', () => {
  it('fills the name when there is one', () => {
    expect(withProfessional('Tu enlace con {professional} ha terminado', 'Ana Pérez', 'tu profesional')).toBe('Tu enlace con Ana Pérez ha terminado');
  });

  it('fills the neutral words for a null name, capitalised only where they open a sentence', () => {
    expect(withProfessional('{professional} ya no está. A {professional} solo le consta. ¿Y {email}?', null, 'tu profesional', { email: 'x' })).toBe(
      'Tu profesional ya no está. A tu profesional solo le consta. ¿Y x?'
    );
  });

  it.each(UNNAMED)('leaves no placeholder in any sentence a client reads, in %s', (locale, unnamed) => {
    const care = locale === 'es-ES' ? esES.care : enGB.care;
    const health = locale === 'es-ES' ? esES.health : enGB.health;

    for (const template of [
      care.illnessEndedTitle,
      care.illnessEndedBody,
      care.illnessEndedBadgeBody,
      care.endConfirmTitle,
      health.illnessLinkWarning
    ]) {
      const line = withProfessional(template, null, unnamed, { email: 'x' });

      expect(line).not.toMatch(/\{\w+\}/);
      expect(line).toContain(unnamed.slice(1));
      // No sentence starts lower-case.
      expect(line).not.toMatch(/(^|[.!?]\s+)\p{Ll}/u);
    }
  });
});
