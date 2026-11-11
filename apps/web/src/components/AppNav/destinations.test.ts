import { describe, expect, it } from 'vitest';

import { currentHref, destinationsFor } from './destinations';
import { enGB } from '../../i18n/dictionaries/en-GB';
import { esES } from '../../i18n/dictionaries/es-ES';

function everywhere() {
  return true;
}

function hrefs(flags: { assistant: boolean; available?: (path: string) => boolean; professional: boolean }) {
  return destinationsFor({ available: everywhere, ...flags }).map(destination => destination.href);
}

describe('destinationsFor', () => {
  it('shows the five a client always has, in the order of the loop', () => {
    expect(hrefs({ assistant: false, professional: false })).toEqual(['/inicio', '/plan', '/compra', '/progreso', '/perfil']);
  });

  it('puts the assistant before the profile while its switch is on', () => {
    expect(hrefs({ assistant: true, professional: false })).toEqual(['/inicio', '/plan', '/compra', '/progreso', '/asistente', '/perfil']);
  });

  it('appends the practice last for a professional, so seven with the assistant on', () => {
    expect(hrefs({ assistant: true, professional: true })).toEqual([
      '/inicio',
      '/plan',
      '/compra',
      '/progreso',
      '/asistente',
      '/perfil',
      '/consulta'
    ]);
  });

  it('keeps offline only what opens', () => {
    const stored = new Set(['/inicio', '/plan', '/compra']);

    expect(hrefs({ assistant: true, available: path => stored.has(path), professional: true })).toEqual(['/inicio', '/plan', '/compra']);
  });

  it('names every destination in both languages', () => {
    for (const destination of destinationsFor({ assistant: true, available: everywhere, professional: true })) {
      expect(esES.appNav[destination.label]).toBeTruthy();
      expect(enGB.appNav[destination.label]).toBeTruthy();
    }
  });
});

describe('currentHref', () => {
  const seven = destinationsFor({ assistant: true, available: everywhere, professional: true });

  it.each([
    ['/inicio', '/inicio'],
    ['/plan/historial', '/plan'],
    ['/compra/proxima', '/compra'],
    ['/asistente/abc', '/asistente'],
    ['/consulta/clientes', '/consulta']
  ])('marks exactly one destination on %s', (pathname, expected) => {
    expect(currentHref(pathname, seven)).toBe(expected);
    expect(seven.filter(destination => destination.href === currentHref(pathname, seven))).toHaveLength(1);
  });

  it('marks none on a screen that is no destination', () => {
    expect(currentHref('/check-in', seven)).toBeUndefined();
    expect(currentHref('/onboarding/3', seven)).toBeUndefined();
  });
});
