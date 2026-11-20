import { interpolate } from './format';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { LinkCounts } from 'core/controllers/Professional';

/**
 * A practice's links counted by status, as the console says them: «1 activo · 0 en
 * pausa · 2 terminados» — each count with its own singular or plural, never «1 activos».
 */
export function linkCounts(links: LinkCounts, t: Dictionary['adminProfessionals'], number: (value: number) => string): string {
  return (['active', 'paused', 'ended'] as const)
    .map(status => interpolate(t.links[status][links[status] === 1 ? 'one' : 'other'], { count: number(links[status]) }))
    .join(' · ');
}
