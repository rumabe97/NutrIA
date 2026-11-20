import { describe, expect, it } from 'vitest';

import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';
import { linkCounts } from './linkCounts';

describe('linkCounts', () => {
  it('says one in the singular and any other count in the plural', () => {
    expect(linkCounts({ active: 1, ended: 2, paused: 0 }, esES.adminProfessionals, String)).toBe('1 activo · 0 en pausa · 2 terminados');
    expect(linkCounts({ active: 0, ended: 1, paused: 1 }, esES.adminProfessionals, String)).toBe('0 activos · 1 en pausa · 1 terminado');
    expect(linkCounts({ active: 1, ended: 1, paused: 3 }, enGB.adminProfessionals, String)).toBe('1 active · 3 paused · 1 ended');
  });
});
